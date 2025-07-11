# Simos V3 - Sistema de Trading de Arbitraje con IA

## Descripción General

Simos V3 es una evolución completa del sistema de arbitraje de criptomonedas que integra inteligencia artificial para la toma de decisiones automatizada. El sistema se conecta al socket de Sebo para recibir datos en tiempo real, los procesa usando un modelo de IA entrenado, y ejecuta operaciones de arbitraje de manera autónoma.

## Características Principales

### 🤖 Inteligencia Artificial Integrada
- Modelo de machine learning para predicción de rentabilidad
- Análisis de riesgo automatizado
- Entrenamiento continuo con datos históricos
- Validación cruzada y métricas de rendimiento

### 📊 Sistema de Trading Automatizado
- Conexión en tiempo real con múltiples exchanges
- Cálculo automático de fees y comisiones de transferencia
- Selección de redes más económicas para transferencias
- Gestión de balance y riesgo

### 🔄 Integración con Sebo y UI
- Recepción de datos Top20 desde Sebo via WebSocket
- Retransmisión de datos procesados a la UI
- Control de trading desde la interfaz web
- Monitoreo en tiempo real del estado del sistema

### 🧪 Herramientas de Desarrollo y Testing
- Sistema completo de entrenamiento del modelo
- Backtesting con datos históricos
- Simulación en tiempo real
- Análisis de resultados y métricas
- Automatización de experimentos

## Estructura del Proyecto

```
Simos/
├── V3/                          # Nueva versión con IA
│   ├── main_v3.py              # Aplicación principal
│   ├── start_v3.py             # Script de inicio
│   ├── config_v3.py            # Configuración (crear desde config_example.py)
│   ├── config_example.py       # Ejemplo de configuración
│   ├── check_installation.py   # Verificación de instalación
│   ├── requirements.txt        # Dependencias
│   │
│   ├── # Módulos principales
│   ├── ai_model.py             # Modelo de IA
│   ├── simulation_engine.py    # Motor de simulación
│   ├── trading_logic.py        # Lógica de trading
│   ├── exchange_manager.py     # Gestión de exchanges
│   ├── sebo_connector.py       # Conexión con Sebo
│   ├── ui_broadcaster.py       # Comunicación con UI
│   ├── data_persistence.py     # Persistencia de datos
│   ├── utils.py                # Utilidades
│   │
│   ├── # Scripts de entrenamiento y testing
│   ├── train_model.py          # Entrenamiento del modelo
│   ├── backtest.py             # Backtesting
│   ├── simulate.py             # Simulación en vivo
│   ├── analyze_results.py      # Análisis de resultados
│   ├── run_experiments.py      # Automatización de experimentos
│   │
│   └── # Directorios de datos
│       ├── logs/               # Archivos de log
│       ├── data/               # Datos y cache
│       ├── models/             # Modelos entrenados
│       └── experiments/        # Resultados de experimentos
│
├── UI/                         # Interfaz web (archivos corregidos)
│   └── clients/src/
│       ├── App_fixed.jsx       # Aplicación principal corregida
│       ├── Layout_fixed.jsx    # Layout corregido
│       ├── Top20DetailedPage_fixed.jsx  # Página Top20 mejorada
│       └── ExchangeAPIsPage.jsx # Nueva página de gestión de APIs
│
└── Sebo/                       # Sistema original (sin cambios)
    └── (archivos originales)
```

## Instalación y Configuración

### 1. Requisitos del Sistema

- Python 3.8 o superior
- Node.js 16+ (para la UI)
- 4GB RAM mínimo
- Conexión a internet estable

### 2. Instalación de Dependencias

```bash
# Navegar al directorio V3
cd Simos/V3

# Instalar dependencias de Python
pip install -r requirements.txt

# Verificar instalación
python check_installation.py
```

### 3. Configuración

```bash
# Copiar archivo de configuración de ejemplo
cp config_example.py config_v3.py

# Editar configuración según tus necesidades
nano config_v3.py
```

**Configuraciones importantes:**

- `SIMULATION_MODE`: `True` para simulación, `False` para trading real
- `API_KEYS`: Configurar las API keys de los exchanges
- `MIN_PROFIT_PERCENTAGE`: Mínimo porcentaje de ganancia requerido
- `DEFAULT_INVESTMENT_PERCENTAGE`: Porcentaje del balance a usar por operación

