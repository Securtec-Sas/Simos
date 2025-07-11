#!/usr/bin/env python3
# Simos/V3/backtest.py

"""
Script para realizar backtesting del modelo de IA.
Uso: python backtest.py [opciones]
"""

import asyncio
import argparse
import logging
import sys
import os
from datetime import datetime
import json
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Agregar el directorio V3 al path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_model import ArbitrageAIModel
from simulation_engine import SimulationEngine
from data_persistence import DataPersistence
from utils import setup_logging

async def main():
    parser = argparse.ArgumentParser(description='Realizar backtesting del modelo de IA')
    parser.add_argument('--data-file', type=str, default=None,
                       help='Archivo CSV con datos históricos para backtesting')
    parser.add_argument('--generate-data', type=int, default=0,
                       help='Generar N muestras sintéticas para backtesting')
    parser.add_argument('--initial-balance', type=float, default=1000.0,
                       help='Balance inicial para el backtesting (default: 1000 USDT)')
    parser.add_argument('--model-path', type=str, default=None,
                       help='Ruta del modelo entrenado a usar')
    parser.add_argument('--export-results', type=str, default=None,
                       help='Archivo donde exportar los resultados del backtesting')
    parser.add_argument('--plot-results', action='store_true',
                       help='Generar gráficos de los resultados')
    parser.add_argument('--log-level', type=str, default='INFO',
                       choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                       help='Nivel de logging (default: INFO)')
    
    args = parser.parse_args()
    
    # Configurar logging
    logger = setup_logging(args.log_level, 'logs/backtest.log')
    logger.info("=== INICIANDO BACKTESTING ===")
    logger.info(f"Configuración: {vars(args)}")
    
    try:
        # Inicializar componentes
        data_persistence = DataPersistence()
        ai_model = ArbitrageAIModel(args.model_path)
        simulation_engine = SimulationEngine(ai_model, data_persistence)
        
        # Verificar si el modelo está entrenado
        if not ai_model.is_trained:
            logger.warning("El modelo no está entrenado. Los resultados pueden no ser óptimos.")
        
        # Obtener datos para backtesting
        historical_data = []
        
        if args.data_file:
            logger.info(f"Cargando datos desde archivo: {args.data_file}")
            try:
                df = pd.read_csv(args.data_file)
                historical_data = df.to_dict('records')
                logger.info(f"Datos cargados: {len(historical_data)} registros")
            except Exception as e:
                logger.error(f"Error cargando archivo de datos: {e}")
                return 1
        
        elif args.generate_data > 0:
            logger.info(f"Generando {args.generate_data} muestras sintéticas...")
            historical_data = await simulation_engine.generate_training_data(
                args.generate_data, save_to_file=False
            )
        
        else:
            # Intentar cargar datos existentes
            logger.info("Cargando datos existentes...")
            historical_data = await data_persistence.load_training_data()
            if not historical_data:
                logger.error("No se encontraron datos. Use --data-file o --generate-data")
                return 1
        
        if len(historical_data) < 10:
            logger.error(f"Datos insuficientes para backtesting: {len(historical_data)} registros")
            return 1
        
        logger.info(f"Datos preparados para backtesting: {len(historical_data)} registros")
        
        # Ejecutar backtesting
        logger.info("Ejecutando backtesting...")
        backtest_results = await simulation_engine.run_backtest(
            historical_data, args.initial_balance
        )
        
        if 'error' in backtest_results:
            logger.error(f"Error en backtesting: {backtest_results['error']}")
            return 1
        
        # Analizar resultados
        logger.info("=== RESULTADOS DEL BACKTESTING ===")
        
        initial_balance = backtest_results['initial_balance']
        final_balance = backtest_results['final_balance']
        total_profit = backtest_results['total_profit']
        total_operations = backtest_results['total_operations']
        successful_operations = backtest_results['successful_operations']
        failed_operations = backtest_results['failed_operations']
        win_rate = backtest_results['win_rate']
        max_drawdown = backtest_results['max_drawdown']
        sharpe_ratio = backtest_results['sharpe_ratio']
        
        roi_percentage = ((final_balance - initial_balance) / initial_balance) * 100
        
        logger.info(f"Balance inicial: {initial_balance:.2f} USDT")
        logger.info(f"Balance final: {final_balance:.2f} USDT")
        logger.info(f"Ganancia total: {total_profit:.2f} USDT")
        logger.info(f"ROI: {roi_percentage:.2f}%")
        logger.info(f"Operaciones totales: {total_operations}")
        logger.info(f"Operaciones exitosas: {successful_operations}")
        logger.info(f"Operaciones fallidas: {failed_operations}")
        logger.info(f"Tasa de éxito: {win_rate:.2f}%")
        logger.info(f"Máximo drawdown: {max_drawdown:.2f}%")
        logger.info(f"Sharpe ratio: {sharpe_ratio:.4f}")
        
        # Análisis adicional
        operations_log = backtest_results.get('operations_log', [])
        if operations_log:
            profits = [op['profit'] for op in operations_log]
            avg_profit = np.mean(profits)
            std_profit = np.std(profits)
            max_profit = max(profits)
            min_profit = min(profits)
            
            logger.info(f"Ganancia promedio por operación: {avg_profit:.4f} USDT")
            logger.info(f"Desviación estándar: {std_profit:.4f} USDT")
            logger.info(f"Mejor operación: {max_profit:.4f} USDT")
            logger.info(f"Peor operación: {min_profit:.4f} USDT")
        
        # Generar gráficos si se solicita
        if args.plot_results and operations_log:
            logger.info("Generando gráficos...")
            await generate_plots(backtest_results, args.export_results)
        
        # Exportar resultados
        if args.export_results:
            export_data = {
                'backtest_config': vars(args),
                'backtest_results': backtest_results,
                'model_info': ai_model.get_model_info(),
                'timestamp': datetime.now().isoformat(),
                'summary': {
                    'initial_balance': initial_balance,
                    'final_balance': final_balance,
                    'roi_percentage': roi_percentage,
                    'total_operations': total_operations,
                    'win_rate': win_rate,
                    'max_drawdown': max_drawdown,
                    'sharpe_ratio': sharpe_ratio
                }
            }
            
            # Guardar como JSON
            json_file = args.export_results.replace('.csv', '.json') if args.export_results.endswith('.csv') else args.export_results + '.json'
            with open(json_file, 'w') as f:
                json.dump(export_data, f, indent=2, default=str)
            
            # Guardar operaciones como CSV
            if operations_log:
                csv_file = args.export_results.replace('.json', '.csv') if args.export_results.endswith('.json') else args.export_results + '.csv'
                df_operations = pd.DataFrame(operations_log)
                df_operations.to_csv(csv_file, index=False)
                logger.info(f"Operaciones exportadas a: {csv_file}")
            
            logger.info(f"Resultados exportados a: {json_file}")
        
        logger.info("=== BACKTESTING COMPLETADO ===")
        return 0
        
    except Exception as e:
        logger.error(f"Error durante backtesting: {e}")
        return 1

