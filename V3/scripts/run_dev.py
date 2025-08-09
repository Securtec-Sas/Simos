import sys
import time
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import subprocess
import os

# Configuración del logging para este script
logging.basicConfig(level=logging.INFO,
                    format='[%(asctime)s] [%(levelname)s] %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')

class ChangeHandler(FileSystemEventHandler):
    """Manejador de eventos para cambios en el sistema de archivos."""
    def __init__(self, command):
        self.command = command
        self.process = None
        self.start_process()

    def start_process(self):
        """Inicia el subproceso."""
        if self.process:
            logging.info("Deteniendo proceso existente...")
            self.process.terminate()
            self.process.wait()

        logging.info(f"Iniciando comando: {' '.join(self.command)}")
        # Usar Popen para no bloquear y poder manejar el proceso
        self.process = subprocess.Popen(self.command, shell=False)

    def on_any_event(self, event):
        """Se activa con cualquier evento del sistema de archivos."""
        if event.is_directory:
            return

        # Reiniciar solo si es un archivo Python
        if event.src_path.endswith('.py'):
            logging.info(f"Cambio detectado en: {event.src_path}. Reiniciando servidor V3...")
            self.start_process()

def main():
    path = os.path.dirname(os.path.abspath(__file__))
    command = [sys.executable, os.path.join(path, 'start_v3.py')]

    logging.info(f"Vigilando cambios en el directorio: {path}")

    event_handler = ChangeHandler(command)
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logging.info("Deteniendo observador y proceso...")
        observer.stop()
        if event_handler.process:
            event_handler.process.terminate()
            event_handler.process.wait()

    observer.join()
    logging.info("Script de vigilancia finalizado.")

if __name__ == "__main__":
    main()
