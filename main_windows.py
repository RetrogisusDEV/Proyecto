from bottle import debug
import webview
import os
import sys


def start_windows_app():

    base_dir = os.path.dirname(os.path.abspath(__file__))
    html_path = os.path.join(base_dir, "src/index.html")

    if not os.path.exists(html_path):
        print(f"Error: No se encuentra el archivo 'index.html' en la ruta: {html_path}")
        return

    webview.create_window(
        "App Nodos",
        html_path,
        width=1024,
        height=700,
        min_size=(450, 450),
        resizable=True,
    )

    webview.start(debug=True)


if __name__ == "__main__":
    if sys.platform.startswith("win"):
        start_windows_app()
