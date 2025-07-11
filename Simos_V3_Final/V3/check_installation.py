#!/usr/bin/env python3
# Simos/V3/check_installation.py

"""
Script para verificar la instalación y dependencias de V3.
Uso: python check_installation.py
"""

import sys
import os
import importlib
import subprocess
from pathlib import Path

def check_python_version():
    """Verifica la versión de Python."""
    print("Verificando versión de Python...")
    version = sys.version_info
    
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(f"❌ Python {version.major}.{version.minor} no es compatible")
        print("   Se requiere Python 3.8 o superior")
        return False
    else:
        print(f"✅ Python {version.major}.{version.minor}.{version.micro} - Compatible")
        return True

def check_required_packages():
    """Verifica los paquetes requeridos."""
    print("\nVerificando paquetes requeridos...")
    
    required_packages = [
        'asyncio',
        'aiohttp',
        'websockets',
        'socketio',
        'ccxt',
        'pandas',
        'numpy',
        'sklearn',
        'joblib',
        'matplotlib',
        'seaborn'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            if package == 'socketio':
                importlib.import_module('socketio')
            elif package == 'sklearn':
                importlib.import_module('sklearn')
            else:
                importlib.import_module(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} - No instalado")
            missing_packages.append(package)
    
    return missing_packages

def check_directories():
    """Verifica y crea directorios necesarios."""
    print("\nVerificando directorios...")
    
    base_dir = Path(__file__).parent
    required_dirs = [
        base_dir / "logs",
        base_dir / "data", 
        base_dir / "models",
        base_dir / "experiments"
    ]
    
    for directory in required_dirs:
        if directory.exists():
            print(f"✅ {directory.name}/ - Existe")
        else:
            try:
                directory.mkdir(exist_ok=True)
                print(f"✅ {directory.name}/ - Creado")
            except Exception as e:
                print(f"❌ {directory.name}/ - Error: {e}")
                return False
    
    return True

def check_config_file():
    """Verifica el archivo de configuración."""
    print("\nVerificando configuración...")
    
    config_file = Path(__file__).parent / "config_v3.py"
    example_file = Path(__file__).parent / "config_example.py"
    
    if config_file.exists():
        print("✅ config_v3.py - Existe")
        try:
            # Intentar importar la configuración
            sys.path.insert(0, str(Path(__file__).parent))
            import config_v3
            print("✅ config_v3.py - Válido")
            return True
        except Exception as e:
            print(f"❌ config_v3.py - Error: {e}")
            return False
    else:
        print("❌ config_v3.py - No existe")
        if example_file.exists():
            print("💡 Copia config_example.py como config_v3.py y configúralo")
        return False

def check_scripts():
    """Verifica que los scripts principales existan."""
    print("\nVerificando scripts principales...")
    
    base_dir = Path(__file__).parent
    required_scripts = [
        "main_v3.py",
        "start_v3.py", 
        "train_model.py",
        "backtest.py",
        "simulate.py",
        "analyze_results.py",
        "run_experiments.py"
    ]
    
    missing_scripts = []
    
    for script in required_scripts:
        script_path = base_dir / script
        if script_path.exists():
            print(f"✅ {script}")
        else:
            print(f"❌ {script} - No encontrado")
            missing_scripts.append(script)
    
    return missing_scripts

def install_missing_packages(packages):
    """Instala paquetes faltantes."""
    if not packages:
        return True
    
    print(f"\n¿Instalar paquetes faltantes? ({', '.join(packages)}) [y/N]: ", end="")
    response = input().strip().lower()
    
    if response in ['y', 'yes', 'sí', 's']:
        print("Instalando paquetes...")
        
        # Mapeo de nombres de paquetes
        package_mapping = {
            'socketio': 'python-socketio[asyncio]',
            'sklearn': 'scikit-learn'
        }
        
        for package in packages:
            pip_package = package_mapping.get(package, package)
            try:
                subprocess.check_call([
                    sys.executable, "-m", "pip", "install", pip_package
                ])
                print(f"✅ {package} instalado")
            except subprocess.CalledProcessError as e:
                print(f"❌ Error instalando {package}: {e}")
                return False
        
        return True
    else:
        print("Instalación cancelada")
        return False

def run_basic_tests():
    """Ejecuta pruebas básicas."""
    print("\nEjecutando pruebas básicas...")
    
    try:
        # Test de importación de módulos principales
        sys.path.insert(0, str(Path(__file__).parent))
        
        print("  Probando importación de utils...")
        import utils
        print("  ✅ utils")
        
        print("  Probando importación de ai_model...")
        import ai_model
        print("  ✅ ai_model")
        
        print("  Probando importación de simulation_engine...")
        import simulation_engine
        print("  ✅ simulation_engine")
        
        print("  Probando creación de modelo de IA...")
        model = ai_model.ArbitrageAIModel()
        print("  ✅ ArbitrageAIModel")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error en pruebas: {e}")
        return False

def main():
    print("="*60)
    print("VERIFICACIÓN DE INSTALACIÓN - CRYPTO ARBITRAGE V3")
    print("="*60)
    
    all_checks_passed = True
    
    # Verificar Python
    if not check_python_version():
        all_checks_passed = False
    
    # Verificar paquetes
    missing_packages = check_required_packages()
    if missing_packages:
        all_checks_passed = False
        if not install_missing_packages(missing_packages):
            print("\n❌ No se pudieron instalar todos los paquetes requeridos")
            return 1
        else:
            # Verificar nuevamente después de la instalación
            missing_packages = check_required_packages()
            if missing_packages:
                all_checks_passed = False
    
    # Verificar directorios
    if not check_directories():
        all_checks_passed = False
    
    # Verificar configuración
    if not check_config_file():
        all_checks_passed = False
    
    # Verificar scripts
    missing_scripts = check_scripts()
    if missing_scripts:
        print(f"\n❌ Scripts faltantes: {', '.join(missing_scripts)}")
        all_checks_passed = False
    
    # Ejecutar pruebas básicas si todo está bien
    if all_checks_passed:
        if not run_basic_tests():
            all_checks_passed = False
    
    print("\n" + "="*60)
    if all_checks_passed:
        print("✅ VERIFICACIÓN COMPLETADA - TODO CORRECTO")
        print("="*60)
        print("V3 está listo para usar. Comandos disponibles:")
        print("  python start_v3.py                    # Iniciar V3")
        print("  python train_model.py --samples 1000  # Entrenar modelo")
        print("  python backtest.py --generate-data 500 # Hacer backtesting")
        print("  python simulate.py --duration 30      # Simulación 30 min")
        print("  python run_experiments.py full        # Experimento completo")
        return 0
    else:
        print("❌ VERIFICACIÓN FALLIDA - REVISAR ERRORES")
        print("="*60)
        print("Soluciona los problemas indicados antes de usar V3")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

