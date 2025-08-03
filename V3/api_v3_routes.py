# Simos/V3/api_v3_routes.py

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import asyncio
from typing import Dict, Any

from training_handler import TrainingHandler
from simulation_handler import SimulationHandler
from ai_model import ArbitrageAIModel
from data_persistence import DataPersistence
from sebo_connector import SeboConnector

class APIv3Routes:
    """Rutas de la API v3 para el sistema de entrenamiento y simulación."""
    
    def __init__(self, app: Flask, sebo_connector: SeboConnector, 
                 ai_model: ArbitrageAIModel, data_persistence: DataPersistence,
                 ui_broadcaster=None):
        self.app = app
        self.logger = logging.getLogger('V3.APIv3Routes')
        
        # Configurar CORS
        CORS(app, origins="*")
        
        # Inicializar handlers
        self.training_handler = TrainingHandler(
            sebo_connector, ai_model, data_persistence, ui_broadcaster
        )
        self.simulation_handler = SimulationHandler(
            ai_model, data_persistence, ui_broadcaster
        )
        
        # Registrar rutas
        self._register_routes()
    
    def _register_routes(self):
        """Registra todas las rutas de la API v3."""
        
        # Rutas de entrenamiento
        self.app.route('/api/v3/create-training-csv', methods=['POST'])(
            self._create_training_csv
        )
        self.app.route('/api/v3/start-training', methods=['POST'])(
            self._start_training
        )
        self.app.route('/api/v3/run-tests', methods=['POST'])(
            self._run_tests
        )
        
        # Rutas de simulación
        self.app.route('/api/v3/start-simulation', methods=['POST'])(
            self._start_simulation
        )
        self.app.route('/api/v3/simulation-status', methods=['GET'])(
            self._get_simulation_status
        )
        self.app.route('/api/v3/stop-simulation', methods=['POST'])(
            self._stop_simulation
        )
        
        # Rutas de modelo de IA
        self.app.route('/api/v3/model-info', methods=['GET'])(
            self._get_model_info
        )
        self.app.route('/api/v3/model-predict', methods=['POST'])(
            self._model_predict
        )
        
        # Rutas de datos
        self.app.route('/api/v3/data-ai', methods=['GET'])(
            self._get_data_ai
        )
        self.app.route('/api/v3/update-data-ai', methods=['POST'])(
            self._update_data_ai
        )
        
        # Ruta de símbolos de Sebo
        self.app.route('/api/sebo/symbols', methods=['GET'])(
            self._get_sebo_symbols
        )
        
        # Ruta para agregar símbolos en Sebo
        self.app.route('/api/sebo/symbols/add-for-exchanges', methods=['POST'])(
            self._add_symbols_for_exchanges
        )
    
    def _create_training_csv(self):
        """Endpoint para crear CSV de entrenamiento."""
        try:
            request_data = request.get_json()
            
            # Ejecutar de forma asíncrona
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                self.training_handler.create_training_csv(request_data)
            )
            loop.close()
            
            return jsonify(result)
            
        except Exception as e:
            self.logger.error(f"Error en create_training_csv: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500
    
    def _start_training(self):
        """Endpoint para iniciar entrenamiento."""
        try:
            request_data = request.get_json()
            
            # Ejecutar de forma asíncrona
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                self.training_handler.start_training(request_data)
            )
            loop.close()
            
            return jsonify(result)
            
        except Exception as e:
            self.logger.error(f"Error en start_training: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500
    
    def _run_tests(self):
        """Endpoint para ejecutar pruebas del modelo."""
        try:
            # Obtener archivo CSV de pruebas
            if 'testCsv' not in request.files:
                return jsonify({
                    "status": "error",
                    "message": "Archivo CSV requerido"
                }), 400
            
            test_file = request.files['testCsv']
            
            # Ejecutar de forma asíncrona
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                self.training_handler.run_tests(test_file)
            )
            loop.close()
            
            return jsonify(result)
            
        except Exception as e:
            self.logger.error(f"Error en run_tests: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500
    
    def _start_simulation(self):
        """Endpoint para iniciar simulación."""
        try:
            request_data = request.get_json()
            
            # Ejecutar de forma asíncrona
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                self.simulation_handler.start_simulation(request_data)
            )
            loop.close()
            
            return jsonify(result)
            
        except Exception as e:
            self.logger.error(f"Error en start_simulation: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500
    
    def _get_simulation_status(self):
        """Endpoint para obtener estado de simulación."""
        try:
            # Ejecutar de forma asíncrona
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                self.simulation_handler.get_simulation_status()
            )
            loop.close()
            
            return jsonify({
                "status": "success",
                "data": result
            })
            
        except Exception as e:
            self.logger.error(f"Error en get_simulation_status: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500
    
    def _stop_simulation(self):
        """Endpoint para detener simulación."""
        try:
            # Ejecutar de forma asíncrona
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                self.simulation_handler.stop_simulation()
            )
            loop.close()
            
            return jsonify(result)
            
        except Exception as e:
            self.logger.error(f"Error en stop_simulation: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500
    
    def _get_model_info(self):
        """Endpoint para obtener información del modelo."""
        try:
            model_info = self.training_handler.ai_model.get_model_info()
            
            return jsonify({
                "status": "success",
                "data": model_info
            })
            
        except Exception as e:
            self.logger.error(f"Error en get_model_info: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500
    
    def _model_predict(self):
        """Endpoint para realizar predicción con el modelo."""
        try:
            request_data = request.get_json()
            
            if not self.training_handler.ai_model.is_trained:
                return jsonify({
                    "status": "error",
                    "message": "El modelo no está entrenado"
                }), 400
            
            prediction = self.training_handler.ai_model.predict(request_data)
            
            return jsonify({
                "status": "success",
                "data": prediction
            })
            
        except Exception as e:
            self.logger.error(f"Error en model_predict: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500
    
    def _get_data_ai(self):
        """Endpoint para obtener datos de IA (solo una vez por solicitud)."""
        try:
            # Obtener información del modelo
            model_info = self.training_handler.ai_model.get_model_info()
            
            # Obtener estadísticas de entrenamiento
            training_stats = self.training_handler.ai_model.training_history
            
            # Datos de configuración
            ai_data = {
                "model_info": model_info,
                "training_stats": training_stats,
                "is_trained": self.training_handler.ai_model.is_trained,
                "last_updated": self.training_handler.ai_model.training_history.get('last_training'),
                "feature_count": len(self.training_handler.ai_model.feature_names),
                "confidence_threshold": self.training_handler.ai_model.confidence_threshold
            }
            
            return jsonify({
                "status": "success",
                "data": ai_data
            })
            
        except Exception as e:
            self.logger.error(f"Error en get_data_ai: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500
    
    def _update_data_ai(self):
        """Endpoint para actualizar datos de IA."""
        try:
            request_data = request.get_json()
            
            # Actualizar configuración del modelo si se proporciona
            if 'confidence_threshold' in request_data:
                self.training_handler.ai_model.confidence_threshold = request_data['confidence_threshold']
            
            # Retornar datos actualizados
            return self._get_data_ai()
            
        except Exception as e:
            self.logger.error(f"Error en update_data_ai: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500
    
    def _get_sebo_symbols(self):
        """Endpoint para obtener símbolos de Sebo."""
        try:
            # Ejecutar de forma asíncrona
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            symbols = loop.run_until_complete(
                self.training_handler.sebo_symbols_api.get_symbols()
            )
            loop.close()
            
            return jsonify({
                "status": "success",
                "data": symbols
            })
            
        except Exception as e:
            self.logger.error(f"Error en get_sebo_symbols: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500
    
    def _add_symbols_for_exchanges(self):
        """Endpoint para agregar símbolos para exchanges activos en Sebo."""
        try:
            # Ejecutar de forma asíncrona
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                self.training_handler.sebo_symbols_api.add_symbols_for_exchanges()
            )
            loop.close()
            
            return jsonify(result)
            
        except Exception as e:
            self.logger.error(f"Error en add_symbols_for_exchanges: {e}")
            return jsonify({
                "status": "error",
                "message": f"Error interno: {str(e)}"
            }), 500

