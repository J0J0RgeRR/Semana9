const $ = (id) => document.getElementById(id);

const MAX_SIDE = 640;      // lado máximo de la foto en píxeles
const JPEG_QUALITY = 0.75; // calidad JPEG (0 a 1)

let stream = null;     // cámara encendida
let stackReady = false; // ¿ya se creó la pila?
let busy = false;      // temporizador en curso
let pendingPhoto = null;
let photoPreviewUrl = null;

// ---------- Comunicación con Flask ----------
async function call(url, method = "GET", body = null) {
  const options = { method: method, headers: { "Content-Type": "application/json" } };
  if (body) options.body = JSON.stringify(body);
  try {
    const response = await fetch(url, options);
    return await response.json();
  } catch (error) {
    return { ok: false, message: "No se pudo conectar con el servidor." };
  }
}

function sendPhoto(blob) {
  if (!blob) {
    showAlert("No se pudo crear la foto.", false);
    return;
  }
  pendingPhoto = blob;
  photoPreviewUrl = URL.createObjectURL(blob);
  $("preview-foto").src = photoPreviewUrl;
  $("guardar-foto-pila").disabled = !stackReady;
  $("guardar-foto-ambos").disabled = !stackReady;
  bootstrap.Modal.getOrCreateInstance($("modal-destino-foto")).show();
}

async function savePhoto(target) {
  if (!pendingPhoto) return;
  const form = new FormData();
  form.append("photo", pendingPhoto, "foto.jpg");
  form.append("target", target);
  ["guardar-foto-pila", "guardar-foto-cola", "guardar-foto-ambos"]
    .forEach((id) => { $(id).disabled = true; });
  try {
    const response = await fetch("/api/photo", { method: "POST", body: form });
    const data = await response.json();
    if (data.stack) update(data);
    updateQueue(data);
    if (data.ok) bootstrap.Modal.getOrCreateInstance($("modal-destino-foto")).hide();
  } catch (error) {
    showAlert("No se pudo conectar con el servidor.", false);
  } finally {
    $("guardar-foto-pila").disabled = !stackReady;
    $("guardar-foto-cola").disabled = false;
    $("guardar-foto-ambos").disabled = !stackReady;
  }
}

// ---------- Utilidades ----------
const isPhoto = (item) => item !== null && typeof item === "object" && item.kind === "photo";
const labelOf = (item) => (isPhoto(item) ? item.label : String(item));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Interfaz ----------
function showAlert(message, ok) {
  if (!message) return;
  const box = document.createElement("div");
  box.className = "alert alert-dismissible fade show alert-" + (ok ? "success" : "warning");
  box.setAttribute("role", "alert");
  box.textContent = message;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "btn-close";
  close.setAttribute("data-bs-dismiss", "alert");
  close.setAttribute("aria-label", "Cerrar");
  box.append(close);
  $("alerta").replaceChildren(box);
  setTimeout(() => box.remove(), 5000);
}

function openPhoto(item) {
  $("modal-img").src = "/foto/" + item.id;
  $("modal-img").alt = item.label;
  $("modal-titulo").textContent = item.label;
  bootstrap.Modal.getOrCreateInstance($("modal-foto")).show();
}

function buildRow(item, i, stack, highlight) {
  const row = document.createElement("li");
  const isTop = i === stack.length - 1;
  let color = "";
  if (highlight.includes(i)) color = " list-group-item-warning";
  else if (isTop) color = " list-group-item-primary";
  row.className = "list-group-item d-flex justify-content-between align-items-center " +
    (isPhoto(item) ? "py-2" : "py-3") + color;

  const tag = document.createElement("span");
  tag.className = "badge " + (isTop ? "text-bg-primary" : "text-bg-secondary");
  tag.textContent = isTop ? "tope" : "#" + (i + 1);

  if (isPhoto(item)) {
    const open = document.createElement("button");
    open.type = "button";
    open.className = "btn btn-link p-0 d-flex align-items-center gap-3 text-decoration-none text-reset";
    open.setAttribute("aria-label", "Ver " + item.label + " en grande");

    const img = document.createElement("img");
    img.src = "/foto/" + item.id;
    img.alt = item.label;
    img.width = 96;
    img.loading = "lazy";
    img.className = "img-thumbnail";

    const name = document.createElement("span");
    name.className = "fw-semibold";
    name.textContent = item.label;

    open.append(img, name);
    open.addEventListener("click", () => openPhoto(item));
    row.append(open, tag);
  } else {
    const value = document.createElement("span");
    value.className = "fs-5 fw-semibold";
    value.textContent = item;
    row.append(value, tag);
  }
  return row;
}

