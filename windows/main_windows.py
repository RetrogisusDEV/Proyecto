import webview
import os
import sys

# --- Función para iniciar la aplicación en Windows ---
def start_windows_app():
    """
    Crea y muestra la ventana de la aplicación para Windows usando pywebview.
    """
    # Ruta absoluta al archivo index.html para asegurar que siempre se encuentre
    base_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(base_dir, "index.html")

    # Verifica si el archivo HTML existe antes de intentar cargarlo
    if not os.path.exists(html_path):
        print(f"Error: No se encuentra el archivo 'index.html' en la ruta: {html_path}")
        return

    # Crear la ventana de la aplicación
    webview.create_window(
        "App Nodos",
        html_path,
        width=1024,
        height=700,
        min_size=(450, 450),
        resizable=True,
    )
    
    # Iniciar el bucle de eventos de la aplicación
    webview.start()

# --- Punto de entrada principal ---
if __name__ == "__main__":
    # Asegurarse de que solo se ejecute en plataformas Windows
    if sys.platform.startswith("win"):
        start_windows_app()
    else:
        print("Este script está diseñado para ejecutarse solo en Windows.")
        print("Para otros sistemas, usa el script correspondiente (ej. main_android.py).")