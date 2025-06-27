import webview
import threading
import sys
import os

# Ruta absoluta al archivo index.html
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_PATH = os.path.join(BASE_DIR, "index.html")

# Para Android, se recomienda usar Kivy + pywebview
try:
    import kivy
    from kivy.app import App
    from kivy.uix.boxlayout import BoxLayout
    from kivy_garden.xcamera import XCamera
    from kivy.uix.widget import Widget
    from kivy.uix.label import Label
    from kivy.uix.button import Button
    from kivy.uix.floatlayout import FloatLayout
    from kivy.uix.popup import Popup
    from kivy.uix.filechooser import FileChooserIconView
    from kivy.core.window import Window

    # from kivy.uix.webview import WebView as KivyWebView  # Not available in standard Kivy, comment out or replace with a supported widget

    KIVY_AVAILABLE = True
except ImportError:
    KIVY_AVAILABLE = False


def start_pywebview():
    webview.create_window(
        "App Nodos",
        HTML_PATH,
        width=1024,
        height=700,
        min_size=(400, 400),
        resizable=True,
    )
    webview.start()


if __name__ == "__main__":
    if sys.platform.startswith("win"):
        # Windows: solo pywebview
        start_pywebview()
    elif KIVY_AVAILABLE:
        # Android: ejemplo básico usando Kivy + WebView
        class WebApp(App):
            def build(self):
                layout = BoxLayout(orientation="vertical")
                # Kivy does not have a built-in WebView; you may use a Label as a placeholder or integrate a third-party widget
                layout.add_widget(Label(text="WebView is not available."))
                return layout

        WebApp().run()
    else:
        print(
            "Para Android, instala Kivy y kivy.uix.webview. Para Windows, solo pywebview."
        )
