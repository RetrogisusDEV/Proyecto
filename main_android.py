import os
from kivymd.app import MDApp
from kivymd.uix.screen import MDScreen
from kivymd.uix.webview import MDWebView
from kivy.utils import platform

# --- Clase principal de la aplicación KivyMD ---
class AndroidApp(MDApp):
    """
    Clase principal de la aplicación KivyMD que carga un WebView
    al iniciar.
    """
    
    def build(self):
        """
        Construye la interfaz de la aplicación.
        Se establece un tema y se devuelve una pantalla raíz vacía,
        ya que el WebView ocupará toda la vista.
        """
        # Establecer el tema de la aplicación (opcional, pero recomendado)
        self.theme_cls.theme_style = "Dark"  # O "Light"
        self.theme_cls.primary_palette = "Blue"  # Color principal

        # Devolvemos una pantalla base. El WebView se superpondrá a esto.
        return MDScreen()

    def on_start(self):
        """
        Este método se llama después de que la app se haya construido.
        Es el lugar ideal para inicializar el MDWebView.
        """
        # Solo intentar cargar el WebView si estamos en Android
        if platform != 'android':
            print("MDWebView solo está disponible en Android.")
            # Aquí podrías mostrar una etiqueta de error o cerrar la app.
            return

        try:
            # Crear la instancia del WebView con la URL del archivo local
            self.webview = MDWebView(
                url=self.get_html_path(),
                enable_javascript=True  # Habilitar JavaScript es crucial para Firebase
            )
            
            # Vincular eventos para manejar el ciclo de vida del WebView
            self.webview.bind(
                on_page_finished=self.on_page_finished,
                on_close=self.on_webview_close
            )
        except Exception as e:
            print(f"Error al inicializar MDWebView: {e}")
            # Esto puede ocurrir si falta el componente WebView del sistema Android.

    def on_page_finished(self, *args):
        """Se ejecuta cuando la página ha terminado de cargar."""
        print("Página cargada exitosamente en WebView.")

    def on_webview_close(self, *args):
        """Se ejecuta cuando el usuario cierra el WebView (ej. con el botón 'atrás')."""
        print("WebView cerrado por el usuario.")
        self.stop()  # Cierra la aplicación

    def get_html_path(self):
        """
        Devuelve la ruta absoluta al archivo index.html formateada como una URL.
        """
        base_dir = os.path.dirname(os.path.abspath(__file__))
        html_file = os.path.join(base_dir, "index.html")
        return f'file://{html_file}'

# --- Punto de entrada principal ---
if __name__ == "__main__":
    AndroidApp().run()