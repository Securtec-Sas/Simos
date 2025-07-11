# Simos/V3/main_v3.py

import asyncio
import logging
import signal
import sys
from typing import Dict, Any

# Importar módulos de V3
from config_v3 import LOG_LEVEL, LOG_FILE_PATH
from utils import setup_logging
from sebo_connector import SeboConnector
from ui_broadcaster import UIBroadcaster
from exchange_manager import ExchangeManager
from data_persistence import DataPersistence
from trading_logic import TradingLogic
from ai_model import ArbitrageAIModel
from simulation_engine import SimulationEngine
from ai_training_manager import AITrainingManager
from ai_test_manager import AITestManager
from sandbox_trading_manager import SandboxTradingManager

class CryptoArbitrageV3:
    """Aplicación principal de arbitraje de criptomonedas V3."""
    
    def __init__(self):
        # Configurar logging
        self.logger = setup_logging(LOG_LEVEL, LOG_FILE_PATH)
        self.logger.info("Iniciando Crypto Arbitrage V3")
        
        # Inicializar componentes principales
        self.sebo_connector = SeboConnector()
        self.ui_broadcaster = UIBroadcaster()
        self.exchange_manager = ExchangeManager()
        self.data_persistence = DataPersistence()
        self.ai_model = ArbitrageAIModel()
        self.trading_logic = TradingLogic(self.exchange_manager, self.data_persistence, self.ai_model)
        self.simulation_engine = SimulationEngine(self.ai_model, self.data_persistence)
        
        # Inicializar nuevos managers de IA
        self.ai_training_manager = AITrainingManager(self.ai_model, self.ui_broadcaster)
        self.ai_test_manager = AITestManager(self.ai_model, self.ui_broadcaster)
        self.sandbox_trading_manager = SandboxTradingManager(self.ai_model, self.ui_broadcaster)
        
        # Estado de la aplicación
        self.is_running = False
        self.shutdown_event = asyncio.Event()
        
        # Configurar callbacks
        self._setup_callbacks()
    
    def _setup_callbacks(self):
        """Configura los callbacks entre componentes."""
        
        # Callbacks de SeboConnector
        self.sebo_connector.set_balances_update_callback(self._on_balances_update)
        self.sebo_connector.set_top20_data_callback(self._on_top20_data)
        
        # Callbacks de UIBroadcaster
        self.ui_broadcaster.set_trading_start_callback(self._on_trading_start_request)
        self.ui_broadcaster.set_trading_stop_callback(self._on_trading_stop_request)
        self.ui_broadcaster.set_ui_message_callback(self._on_ui_message)
        self.ui_broadcaster.set_get_ai_model_details_callback(self._on_get_ai_model_details_request)
        
        # Nuevos callbacks para IA
        self.ui_broadcaster.set_train_ai_model_callback(self._on_train_ai_model_request)
        self.ui_broadcaster.set_test_ai_model_callback(self._on_test_ai_model_request)
        self.ui_broadcaster.set_start_ai_simulation_callback(self._on_start_ai_simulation_request)
        
        # Callbacks de TradingLogic
        self.trading_logic.set_operation_complete_callback(self._on_operation_complete)
        self.trading_logic.set_trading_status_change_callback(self._on_trading_status_change)
    
    async def initialize(self):
        """Inicializa todos los componentes."""
        try:
            self.logger.info("Inicializando componentes...")
            
            # Inicializar en orden de dependencias
            await self.sebo_connector.initialize()
            await self.exchange_manager.initialize()
            await self.trading_logic.initialize()
            
            # Iniciar servidor UI
            await self.ui_broadcaster.start_server()
            
            self.logger.info("Todos los componentes inicializados correctamente")
            
        except Exception as e:
            self.logger.error(f"Error inicializando componentes: {e}")
            raise
    
    async def start(self):
        """Inicia la aplicación."""
        try:
            self.is_running = True
            self.logger.info("Iniciando Crypto Arbitrage V3...")
            
            # Conectar a Sebo
            connected = await self.sebo_connector.connect_to_sebo()
            if not connected:
                self.logger.error("No se pudo conectar a Sebo")
                return False
            
            self.logger.info("V3 iniciado correctamente")
            
            # Configurar manejo de señales para shutdown graceful
            self._setup_signal_handlers()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error iniciando V3: {e}")
            return False
    
    async def run(self):
        """Ejecuta el bucle principal de la aplicación."""
        try:
            self.logger.info("Ejecutando bucle principal...")
            
            # Crear tareas principales
            tasks = [
                asyncio.create_task(self.sebo_connector.wait_for_connection()),
                asyncio.create_task(self._monitor_system_health()),
                asyncio.create_task(self._wait_for_shutdown())
            ]
            
            # Ejecutar hasta que se reciba señal de shutdown
            await asyncio.gather(*tasks, return_exceptions=True)
            
        except Exception as e:
            self.logger.error(f"Error en bucle principal: {e}")
        finally:
            await self.shutdown()
    
    async def shutdown(self):
        """Realiza un shutdown graceful de la aplicación."""
        if not self.is_running:
            return
        
        self.logger.info("Iniciando shutdown de V3...")
        self.is_running = False
        
        try:
            # Detener trading si está activo
            if self.trading_logic.is_trading_active():
                await self.trading_logic.stop_trading()
            
            # Detener procesos de IA si están activos
            if self.ai_training_manager.is_training:
                await self.ai_training_manager.stop_training()
            
            if self.ai_test_manager.is_testing:
                await self.ai_test_manager.stop_test()
            
            if self.sandbox_trading_manager.is_simulation_running:
                await self.sandbox_trading_manager.stop_simulation()
            
            # Cerrar componentes en orden inverso
            await self.ui_broadcaster.stop_server()
            await self.sebo_connector.disconnect_from_sebo()
            await self.trading_logic.cleanup()
            await self.exchange_manager.cleanup()
            await self.sebo_connector.cleanup()
            
            self.logger.info("Shutdown completado")
            
        except Exception as e:
            self.logger.error(f"Error durante shutdown: {e}")
    
    def _setup_signal_handlers(self):
        """Configura los manejadores de señales para shutdown graceful."""
        def signal_handler(signum, frame):
            self.logger.info(f"Recibida señal {signum}, iniciando shutdown...")
            self.shutdown_event.set()
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    
    async def _wait_for_shutdown(self):
        """Espera la señal de shutdown."""
        await self.shutdown_event.wait()
    
    async def _monitor_system_health(self):
        """Monitorea la salud del sistema."""
        while self.is_running:
            try:
                # Verificar estado de componentes
                health_status = {
                    'sebo_connected': self.sebo_connector.is_connected(),
                    'ui_server_running': self.ui_broadcaster.is_server_running(),
                    'trading_active': self.trading_logic.is_trading_active(),
                    'ai_training_active': self.ai_training_manager.is_training,
                    'ai_testing_active': self.ai_test_manager.is_testing,
                    'simulation_active': self.sandbox_trading_manager.is_simulation_running,
                    'timestamp': self.data_persistence.get_current_timestamp()
                }
                
                # Emitir estado del sistema a la UI
                await self.ui_broadcaster.broadcast_message({
                    'type': 'system_health',
                    'payload': health_status
                })
                
                await asyncio.sleep(30)  # Verificar cada 30 segundos
                
            except Exception as e:
                self.logger.error(f"Error monitoreando salud del sistema: {e}")
                await asyncio.sleep(60)  # Esperar más tiempo si hay error
    
    # Callbacks de eventos
    
    async def _on_balances_update(self, balances_data: Dict):
        """Maneja actualizaciones de balance desde Sebo."""
        try:
            self.logger.debug("Recibida actualización de balances")
            
            # Procesar y retransmitir a UI
            await self.ui_broadcaster.broadcast_balances_update(balances_data)
            
            # Actualizar datos en trading logic si es necesario
            await self.trading_logic.update_balances(balances_data)
            
        except Exception as e:
            self.logger.error(f"Error procesando actualización de balances: {e}")
    
    async def _on_top20_data(self, top20_data: Dict):
        """Maneja datos del Top20 desde Sebo."""
        try:
            self.logger.debug("Recibidos datos del Top20")
            
            # Retransmitir a UI
            await self.ui_broadcaster.broadcast_top20_data(top20_data)
            
            # Procesar para trading automático si está activo
            if self.trading_logic.is_trading_active():
                await self.trading_logic.process_top20_data(top20_data)
            
        except Exception as e:
            self.logger.error(f"Error procesando datos del Top20: {e}")
    
    async def _on_trading_start_request(self, trading_params: Dict):
        """Maneja solicitud de inicio de trading."""
        try:
            self.logger.info("Recibida solicitud de inicio de trading")
            result = await self.trading_logic.start_trading(trading_params)
            
            # Emitir resultado a UI
            await self.ui_broadcaster.broadcast_message({
                'type': 'trading_start_result',
                'payload': result
            })
            
        except Exception as e:
            self.logger.error(f"Error iniciando trading: {e}")
    
    async def _on_trading_stop_request(self):
        """Maneja solicitud de detención de trading."""
        try:
            self.logger.info("Recibida solicitud de detención de trading")
            result = await self.trading_logic.stop_trading()
            
            # Emitir resultado a UI
            await self.ui_broadcaster.broadcast_message({
                'type': 'trading_stop_result',
                'payload': result
            })
            
        except Exception as e:
            self.logger.error(f"Error deteniendo trading: {e}")
    
    async def _on_get_ai_model_details_request(self):
        """Maneja solicitud de detalles del modelo de IA."""
        try:
            details = self.ai_model.get_model_details()
            
            await self.ui_broadcaster.broadcast_message({
                'type': 'ai_model_details',
                'payload': details
            })
            
        except Exception as e:
            self.logger.error(f"Error obteniendo detalles del modelo: {e}")
    
    async def _on_train_ai_model_request(self, training_params: Dict):
        """Maneja solicitud de entrenamiento del modelo de IA."""
        try:
            self.logger.info("Recibida solicitud de entrenamiento de IA")
            result = await self.ai_training_manager.start_training(training_params)
            
            await self.ui_broadcaster.broadcast_message({
                'type': 'ai_training_result',
                'payload': result
            })
            
        except Exception as e:
            self.logger.error(f"Error en entrenamiento de IA: {e}")
    
    async def _on_test_ai_model_request(self, test_params: Dict):
        """Maneja solicitud de prueba del modelo de IA."""
        try:
            self.logger.info("Recibida solicitud de prueba de IA")
            result = await self.ai_test_manager.start_test(test_params)
            
            await self.ui_broadcaster.broadcast_message({
                'type': 'ai_test_results',
                'payload': result
            })
            
        except Exception as e:
            self.logger.error(f"Error en prueba de IA: {e}")
    
    async def _on_start_ai_simulation_request(self, simulation_params: Dict):
        """Maneja solicitud de simulación de IA."""
        try:
            self.logger.info("Recibida solicitud de simulación de IA")
            result = await self.sandbox_trading_manager.start_sandbox_simulation(simulation_params)
            
            await self.ui_broadcaster.broadcast_message({
                'type': 'ai_simulation_result',
                'payload': result
            })
            
        except Exception as e:
            self.logger.error(f"Error en simulación de IA: {e}")
    
    async def _on_ui_message(self, message_data: Dict):
        """Maneja mensajes generales desde la UI."""
        try:
            message_type = message_data.get('type')
            payload = message_data.get('payload', {})
            
            if message_type == 'ping':
                await self.ui_broadcaster.broadcast_message({
                    'type': 'pong',
                    'payload': {'timestamp': self.data_persistence.get_current_timestamp()}
                })
            
            elif message_type == 'get_system_status':
                status = {
                    'v3_running': self.is_running,
                    'sebo_connected': self.sebo_connector.is_connected(),
                    'trading_active': self.trading_logic.is_trading_active(),
                    'ai_training_active': self.ai_training_manager.is_training,
                    'ai_testing_active': self.ai_test_manager.is_testing,
                    'simulation_active': self.sandbox_trading_manager.is_simulation_running
                }
                
                await self.ui_broadcaster.broadcast_message({
                    'type': 'system_status',
                    'payload': status
                })
            
        except Exception as e:
            self.logger.error(f"Error procesando mensaje de UI: {e}")
    
    async def _on_operation_complete(self, operation_result: Dict):
        """Maneja completación de operaciones de trading."""
        try:
            # Emitir resultado a UI
            await self.ui_broadcaster.broadcast_message({
                'type': 'operation_complete',
                'payload': operation_result
            })
            
            # Guardar en persistencia
            await self.data_persistence.save_operation_result(operation_result)
            
        except Exception as e:
            self.logger.error(f"Error procesando completación de operación: {e}")
    
    async def _on_trading_status_change(self, status_data: Dict):
        """Maneja cambios de estado del trading."""
        try:
            await self.ui_broadcaster.broadcast_message({
                'type': 'trading_status_change',
                'payload': status_data
            })
            
        except Exception as e:
            self.logger.error(f"Error procesando cambio de estado de trading: {e}")


async def main():
    """Función principal."""
    app = CryptoArbitrageV3()
    
    try:
        # Inicializar
        await app.initialize()
        
        # Iniciar
        started = await app.start()
        if not started:
            return 1
        
        # Ejecutar
        await app.run()
        
        return 0
        
    except KeyboardInterrupt:
        app.logger.info("Interrupción por teclado recibida")
        return 0
    except Exception as e:
        app.logger.error(f"Error fatal: {e}")
        return 1
    finally:
        await app.shutdown()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

