# Simos/V3/socket_optimizer.py

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from ui_broadcaster import UIBroadcaster
from sebo_connector import SeboConnector
from data_persistence import DataPersistence

class SocketOptimizer:
    """Optimiza la comunicación por socket para mejorar el rendimiento."""
    
    def __init__(self, ui_broadcaster: UIBroadcaster, sebo_connector: SeboConnector, 
                 data_persistence: DataPersistence):
        self.logger = logging.getLogger('V3.SocketOptimizer')
        self.ui_broadcaster = ui_broadcaster
        self.sebo_connector = sebo_connector
        self.data_persistence = data_persistence
        
        # Estado de optimización
        self.is_running = False
        self.last_top20_update = None
        self.last_balance_update = None
        self.balance_cache = None
        
        # Configuración de intervalos
        self.TOP20_INTERVAL = 5  # segundos
        self.BALANCE_UPDATE_ON_LOAD = True
        self.BALANCE_UPDATE_ON_OPERATION = True
        
        # Tareas en background
        self.top20_task = None
        
    async def start(self):
        """Inicia la optimización de comunicación por socket."""
        try:
            self.is_running = True
            self.logger.info("Iniciando optimizador de socket")
            
            # Iniciar tarea de Top 20 cada 5 segundos
            self.top20_task = asyncio.create_task(self._top20_broadcast_loop())
            
            # Enviar balance inicial al cargar
            if self.BALANCE_UPDATE_ON_LOAD:
                await self._send_initial_balance()
            
            self.logger.info("Optimizador de socket iniciado")
            
        except Exception as e:
            self.logger.error(f"Error iniciando optimizador de socket: {e}")
            self.is_running = False
    
    async def stop(self):
        """Detiene la optimización de comunicación por socket."""
        try:
            self.is_running = False
            
            # Cancelar tareas en background
            if self.top20_task and not self.top20_task.done():
                self.top20_task.cancel()
                try:
                    await self.top20_task
                except asyncio.CancelledError:
                    pass
            
            self.logger.info("Optimizador de socket detenido")
            
        except Exception as e:
            self.logger.error(f"Error deteniendo optimizador de socket: {e}")
    
    async def _top20_broadcast_loop(self):
        """Loop para enviar Top 20 cada 5 segundos."""
        try:
            while self.is_running:
                try:
                    # Obtener datos del Top 20
                    top20_data = await self._get_top20_data()
                    
                    if top20_data:
                        # Enviar a todos los clientes conectados
                        await self.ui_broadcaster.broadcast_top20_data(top20_data)
                        self.last_top20_update = datetime.now()
                        
                        self.logger.debug(f"Top 20 enviado a {len(self.ui_broadcaster.ui_clients)} clientes")
                    
                    # Esperar 5 segundos
                    await asyncio.sleep(self.TOP20_INTERVAL)
                    
                except Exception as e:
                    self.logger.error(f"Error en loop de Top 20: {e}")
                    await asyncio.sleep(self.TOP20_INTERVAL)  # Continuar después del error
                    
        except asyncio.CancelledError:
            self.logger.info("Loop de Top 20 cancelado")
        except Exception as e:
            self.logger.error(f"Error fatal en loop de Top 20: {e}")
    
    async def _get_top20_data(self) -> Optional[list]:
        """Obtiene los datos del Top 20 desde Sebo."""
        try:
            # Simular datos del Top 20 - en implementación real usar sebo_connector
            top20_data = []
            
            for i in range(20):
                symbol_data = {
                    'rank': i + 1,
                    'symbol': f'SYMBOL{i+1}/USDT',
                    'price': round(100 + (i * 10) + (i * 0.5), 2),
                    'change_24h': round(-5 + (i * 0.5), 2),
                    'volume_24h': round(1000000 + (i * 100000), 2),
                    'market_cap': round(10000000 + (i * 1000000), 2),
                    'last_updated': datetime.now().isoformat()
                }
                top20_data.append(symbol_data)
            
            return top20_data
            
        except Exception as e:
            self.logger.error(f"Error obteniendo datos Top 20: {e}")
            return None
    
    async def _send_initial_balance(self):
        """Envía el balance inicial al cargar la página."""
        try:
            # Obtener balance desde cache o Sebo
            balance_data = await self._get_balance_data()
            
            if balance_data:
                await self.ui_broadcaster.broadcast_balance_update(balance_data)
                self.balance_cache = balance_data
                self.last_balance_update = datetime.now()
                
                self.logger.info("Balance inicial enviado")
            
        except Exception as e:
            self.logger.error(f"Error enviando balance inicial: {e}")
    
    async def _get_balance_data(self) -> Optional[Dict]:
        """Obtiene los datos de balance."""
        try:
            # Intentar obtener desde cache primero
            if self.balance_cache:
                cache_age = datetime.now() - self.last_balance_update
                if cache_age < timedelta(minutes=5):  # Cache válido por 5 minutos
                    return self.balance_cache
            
            # Obtener balance fresco desde Sebo
            # En implementación real usar sebo_connector
            balance_data = {
                'total_usdt': 1000.0,
                'available_usdt': 950.0,
                'in_orders_usdt': 50.0,
                'balances': {
                    'USDT': {'total': 1000.0, 'available': 950.0, 'in_orders': 50.0},
                    'BTC': {'total': 0.01, 'available': 0.01, 'in_orders': 0.0},
                    'ETH': {'total': 0.5, 'available': 0.5, 'in_orders': 0.0}
                },
                'last_updated': datetime.now().isoformat()
            }
            
            return balance_data
            
        except Exception as e:
            self.logger.error(f"Error obteniendo datos de balance: {e}")
            return None
    
    async def on_operation_completed(self, operation_result: Dict):
        """Maneja la finalización de una operación y actualiza el balance."""
        try:
            if self.BALANCE_UPDATE_ON_OPERATION:
                # Actualizar balance después de una operación
                balance_data = await self._get_balance_data()
                
                if balance_data:
                    await self.ui_broadcaster.broadcast_balance_update(balance_data)
                    self.balance_cache = balance_data
                    self.last_balance_update = datetime.now()
                    
                    self.logger.info("Balance actualizado después de operación")
                
                # También enviar resultado de la operación
                await self.ui_broadcaster.broadcast_message({
                    "type": "operation_completed",
                    "payload": operation_result
                })
            
        except Exception as e:
            self.logger.error(f"Error actualizando balance después de operación: {e}")
    
    async def on_page_load(self, client_info: Dict = None):
        """Maneja la carga de página y envía datos iniciales."""
        try:
            # Enviar balance al cargar la página
            if self.BALANCE_UPDATE_ON_LOAD:
                balance_data = await self._get_balance_data()
                
                if balance_data:
                    await self.ui_broadcaster.broadcast_balance_update(balance_data)
                    self.balance_cache = balance_data
                    self.last_balance_update = datetime.now()
            
            # Enviar Top 20 inmediatamente
            top20_data = await self._get_top20_data()
            if top20_data:
                await self.ui_broadcaster.broadcast_top20_data(top20_data)
            
            # Enviar estado del sistema
            system_status = await self._get_system_status()
            if system_status:
                await self.ui_broadcaster.broadcast_message({
                    "type": "system_status",
                    "payload": system_status
                })
            
            self.logger.info("Datos iniciales enviados al cargar página")
            
        except Exception as e:
            self.logger.error(f"Error enviando datos al cargar página: {e}")
    
    async def _get_system_status(self) -> Dict:
        """Obtiene el estado del sistema."""
        try:
            return {
                "sebo_connected": self.sebo_connector.is_connected if self.sebo_connector else False,
                "ui_clients": len(self.ui_broadcaster.ui_clients),
                "last_top20_update": self.last_top20_update.isoformat() if self.last_top20_update else None,
                "last_balance_update": self.last_balance_update.isoformat() if self.last_balance_update else None,
                "optimizer_running": self.is_running,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error obteniendo estado del sistema: {e}")
            return {}
    
    def get_stats(self) -> Dict:
        """Obtiene estadísticas del optimizador."""
        return {
            "is_running": self.is_running,
            "top20_interval": self.TOP20_INTERVAL,
            "last_top20_update": self.last_top20_update.isoformat() if self.last_top20_update else None,
            "last_balance_update": self.last_balance_update.isoformat() if self.last_balance_update else None,
            "balance_cached": self.balance_cache is not None,
            "connected_clients": len(self.ui_broadcaster.ui_clients)
        }

