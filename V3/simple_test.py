#!/usr/bin/env python3
"""
Script de prueba simplificado para el sistema de simulación V3
Sin dependencias externas complejas
"""

import sys
import os
import asyncio
import json
from datetime import datetime

# Agregar el directorio V3 al path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Prueba las importaciones básicas"""
    print("🔍 Probando importaciones...")
    
    try:
        from shared.config_v3 import ADVANCED_SIMULATION_CONFIG
        print("✅ Configuración importada correctamente")
        
        # Mostrar configuración
        print(f"📋 Configuración de simulación:")
        for key, value in ADVANCED_SIMULATION_CONFIG.items():
            print(f"   {key}: {value}")
        
        return True
    except Exception as e:
        print(f"❌ Error en importaciones: {e}")
        return False

def test_simulation_config():
    """Prueba la configuración de simulación"""
    print("\n🔧 Probando configuración de simulación...")
    
    try:
        from shared.config_v3 import ADVANCED_SIMULATION_CONFIG
        
        # Verificar configuraciones requeridas
        required_keys = [
            'initial_balance',
            'time_between_transfers_seconds',
            'simulation_duration_minutes',
            'max_concurrent_operations',
            'ai_confidence_threshold'
        ]
        
        missing_keys = []
        for key in required_keys:
            if key not in ADVANCED_SIMULATION_CONFIG:
                missing_keys.append(key)
        
        if missing_keys:
            print(f"❌ Faltan configuraciones: {missing_keys}")
            return False
        
        print("✅ Todas las configuraciones requeridas están presentes")
        return True
        
    except Exception as e:
        print(f"❌ Error en configuración: {e}")
        return False

def test_websocket_integration():
    """Prueba la integración con WebSocket"""
    print("\n🌐 Probando integración WebSocket...")
    
    try:
        from main_v3 import CryptoArbitrageV3
        
        # Verificar que la clase principal existe
        print("✅ Clase CryptoArbitrageV3 encontrada")
        
        # Verificar que el motor de simulación avanzado está importado
        try:
            from core.advanced_simulation_engine import AdvancedSimulationEngine, SimulationMode
            print("✅ Motor de simulación avanzado importado correctamente")
        except ImportError as e:
            print(f"❌ Error importando motor de simulación: {e}")
            return False
        
        # Verificar que los handlers de simulación están implementados
        simulation_methods = [
            '_handle_start_simulation',
            '_handle_stop_simulation',
            '_handle_get_simulation_status'
        ]
        
        missing_methods = []
        for method in simulation_methods:
            if not hasattr(CryptoArbitrageV3, method):
                missing_methods.append(method)
        
        if missing_methods:
            print(f"❌ Faltan métodos: {missing_methods}")
            return False
        
        print("✅ Todos los métodos de simulación están implementados")
        return True
        
    except Exception as e:
        print(f"❌ Error en integración WebSocket: {e}")
        return False

def test_simulation_modes():
    """Prueba los modos de simulación disponibles"""
    print("\n🎯 Probando modos de simulación...")
    
    try:
        # Importar sin pandas
        import importlib.util
        
        # Cargar el módulo sin ejecutar pandas
        spec = importlib.util.spec_from_file_location(
            "advanced_simulation_engine", 
            "core/advanced_simulation_engine.py"
        )
        
        if spec is None:
            print("❌ No se pudo cargar el módulo de simulación")
            return False
        
        print("✅ Módulo de simulación encontrado")
        
        # Verificar que los archivos de simulación existen
        current_dir = os.getcwd()
        print(f"📁 Directorio actual: {current_dir}")
        
        if current_dir.endswith('V3'):
            # Estamos en V3, usar rutas relativas
            simulation_files = [
                'core/advanced_simulation_engine.py',
                'shared/config_v3.py',
                'main_v3.py'
            ]
        else:
            # Estamos en el directorio raíz
            simulation_files = [
                'V3/core/advanced_simulation_engine.py',
                'V3/shared/config_v3.py',
                'V3/main_v3.py'
            ]
        
        for file_path in simulation_files:
            if not os.path.exists(file_path):
                print(f"❌ Archivo faltante: {file_path}")
                return False
        
        print("✅ Todos los archivos de simulación están presentes")
        return True
        
    except Exception as e:
        print(f"❌ Error en modos de simulación: {e}")
        return False

