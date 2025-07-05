#!/usr/bin/env python3
# Simos/V3/analyze_results.py

"""
Script para analizar resultados de entrenamiento, backtesting y simulaciones.
Uso: python analyze_results.py [opciones]
"""

import argparse
import json
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from datetime import datetime
import os
import glob

def load_results_file(filepath):
    """Carga un archivo de resultados JSON."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error cargando {filepath}: {e}")
        return None

def analyze_training_results(results_data):
    """Analiza resultados de entrenamiento."""
    print("\n=== ANÁLISIS DE ENTRENAMIENTO ===")
    
    training_results = results_data.get('training_results', {})
    
    # Métricas principales
    metrics = {
        'Precisión de Rentabilidad': training_results.get('profitability_accuracy', 0),
        'Precisión': training_results.get('profitability_precision', 0),
        'Recall': training_results.get('profitability_recall', 0),
        'F1-Score': training_results.get('profitability_f1', 0),
        'RMSE de Ganancia': training_results.get('profit_rmse', 0),
        'Precisión de Riesgo': training_results.get('risk_accuracy', 0)
    }
    
    print("Métricas del Modelo:")
    for metric, value in metrics.items():
        print(f"  {metric}: {value:.4f}")
    
    # Validación cruzada
    cv_mean = training_results.get('cv_mean_accuracy', 0)
    cv_std = training_results.get('cv_std_accuracy', 0)
    print(f"\nValidación Cruzada: {cv_mean:.4f} ± {cv_std:.4f}")
    
    # Importancia de características
    feature_importance = training_results.get('feature_importance', {})
    if feature_importance:
        print("\nTop 10 Características Más Importantes:")
        sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
        for i, (feature, importance) in enumerate(sorted_features[:10], 1):
            print(f"  {i:2d}. {feature}: {importance:.4f}")
    
    # Validación
    validation = training_results.get('validation', {})
    if validation:
        print(f"\nResultados de Validación:")
        print(f"  Precisión: {validation.get('accuracy', 0):.4f}")
        print(f"  Error de Predicción de Ganancia: {validation.get('profit_prediction_error', 0):.4f}")
    
    return metrics

def analyze_backtest_results(results_data):
    """Analiza resultados de backtesting."""
    print("\n=== ANÁLISIS DE BACKTESTING ===")
    
    summary = results_data.get('summary', {})
    backtest_results = results_data.get('backtest_results', {})
    
    # Métricas principales
    initial_balance = summary.get('initial_balance', 0)
    final_balance = summary.get('final_balance', 0)
    roi_percentage = summary.get('roi_percentage', 0)
    total_operations = summary.get('total_operations', 0)
    win_rate = summary.get('win_rate', 0)
    max_drawdown = summary.get('max_drawdown', 0)
    sharpe_ratio = summary.get('sharpe_ratio', 0)
    
    print("Métricas de Rendimiento:")
    print(f"  Balance Inicial: {initial_balance:.2f} USDT")
    print(f"  Balance Final: {final_balance:.2f} USDT")
    print(f"  ROI: {roi_percentage:.2f}%")
    print(f"  Operaciones Totales: {total_operations}")
    print(f"  Tasa de Éxito: {win_rate:.2f}%")
    print(f"  Máximo Drawdown: {max_drawdown:.2f}%")
    print(f"  Sharpe Ratio: {sharpe_ratio:.4f}")
    
    # Análisis de riesgo
    print("\nAnálisis de Riesgo:")
    if roi_percentage > 20:
        risk_level = "ALTO RENDIMIENTO"
    elif roi_percentage > 10:
        risk_level = "RENDIMIENTO MODERADO"
    elif roi_percentage > 0:
        risk_level = "RENDIMIENTO BAJO"
    else:
        risk_level = "PÉRDIDAS"
    
    print(f"  Nivel de Rendimiento: {risk_level}")
    
    if max_drawdown > 20:
        risk_assessment = "ALTO RIESGO"
    elif max_drawdown > 10:
        risk_assessment = "RIESGO MODERADO"
    else:
        risk_assessment = "BAJO RIESGO"
    
    print(f"  Evaluación de Riesgo: {risk_assessment}")
    
    return summary

def analyze_simulation_results(results_data):
    """Analiza resultados de simulación."""
    print("\n=== ANÁLISIS DE SIMULACIÓN ===")
    
    summary = results_data.get('summary', {})
    
    # Métricas principales
    initial_balance = summary.get('initial_balance', 0)
    final_balance = summary.get('final_balance', 0)
    roi_percentage = summary.get('roi_percentage', 0)
    total_operations = summary.get('total_operations', 0)
    win_rate = summary.get('win_rate', 0)
    total_profit = summary.get('total_profit', 0)
    
    print("Métricas de Simulación:")
    print(f"  Balance Inicial: {initial_balance:.2f} USDT")
    print(f"  Balance Final: {final_balance:.2f} USDT")
    print(f"  ROI: {roi_percentage:.2f}%")
    print(f"  Ganancia Total: {total_profit:.2f} USDT")
    print(f"  Operaciones Totales: {total_operations}")
    print(f"  Tasa de Éxito: {win_rate:.2f}%")
    
    if total_operations > 0:
        avg_profit = total_profit / total_operations
        print(f"  Ganancia Promedio por Operación: {avg_profit:.4f} USDT")
    
    return summary

def compare_results(results_list):
    """Compara múltiples resultados."""
    print("\n=== COMPARACIÓN DE RESULTADOS ===")
    
    comparison_data = []
    
    for i, (filepath, results) in enumerate(results_list):
        filename = os.path.basename(filepath)
        
        # Determinar tipo de resultado
        if 'training_results' in results:
            result_type = 'Training'
            roi = None
            accuracy = results.get('training_results', {}).get('profitability_accuracy', 0)
        elif 'backtest_results' in results:
            result_type = 'Backtest'
            roi = results.get('summary', {}).get('roi_percentage', 0)
            accuracy = None
        elif 'simulation_results' in results:
            result_type = 'Simulation'
            roi = results.get('summary', {}).get('roi_percentage', 0)
            accuracy = None
        else:
            result_type = 'Unknown'
            roi = None
            accuracy = None
        
        comparison_data.append({
            'Archivo': filename,
            'Tipo': result_type,
            'ROI (%)': roi,
            'Precisión': accuracy,
            'Fecha': results.get('timestamp', 'N/A')
        })
    
    if comparison_data:
        df = pd.DataFrame(comparison_data)
        print(df.to_string(index=False))
        
        # Estadísticas de ROI
        roi_values = [x for x in df['ROI (%)'].values if x is not None]
        if roi_values:
            print(f"\nEstadísticas de ROI:")
            print(f"  Promedio: {np.mean(roi_values):.2f}%")
            print(f"  Mediana: {np.median(roi_values):.2f}%")
            print(f"  Mejor: {max(roi_values):.2f}%")
            print(f"  Peor: {min(roi_values):.2f}%")

def generate_comparison_plots(results_list, output_dir):
    """Genera gráficos de comparación."""
    try:
        plt.style.use('seaborn-v0_8')
    except:
        plt.style.use('default')
    
    # Preparar datos para gráficos
    roi_data = []
    accuracy_data = []
    
    for filepath, results in results_list:
        filename = os.path.basename(filepath).replace('.json', '')
        
        if 'summary' in results and 'roi_percentage' in results['summary']:
            roi_data.append({
                'Archivo': filename,
                'ROI': results['summary']['roi_percentage']
            })
        
        if 'training_results' in results:
            accuracy = results['training_results'].get('profitability_accuracy', 0)
            accuracy_data.append({
                'Archivo': filename,
                'Precisión': accuracy
            })
    
    # Gráfico de ROI
    if roi_data:
        plt.figure(figsize=(12, 6))
        df_roi = pd.DataFrame(roi_data)
        
        plt.subplot(1, 2, 1)
        bars = plt.bar(range(len(df_roi)), df_roi['ROI'], color='skyblue', edgecolor='navy')
        plt.title('Comparación de ROI')
        plt.ylabel('ROI (%)')
        plt.xticks(range(len(df_roi)), df_roi['Archivo'], rotation=45, ha='right')
        
        # Añadir valores en las barras
        for bar, value in zip(bars, df_roi['ROI']):
            plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                    f'{value:.1f}%', ha='center', va='bottom')
        
        plt.grid(True, alpha=0.3)
    
    # Gráfico de precisión
    if accuracy_data:
        if not roi_data:
            plt.figure(figsize=(6, 6))
            subplot_pos = 111
        else:
            subplot_pos = 122
        
        plt.subplot(subplot_pos)
        df_acc = pd.DataFrame(accuracy_data)
        
        bars = plt.bar(range(len(df_acc)), df_acc['Precisión'], color='lightcoral', edgecolor='darkred')
        plt.title('Comparación de Precisión del Modelo')
        plt.ylabel('Precisión')
        plt.xticks(range(len(df_acc)), df_acc['Archivo'], rotation=45, ha='right')
        
        # Añadir valores en las barras
        for bar, value in zip(bars, df_acc['Precisión']):
            plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                    f'{value:.3f}', ha='center', va='bottom')
        
        plt.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    output_file = os.path.join(output_dir, 'comparison_plots.png')
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"\nGráfico de comparación guardado en: {output_file}")

def main():
    parser = argparse.ArgumentParser(description='Analizar resultados de entrenamiento, backtesting y simulaciones')
    parser.add_argument('files', nargs='*', help='Archivos JSON de resultados a analizar')
    parser.add_argument('--directory', type=str, default=None,
                       help='Directorio donde buscar archivos de resultados')
    parser.add_argument('--pattern', type=str, default='*.json',
                       help='Patrón de archivos a buscar (default: *.json)')
    parser.add_argument('--compare', action='store_true',
                       help='Comparar múltiples resultados')
    parser.add_argument('--plot', action='store_true',
                       help='Generar gráficos de comparación')
    parser.add_argument('--output-dir', type=str, default='.',
                       help='Directorio de salida para gráficos (default: .)')
    
    args = parser.parse_args()
    
    # Recopilar archivos a analizar
    files_to_analyze = []
    
    if args.files:
        files_to_analyze.extend(args.files)
    
    if args.directory:
        pattern_path = os.path.join(args.directory, args.pattern)
        files_to_analyze.extend(glob.glob(pattern_path))
    
    if not files_to_analyze:
        print("No se especificaron archivos para analizar.")
        print("Use --directory para buscar en un directorio o especifique archivos directamente.")
        return 1
    
    # Cargar y analizar resultados
    results_list = []
    
    for filepath in files_to_analyze:
        print(f"\n{'='*60}")
        print(f"ANALIZANDO: {filepath}")
        print('='*60)
        
        results = load_results_file(filepath)
        if results is None:
            continue
        
        results_list.append((filepath, results))
        
        # Analizar según el tipo de resultado
        if 'training_results' in results:
            analyze_training_results(results)
        elif 'backtest_results' in results:
            analyze_backtest_results(results)
        elif 'simulation_results' in results:
            analyze_simulation_results(results)
        else:
            print("Tipo de resultado no reconocido")
    
    # Comparación si se solicita
    if args.compare and len(results_list) > 1:
        compare_results(results_list)
    
    # Generar gráficos si se solicita
    if args.plot and len(results_list) > 1:
        os.makedirs(args.output_dir, exist_ok=True)
        generate_comparison_plots(results_list, args.output_dir)
    
    print(f"\n{'='*60}")
    print("ANÁLISIS COMPLETADO")
    print('='*60)
    
    return 0

if __name__ == "__main__":
    exit_code = main()
    exit(exit_code)

