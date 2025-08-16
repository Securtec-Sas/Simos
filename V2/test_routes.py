# V2/test_routes.py

import asyncio
import json
from aiohttp import web, ClientSession
from controllera.testController import test_controller

class TestRoutes:
    """Rutas HTTP para operaciones de pruebas."""
    
    def __init__(self):
        self.routes = [
            web.get('/api/test/create', self.create_test_file_route),
            web.get('/api/test/files', self.get_test_files_route),
            web.get('/api/test/create/{days_back}/{num_analysis}/{frame_time}', self.create_test_file_params_route)
        ]
    
    async def create_test_file_route(self, request):
        """
        Ruta GET para crear archivo de pruebas.
        Parámetros de query: days_back, num_analysis, frame_time
        """
        try:
            # Obtener parámetros de query
            days_back = int(request.query.get('days_back', 59))
            num_analysis = int(request.query.get('num_analysis', 100))
            frame_time = request.query.get('frame_time', '5m')
            
            print(f"TestRoutes: GET /api/test/create - {days_back} días, {num_analysis} análisis, {frame_time}")
            
            # Llamar al test controller
            result = await test_controller.create_test_file(days_back, num_analysis, frame_time)
            
            if result["success"]:
                return web.json_response({
                    "status": "success",
                    "message": result["message"],
                    "data": {
                        "filepath": result["filepath"],
                        "filename": result["filename"],
                        "records_count": result["records_count"],
                        "parameters": result["parameters"]
                    }
                }, status=200)
            else:
                return web.json_response({
                    "status": "error",
                    "message": result["message"]
                }, status=400)
                
        except ValueError as e:
            return web.json_response({
                "status": "error",
                "message": f"Parámetros inválidos: {str(e)}"
            }, status=400)
        except Exception as e:
            print(f"TestRoutes: Error en create_test_file_route: {e}")
            return web.json_response({
                "status": "error",
                "message": f"Error interno del servidor: {str(e)}"
            }, status=500)
    
    async def create_test_file_params_route(self, request):
        """
        Ruta GET para crear archivo de pruebas con parámetros en la URL.
        URL: /api/test/create/{days_back}/{num_analysis}/{frame_time}
        """
        try:
            # Obtener parámetros de la URL
            days_back = int(request.match_info['days_back'])
            num_analysis = int(request.match_info['num_analysis'])
            frame_time = request.match_info['frame_time']
            
            print(f"TestRoutes: GET /api/test/create/{days_back}/{num_analysis}/{frame_time}")
            
            # Validar parámetros
            if days_back < 1 or days_back > 365:
                return web.json_response({
                    "status": "error",
                    "message": "days_back debe estar entre 1 y 365"
                }, status=400)
            
            if num_analysis < 1 or num_analysis > 10000:
                return web.json_response({
                    "status": "error",
                    "message": "num_analysis debe estar entre 1 y 10000"
                }, status=400)
            
            valid_frame_times = ["5m", "10m", "15m", "30m", "1h", "2h", "3h", "4h", "6h", "12h", "1d"]
            if frame_time not in valid_frame_times:
                return web.json_response({
                    "status": "error",
                    "message": f"frame_time debe ser uno de: {', '.join(valid_frame_times)}"
                }, status=400)
            
            # Llamar al test controller
            result = await test_controller.create_test_file(days_back, num_analysis, frame_time)
            
            if result["success"]:
                return web.json_response({
                    "status": "success",
                    "message": result["message"],
                    "data": {
                        "filepath": result["filepath"],
                        "filename": result["filename"],
                        "records_count": result["records_count"],
                        "parameters": result["parameters"]
                    }
                }, status=200)
            else:
                return web.json_response({
                    "status": "error",
                    "message": result["message"]
                }, status=400)
                
        except ValueError as e:
            return web.json_response({
                "status": "error",
                "message": f"Parámetros inválidos: {str(e)}"
            }, status=400)
        except Exception as e:
            print(f"TestRoutes: Error en create_test_file_params_route: {e}")
            return web.json_response({
                "status": "error",
                "message": f"Error interno del servidor: {str(e)}"
            }, status=500)
    
    async def get_test_files_route(self, request):
        """
        Ruta GET para obtener la lista de archivos de prueba disponibles.
        """
        try:
            print("TestRoutes: GET /api/test/files")
            
            # Llamar al test controller
            result = await test_controller.get_test_files_list()
            
            if result["success"]:
                return web.json_response({
                    "status": "success",
                    "message": result["message"],
                    "data": {
                        "files": result["files"],
                        "count": result["count"]
                    }
                }, status=200)
            else:
                return web.json_response({
                    "status": "error",
                    "message": result["message"]
                }, status=400)
                
        except Exception as e:
            print(f"TestRoutes: Error en get_test_files_route: {e}")
            return web.json_response({
                "status": "error",
                "message": f"Error interno del servidor: {str(e)}"
            }, status=500)

# Función para configurar las rutas en una aplicación aiohttp
def setup_test_routes(app):
    """Configura las rutas de prueba en la aplicación aiohttp."""
    test_routes = TestRoutes()
    for route in test_routes.routes:
        app.router.add_route(route.method, route.path, route.handler)
    
    print("TestRoutes: Rutas de prueba configuradas:")
    print("  GET /api/test/create?days_back=59&num_analysis=100&frame_time=5m")
    print("  GET /api/test/create/{days_back}/{num_analysis}/{frame_time}")
    print("  GET /api/test/files")

# Instancia global para uso directo
test_routes_instance = TestRoutes()