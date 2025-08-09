#!/usr/bin/env python3
"""
Script de prueba para el sistema de simulación V3.
Valida ambas modalidades: Local y Sandbox.
"""

import asyncio
import logging
import json
import time
from datetime import datetime

# Importar componentes de V3
from core.advanced_simulation_engine import AdvancedSimulationEngine, SimulationMode
from core.ai_model import ArbitrageAIModel
from adapters.persistence.data_persistence import DataPersistence
from adapters.exchanges.exchange_manager import ExchangeManager
from shared.utils import get_current_timestamp

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('V3.TestSimulation')

class MockUIBroadcaster:
    """Mock del UI broadcaster para pruebas."""
    
    def __init__(self):
        self.messages = []
    
    async def broadcast_message(self, message):
        self.messages.append(message)
        logger.info(f"UI Message: {message['type']} - {message.get('payload', {})}")

async def test_local_simulation():
    """Prueba la simulación local."""
    logger.info("=== INICIANDO PRUEBA DE SIMULACIÓN LOCAL ===")
    
    try:
        # Inicializar componentes
        ai_model = ArbitrageAIModel()
        data_persistence = DataPersistence()
        exchange_manager = ExchangeManager()
        ui_broadcaster = MockUIBroadcaster()
        
        # Crear motor de simulación
        simulation_engine = AdvancedSimulationEngine(
            ai_model=ai_model,
            data_persistence=data_persistence,
            exchange_manager=exchange_manager,
            ui_broadcaster=ui_broadcaster
        )
        
        # Inicializar
        await simulation_engine.initialize()
        
        # Configuración de prueba
        test_config = {
            'initial_balance': 500.0,
            'time_between_transfers': 1.0,
            'simulation_duration': 60,  # 1 minuto
            'max_concurrent_operations': 2,
            'success_rate': 0.8
        }
        
        # Iniciar simulación local
        result = await simulation_engine.start_simulation(
            mode=SimulationMode.LOCAL,
            config=test_config
        )
        
        if not result['success']:
            logger.error(f"Error iniciando simulación local: {result['message']}")
            return False
        
        logger.info("Simulación local iniciada exitosamente")
        
        # Simular algunas oportunidades de arbitraje
        test_opportunities = [
            {
                'symbol': 'BTC/USDT',
                'symbol_name': 'BTCUSDT',
                'exchange_min_id': 'binance',
                'exchange_max_id': 'okx',
                'price_at_exMin_to_buy_asset': 45000.0,
                'price_at_exMax_to_sell_asset': 45200.0,
                'percentage_difference': '0.44%',
                'timestamp': get_current_timestamp()
            },
            {
                'symbol': 'ETH/USDT',
                'symbol_name': 'ETHUSDT',
                'exchange_min_id': 'okx',
                'exchange_max_id': 'kucoin',
                'price_at_exMin_to_buy_asset': 3000.0,
                'price_at_exMax_to_sell_asset': 3020.0,
                'percentage_difference': '0.67%',
                'timestamp': get_current_timestamp()
            }
        ]
        
        # Procesar oportunidades
        for opportunity in test_opportunities:
            logger.info(f"Procesando oportunidad: {opportunity['symbol']}")
            op_result = await simulation_engine.process_arbitrage_opportunity(opportunity)
            logger.info(f"Resultado: {op_result}")
            
            # Esperar un poco entre oportunidades
            await asyncio.sleep(2)
        
        # Esperar a que se completen las transacciones
        logger.info("Esperando completar transacciones...")
        await asyncio.sleep(10)
        
        # Obtener estado final
        final_status = simulation_engine.get_simulation_status()
        final_summary = await simulation_engine.get_simulation_summary()
        
        logger.info("=== RESULTADOS SIMULACIÓN LOCAL ===")
        logger.info(f"Balance final: {final_summary.get('current_balance', 0):.2f} USDT")
        logger.info(f"Operaciones totales: {final_summary.get('total_operations', 0)}")
        logger.info(f"Operaciones exitosas: {final_summary.get('successful_operations', 0)}")
        logger.info(f"Ganancia total: {final_summary.get('total_profit_usdt', 0):.4f} USDT")
        logger.info(f"ROI: {final_summary.get('roi_percentage', 0):.2f}%")
        
        # Detener simulación
        stop_result = await simulation_engine.stop_simulation()
        logger.info(f"Simulación detenida: {stop_result['success']}")
        
        # Limpiar
        await simulation_engine.cleanup()
        
        logger.info("=== PRUEBA SIMULACIÓN LOCAL COMPLETADA ===")
        return True
        
    except Exception as e:
        logger.error(f"Error en prueba de simulación local: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_sandbox_simulation():
    """Prueba la simulación sandbox."""
    logger.info("=== INICIANDO PRUEBA DE SIMULACIÓN SANDBOX ===")
    
    try:
        # Inicializar componentes
        ai_model = ArbitrageAIModel()
        data_persistence = DataPersistence()
        exchange_manager = ExchangeManager()
        ui_broadcaster = MockUIBroadcaster()
        
        # Crear motor de simulación
        simulation_engine = AdvancedSimulationEngine(
            ai_model=ai_model,
            data_persistence=data_persistence,
            exchange_manager=exchange_manager,
            ui_broadcaster=ui_broadcaster
        )
        
        # Inicializar
        await simulation_engine.initialize()
        
        # Configuración de prueba
        test_config = {
            'initial_balance': 300.0,
            'time_between_transfers': 2.0,
            'simulation_duration': 120,  # 2 minutos
            'max_concurrent_operations': 1,
            'success_rate': 0.9
        }
        
        # Iniciar simulación sandbox
        result = await simulation_engine.start_simulation(
            mode=SimulationMode.SEBO_SANDBOX,
            config=test_config
        )
        
        if not result['success']:
            logger.error(f"Error iniciando simulación sandbox: {result['message']}")
            return False
        
        logger.info("Simulación sandbox iniciada exitosamente")
        
        # Simular una oportunidad de arbitraje
        test_opportunity = {
            'symbol': 'BTC/USDT',
            'symbol_name': 'BTCUSDT',
            'exchange_min_id': 'binance',
            'exchange_max_id': 'okx',
            'price_at_exMin_to_buy_asset': 44800.0,
            'price_at_exMax_to_sell_asset': 45100.0,
            'percentage_difference': '0.67%',
            'timestamp': get_current_timestamp()
        }
        
        # Procesar oportunidad
        logger.info(f"Procesando oportunidad sandbox: {test_opportunity['symbol']}")
        op_result = await simulation_engine.process_arbitrage_opportunity(test_opportunity)
        logger.info(f"Resultado sandbox: {op_result}")
        
        # Esperar a que se complete la transacción
        logger.info("Esperando completar transacción sandbox...")
        await asyncio.sleep(15)  # Las llamadas API toman más tiempo
        
        # Obtener estado final
        final_status = simulation_engine.get_simulation_status()
        final_summary = await simulation_engine.get_simulation_summary()
        
        logger.info("=== RESULTADOS SIMULACIÓN SANDBOX ===")
        logger.info(f"Balance final: {final_summary.get('current_balance', 0):.2f} USDT")
        logger.info(f"Operaciones totales: {final_summary.get('total_operations', 0)}")
        logger.info(f"Operaciones exitosas: {final_summary.get('successful_operations', 0)}")
        logger.info(f"Ganancia total: {final_summary.get('total_profit_usdt', 0):.4f} USDT")
        logger.info(f"ROI: {final_summary.get('roi_percentage', 0):.2f}%")
        
        # Detener simulación
        stop_result = await simulation_engine.stop_simulation()
        logger.info(f"Simulación sandbox detenida: {stop_result['success']}")
        
        # Limpiar
        await simulation_engine.cleanup()
        
        logger.info("=== PRUEBA SIMULACIÓN SANDBOX COMPLETADA ===")
        return True
        
    except Exception as e:
        logger.error(f"Error en prueba de simulación sandbox: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_ai_integration():
    """Prueba la integración con el modelo de IA."""
    logger.info("=== INICIANDO PRUEBA DE INTEGRACIÓN IA ===")
    
    try:
        # Crear modelo de IA
        ai_model = ArbitrageAIModel()
        
        # Datos de prueba para predicción
        test_data = {
            'symbol': 'BTC/USDT',
            'symbol_name': 'BTCUSDT',
            'buy_exchange_id': 'binance',
            'sell_exchange_id': 'okx',
            'current_price_buy': 45000.0,
            'current_price_sell': 45300.0,
            'investment_usdt': 100.0,
            'estimated_buy_fee': 0.001,
            'estimated_sell_fee': 0.001,
            'estimated_transfer_fee': 1.0,
            'current_balance': 1000.0,
            'timestamp': get_current_timestamp()
        }
        
        # Hacer predicción
        prediction = ai_model.predict(test_data)
        
        logger.info("=== RESULTADO PREDICCIÓN IA ===")
        logger.info(f"Debe ejecutar: {prediction['should_execute']}")
        logger.info(f"Confianza: {prediction['confidence']:.3f}")
        logger.info(f"Ganancia predicha: {prediction['predicted_profit_usdt']:.4f} USDT")
        logger.info(f"Probabilidad de éxito: {prediction['success_probability']:.3f}")
        logger.info(f"Probabilidad de riesgo: {prediction['high_risk_probability']:.3f}")
        logger.info(f"Razón: {prediction['reason']}")
        
        # Simular retroalimentación
        mock_result = {
            'was_executed': prediction['should_execute'],
            'was_successful': True,
            'actual_profit_usdt': 2.5,
            'execution_time': 8.5
        }
        
        ai_model.update_with_feedback(test_data, mock_result)
        logger.info("Retroalimentación enviada al modelo de IA")
        
        logger.info("=== PRUEBA INTEGRACIÓN IA COMPLETADA ===")
        return True
        
    except Exception as e:
        logger.error(f"Error en prueba de integración IA: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Función principal de pruebas."""
    logger.info("🚀 INICIANDO PRUEBAS DEL SISTEMA DE SIMULACIÓN V3")
    
    results = {
        'ai_integration': False,
        'local_simulation': False,
        'sandbox_simulation': False
    }
    
    try:
        # Prueba 1: Integración con IA
        logger.info("\n" + "="*60)
        results['ai_integration'] = await test_ai_integration()
        
        # Prueba 2: Simulación Local
        logger.info("\n" + "="*60)
        results['local_simulation'] = await test_local_simulation()
        
        # Prueba 3: Simulación Sandbox
        logger.info("\n" + "="*60)
        results['sandbox_simulation'] = await test_sandbox_simulation()
        
    except Exception as e:
        logger.error(f"Error general en pruebas: {e}")
    
    # Resumen final
    logger.info("\n" + "="*60)
    logger.info("📊 RESUMEN DE PRUEBAS")
    logger.info("="*60)
    
    for test_name, result in results.items():
        status = "✅ EXITOSA" if result else "❌ FALLIDA"
        logger.info(f"{test_name.replace('_', ' ').title()}: {status}")
    
    total_passed = sum(results.values())
    total_tests = len(results)
    
    logger.info(f"\nResultado general: {total_passed}/{total_tests} pruebas exitosas")
    
    if total_passed == total_tests:
        logger.info("🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE")
        return 0
    else:
        logger.error("⚠️  ALGUNAS PRUEBAS FALLARON")
        return 1

if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)