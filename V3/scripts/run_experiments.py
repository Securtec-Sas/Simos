#!/usr/bin/env python3
# Simos/V3/run_experiments.py

"""
Script de automatización para ejecutar experimentos completos de entrenamiento, backtesting y simulación.
Uso: python run_experiments.py [comando] [opciones]
"""

import asyncio
import argparse
import subprocess
import sys
import os
from datetime import datetime
import json

def run_command(command, description):
    """Ejecuta un comando y maneja errores."""
    print(f"\n{'='*60}")
    print(f"EJECUTANDO: {description}")
    print(f"COMANDO: {' '.join(command)}")
    print('='*60)
    
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        return True
    except subprocess.CalledProcessError as e:
        print(f"ERROR: {e}")
        print(f"STDOUT: {e.stdout}")
        print(f"STDERR: {e.stderr}")
        return False

def create_experiment_config(name, config):
    """Crea un archivo de configuración para el experimento."""
    config_file = f"experiments/{name}_config.json"
    os.makedirs("experiments", exist_ok=True)
    
    with open(config_file, 'w') as f:
        json.dump(config, f, indent=2)
    
    return config_file

def run_full_experiment(args):
    """Ejecuta un experimento completo: entrenamiento -> backtesting -> simulación."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    experiment_name = f"experiment_{timestamp}"
    
    print(f"Iniciando experimento completo: {experiment_name}")
    
    # Configuración del experimento
    config = {
        "experiment_name": experiment_name,
        "timestamp": timestamp,
        "training_samples": args.training_samples,
        "backtest_samples": args.backtest_samples,
        "simulation_duration": args.simulation_duration,
        "initial_balance": args.initial_balance
    }
    
    config_file = create_experiment_config(experiment_name, config)
    print(f"Configuración guardada en: {config_file}")
    
    results_dir = f"experiments/{experiment_name}"
    os.makedirs(results_dir, exist_ok=True)
    
    # Paso 1: Entrenamiento
    training_command = [
        sys.executable, "train_model.py",
        "--samples", str(args.training_samples),
        "--validation-split", str(args.validation_split),
        "--export-results", f"{results_dir}/training_results.json",
        "--log-level", args.log_level
    ]
    
    if not run_command(training_command, "Entrenamiento del modelo"):
        print("ERROR: Falló el entrenamiento")
        return False
    
    # Paso 2: Backtesting
    backtest_command = [
        sys.executable, "backtest.py",
        "--generate-data", str(args.backtest_samples),
        "--initial-balance", str(args.initial_balance),
        "--export-results", f"{results_dir}/backtest_results.json",
        "--plot-results",
        "--log-level", args.log_level
    ]
    
    if not run_command(backtest_command, "Backtesting"):
        print("ERROR: Falló el backtesting")
        return False
    
    # Paso 3: Simulación
    simulation_command = [
        sys.executable, "simulate.py",
        "--duration", str(args.simulation_duration),
        "--initial-balance", str(args.initial_balance),
        "--operations-per-minute", str(args.operations_per_minute),
        "--export-results", f"{results_dir}/simulation_results.json",
        "--log-level", args.log_level
    ]
    
    if not run_command(simulation_command, "Simulación en vivo"):
        print("ERROR: Falló la simulación")
        return False
    
    # Paso 4: Análisis de resultados
    analysis_command = [
        sys.executable, "analyze_results.py",
        "--directory", results_dir,
        "--compare",
        "--plot",
        "--output-dir", results_dir
    ]
    
    if not run_command(analysis_command, "Análisis de resultados"):
        print("WARNING: Falló el análisis de resultados")
    
    print(f"\n{'='*60}")
    print(f"EXPERIMENTO COMPLETADO: {experiment_name}")
    print(f"Resultados en: {results_dir}")
    print('='*60)
    
    return True

def run_training_only(args):
    """Ejecuta solo entrenamiento."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    command = [
        sys.executable, "train_model.py",
        "--samples", str(args.training_samples),
        "--validation-split", str(args.validation_split),
        "--export-results", f"training_results_{timestamp}.json",
        "--log-level", args.log_level
    ]
    
    return run_command(command, "Entrenamiento del modelo")

def run_backtest_only(args):
    """Ejecuta solo backtesting."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    command = [
        sys.executable, "backtest.py",
        "--generate-data", str(args.backtest_samples),
        "--initial-balance", str(args.initial_balance),
        "--export-results", f"backtest_results_{timestamp}.json",
        "--plot-results",
        "--log-level", args.log_level
    ]
    
    return run_command(command, "Backtesting")

def run_simulation_only(args):
    """Ejecuta solo simulación."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    command = [
        sys.executable, "simulate.py",
        "--duration", str(args.simulation_duration),
        "--initial-balance", str(args.initial_balance),
        "--operations-per-minute", str(args.operations_per_minute),
        "--export-results", f"simulation_results_{timestamp}.json",
        "--log-level", args.log_level
    ]
    
    return run_command(command, "Simulación en vivo")

def run_analysis_only(args):
    """Ejecuta solo análisis."""
    command = [
        sys.executable, "analyze_results.py",
        "--directory", args.results_directory,
        "--compare",
        "--plot",
        "--output-dir", args.output_directory
    ]
    
    return run_command(command, "Análisis de resultados")

