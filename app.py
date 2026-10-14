from io import BytesIO

from flask import Flask, jsonify, render_template, request, send_file

import pila
import cola


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = pila.MAX_PHOTO_BYTES + 64 * 1024


def state_response(ok=True, message="", highlight=None, photo=None):
    data = {
        "ok": ok,
        "message": message,
        "stack": list(pila.stack),
        "capacity": pila.capacity,
        "history": list(pila.history),
        "highlight": highlight or [],
    }
    if photo is not None:
        data["photo"] = photo
    return jsonify(data)


def queue_response(ok=True, message=""):
    return jsonify(
        {
            "ok": ok,
            "message": message,
            "queue": list(cola.queue),
        }
    )


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/state")
def get_state():
    return state_response()


@app.get("/api/queue")
def get_queue():
    return queue_response()


@app.post("/api/queue/enqueue")
def enqueue_items():
    data = request.get_json(silent=True)
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, str):
        return queue_response(False, "Escribe al menos un valor para encolar.")
    ok, message = cola.enqueue_many(items)
    return queue_response(ok, message)


@app.post("/api/queue/dequeue")
def dequeue_item():
    ok, message = cola.dequeue()
    return queue_response(ok, message)


@app.get("/api/queue/front")
def get_queue_front():
    ok, message = cola.front()
    return queue_response(ok, message)


@app.post("/api/capacity")
def create_capacity():
    data = request.get_json(silent=True)
    capacity = data.get("capacity") if isinstance(data, dict) else None
    ok, message = pila.set_capacity(capacity)
    return state_response(ok, message)


@app.post("/api/push")
def push_items():
    data = request.get_json(silent=True)
    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, str):
        return state_response(False, "Escribe al menos un valor (número o nombre).")
    ok, message = pila.push_many(items)
    return state_response(ok, message)


@app.post("/api/pop")
def pop_item():
    ok, message = pila.pop_stack()
    return state_response(ok, message)


@app.get("/api/peek")
def peek_item():
    ok, message = pila.peek()
    photo = pila.stack[-1] if ok and pila.is_photo(pila.stack[-1]) else None
    return state_response(ok, message, photo=photo)


@app.post("/api/duplicate")
def duplicate_item():
    ok, message = pila.duplicate_top()
    return state_response(ok, message)


@app.post("/api/reverse")
def reverse_items():
    ok, message = pila.reverse_stack()
    return state_response(ok, message)


@app.post("/api/clear")
def clear_items():
    ok, message = pila.clear_stack()
    return state_response(ok, message)


@app.post("/api/search")
def search_items():
    data = request.get_json(silent=True)
    value = data.get("value") if isinstance(data, dict) else None
    if not isinstance(value, str):
        return state_response(False, "Escribe el valor a buscar.")
    ok, message, positions = pila.search_value(value)
    return state_response(ok, message, highlight=positions)


@app.post("/api/balance")
def check_balance():
    data = request.get_json(silent=True)
    text = data.get("text") if isinstance(data, dict) else None
    if not isinstance(text, str):
        return state_response(False, "Escribe una expresión para verificar.")
    ok, message = pila.check_balance(text)
    return state_response(ok, message)


@app.post("/api/photo")
def push_photo():
    upload = request.files.get("photo")
    photo_bytes = upload.read() if upload is not None else b""
    target = request.form.get("target", "stack")
    if target not in {"stack", "queue", "both"}:
        ok, message = False, "Elige guardar la foto en la pila, la cola o ambas."
    elif target in {"stack", "both"} and pila.capacity == 0:
        ok, message = False, "Primero crea una pila para guardar la foto en ella."
    elif target in {"stack", "both"} and pila.is_full():
        ok, message = False, "La pila está llena; no se guardó la foto."
    elif target in {"stack", "both"}:
        ok, message = pila.push_photo(photo_bytes)
        if ok and target == "both":
            queue_ok, queue_message = cola.enqueue_photo(photo_bytes)
            if queue_ok:
                message = f"{message} También {queue_message[0].lower() + queue_message[1:]}"
            else:
                pila.pop_stack()
                ok, message = False, queue_message
    else:
        ok, message = cola.enqueue_photo(photo_bytes)

    data = state_response(ok, message).get_json()
    data["queue"] = list(cola.queue)
    return jsonify(data)


@app.get("/foto/<photo_id>")
def get_photo(photo_id):
    photo_bytes = pila.photos.get(photo_id)
    if photo_bytes is None:
        photo_bytes = cola.photos.get(photo_id)
    if photo_bytes is None:
        return "No se encontró la foto.", 404
    return send_file(BytesIO(photo_bytes), mimetype="image/jpeg")


@app.errorhandler(413)
def request_too_large(_error):
    return state_response(
        False, f"La foto es demasiado grande (máximo {pila.MAX_PHOTO_BYTES // 1_000_000} MB)."
    ), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
