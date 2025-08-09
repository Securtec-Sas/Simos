#!/usr/bin/env python3
"""
Script de prueba para verificar el flujo de entrenamiento.
"""

import asyncio
import json
import logging
from core.training_handler import TrainingHandler
from core.ai_model import ArbitrageAIModel
from adapters.persistence.data_persistence import DataPersistence
from adapters.socket.ui_broadcaster import UIBroadcaster

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_training_flow():
    """Prueba el flujo completo de entrenamiento."""
    try:
        logger.info("=== Iniciando prueba del flujo de entrenamiento ===")
        
        # Inicializar componentes
        ui_broadcaster = UIBroadcaster()
        ai_model = ArbitrageAIModel()
        data_persistence = DataPersistence()
        
        # Crear training handler
        training_handler = TrainingHandler(
            sebo_connector=None,  # No necesario para esta prueba
            ai_model=ai_model,
            data_persistence=data_persistence,
            ui_broadcaster=ui_broadcaster
        )
        
        logger.info("Componentes inicializados correctamente")
        
        # Simular mensaje de inicio de entrenamiento desde UI
        test_payload = {
            "csv_filename": "test_training_data.csv"
        }
        
        logger.info(f"Enviando payload de prueba: {test_payload}")
        
        # Llamar al método de inicio de entrenamiento
        result = await training_handler.start_training(test_payload)
        
        logger.info(f"Resultado del inicio de entrenamiento: {result}")
        
        if result.get("status") == "success":
            logger.info("✅ Entrenamiento iniciado correctamente")
            
            # Esperar un poco para que el entrenamiento progrese
            logger.info("Esperando progreso del entrenamiento...")
            await asyncio.sleep(5)
            
            # Verificar estado del entrenamiento
            in_progress, progress, filepath = training_handler.get_training_status()
            logger.info(f"Estado del entrenamiento: en_progreso={in_progress}, progreso={progress}%, archivo={filepath}")
            
            # Esperar a que termine el entrenamiento
            if in_progress:
                logger.info("Esperando a que termine el entrenamiento...")
                while training_handler.training_in_progress:
                    await asyncio.sleep(2)
                    in_progress, progress, filepath = training_handler.get_training_status()
                    logger.info(f"Progreso: {progress}%")
                
                logger.info("✅ Entrenamiento completado")
            
        else:
            logger.error(f"❌ Error iniciando entrenamiento: {result.get('message')}")
            
    except Exception as e:
        logger.error(f"❌ Error en prueba de entrenamiento: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_training_flow())