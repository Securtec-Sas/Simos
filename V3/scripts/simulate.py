#!/usr/bin/env python3
# Simos/V3/simulate.py

"""
Script para ejecutar simulación de trading en vivo.
Uso: python simulate.py [opciones]
"""

import asyncio
import argparse
import logging
import sys
import os
import signal
from datetime import datetime
import json

# Add the parent directory (V3) to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.ai_model import ArbitrageAIModel
from core.simulation_engine import SimulationEngine
from adapters.persistence.data_persistence import DataPersistence
from shared.utils import setup_logging

class SimulationController:
    def __init__(self, simulation_engine, logger):
        self.simulation_engine = simulation_engine
        self.logger = logger
        self.shutdown_event = asyncio.Event()
        
    def signal_handler(self, signum, frame):
        self.logger.info(f"Señal recibida: {signum}. Deteniendo simulación...")
        self.simulation_engine.stop_simulation()
        self.shutdown_event.set()

async def main():
    parser = argparse.ArgumentParser(description='Ejecutar simulación de trading en vivo')
    parser.add_argument('--duration', type=int, default=60,
                       help='Duración de la simulación en minutos (default: 60)')
    parser.add_argument('--operations-per-minute', type=float, default=0.5,
                       help='Operaciones por minuto (default: 0.5)')
    parser.add_argument('--initial-balance', type=float, default=1000.0,
                       help='Balance inicial para la simulación (default: 1000 USDT)')
    parser.add_argument('--model-path', type=str, default=None,
                       help='Ruta del modelo entrenado a usar')
    parser.add_argument('--export-results', type=str, default=None,
                       help='Archivo donde exportar los resultados')
    parser.add_argument('--log-level', type=str, default='INFO',
                       choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                       help='Nivel de logging (default: INFO)')
    parser.add_argument('--market-volatility', type=float, default=0.1,
                       help='Factor de volatilidad del mercado 0-1 (default: 0.1)')
    parser.add_argument('--time-acceleration', type=float, default=1.0,
                       help='Factor de aceleración temporal (default: 1.0)')
    
    args = parser.parse_args()
    
    # Configurar logging
    logger = setup_logging(args.log_level, 'logs/simulation.log')
    logger.info("=== INICIANDO SIMULACIÓN EN VIVO ===")
    logger.info(f"Configuración: {vars(args)}")
    
    try:
        # Inicializar componentes
        data_persistence = DataPersistence()
        ai_model = ArbitrageAIModel(args.model_path)
        simulation_engine = SimulationEngine(ai_model, data_persistence)
        
        # Configurar simulación
        simulation_config = {
            'initial_balance': args.initial_balance,
            'market_volatility': args.market_volatility,
            'time_acceleration': args.time_acceleration
        }
        simulation_engine.update_simulation_config(simulation_config)
        
        # Verificar estado del modelo
        if ai_model.is_trained:
            logger.info("Usando modelo entrenado para decisiones")
        else:
            logger.warning("Modelo no entrenado. Usando lógica básica de decisiones")
        
        # Configurar controlador de señales
        controller = SimulationController(simulation_engine, logger)
        signal.signal(signal.SIGINT, controller.signal_handler)
        signal.signal(signal.SIGTERM, controller.signal_handler)
        
        logger.info(f"Iniciando simulación por {args.duration} minutos...")
        logger.info(f"Operaciones por minuto: {args.operations_per_minute}")
        logger.info(f"Balance inicial: {args.initial_balance} USDT")
        
        # Ejecutar simulación
        start_time = datetime.now()
        
        # Crear tarea de simulación
        simulation_task = asyncio.create_task(
            simulation_engine.run_live_simulation(
                duration_minutes=args.duration,
                operations_per_minute=args.operations_per_minute
            )
        )
        
        # Crear tarea de monitoreo
        monitor_task = asyncio.create_task(
            monitor_simulation(simulation_engine, logger, controller.shutdown_event)
        )
        
        # Esperar a que termine la simulación o se reciba señal de parada
        done, pending = await asyncio.wait(
            [simulation_task, monitor_task, asyncio.create_task(controller.shutdown_event.wait())],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancelar tareas pendientes
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        # Obtener resultados
        if simulation_task.done() and not simulation_task.cancelled():
            simulation_results = simulation_task.result()
        else:
            # Simulación interrumpida, obtener estado actual
            simulation_results = simulation_engine.get_simulation_status()
        
        end_time = datetime.now()
        duration_actual = (end_time - start_time).total_seconds() / 60
        
        # Mostrar resultados
        logger.info("=== RESULTADOS DE LA SIMULACIÓN ===")
        
        if 'error' in simulation_results:
            logger.error(f"Error en simulación: {simulation_results['error']}")
            return 1
        
        stats = simulation_results.get('stats', simulation_results)
        
        initial_balance = simulation_config['initial_balance']
        final_balance = simulation_results.get('final_balance', initial_balance)
        total_operations = stats.get('total_operations', 0)
        successful_operations = stats.get('successful_operations', 0)
        total_profit = stats.get('total_profit_usdt', 0)
        roi_percentage = simulation_results.get('roi_percentage', 0)
        win_rate = simulation_results.get('win_rate', 0)
        
        logger.info(f"Duración real: {duration_actual:.2f} minutos")
        logger.info(f"Balance inicial: {initial_balance:.2f} USDT")
        logger.info(f"Balance final: {final_balance:.2f} USDT")
        logger.info(f"Ganancia total: {total_profit:.2f} USDT")
        logger.info(f"ROI: {roi_percentage:.2f}%")
        logger.info(f"Operaciones totales: {total_operations}")
        logger.info(f"Operaciones exitosas: {successful_operations}")
        logger.info(f"Tasa de éxito: {win_rate:.2f}%")
        
        if total_operations > 0:
            avg_profit = total_profit / total_operations
            operations_per_minute_actual = total_operations / duration_actual
            logger.info(f"Ganancia promedio por operación: {avg_profit:.4f} USDT")
            logger.info(f"Operaciones por minuto (real): {operations_per_minute_actual:.2f}")
        
        # Exportar resultados
        if args.export_results:
            export_data = {
                'simulation_config': vars(args),
                'simulation_results': simulation_results,
                'model_info': ai_model.get_model_info(),
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'duration_minutes': duration_actual,
                'summary': {
                    'initial_balance': initial_balance,
                    'final_balance': final_balance,
                    'roi_percentage': roi_percentage,
                    'total_operations': total_operations,
                    'win_rate': win_rate,
                    'total_profit': total_profit
                }
            }
            
            await simulation_engine.export_simulation_results(args.export_results)
            
            # También guardar resumen detallado
            json_file = args.export_results.replace('.json', '_detailed.json') if args.export_results.endswith('.json') else args.export_results + '_detailed.json'
            with open(json_file, 'w') as f:
                json.dump(export_data, f, indent=2, default=str)
            
            logger.info(f"Resultados exportados a: {args.export_results}")
            logger.info(f"Resumen detallado en: {json_file}")
        
        logger.info("=== SIMULACIÓN COMPLETADA ===")
        return 0
        
    except Exception as e:
        logger.error(f"Error durante simulación: {e}")
        return 1

async def monitor_simulation(simulation_engine, logger, shutdown_event):
    """Monitorea el progreso de la simulación."""
    try:
        while not shutdown_event.is_set():
            await asyncio.sleep(30)  # Actualizar cada 30 segundos
            
            if not simulation_engine.is_simulation_running:
                break
            
            status = simulation_engine.get_simulation_status()
            stats = status.get('stats', {})
            
            total_ops = stats.get('total_operations', 0)
            successful_ops = stats.get('successful_operations', 0)
            total_profit = stats.get('total_profit_usdt', 0)
            
            logger.info(f"Estado: {total_ops} operaciones, {successful_ops} exitosas, {total_profit:.2f} USDT ganancia")
            
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error(f"Error en monitoreo: {e}")

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

