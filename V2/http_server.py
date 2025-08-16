# V2/http_server.py

import asyncio
from aiohttp import web
from test_routes import setup_test_routes

class V2HttpServer:
    """Servidor HTTP para V2 que maneja rutas GET para el testController."""
    
    def __init__(self, port=3032):
        self.port = port
        self.app = None
        self.runner = None
        self.site = None
    
    async def create_app(self):
        """Crea la aplicación aiohttp con las rutas configuradas."""
        self.app = web.Application()
        
        # Configurar rutas de prueba
        setup_test_routes(self.app)
        
        # Ruta de salud
        self.app.router.add_get('/health', self.health_check)
        
        # Ruta de información
        self.app.router.add_get('/api/info', self.get_info)
        
        return self.app
    
    async def health_check(self, request):
        """Endpoint de verificación de salud."""
        return web.json_response({
            "status": "healthy",
            "service": "V2 Test Controller",
            "port": self.port
        })
    
    async def get_info(self, request):
        """Endpoint de información del servicio."""
        return web.json_response({
            "service": "V2 Test Controller HTTP Server",
            "version": "1.0.0",
            "port": self.port,
            "endpoints": [
                {
                    "method": "GET",
                    "path": "/api/test/create",
                    "description": "Crear archivo de pruebas con parámetros de query",
                    "parameters": {
                        "days_back": "Días hacia atrás (default: 59)",
                        "num_analysis": "Número de análisis (default: 100)",
                        "frame_time": "Intervalo de tiempo (default: 5m)"
                    },
                    "example": "/api/test/create?days_back=59&num_analysis=100&frame_time=5m"
                },
                {
                    "method": "GET",
                    "path": "/api/test/create/{days_back}/{num_analysis}/{frame_time}",
                    "description": "Crear archivo de pruebas con parámetros en la URL",
                    "example": "/api/test/create/59/100/5m"
                },
                {
                    "method": "GET",
                    "path": "/api/test/files",
                    "description": "Obtener lista de archivos de prueba disponibles"
                },
                {
                    "method": "GET",
                    "path": "/health",
                    "description": "Verificación de salud del servicio"
                },
                {
                    "method": "GET",
                    "path": "/api/info",
                    "description": "Información del servicio y endpoints disponibles"
                }
            ]
        })
    
    async def start(self):
        """Inicia el servidor HTTP."""
        try:
            await self.create_app()
            
            self.runner = web.AppRunner(self.app)
            await self.runner.setup()
            
            self.site = web.TCPSite(self.runner, 'localhost', self.port)
            await self.site.start()
            
            print(f"🚀 V2 HTTP Server iniciado en http://localhost:{self.port}")
            print(f"📋 Endpoints disponibles:")
            print(f"   GET http://localhost:{self.port}/api/test/create?days_back=59&num_analysis=100&frame_time=5m")
            print(f"   GET http://localhost:{self.port}/api/test/create/59/100/5m")
            print(f"   GET http://localhost:{self.port}/api/test/files")
            print(f"   GET http://localhost:{self.port}/health")
            print(f"   GET http://localhost:{self.port}/api/info")
            
        except Exception as e:
            print(f"❌ Error iniciando servidor HTTP: {e}")
            raise
    
    async def stop(self):
        """Detiene el servidor HTTP."""
        try:
            if self.site:
                await self.site.stop()
                print("🛑 V2 HTTP Server detenido")
            
            if self.runner:
                await self.runner.cleanup()
                
        except Exception as e:
            print(f"❌ Error deteniendo servidor HTTP: {e}")

# Instancia global del servidor
http_server = V2HttpServer()

async def start_http_server(port=3032):
    """Función de utilidad para iniciar el servidor HTTP."""
    global http_server
    http_server = V2HttpServer(port)
    await http_server.start()
    return http_server

async def stop_http_server():
    """Función de utilidad para detener el servidor HTTP."""
    global http_server
    if http_server:
        await http_server.stop()

# Función principal para ejecutar solo el servidor HTTP
async def main():
    """Función principal para ejecutar el servidor HTTP independientemente."""
    server = None
    try:
        server = await start_http_server(3032)
        print("✅ Servidor HTTP ejecutándose. Presiona Ctrl+C para detener.")
        
        # Mantener el servidor corriendo
        while True:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Deteniendo servidor HTTP...")
    except Exception as e:
        print(f"❌ Error en servidor HTTP: {e}")
    finally:
        if server:
            await server.stop()

if __name__ == "__main__":
    asyncio.run(main())