function renderStack(stack, capacity, highlight) {
  const list = $("pila");
  list.replaceChildren();
  list.style.maxHeight = "28rem";

  if (capacity === 0) {
    const empty = document.createElement("li");
    empty.className = "list-group-item text-body-tertiary py-4";
    empty.textContent = "Crea una pila para empezar.";
    list.append(empty);
  }

  // De arriba (tope) hacia abajo (base)
  for (let i = capacity - 1; i >= 0; i--) {
    if (i < stack.length) {
      list.append(buildRow(stack[i], i, stack, highlight));
    } else {
      const slot = document.createElement("li");
      slot.className = "list-group-item text-body-tertiary py-3";
      slot.textContent = "vacío";
      list.append(slot);
    }
  }
}

function renderStats(stack, capacity) {
  const full = capacity > 0 && stack.length === capacity;
  const percent = capacity > 0 ? Math.round((stack.length / capacity) * 100) : 0;

  $("contador").textContent = stack.length + " / " + capacity;
  $("contador").className = "badge " + (full ? "text-bg-danger" : "text-bg-secondary");

  const bar = $("barra");
  bar.style.width = percent + "%";
  bar.className = "progress-bar " + (percent >= 100 ? "bg-danger" : percent >= 70 ? "bg-warning" : "bg-success");
  bar.parentElement.setAttribute("aria-valuenow", percent);

  $("st-elem").textContent = stack.length;
  $("st-libres").textContent = capacity - stack.length;
  $("st-tope").textContent = stack.length ? labelOf(stack[stack.length - 1]) : "—";
}

function renderHistory(history) {
  const list = $("historial");
  list.replaceChildren();
  if (!history.length) {
    const empty = document.createElement("li");
    empty.className = "list-group-item text-body-tertiary";
    empty.textContent = "Aún no hay operaciones.";
    list.append(empty);
    return;
  }
  history.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "list-group-item";
    item.textContent = entry;
    list.append(item);
  });
}

function setControls(enabled) {
  ["valor", "btn-push", "btn-pop", "btn-peek", "btn-dup", "btn-rev", "btn-clear", "valor-buscar", "btn-buscar"]
    .forEach((id) => { $(id).disabled = !enabled; });
}

function refreshCameraButtons() {
  const canShoot = stream !== null && !busy;
  $("btn-foto").disabled = !canShoot;
  $("btn-timer").disabled = !canShoot;
  $("archivo").disabled = busy;
}

function update(data) {
  if (data.stack) {
    stackReady = data.capacity > 0;
    renderStack(data.stack, data.capacity, data.highlight || []);
    renderStats(data.stack, data.capacity);
    renderHistory(data.history || []);
    setControls(stackReady);
    refreshCameraButtons();
    if (data.photo) openPhoto(data.photo); // "Ver tope" con una foto arriba
  }
  showAlert(data.message, data.ok);
}

function updateQueue(data) {
  const queue = Array.isArray(data.queue) ? data.queue : [];
  const list = $("cola");
  list.replaceChildren();
  $("cola-contador").textContent = queue.length + (queue.length === 1 ? " elemento" : " elementos");
  $("btn-desencolar").disabled = queue.length === 0;
  $("btn-frente-cola").disabled = queue.length === 0;

  if (!queue.length) {
    const empty = document.createElement("li");
    empty.className = "list-group-item text-body-tertiary";
    empty.textContent = "La cola está vacía.";
    list.append(empty);
  } else {
    queue.forEach((value, index) => {
      const item = document.createElement("li");
      item.className = "list-group-item d-flex flex-column align-items-center gap-2";
      item.style.minWidth = "9rem";
      if (isPhoto(value)) {
        const open = document.createElement("button");
        open.type = "button";
        open.className = "btn btn-link p-0 text-reset";
        open.setAttribute("aria-label", "Ver " + value.label + " en grande");
        const image = document.createElement("img");
        image.src = "/foto/" + value.id;
        image.alt = value.label;
        image.width = 112;
        image.className = "img-thumbnail";
        open.append(image);
        open.addEventListener("click", () => openPhoto(value));
        item.append(open);
        const label = document.createElement("span");
        label.textContent = value.label;
        item.append(label);
      } else {
        const label = document.createElement("span");
        label.className = "fw-semibold";
        label.textContent = String(value);
        item.append(label);
      }
      if (index === 0) {
        const badge = document.createElement("span");
        badge.className = "badge text-bg-primary";
        badge.textContent = "frente";
        item.append(badge);
      }
      list.append(item);
    });
  }
  showAlert(data.message, data.ok);
}