async def generate_plots(backtest_results, export_prefix):
    """Genera gráficos de los resultados del backtesting."""
    try:
        operations_log = backtest_results.get('operations_log', [])
        if not operations_log:
            return
        
        # Preparar datos
        df = pd.DataFrame(operations_log)
        
        # Configurar matplotlib para no mostrar ventanas
        plt.switch_backend('Agg')
        
        # Gráfico 1: Evolución del balance
        plt.figure(figsize=(12, 6))
        plt.plot(df.index, df['balance_after'], linewidth=2, color='blue')
        plt.title('Evolución del Balance Durante el Backtesting')
        plt.xlabel('Número de Operación')
        plt.ylabel('Balance (USDT)')
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        
        balance_plot = f"{export_prefix}_balance_evolution.png" if export_prefix else "backtest_balance_evolution.png"
        plt.savefig(balance_plot, dpi=300, bbox_inches='tight')
        plt.close()
        
        # Gráfico 2: Distribución de ganancias
        plt.figure(figsize=(10, 6))
        profits = df['profit']
        plt.hist(profits, bins=30, alpha=0.7, color='green', edgecolor='black')
        plt.axvline(profits.mean(), color='red', linestyle='--', linewidth=2, label=f'Media: {profits.mean():.4f}')
        plt.title('Distribución de Ganancias por Operación')
        plt.xlabel('Ganancia (USDT)')
        plt.ylabel('Frecuencia')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        
        profit_dist_plot = f"{export_prefix}_profit_distribution.png" if export_prefix else "backtest_profit_distribution.png"
        plt.savefig(profit_dist_plot, dpi=300, bbox_inches='tight')
        plt.close()
        
        # Gráfico 3: Ganancias acumuladas
        plt.figure(figsize=(12, 6))
        cumulative_profit = profits.cumsum()
        plt.plot(df.index, cumulative_profit, linewidth=2, color='green')
        plt.title('Ganancias Acumuladas')
        plt.xlabel('Número de Operación')
        plt.ylabel('Ganancia Acumulada (USDT)')
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        
        cumulative_plot = f"{export_prefix}_cumulative_profit.png" if export_prefix else "backtest_cumulative_profit.png"
        plt.savefig(cumulative_plot, dpi=300, bbox_inches='tight')
        plt.close()
        
        # Gráfico 4: Análisis por símbolo (si hay datos)
        if 'symbol' in df.columns:
            plt.figure(figsize=(12, 8))
            symbol_profits = df.groupby('symbol')['profit'].agg(['sum', 'count', 'mean']).sort_values('sum', ascending=False)
            
            # Top 10 símbolos por ganancia total
            top_symbols = symbol_profits.head(10)
            
            plt.subplot(2, 1, 1)
            top_symbols['sum'].plot(kind='bar', color='skyblue')
            plt.title('Top 10 Símbolos por Ganancia Total')
            plt.ylabel('Ganancia Total (USDT)')
            plt.xticks(rotation=45)
            
            plt.subplot(2, 1, 2)
            top_symbols['mean'].plot(kind='bar', color='lightcoral')
            plt.title('Ganancia Promedio por Símbolo')
            plt.ylabel('Ganancia Promedio (USDT)')
            plt.xticks(rotation=45)
            
            plt.tight_layout()
            
            symbol_plot = f"{export_prefix}_symbol_analysis.png" if export_prefix else "backtest_symbol_analysis.png"
            plt.savefig(symbol_plot, dpi=300, bbox_inches='tight')
            plt.close()
        
        print(f"Gráficos generados:")
        print(f"  - {balance_plot}")
        print(f"  - {profit_dist_plot}")
        print(f"  - {cumulative_plot}")
        if 'symbol' in df.columns:
            print(f"  - {symbol_plot}")
        
    except Exception as e:
        print(f"Error generando gráficos: {e}")

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

