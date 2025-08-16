#!/usr/bin/env python3
# Simos/V3/train_model.py

"""
Script para entrenar el modelo de IA de arbitraje.
Uso: python train_model.py [opciones]
"""

import asyncio
import argparse
import logging
import sys
import os
from datetime import datetime
import json

# Add the parent directory (V3) to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.ai_model import ArbitrageAIModel
from core.simulation_engine import SimulationEngine
from adapters.persistence.data_persistence import DataPersistence
from shared.utils import setup_logging

async def main():
    parser = argparse.ArgumentParser(description='Entrenar modelo de IA para arbitraje')
    parser.add_argument('--samples', type=int, default=1000, 
                       help='Número de muestras de entrenamiento a generar (default: 1000)')
    parser.add_argument('--validation-split', type=float, default=0.2,
                       help='Porcentaje de datos para validación (default: 0.2)')
    parser.add_argument('--model-path', type=str, default=None,
                       help='Ruta donde guardar el modelo entrenado')
    parser.add_argument('--use-existing-data', action='store_true',
                       help='Usar datos existentes en lugar de generar nuevos')
    parser.add_argument('--log-level', type=str, default='INFO',
                       choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                       help='Nivel de logging (default: INFO)')
    parser.add_argument('--export-results', type=str, default=None,
                       help='Archivo donde exportar los resultados del entrenamiento')
    
    args = parser.parse_args()
    
    # Configurar logging
    logger = setup_logging(args.log_level, 'logs/training.log')
    logger.info("=== INICIANDO ENTRENAMIENTO DEL MODELO ===")
    logger.info(f"Configuración: {vars(args)}")
    
    try:
        # Inicializar componentes
        data_persistence = DataPersistence()
        ai_model = ArbitrageAIModel(args.model_path)
        simulation_engine = SimulationEngine(ai_model, data_persistence)
        
        # Obtener datos de entrenamiento
        if args.use_existing_data:
            logger.info("Cargando datos existentes...")
            training_data = await data_persistence.load_training_data()
            if not training_data:
                logger.error("No se encontraron datos existentes. Use --samples para generar nuevos.")
                return 1
        else:
            logger.info(f"Generando {args.samples} muestras de entrenamiento...")
            training_data = await simulation_engine.generate_training_data(
                args.samples, save_to_file=True
            )
        
        if len(training_data) < 10:
            logger.error(f"Datos insuficientes para entrenamiento: {len(training_data)} muestras")
            return 1
        
        logger.info(f"Datos de entrenamiento preparados: {len(training_data)} muestras")
        
        # Dividir datos
        split_index = int(len(training_data) * (1 - args.validation_split))
        train_data = training_data[:split_index]
        validation_data = training_data[split_index:]
        
        logger.info(f"División de datos - Entrenamiento: {len(train_data)}, Validación: {len(validation_data)}")
        
        # Entrenar modelo
        logger.info("Iniciando entrenamiento del modelo...")
        training_results = ai_model.train(train_data)
        
        # Validar modelo
        if validation_data:
            logger.info("Validando modelo...")
            validation_results = await simulation_engine._validate_model(validation_data)
            training_results['validation'] = validation_results
        
        # Mostrar resultados
        logger.info("=== RESULTADOS DEL ENTRENAMIENTO ===")
        logger.info(f"Precisión de rentabilidad: {training_results.get('profitability_accuracy', 0):.4f}")
        logger.info(f"Precisión: {training_results.get('profitability_precision', 0):.4f}")
        logger.info(f"Recall: {training_results.get('profitability_recall', 0):.4f}")
        logger.info(f"F1-Score: {training_results.get('profitability_f1', 0):.4f}")
        logger.info(f"RMSE de ganancia: {training_results.get('profit_rmse', 0):.4f}")
        logger.info(f"Precisión de riesgo: {training_results.get('risk_accuracy', 0):.4f}")
        
        if 'validation' in training_results:
            val_results = training_results['validation']
            logger.info(f"Precisión en validación: {val_results.get('accuracy', 0):.4f}")
            logger.info(f"Error de predicción de ganancia: {val_results.get('profit_prediction_error', 0):.4f}")
        
        # Validación cruzada
        cv_mean = training_results.get('cv_mean_accuracy', 0)
        cv_std = training_results.get('cv_std_accuracy', 0)
        logger.info(f"Validación cruzada: {cv_mean:.4f} ± {cv_std:.4f}")
        
        # Importancia de características
        feature_importance = training_results.get('feature_importance', {})
        if feature_importance:
            logger.info("Top 5 características más importantes:")
            sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
            for feature, importance in sorted_features[:5]:
                logger.info(f"  {feature}: {importance:.4f}")
        
        # Exportar resultados si se especifica
        if args.export_results:
            export_data = {
                'training_config': vars(args),
                'training_results': training_results,
                'model_info': ai_model.get_model_info(),
                'timestamp': datetime.now().isoformat()
            }
            
            with open(args.export_results, 'w') as f:
                json.dump(export_data, f, indent=2, default=str)
            
            logger.info(f"Resultados exportados a: {args.export_results}")
        
        logger.info("=== ENTRENAMIENTO COMPLETADO EXITOSAMENTE ===")
        return 0
        
    except Exception as e:
        logger.error(f"Error durante el entrenamiento: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