// ---------- Cámara ----------
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showAlert("Este navegador no permite usar la cámara aquí. Abre la página en http://127.0.0.1:5000 o sube una imagen.", false);
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch (error) {
    stream = null;
    let message = "No se pudo encender la cámara.";
    if (error.name === "NotAllowedError") message = "Permiso de cámara denegado. Permítelo en el candado de la barra de direcciones.";
    if (error.name === "NotFoundError") message = "No se encontró ninguna cámara en este equipo.";
    if (error.name === "NotReadableError") message = "La cámara está siendo usada por otra aplicación.";
    showAlert(message, false);
    return;
  }
  $("video").srcObject = stream;
  $("video").classList.remove("d-none");
  $("camara-vacia").classList.add("d-none");
  $("btn-camara").textContent = "Apagar cámara";
  refreshCameraButtons();
}

function stopCamera() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  $("video").srcObject = null;
  $("video").classList.add("d-none");
  $("camara-vacia").classList.remove("d-none");
  $("btn-camara").textContent = "Encender cámara";
  refreshCameraButtons();
}

// Reduce la imagen y la convierte a JPEG
function toJpeg(source, width, height) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
}

async function shoot() {
  const video = $("video");
  if (!stream || !video.videoWidth) {
    showAlert("La cámara todavía no está lista, espera un segundo.", false);
    return;
  }
  await sendPhoto(await toJpeg(video, video.videoWidth, video.videoHeight));
}

async function shootWithTimer() {
  busy = true;
  refreshCameraButtons();
  for (let s = 3; s > 0; s--) {
    $("btn-timer").textContent = "Foto en " + s + "…";
    await sleep(1000);
  }
  $("btn-timer").textContent = "Foto en 3 s";
  busy = false;
  await shoot();
  refreshCameraButtons();
}

// ---------- Eventos ----------
$("form-capacidad").addEventListener("submit", async (e) => {
  e.preventDefault();
  update(await call("/api/capacity", "POST", { capacity: $("capacidad").value }));
  $("valor").focus();
});

$("form-push").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = await call("/api/push", "POST", { items: $("valor").value });
  update(data);
  if (data.ok) $("valor").value = "";
  $("valor").focus();
});

$("form-encolar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = await call("/api/queue/enqueue", "POST", { items: $("valor-cola").value });
  updateQueue(data);
  if (data.ok) $("valor-cola").value = "";
  $("valor-cola").focus();
});

$("form-buscar").addEventListener("submit", async (e) => {
  e.preventDefault();
  update(await call("/api/search", "POST", { value: $("valor-buscar").value }));
});

$("form-balance").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = await call("/api/balance", "POST", { text: $("texto-balance").value });
  const box = document.createElement("div");
  box.className = "alert mb-0 alert-" + (data.ok ? "success" : "danger");
  box.textContent = data.message;
  $("resultado-balance").replaceChildren(box);
});

$("btn-pop").addEventListener("click", async () => update(await call("/api/pop", "POST")));
$("btn-desencolar").addEventListener("click", async () => updateQueue(await call("/api/queue/dequeue", "POST")));
$("btn-frente-cola").addEventListener("click", async () => updateQueue(await call("/api/queue/front")));
$("guardar-foto-pila").addEventListener("click", () => savePhoto("stack"));
$("guardar-foto-cola").addEventListener("click", () => savePhoto("queue"));
$("guardar-foto-ambos").addEventListener("click", () => savePhoto("both"));
$("btn-peek").addEventListener("click", async () => update(await call("/api/peek")));
$("btn-dup").addEventListener("click", async () => update(await call("/api/duplicate", "POST")));
$("btn-rev").addEventListener("click", async () => update(await call("/api/reverse", "POST")));
$("btn-clear").addEventListener("click", async () => update(await call("/api/clear", "POST")));

$("btn-camara").addEventListener("click", () => (stream ? stopCamera() : startCamera()));
$("btn-foto").addEventListener("click", shoot);
$("btn-timer").addEventListener("click", shootWithTimer);

$("archivo").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const bitmap = await createImageBitmap(file);
    const blob = await toJpeg(bitmap, bitmap.width, bitmap.height);
    await sendPhoto(blob);
  } catch (error) {
    showAlert("No se pudo leer esa imagen. Prueba con un archivo JPG o PNG.", false);
  }
});

$("btn-tema").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.getAttribute("data-bs-theme") === "dark";
  root.setAttribute("data-bs-theme", dark ? "light" : "dark");
  $("btn-tema").textContent = dark ? "Modo oscuro" : "Modo claro";
});

$("modal-destino-foto").addEventListener("hidden.bs.modal", () => {
  pendingPhoto = null;
  $("preview-foto").removeAttribute("src");
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = null;
});

window.addEventListener("beforeunload", stopCamera);

// Estado inicial
call("/api/state").then(update);
call("/api/queue").then(updateQueue);
