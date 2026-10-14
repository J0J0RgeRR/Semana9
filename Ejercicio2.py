# Crear un menu: aplicar caja, despilar, mostrar tope, mostrar pila, salir
# no aceptar códigos vacíos y multiplicidad de datos
# Mostrar cantidad de cajas y validar pila vacía

pila = []


def apilar():
    caja = input("Ingrese el código de la caja: ").strip()
    if caja == "":
        print("No se aceptan códigos vacíos.")
        return
    pila.append(caja)
    print(f"Caja '{caja}' agregada.")
    print(f"Cantidad de cajas: {len(pila)}")


def despilar():
    if not pila:
        print("La pila está vacía.")
        return
    caja = pila.pop()
    print(f"Caja retirada: {caja}")
    print(f"Cantidad de cajas: {len(pila)}")


def mostrar_tope():
    if not pila:
        print("La pila está vacía.")
        return
    print(f"Tope de la pila: {pila[-1]}")


def mostrar_pila():
    if not pila:
        print("La pila está vacía.")
        return
    print("Contenido de la pila:", pila)


def menu():
    while True:
        print("\n===== MENU =====")
        print("1. Aplicar caja")
        print("2. Despilar")
        print("3. Mostrar tope")
        print("4. Mostrar pila")
        print("5. Salir")

        opcion = input("Seleccione una opción: ").strip()

        if opcion == "1":
            apilar()
        elif opcion == "2":
            despilar()
        elif opcion == "3":
            mostrar_tope()
        elif opcion == "4":
            mostrar_pila()
        elif opcion == "5":
            print("Saliendo del programa...")
            break
        else:
            print("Opción inválida. Intente nuevamente.")


menu()