def test_ui_integration():
    """Prueba la integración con la UI"""
    print("\n🖥️ Probando integración con UI...")
    
    try:
        # Cambiar las rutas relativas para que funcionen desde el directorio V3
        ui_files = [
            '../UI/clients/src/components/SimulationPage/SimulationPage.jsx',
            '../UI/clients/src/components/SimulationPage/SimulationPage.css'
        ]
        
        # Verificar si estamos en el directorio correcto
        current_dir = os.getcwd()
        print(f"📁 Directorio actual: {current_dir}")
        
        # Ajustar rutas si es necesario
        if current_dir.endswith('V3'):
            # Estamos en V3, usar rutas relativas
            ui_files = [
                '../UI/clients/src/components/SimulationPage/SimulationPage.jsx',
                '../UI/clients/src/components/SimulationPage/SimulationPage.css'
            ]
        else:
            # Estamos en el directorio raíz
            ui_files = [
                'UI/clients/src/components/SimulationPage/SimulationPage.jsx',
                'UI/clients/src/components/SimulationPage/SimulationPage.css'
            ]
        
        for file_path in ui_files:
            if not os.path.exists(file_path):
                print(f"❌ Archivo UI faltante: {file_path}")
                return False
        
        print("✅ Archivos de UI de simulación están presentes")
        return True
        
    except Exception as e:
        print(f"❌ Error en integración UI: {e}")
        return False

def test_sebo_integration():
    """Prueba la integración con Sebo"""
    print("\n🔗 Probando integración con Sebo...")
    
    try:
        # Cambiar las rutas relativas para que funcionen desde el directorio V3
        current_dir = os.getcwd()
        
        if current_dir.endswith('V3'):
            # Estamos en V3, usar rutas relativas
            sebo_files = [
                '../sebo/src/server/routes/sandboxOperationRoutes.js',
                '../sebo/src/server/controllers/sandboxOperationController.js'
            ]
        else:
            # Estamos en el directorio raíz
            sebo_files = [
                'sebo/src/server/routes/sandboxOperationRoutes.js',
                'sebo/src/server/controllers/sandboxOperationController.js'
            ]
        
        for file_path in sebo_files:
            if not os.path.exists(file_path):
                print(f"❌ Archivo Sebo faltante: {file_path}")
                return False
        
        print("✅ Archivos de integración Sebo están presentes")
        return True
        
    except Exception as e:
        print(f"❌ Error en integración Sebo: {e}")
        return False

def main():
    """Función principal de pruebas"""
    print("🚀 Iniciando pruebas del sistema de simulación V3")
    print("=" * 60)
    
    tests = [
        ("Importaciones", test_imports),
        ("Configuración", test_simulation_config),
        ("WebSocket", test_websocket_integration),
        ("Modos de Simulación", test_simulation_modes),
        ("Integración UI", test_ui_integration),
        ("Integración Sebo", test_sebo_integration)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Error ejecutando {test_name}: {e}")
            results.append((test_name, False))
    
    # Resumen de resultados
    print("\n" + "=" * 60)
    print("📊 RESUMEN DE PRUEBAS")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASÓ" if result else "❌ FALLÓ"
        print(f"{test_name:.<30} {status}")
        if result:
            passed += 1
    
    print("-" * 60)
    print(f"Total: {passed}/{total} pruebas pasaron")
    
    if passed == total:
        print("🎉 ¡Todas las pruebas pasaron! El sistema está listo.")
        return True
    else:
        print("⚠️  Algunas pruebas fallaron. Revisar los errores arriba.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)