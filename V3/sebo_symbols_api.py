# Simos/V3/sebo_symbols_api.py

import asyncio
import logging
from typing import List, Dict, Optional
import aiohttp

from config_v3 import SEBO_API_BASE_URL, REQUEST_TIMEOUT
from utils import make_http_request

class SeboSymbolsAPI:
    """API para obtener símbolos desde Sebo."""
    
    def __init__(self):
        self.logger = logging.getLogger('V3.SeboSymbolsAPI')
        self.http_session: Optional[aiohttp.ClientSession] = None
        self.symbols_cache: List[Dict] = []
        self.cache_timestamp = None
        
    async def initialize(self):
        """Inicializa la sesión HTTP."""
        if self.http_session is None or self.http_session.closed:
            self.http_session = aiohttp.ClientSession()
    
    async def cleanup(self):
        """Limpia recursos."""
        if self.http_session and not self.http_session.closed:
            await self.http_session.close()
    
    async def get_symbols(self, force_refresh: bool = False) -> List[Dict]:
        """
        Obtiene la lista de símbolos desde Sebo.
        
        Args:
            force_refresh: Si True, fuerza la actualización del cache
            
        Returns:
            Lista de símbolos con formato [{"id_sy": "BTC/USDT", "name": "BTC"}, ...]
        """
        try:
            # Verificar cache si no se fuerza la actualización
            if not force_refresh and self.symbols_cache:
                self.logger.debug(f"Retornando {len(self.symbols_cache)} símbolos desde cache")
                return self.symbols_cache
            
            await self.initialize()
            
            # Endpoint para obtener símbolos de Sebo
            url = f"{SEBO_API_BASE_URL}/api/symbols"
            
            self.logger.info(f"Obteniendo símbolos desde Sebo: {url}")
            
            result = await make_http_request(
                self.http_session, 'GET', url, timeout=REQUEST_TIMEOUT
            )
            
            if result and isinstance(result, list):
                # Procesar y formatear símbolos
                formatted_symbols = []
                for symbol in result:
                    if isinstance(symbol, dict) and 'id_sy' in symbol and 'name' in symbol:
                        formatted_symbols.append({
                            'id_sy': symbol['id_sy'],
                            'name': symbol['name']
                        })
                
                self.symbols_cache = formatted_symbols
                self.logger.info(f"Obtenidos {len(formatted_symbols)} símbolos desde Sebo")
                return formatted_symbols
            else:
                self.logger.warning("Respuesta inválida de Sebo para símbolos")
                return []
                
        except Exception as e:
            self.logger.error(f"Error obteniendo símbolos desde Sebo: {e}")
            # Retornar cache si hay error y existe
            if self.symbols_cache:
                self.logger.info(f"Retornando {len(self.symbols_cache)} símbolos desde cache debido a error")
                return self.symbols_cache
            return []
    
    async def get_symbol_by_id(self, symbol_id: str) -> Optional[Dict]:
        """
        Obtiene un símbolo específico por su ID.
        
        Args:
            symbol_id: ID del símbolo (ej: "BTC/USDT")
            
        Returns:
            Diccionario con datos del símbolo o None si no se encuentra
        """
        try:
            await self.initialize()
            
            url = f"{SEBO_API_BASE_URL}/api/symbols/{symbol_id}"
            
            self.logger.debug(f"Obteniendo símbolo {symbol_id} desde Sebo")
            
            result = await make_http_request(
                self.http_session, 'GET', url, timeout=REQUEST_TIMEOUT
            )
            
            if result and isinstance(result, dict):
                return {
                    'id_sy': result.get('id_sy'),
                    'name': result.get('name')
                }
            else:
                self.logger.warning(f"Símbolo {symbol_id} no encontrado en Sebo")
                return None
                
        except Exception as e:
            self.logger.error(f"Error obteniendo símbolo {symbol_id} desde Sebo: {e}")
            return None
    
    async def add_symbols_for_exchanges(self) -> Dict:
        """
        Solicita a Sebo que agregue símbolos para exchanges activos.
        
        Returns:
            Diccionario con resultado de la operación
        """
        try:
            await self.initialize()
            
            url = f"{SEBO_API_BASE_URL}/api/symbols/add-for-exchanges"
            
            self.logger.info("Solicitando a Sebo agregar símbolos para exchanges activos")
            
            result = await make_http_request(
                self.http_session, 'POST', url, timeout=REQUEST_TIMEOUT * 3  # Timeout más largo
            )
            
            if result:
                self.logger.info(f"Símbolos agregados en Sebo: {result.get('message', 'Sin mensaje')}")
                # Limpiar cache para forzar actualización
                self.symbols_cache = []
                return result
            else:
                return {"message": "Error agregando símbolos", "success": False}
                
        except Exception as e:
            self.logger.error(f"Error solicitando agregar símbolos en Sebo: {e}")
            return {"message": f"Error: {str(e)}", "success": False}
    
    def get_cached_symbols(self) -> List[Dict]:
        """
        Retorna los símbolos en cache sin hacer llamada a la API.
        
        Returns:
            Lista de símbolos en cache
        """
        return self.symbols_cache.copy()
    
    def clear_cache(self):
        """Limpia el cache de símbolos."""
        self.symbols_cache = []
        self.cache_timestamp = None
        self.logger.debug("Cache de símbolos limpiado")
    
    async def refresh_symbols(self) -> List[Dict]:
        """
        Fuerza la actualización de símbolos desde Sebo.
        
        Returns:
            Lista actualizada de símbolos
        """
        self.logger.info("Forzando actualización de símbolos desde Sebo")
        return await self.get_symbols(force_refresh=True)