### 4. Configuración de la UI

```bash
# Navegar al directorio de la UI
cd ../UI/clients

# Reemplazar archivos con versiones corregidas
cp ../../UI_fixes/App_fixed.jsx src/App.jsx
cp ../../UI_fixes/Layout_fixed.jsx src/components/Layout/Layout.jsx
cp ../../UI_fixes/Top20DetailedPage_fixed.jsx src/components/Top20DetailedPage/Top20DetailedPage.jsx
cp ../../UI_fixes/ExchangeAPIsPage.jsx src/components/ExchangeAPIsPage/ExchangeAPIsPage.jsx

# Instalar dependencias e iniciar
npm install
npm start
```

## Uso del Sistema

### 1. Inicio Rápido

```bash
# Verificar instalación
python check_installation.py

# Entrenar modelo (primera vez)
python train_model.py --samples 1000

# Iniciar V3 en modo simulación
python start_v3.py --simulation

# En otra terminal, iniciar la UI
cd ../UI/clients && npm start
```

### 2. Comandos Principales

#### Entrenamiento del Modelo
```bash
# Entrenamiento básico
python train_model.py --samples 1000

# Entrenamiento avanzado con exportación
python train_model.py --samples 2000 --validation-split 0.2 --export-results training_results.json
```

#### Backtesting
```bash
# Backtesting con datos sintéticos
python backtest.py --generate-data 500 --initial-balance 1000

# Backtesting con gráficos
python backtest.py --generate-data 500 --plot-results --export-results backtest_results.json
```

#### Simulación
```bash
# Simulación de 30 minutos
python simulate.py --duration 30 --initial-balance 1000

# Simulación con configuración personalizada
python simulate.py --duration 60 --operations-per-minute 2.0 --market-volatility 0.2
```

#### Experimentos Automatizados
```bash
# Experimento completo (entrenamiento + backtesting + simulación)
python run_experiments.py full

# Solo entrenamiento
python run_experiments.py train --training-samples 1500

# Barrido de parámetros
python run_experiments.py sweep
```

#### Análisis de Resultados
```bash
# Analizar archivos específicos
python analyze_results.py results1.json results2.json

# Analizar directorio completo
python analyze_results.py --directory experiments/ --compare --plot
```

### 3. Uso de la Interfaz Web

1. **Dashboard Principal**: Muestra el estado de conexiones V2, V3 y Sebo
2. **APIs Exchanges**: Gestión de credenciales de exchanges
3. **Top 20 Trading**: 
   - Visualización de oportunidades en tiempo real
   - Control de trading automatizado
   - Configuración de parámetros de inversión
   - Ejecución de trades manuales

#### Configuración de Trading en la UI

1. Seleccionar exchange principal donde se almacena el balance
2. Configurar modo de inversión (porcentaje o cantidad fija)
3. Ajustar parámetros de inversión
4. Activar trading automatizado con el botón "Iniciar Trading"

## Arquitectura del Sistema

### Flujo de Datos

```
Sebo (WebSocket) → V3 (Procesamiento + IA) → UI (Visualización + Control)
                     ↓
                 Exchanges (Trading Real)
```

### Componentes Principales

1. **SeboConnector**: Recibe datos del socket de Sebo
2. **ArbitrageAIModel**: Procesa datos con IA para tomar decisiones
3. **TradingLogic**: Ejecuta la lógica de arbitraje
4. **ExchangeManager**: Gestiona conexiones y operaciones con exchanges
5. **UIBroadcaster**: Comunica estado y datos a la interfaz web
6. **DataPersistence**: Almacena datos y estado del sistema

### Proceso de Trading Automatizado

1. **Recepción**: Datos Top20 desde Sebo
2. **Análisis**: IA evalúa rentabilidad y riesgo
3. **Decisión**: Determina si ejecutar la operación
4. **Ejecución**: 
   - Transferir USDT al exchange de compra
   - Comprar el símbolo
   - Transferir símbolo al exchange de venta
   - Vender por USDT
   - Devolver USDT al exchange principal
5. **Retroalimentación**: Actualizar modelo con resultados

