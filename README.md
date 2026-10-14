# Pilas y colas interactivas (Flask + Bootstrap + JS)

Apila números, nombres y fotos tomadas con la cámara. También administra una cola FIFO independiente para números y nombres.

## Estructura
```
pila_app/
├── app.py              rutas de Flask
├── cola.py             lógica de la cola FIFO
├── pila.py             lógica de la pila
├── requirements.txt
├── templates/
│   └── index.html      interfaz (Bootstrap)
└── static/
    └── js/
        └── app.js      comportamiento (fetch, cámara, dibujo)
```

## Ejecutar
```
python -m pip install -r requirements.txt
python app.py
```
Abre http://127.0.0.1:5000 (necesita internet para cargar Bootstrap).

La sección **Cola FIFO** permite encolar números, nombres e imágenes, consultar el frente y desencolar en orden de llegada. Se muestra horizontalmente, de izquierda a derecha. Después de tomar o subir una foto puedes guardarla en la pila, la cola o ambas. La cola está separada de la pila y, al igual que esta, se conserva en memoria mientras el servidor está activo.

## Cámara
El navegador solo permite la cámara en http://127.0.0.1:5000 o http://localhost:5000
(o en https). Si abres la página desde otra IP, usa el botón de subir imagen.
Las fotos se guardan en la memoria del servidor y se pierden al reiniciarlo.
