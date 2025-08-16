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
        'seaborn',
        'watchdog',
        'tensorflow'
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
    
    config_file = Path(__file__).parent.parent / "shared/config_v3.py"
    example_file = Path(__file__).parent.parent / "config_example.py"
    
    if config_file.exists():
        print("✅ config_v3.py - Existe")
        try:
            # Intentar importar la configuración
            sys.path.insert(0, str(Path(__file__).parent.parent))
            from shared import config_v3
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
    parent_dir = base_dir.parent

    required_scripts = {
        "main_v3.py": parent_dir,
        "start_v3.py": base_dir,
        "train_model.py": base_dir,
        "backtest.py": base_dir,
        "simulate.py": base_dir,
        "analyze_results.py": base_dir,
        "run_experiments.py": base_dir
    }
    
    missing_scripts = []
    
    for script, location in required_scripts.items():
        script_path = location / script
        if script_path.exists():
            print(f"✅ {script}")
        else:
            print(f"❌ {script} - No encontrado en {location}")
            missing_scripts.append(script)
    
    return missing_scripts

def check_pip_available():
    """Verifica si pip está disponible."""
    try:
        python_executable = sys.executable or "python"
        cmd = [str(python_executable), "-m", "pip", "--version"]
        subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False
    except Exception:
        return False

def install_pip():
    """Instala pip si no está disponible."""
    print("\n🔧 pip no está instalado. Intentando instalar pip...")
    
    # Intentar con ensurepip primero
    try:
        import ensurepip
        ensurepip.bootstrap()
        print("✅ pip instalado exitosamente usando ensurepip")
        return True
    except ImportError:
        print("❌ ensurepip no está disponible")
    except Exception as e:
        print(f"❌ Error instalando pip: {e}")
    
    # Verificar si estamos en un entorno virtual
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("\n🐍 Detectado entorno virtual")
        print("💡 Para instalar pip en el entorno virtual:")
        print("   1. python -m ensurepip --upgrade")
        print("   2. python -m pip install --upgrade pip")
        print("   3. Si falla, reactiva el entorno: python -m venv venv")
        print("      luego: venv\\Scripts\\activate (Windows) o source venv/bin/activate (Linux/Mac)")
    else:
        print("\n💡 Soluciones alternativas:")
        print("   1. Crea un entorno virtual:")
        print("      python -m venv venv")
        print("      venv\\Scripts\\activate (Windows) o source venv/bin/activate (Linux/Mac)")
        print("   2. Descarga get-pip.py desde https://bootstrap.pypa.io/get-pip.py")
        print("   3. Ejecuta: python get-pip.py")
        print("   4. Reinstala Python y asegúrate de marcar 'Add pip to PATH'")
    
    return False

def check_virtual_environment():
    """Verifica si estamos en un entorno virtual."""
    return (
        hasattr(sys, 'real_prefix') or 
        (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix)
    )

def install_missing_packages(packages):
    """Instala paquetes faltantes."""
    if not packages:
        return True
    
    print(f"\n¿Instalar paquetes faltantes? ({', '.join(packages)}) [y/N]: ", end="")
    response = input().strip().lower()
    
    if response in ['y', 'yes', 'sí', 's']:
        # Verificar si pip está disponible
        if not check_pip_available():
            if not install_pip():
                print("❌ No se puede continuar sin pip")
                return False
        
        # Obtener el ejecutable de Python de forma segura
        python_executable = sys.executable or "python"
        
        # Verificar que el ejecutable existe
        if not python_executable or python_executable == "None":
            python_executable = "python"
        
        print("Instalando paquetes...")
        
        # Mapeo de nombres de paquetes
        package_mapping = {
            'socketio': 'python-socketio[asyncio]',
            'sklearn': 'scikit-learn'
        }
        
        success_count = 0
        failed_packages = []
        
        for package in packages:
            pip_package = package_mapping.get(package, package)
            try:
                cmd = [str(python_executable), "-m", "pip", "install", pip_package]
                subprocess.check_call(cmd, shell=False)
                print(f"✅ {package} instalado")
                success_count += 1
            except subprocess.CalledProcessError as e:
                print(f"❌ Error instalando {package}: {e}")
                failed_packages.append(package)
            except Exception as e:
                print(f"❌ Error inesperado instalando {package}: {e}")
                failed_packages.append(package)
        
        if failed_packages:
            print(f"\n⚠️  Algunos paquetes no se pudieron instalar: {', '.join(failed_packages)}")
            print("   Intenta instalarlos manualmente:")
            for pkg in failed_packages:
                print(f"   python -m pip install {package_mapping.get(pkg, pkg)}")
            return len(failed_packages) < len(packages)
        
        return success_count > 0
    else:
        print("Instalación cancelada")
        return False

def run_basic_tests():
    """Ejecuta pruebas básicas."""
    print("\nEjecutando pruebas básicas...")
    
    try:
        # Test de importación de módulos principales
        sys.path.insert(0, str(Path(__file__).parent.parent))
        
        print("  Probando importación de shared.utils...")
        from shared import utils
        print("  ✅ shared.utils")
        
        print("  Probando importación de core.ai_model...")
        from core import ai_model
        print("  ✅ core.ai_model")
        
        print("  Probando importación de core.simulation_engine...")
        from core import simulation_engine
        print("  ✅ core.simulation_engine")
        
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