## Configuración de Exchanges

### Exchanges Soportados

- Binance
- OKX
- KuCoin
- Bybit
- Huobi
- Gate.io

### Configuración de API Keys

```python
# En config_v3.py
API_KEYS = {
    "binance": {
        "apiKey": "tu_api_key",
        "secret": "tu_secret",
        "sandbox": True  # False para producción
    },
    # ... otros exchanges
}
```

**Importante**: 
- Usar variables de entorno para las API keys en producción
- Activar sandbox/testnet para pruebas
- Configurar permisos de trading en las API keys

## Seguridad y Riesgo

### Medidas de Seguridad

- Modo simulación por defecto
- Límites de pérdida diaria y por operación
- Validación de operaciones antes de ejecución
- Logs detallados de todas las operaciones
- Timeouts para operaciones colgadas

### Gestión de Riesgo

- Análisis de riesgo por IA antes de cada operación
- Límites configurables de inversión
- Monitoreo de drawdown máximo
- Alertas por pérdidas significativas

## Monitoreo y Logs

### Archivos de Log

- `logs/v3.log`: Log principal del sistema
- `logs/training.log`: Logs de entrenamiento
- `logs/backtest.log`: Logs de backtesting
- `logs/simulation.log`: Logs de simulación

### Métricas Monitoreadas

- ROI (Return on Investment)
- Tasa de éxito de operaciones
- Drawdown máximo
- Sharpe ratio
- Precisión del modelo de IA
- Latencia de operaciones

## Solución de Problemas

### Problemas Comunes

1. **Error de conexión con Sebo**
   - Verificar que Sebo esté ejecutándose en puerto 3031
   - Comprobar configuración de WebSocket

2. **Modelo de IA no entrenado**
   - Ejecutar `python train_model.py --samples 1000`
   - Verificar que se generen datos de entrenamiento

3. **Errores de API de exchanges**
   - Verificar API keys y permisos
   - Comprobar límites de rate limiting
   - Usar modo sandbox para pruebas

4. **UI no se conecta a V3**
   - Verificar que V3 esté ejecutándose en puerto 3002
   - Comprobar configuración de CORS

### Comandos de Diagnóstico

```bash
# Verificar instalación completa
python check_installation.py

# Probar conexión con exchanges
python -c "from exchange_manager import ExchangeManager; em = ExchangeManager(); print('OK')"

# Verificar modelo de IA
python -c "from ai_model import ArbitrageAIModel; ai = ArbitrageAIModel(); print(f'Entrenado: {ai.is_trained}')"
```

## Desarrollo y Contribución

### Estructura de Desarrollo

- Usar modo simulación para desarrollo
- Ejecutar tests antes de commits
- Documentar cambios en el código
- Seguir convenciones de naming de Python

### Testing

```bash
# Test completo del sistema
python run_experiments.py full

# Test específico de componentes
python -m pytest tests/ (si se implementan tests unitarios)
```

## Changelog

### V3.0.0 (Actual)
- ✅ Integración completa de IA para decisiones de trading
- ✅ Sistema de entrenamiento y backtesting
- ✅ Simulación en tiempo real
- ✅ Interfaz web mejorada con control de trading
- ✅ Gestión avanzada de exchanges y APIs
- ✅ Sistema de monitoreo y logs
- ✅ Herramientas de análisis de resultados

### Mejoras Futuras (Roadmap)
- 🔄 Integración con más exchanges
- 🔄 Algoritmos de IA más avanzados
- 🔄 Interfaz móvil
- 🔄 Sistema de alertas por email/SMS
- 🔄 API REST para integración externa
- 🔄 Dashboard de métricas avanzado

## Soporte

Para soporte técnico o reportar bugs:

1. Revisar la sección de solución de problemas
2. Ejecutar `python check_installation.py` para diagnóstico
3. Revisar logs en el directorio `logs/`
4. Contactar al equipo de desarrollo con información detallada del error

## Licencia

Este proyecto es propiedad de Securtec SAS. Todos los derechos reservados.

---

**Nota**: Este sistema maneja operaciones financieras reales. Siempre usar modo simulación para pruebas y entender completamente el funcionamiento antes de usar con dinero real.

