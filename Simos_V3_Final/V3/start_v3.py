#!/usr/bin/env python3
# Simos/V3/start_v3.py

"""
Script de inicio para V3 con opciones de configuración.
Uso: python start_v3.py [opciones]
"""

import asyncio
import argparse
import sys
import os
import signal
from pathlib import Path

# Agregar el directorio V3 al path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main_v3 import CryptoArbitrageV3
from config_v3 import SIMULATION_MODE

def setup_signal_handlers(app):
    """Configura manejadores de señales para shutdown graceful."""
    def signal_handler(signum, frame):
        print(f"\nSeñal {signum} recibida. Iniciando shutdown graceful...")
        asyncio.create_task(app.shutdown())
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

async def main():
    parser = argparse.ArgumentParser(description='Iniciar Crypto Arbitrage V3')
    parser.add_argument('--simulation', action='store_true',
                       help='Ejecutar en modo simulación')
    parser.add_argument('--config', type=str, default=None,
                       help='Archivo de configuración personalizado')
    parser.add_argument('--log-level', type=str, default='INFO',
                       choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                       help='Nivel de logging')
    parser.add_argument('--port', type=int, default=3002,
                       help='Puerto para el servidor WebSocket de V3')
    parser.add_argument('--auto-train', action='store_true',
                       help='Entrenar modelo automáticamente si no existe')
    parser.add_argument('--training-samples', type=int, default=1000,
                       help='Número de muestras para entrenamiento automático')
    
    args = parser.parse_args()
    
    print("="*60)
    print("CRYPTO ARBITRAGE V3")
    print("="*60)
    print(f"Modo: {'SIMULACIÓN' if args.simulation or SIMULATION_MODE else 'REAL'}")
    print(f"Puerto WebSocket: {args.port}")
    print(f"Nivel de log: {args.log_level}")
    
    # Crear directorios necesarios
    directories = ['logs', 'data', 'models']
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        print(f"Directorio verificado: {directory}/")
    
    try:
        # Crear aplicación
        app = CryptoArbitrageV3()
        
        # Configurar manejadores de señales
        setup_signal_handlers(app)
        
        # Entrenamiento automático si se solicita
        if args.auto_train:
            print("\nVerificando modelo de IA...")
            if not app.ai_model.is_trained:
                print("Modelo no entrenado. Iniciando entrenamiento automático...")
                
                # Generar datos de entrenamiento
                training_data = await app.simulation_engine.generate_training_data(
                    args.training_samples, save_to_file=True
                )
                
                if len(training_data) >= 10:
                    # Entrenar modelo
                    training_results = app.ai_model.train(training_data)
                    print(f"Entrenamiento completado. Precisión: {training_results.get('profitability_accuracy', 0):.4f}")
                else:
                    print("WARNING: No se pudieron generar suficientes datos de entrenamiento")
            else:
                print("Modelo ya entrenado.")
        
        # Inicializar aplicación
        print("\nInicializando componentes...")
        await app.initialize()
        
        # Iniciar aplicación
        print("Iniciando V3...")
        started = await app.start()
        
        if not started:
            print("ERROR: No se pudo iniciar V3")
            return 1
        
        print("\n" + "="*60)
        print("V3 INICIADO CORRECTAMENTE")
        print("="*60)
        print("Presiona Ctrl+C para detener")
        print("="*60)
        
        # Ejecutar aplicación
        await app.run()
        
        return 0
        
    except KeyboardInterrupt:
        print("\nInterrupción recibida. Cerrando...")
        return 0
    except Exception as e:
        print(f"ERROR FATAL: {e}")
        return 1

if __name__ == "__main__":
    # Configurar política de eventos para Windows
    if sys.platform.startswith('win'):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