def run_parameter_sweep(args):
    """Ejecuta un barrido de parámetros."""
    print("Ejecutando barrido de parámetros...")
    
    # Parámetros a probar
    training_samples_list = [500, 1000, 2000]
    validation_splits = [0.1, 0.2, 0.3]
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    sweep_dir = f"experiments/parameter_sweep_{timestamp}"
    os.makedirs(sweep_dir, exist_ok=True)
    
    results = []
    
    for samples in training_samples_list:
        for val_split in validation_splits:
            experiment_name = f"samples_{samples}_valsplit_{val_split}"
            print(f"\nEjecutando configuración: {experiment_name}")
            
            # Entrenamiento
            training_command = [
                sys.executable, "train_model.py",
                "--samples", str(samples),
                "--validation-split", str(val_split),
                "--export-results", f"{sweep_dir}/{experiment_name}_training.json",
                "--log-level", "WARNING"  # Menos verbose para barrido
            ]
            
            if run_command(training_command, f"Entrenamiento {experiment_name}"):
                # Backtesting rápido
                backtest_command = [
                    sys.executable, "backtest.py",
                    "--generate-data", "200",  # Menos datos para rapidez
                    "--initial-balance", str(args.initial_balance),
                    "--export-results", f"{sweep_dir}/{experiment_name}_backtest.json",
                    "--log-level", "WARNING"
                ]
                
                if run_command(backtest_command, f"Backtesting {experiment_name}"):
                    results.append({
                        "experiment": experiment_name,
                        "training_samples": samples,
                        "validation_split": val_split,
                        "status": "success"
                    })
                else:
                    results.append({
                        "experiment": experiment_name,
                        "training_samples": samples,
                        "validation_split": val_split,
                        "status": "backtest_failed"
                    })
            else:
                results.append({
                    "experiment": experiment_name,
                    "training_samples": samples,
                    "validation_split": val_split,
                    "status": "training_failed"
                })
    
    # Guardar resumen del barrido
    summary_file = f"{sweep_dir}/parameter_sweep_summary.json"
    with open(summary_file, 'w') as f:
        json.dump({
            "timestamp": timestamp,
            "parameters_tested": {
                "training_samples": training_samples_list,
                "validation_splits": validation_splits
            },
            "results": results
        }, f, indent=2)
    
    # Análisis final
    analysis_command = [
        sys.executable, "analyze_results.py",
        "--directory", sweep_dir,
        "--compare",
        "--plot",
        "--output-dir", sweep_dir
    ]
    
    run_command(analysis_command, "Análisis del barrido de parámetros")
    
    print(f"\nBarrido de parámetros completado. Resultados en: {sweep_dir}")
    return True

def main():
    parser = argparse.ArgumentParser(description='Automatización de experimentos de IA para arbitraje')
    subparsers = parser.add_subparsers(dest='command', help='Comandos disponibles')
    
    # Comando: experimento completo
    full_parser = subparsers.add_parser('full', help='Ejecutar experimento completo')
    full_parser.add_argument('--training-samples', type=int, default=1000)
    full_parser.add_argument('--backtest-samples', type=int, default=500)
    full_parser.add_argument('--simulation-duration', type=int, default=30)
    full_parser.add_argument('--initial-balance', type=float, default=1000.0)
    full_parser.add_argument('--validation-split', type=float, default=0.2)
    full_parser.add_argument('--operations-per-minute', type=float, default=1.0)
    full_parser.add_argument('--log-level', type=str, default='INFO')
    
    # Comando: solo entrenamiento
    train_parser = subparsers.add_parser('train', help='Solo entrenamiento')
    train_parser.add_argument('--training-samples', type=int, default=1000)
    train_parser.add_argument('--validation-split', type=float, default=0.2)
    train_parser.add_argument('--log-level', type=str, default='INFO')
    
    # Comando: solo backtesting
    backtest_parser = subparsers.add_parser('backtest', help='Solo backtesting')
    backtest_parser.add_argument('--backtest-samples', type=int, default=500)
    backtest_parser.add_argument('--initial-balance', type=float, default=1000.0)
    backtest_parser.add_argument('--log-level', type=str, default='INFO')
    
    # Comando: solo simulación
    sim_parser = subparsers.add_parser('simulate', help='Solo simulación')
    sim_parser.add_argument('--simulation-duration', type=int, default=30)
    sim_parser.add_argument('--initial-balance', type=float, default=1000.0)
    sim_parser.add_argument('--operations-per-minute', type=float, default=1.0)
    sim_parser.add_argument('--log-level', type=str, default='INFO')
    
    # Comando: solo análisis
    analysis_parser = subparsers.add_parser('analyze', help='Solo análisis')
    analysis_parser.add_argument('--results-directory', type=str, default='.')
    analysis_parser.add_argument('--output-directory', type=str, default='.')
    
    # Comando: barrido de parámetros
    sweep_parser = subparsers.add_parser('sweep', help='Barrido de parámetros')
    sweep_parser.add_argument('--initial-balance', type=float, default=1000.0)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # Crear directorios necesarios
    os.makedirs('logs', exist_ok=True)
    os.makedirs('experiments', exist_ok=True)
    
    # Ejecutar comando
    success = False
    
    if args.command == 'full':
        success = run_full_experiment(args)
    elif args.command == 'train':
        success = run_training_only(args)
    elif args.command == 'backtest':
        success = run_backtest_only(args)
    elif args.command == 'simulate':
        success = run_simulation_only(args)
    elif args.command == 'analyze':
        success = run_analysis_only(args)
    elif args.command == 'sweep':
        success = run_parameter_sweep(args)
    
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

