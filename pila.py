"""Lógica de la pila (sin Flask). Programación estructurada con funciones.

Cada elemento de la pila puede ser:
  - un número o un texto (nombre)
  - una foto: {"kind": "photo", "id": "...", "label": "Foto 1"}
    (los bytes JPEG se guardan aparte en el diccionario `photos`)
"""
import math
import uuid
from datetime import datetime

MAX_CAPACITY = 50
MAX_TEXT = 40
MAX_PHOTO_BYTES = 1_000_000  # 1 MB por foto
HISTORY_LIMIT = 30

# Estado en memoria
stack = []
capacity = 0  # 0 = pila aún no creada
history = []
photos = {}  # id -> bytes JPEG
photo_count = 0


# ---------- Consultas ----------
def is_empty():
    return len(stack) == 0


def is_full():
    return len(stack) == capacity


def is_photo(item):
    return isinstance(item, dict) and item.get("kind") == "photo"


def label_of(item):
    """Texto para mostrar de cualquier elemento."""
    return item["label"] if is_photo(item) else str(item)


# ---------- Utilidades ----------
def parse_value(text):
    """Convierte a int o float si es número; si no, lo deja como texto."""
    text = text.strip()[:MAX_TEXT]
    try:
        return int(text)
    except ValueError:
        pass
    try:
        number = float(text)
        if math.isfinite(number):
            return number
    except ValueError:
        pass
    return text


def release(item):
    """Libera de la memoria la imagen de un elemento que sale de la pila."""
    if is_photo(item):
        photos.pop(item["id"], None)


def log(message):
    history.insert(0, f"{datetime.now():%H:%M:%S}  {message}")
    del history[HISTORY_LIMIT:]


# ---------- Operaciones (devuelven (ok, mensaje)) ----------
def set_capacity(value):
    global capacity, photo_count
    try:
        value = int(value)
    except (TypeError, ValueError):
        value = 0
    if not 1 <= value <= MAX_CAPACITY:
        return False, f"Escribe un tamaño entero entre 1 y {MAX_CAPACITY}."
    capacity = value
    stack.clear()
    photos.clear()
    photo_count = 0
    message = f"Pila nueva con capacidad para {capacity} elementos."
    log(message)
    return True, message


def push_many(raw):
    """Apila uno o varios valores separados por comas."""
    if capacity == 0:
        return False, "Primero define el tamaño de la pila."
    values = [parse_value(p) for p in raw.split(",") if p.strip()]
    if not values:
        return False, "Escribe al menos un valor (número o nombre)."

    pushed, rejected = [], []
    for value in values:
        if is_full():
            rejected.append(value)
        else:
            stack.append(value)
            pushed.append(value)

    if not pushed:
        return False, "La pila está llena."
    message = "Se apiló: " + ", ".join(map(str, pushed)) + "."
    if rejected:
        message += " No cupieron: " + ", ".join(map(str, rejected)) + "."
    log(message)
    return True, message


def push_photo(data):
    """Apila una foto JPEG recibida como bytes."""
    global photo_count
    if capacity == 0:
        return False, "Primero define el tamaño de la pila."
    if is_full():
        return False, "La pila está llena."
    if not data:
        return False, "No se recibió ninguna foto."
    if len(data) > MAX_PHOTO_BYTES:
        return False, "La foto es demasiado grande (máximo 1 MB)."
    if not data.startswith(b"\xff\xd8\xff"):
        return False, "La foto debe ser una imagen JPEG."

    photo_count += 1
    item = {"kind": "photo", "id": uuid.uuid4().hex, "label": f"Foto {photo_count}"}
    photos[item["id"]] = data
    stack.append(item)
    message = f"Se apiló: {item['label']}."
    log(message)
    return True, message


def pop_stack():
    if is_empty():
        return False, "La pila está vacía."
    item = stack.pop()
    release(item)
    message = f"Se desapiló: {label_of(item)}."
    log(message)
    return True, message


def peek():
    if is_empty():
        return False, "La pila está vacía."
    message = f"El tope de la pila es: {label_of(stack[-1])}."
    log(message)
    return True, message


def duplicate_top():
    if is_empty():
        return False, "La pila está vacía."
    if is_full():
        return False, "La pila está llena, no hay espacio para duplicar."
    top = stack[-1]
    if is_photo(top):
        copy = dict(top, id=uuid.uuid4().hex)
        if not copy["label"].endswith("(copia)"):
            copy["label"] += " (copia)"
        photos[copy["id"]] = photos[top["id"]]
        stack.append(copy)
    else:
        stack.append(top)
    message = f"Se duplicó el tope: {label_of(stack[-1])}."
    log(message)
    return True, message


def reverse_stack():
    if len(stack) < 2:
        return False, "Se necesitan al menos 2 elementos para invertir."
    stack.reverse()
    message = "La pila se invirtió."
    log(message)
    return True, message


def clear_stack():
    if is_empty():
        return False, "La pila ya está vacía."
    total = len(stack)
    for item in stack:
        release(item)
    stack.clear()
    message = f"Se vació la pila ({total} elementos)."
    log(message)
    return True, message


def search_value(text):
    """Devuelve (ok, mensaje, posiciones encontradas)."""
    query = text.strip().lower()
    if not query:
        return False, "Escribe el valor a buscar.", []
    found = [i for i, item in enumerate(stack) if label_of(item).lower() == query]
    if not found:
        return False, f"«{text.strip()}» no está en la pila.", []
    places = ", ".join(
        f"{i + 1}" + (" (tope)" if i == len(stack) - 1 else "") for i in found
    )
    message = f"«{text.strip()}» está en la posición {places} (se cuenta desde la base)."
    log(f"Búsqueda: {text.strip()} (encontrado).")
    return True, message, found


def check_balance(text):
    """Verifica (), [] y {} usando una pila auxiliar."""
    pairs = {")": "(", "]": "[", "}": "{"}
    aux = []
    for pos, char in enumerate(text, start=1):
        if char in pairs.values():
            aux.append((char, pos))
        elif char in pairs:
            if not aux:
                return False, f"El «{char}» de la posición {pos} no tiene apertura."
            if aux[-1][0] != pairs[char]:
                return False, (f"El «{char}» de la posición {pos} no coincide con "
                               f"el «{aux[-1][0]}» de la posición {aux[-1][1]}.")
            aux.pop()
    if aux:
        char, pos = aux[-1]
        return False, f"El «{char}» de la posición {pos} nunca se cerró."
    message = "La expresión está balanceada."
    log("Verificación de paréntesis: expresión balanceada.")
    return True, message
