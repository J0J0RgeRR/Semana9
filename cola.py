from collections import deque
import uuid

import pila


queue = deque()
photos = {}
photo_count = 0


def enqueue_many(raw):
    values = [pila.parse_value(part) for part in raw.split(",") if part.strip()]
    if not values:
        return False, "Escribe al menos un valor para encolar."
    queue.extend(values)
    message = "Se encoló: " + ", ".join(map(str, values)) + "."
    return True, message


def dequeue():
    if not queue:
        return False, "La cola está vacía."
    value = queue.popleft()
    if pila.is_photo(value):
        photos.pop(value["id"], None)
    return True, f"Se desencoló: {pila.label_of(value)}."


def front():
    if not queue:
        return False, "La cola está vacía."
    return True, f"El frente de la cola es: {pila.label_of(queue[0])}."


def enqueue_photo(data):
    global photo_count
    if not data:
        return False, "No se recibió ninguna foto."
    if len(data) > pila.MAX_PHOTO_BYTES:
        return False, "La foto es demasiado grande (máximo 1 MB)."
    if not data.startswith(b"\xff\xd8\xff"):
        return False, "La foto debe ser una imagen JPEG."

    photo_count += 1
    item = {
        "kind": "photo",
        "id": uuid.uuid4().hex,
        "label": f"Foto cola {photo_count}",
    }
    photos[item["id"]] = data
    queue.append(item)
    return True, f"Se encoló: {item['label']}."
