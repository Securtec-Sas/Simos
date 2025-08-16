# V3 - Sistema de Arbitraje con IA

Este directorio contiene el sistema V3 de arbitraje con inteligencia artificial, incluyendo modelos de machine learning y redes neuronales.

## Configuración del Entorno Virtual

### Requisitos Previos
- Python 3.8 o superior
- pip (gestor de paquetes de Python)

### Instalación Automática

1. **Configurar entorno virtual por primera vez:**
   ```bash
   # En Windows
   setup_env.bat
   ```

2. **Activar entorno virtual (uso diario):**
   ```bash
   # En Windows
   activate.bat
   ```

### Instalación Manual

1. **Crear entorno virtual:**
   ```bash
   python -m venv venv
   ```

2. **Activar entorno virtual:**
   ```bash
   # Windows
   venv\Scripts\activate

   # Linux/Mac
   source venv/bin/activate
   ```

3. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

## Estructura del Proyecto

```
V3/
├── core/                          # Núcleo del sistema
│   ├── ai_model.py               # Modelo de IA con red neuronal
│   ├── advanced_simulation_engine.py # Motor de simulación
│   ├── ai_model_test.py          # Tests del modelo AI
│   └── test_handler.py           # Manejador de tests
├── adapters/                      # Adaptadores
│   └── socket/
│       └── ui_broadcaster.py     # Broadcaster para UI
├── shared/                        # Utilidades compartidas
├── venv/                         # Entorno virtual (creado automáticamente)
├── requirements.txt              # Dependencias de Python
├── setup_env.bat                # Script de configuración
├── activate.bat                 # Script de activación rápida
└── README.md                    # Este archivo
```

## Componentes Principales

### 1. Modelo de IA (`core/ai_model.py`)
- **Red Neuronal**: Implementación con TensorFlow/Keras
- **Modelos Tradicionales**: Soporte para sklearn (RandomForest, GradientBoosting)
- **Predicción Múltiple**: Probabilidad de éxito, ganancia esperada, nivel de riesgo
- **Entrenamiento Avanzado**: Early stopping, regularización L2, dropout

### 2. Motor de Simulación (`core/advanced_simulation_engine.py`)
- **Integración con Sebo**: Obtiene datos reales desde endpoints
- **Modos de Operación**: Local, Sandbox, Real
- **Persistencia**: Todas las operaciones se guardan en base de datos
- **Validación Real**: Usa datos de CCXT para validar exchanges

## Uso

### Entrenar el Modelo de IA
```python
from core.ai_model import ArbitrageAIModel

# Crear modelo con red neuronal
model = ArbitrageAIModel(use_neural_network=True)

# Entrenar con datos históricos
training_data = [...]  # Datos de entrenamiento
result = model.train(training_data)
```

### Ejecutar Simulación
```python
from core.advanced_simulation_engine import AdvancedSimulationEngine

# Crear motor de simulación
engine = AdvancedSimulationEngine(ai_model, data_persistence)

# Iniciar simulación
await engine.start_simulation(mode=SimulationMode.LOCAL)
```

## Dependencias Principales

- **TensorFlow**: Red neuronal y deep learning
- **scikit-learn**: Modelos de machine learning tradicionales
- **NumPy/Pandas**: Manipulación de datos
- **aiohttp**: Cliente HTTP asíncrono
- **joblib**: Serialización de modelos

## Configuración

El sistema utiliza configuraciones desde `shared/config_v3.py`:
- Rutas de modelos
- Umbrales de confianza
- URLs de APIs
- Parámetros de red neuronal

## Tests

Ejecutar tests del modelo AI:
```bash
python core/ai_model_test.py
```

## Notas Importantes

1. **Entorno Virtual**: Siempre activar el entorno virtual antes de ejecutar código Python
2. **TensorFlow**: Si no tienes GPU, TensorFlow usará CPU automáticamente
3. **Memoria**: Los modelos de red neuronal requieren más memoria que sklearn
4. **Persistencia**: Todos los modelos entrenados se guardan automáticamente

## Solución de Problemas

### Error: "TensorFlow no está disponible"
- Instalar TensorFlow: `pip install tensorflow`
- El sistema funcionará con sklearn si TensorFlow no está disponible

### Error: "Modelo no entrenado"
- Entrenar el modelo antes de hacer predicciones
- Verificar que existe el archivo del modelo guardado

### Error de memoria con red neuronal
- Reducir batch_size en configuración
- Usar modelos sklearn como alternativa