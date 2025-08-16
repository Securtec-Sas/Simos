# Documentación del Sistema SIMOS

## Descripción General

**SIMOS** es una plataforma integral para la simulación y ejecución de estrategias de arbitraje en el mercado de criptomonedas. El sistema está compuesto por tres componentes principales que trabajan en conjunto: `V3` (el motor de lógica y simulación), `sebo` (el proveedor de datos y entorno de pruebas) y `UI` (la interfaz de usuario para control y monitoreo).

---

## Componentes del Sistema

### 1. `V3/` - Motor de Simulación y Lógica de Trading

Este es el cerebro del sistema. Escrito en Python, `V3` contiene toda la lógica para detectar y ejecutar oportunidades de arbitraje.

**Funcionalidades Clave:**
- **Motor de Simulación**: Permite ejecutar simulaciones de trading en dos modos:
    - **Modo Local**: Una simulación rápida y autocontenida para probar estrategias sin dependencias externas.
    - **Modo Sebo Sandbox**: Una simulación más realista que interactúa con el backend `sebo` para simular operaciones en un entorno controlado que imita el mercado real.
- **Inteligencia Artificial (IA)**: Integra un modelo de IA para evaluar la confianza de las oportunidades de arbitraje antes de ejecutarlas.
- **Lógica de Trading**: Implementa los algoritalos para calcular la rentabilidad (`arbitrage_calculator.py`) y ejecutar las operaciones (`arbitrage_executor.py`).
- **Comunicación**: Utiliza WebSockets para comunicarse en tiempo real con la `UI`, enviando actualizaciones de estado y recibiendo comandos (iniciar/detener simulación).

### 2. `sebo/` - Backend de Datos y Sandbox

`sebo` es un servicio de backend desarrollado en Node.js que cumple dos funciones críticas.

**Funcionalidades Clave:**
- **Proveedor de Datos de Mercado**: Utiliza la librería `ccxt` para conectarse a múltiples exchanges de criptomonedas y obtener datos de precios en tiempo real.
- **Entorno Sandbox**: Proporciona una serie de endpoints API que simulan las acciones de un exchange real (comprar, vender, transferir). Esto permite que `V3` ejecute sus operaciones en un entorno de pruebas seguro y realista sin arriesgar fondos reales.
- **API y WebSockets**: Expone una API REST y utiliza `socket.io` para servir los datos a otros componentes del sistema.

### 3. `UI/` - Interfaz de Usuario

La `UI` es una aplicación frontend moderna construida con React y Vite. Es el punto de interacción del usuario con el sistema SIMOS.

**Funcionalidades Clave:**
- **Control de Simulaciones**: Permite a los usuarios iniciar, detener y configurar los parámetros de las simulaciones ejecutadas por `V3`.
- **Monitoreo en Tiempo Real**: Muestra datos actualizados en vivo sobre el estado de las operaciones, el balance, el ROI y otras métricas de rendimiento.
- **Visualización de Datos**: Presenta la información de manera clara y organizada, facilitando el análisis del rendimiento de las estrategias de arbitraje.
- **Comunicación con el Backend**: Interactúa con `V3` y `sebo` para enviar comandos y recibir datos actualizados.

---

## Arquitectura y Flujo de Trabajo

El sistema funciona de la siguiente manera:

1.  **`sebo`** obtiene continuamente los precios de los exchanges.
2.  **`V3`** recibe estos datos y su motor de arbitraje busca oportunidades rentables.
3.  El usuario, a través de la **`UI`**, inicia una simulación en `V3`.
4.  Cuando `V3` encuentra una oportunidad y la IA la valida, ejecuta la operación (ya sea de forma local o contra el sandbox de `sebo`).
5.  **`V3`** envía actualizaciones en tiempo real a la **`UI`**, que muestra el progreso y los resultados al usuario.

---

## Estructura de Carpetas y Archivos

A continuación se presenta la estructura completa de archivos y carpetas del proyecto.

```
.:
Cambios Implementados en Simos - Rama manusUpdate.docx
Environment_Variables.txt
INFORME_ANALISIS_COMPLETO.md
INFORME_OPTIMIZACION_ENTRENAMIENTO.md
INSTRUCCIONES_INSTALACION.md
LICENCIA
README_SOCKET_FIXES.md
Tareas.md
UI
V1
V2
V3
analysis_report.md
archivos_modificados
createDoc.sh
docs
manage_all.sh
package-lock.json
prompPrivate.docx
run_all.sh
run_proy.docx
run_proy.sh
sebo
seboSis.docx
simosRead.md
stop_proy.sh
todo.md

./UI:
README.md
clients
desktop.ini

./UI/clients:
App.jsx
README.md
desktop.ini
eslint.config.js
index.html
package-lock.json
package.json
public
separar_componentes.sh
src
tailwind.config.js
vite.config.js
yarn.lock

./UI/clients/public:
desktop.ini
vite.svg

./UI/clients/src:
App.jsx
App.module.css
App_old.jsx
App_pl.jsx
components
config
desktop.ini
hooks
index.css
index.jsx
main.jsx
pages

./UI/clients/src/components:
AIDataPage
ActiveExchangesTable
BalanceDisplay
DataStreamPage
ExchangeList
ExchangeManager
Layout
Sidebar
SimulationPage
SpotsMenu
Top20DetailedPage
TopSpotData
TrainingPage
desktop.ini

./UI/clients/src/components/AIDataPage:
DataAI.jsx
Simulation.jsx
Test.jsx
Training.jsx
desktop.ini

./UI/clients/src/components/ActiveExchangesTable:
ActiveExchangesTable.jsx
ActiveExchangesTable.module.css
desktop.ini

./UI/clients/src/components/BalanceDisplay:
BalanceDisplay.jsx
BalanceDisplay.module.css
desktop.ini

./UI/clients/src/components/DataStreamPage:
DataStreamPage.jsx
desktop.ini

./UI/clients/src/components/ExchangeList:
ExchangeList.jsx
ExchangeList.module.css
desktop.ini

./UI/clients/src/components/ExchangeManager:
ExchangeManager.jsx
desktop.ini

./UI/clients/src/components/Layout:
Layout.jsx
Layout.module.css
Layoutssss.jsx
desktop.ini

./UI/clients/src/components/Sidebar:
Sidebar.jsx
Sidebar.module.css
desktop.ini

./UI/clients/src/components/SimulationPage:
SimulationPage.css
SimulationPage.jsx

./UI/clients/src/components/SpotsMenu:
SpotsMenu.jsx
SpotsMenu.module.css
desktop.ini

./UI/clients/src/components/Top20DetailedPage:
Top20DetailedPage.jsx
desktop.ini

./UI/clients/src/components/TopSpotData:
TopSpotData.jsx
TopSpotData.module.css
desktop.ini

./UI/clients/src/components/TrainingPage:
TrainingPage.css
TrainingPage.jsx
TrainingVisualization.css
TrainingVisualization.jsx
desktop.ini

./UI/clients/src/config:
api.js

./UI/clients/src/hooks:
desktop.ini
useWebSocketController.jsx

./UI/clients/src/pages:
ConnectionPage
DataViewPage
Top20DetailedPage
TrainingPage
aiDataPage.jsx
configDataPage
desktop.ini
exchangesApis

./UI/clients/src/pages/ConnectionPage:
ConnectionPage.jsx
desktop.ini

./UI/clients/src/pages/DataViewPage:
DataViewPage.jsx
DataViewPage.module.css
desktop.ini

./UI/clients/src/pages/Top20DetailedPage:
Top20DetailedPage.jsx
desktop.ini

./UI/clients/src/pages/TrainingPage:
TrainingPage.css
TrainingPage.jsx
TrainingVisualization.css
TrainingVisualization.jsx
desktop.ini

./UI/clients/src/pages/configDataPage:
ConfigDataPage.jsx
desktop.ini

./UI/clients/src/pages/exchangesApis:
ExchangeAPIsPage.jsx
desktop.ini
exhangeApis.jsx

./V1:
desktop.ini
templates

./V1/templates:
desktop.ini
index.html

./V2:
Aplicación de Arbitraje de Criptomonedas con IA.md
Creación de App Python con IA para Trading Automatizado.zip
app_core.py
arbitrage_calculator.py
arbitrage_executor.py
config.py
config_old.py
controllera
data_logger.py
desktop.ini
logs
main.py
main_old.py
model.py
model_old.py
opportunity_processor.py
package-lock.json
requirements.txt
sio_event_handlers.py
todo.md
trained_arbitrage_model.joblib
ui_command_handlers.py
v2_helpers.py

./V2/controllera:
data.py
desktop.ini

./V2/logs:
desktop.ini
v2_operation_logs.csv

./V3:
GUIA_INICIO_RAPIDO.md
RESUMEN_IMPLEMENTACION_SIMULACION.md
SIMULACION_V3_DOCUMENTACION.md
V2_Analysis.md
V3_Plan.md
__pycache__
adapters
config_example.py
core
desktop.ini
experiments
logs
main_v3.py
models
requirements.txt
scripts
shared
simple_test.py
test_simulation.py
test_training_flow.py
ui_broadcaster.py
v3_enhanced.py

./V3/__pycache__:
training_handler.cpython-311.pyc

./V3/adapters:
__init__.py
api
connectors
exchanges
persistence
socket

./V3/adapters/api:
__init__.py
api_v3_routes.py

./V3/adapters/connectors:
__init__.py
sebo_connector.py
sebo_symbols_api.py

./V3/adapters/exchanges:
__init__.py
exchange_manager.py

./V3/adapters/persistence:
__init__.py
data_persistence.py

./V3/adapters/socket:
__init__.py
socket_optimizer.py
ui_broadcaster.py

./V3/core:
__init__.py
advanced_simulation_engine.py
ai_model.py
arbitrage_calculator.py
arbitrage_executor.py
model.py
simulation_engine.py
trading_logic.py
training_handler.py

./V3/experiments:
desktop.ini
experiment_20250708_012906_config.json
experiment_20250708_013005
experiment_20250708_013005_config.json
experiment_20250708_022021_config.json
experiment_20250708_022046
experiment_20250708_022046_config.json

./V3/experiments/experiment_20250708_013005:
desktop.ini
training_results.json

./V3/experiments/experiment_20250708_022046:
desktop.ini
training_results.json

./V3/logs:
desktop.ini

./V3/models:
arbitrage_model.pkl
desktop.ini

./V3/scripts:
__init__.py
analyze_results.py
backtest.py
check_installation.py
run_dev.py
run_experiments.py
simulate.py
simulation_handler.py
start_v3.py
train_model.py

./V3/shared:
__init__.py
config_v3.py
utils.py

./archivos_modificados:
README_CAMBIOS.md
desktop.ini

./docs:
data
desktop.ini

./docs/data:
desktop.ini

./sebo:
desktop.ini
package-lock.json
package.json
package_old.json
run.sh
src
yarn.lock

./sebo/src:
data
desktop.ini
public
server

./sebo/src/data:
realData_2025-08-01_10m.csv
realData_2025-08-01_15m.csv

./sebo/src/public:
css
desktop.ini
index.html
js

./sebo/src/public/css:
desktop.ini
style.css

./sebo/src/public/js:
desktop.ini
script.js

./sebo/src/server:
app.js
app_old.js
config
controllers
data
desktop.ini
routes
utils

./sebo/src/server/config:
desktop.ini
swaggerConfig.js

./sebo/src/server/controllers:
TradingController.js
analizerController.js
balanceController.js
configController.js
dbCotroller.js
desktop.ini
echangeSecurityController.js
exchangeController.js
operationController.js
sandboxOperationController.js
spotController.js
spotController_old.js
spotSocketController.js
spotSocketController_old.js
symbolController.js

./sebo/src/server/data:
dataBase
desktop.ini
exchanges_config.json
realData(2025-07-15_5m).csv
spot_usdt_coins.json

./sebo/src/server/data/dataBase:
connectio.js
desktop.ini
modelosBD

./sebo/src/server/data/dataBase/modelosBD:
analysis.model.js
balance.model.js
config.model.js
desktop.ini
exchange.model.js
exchangeSecurity.model.js
exchangeSymbol.model.js
exxhangeSecurity.model.js.old
networks.model.js
symbol.model.js

./sebo/src/server/routes:
balanceRoutes.js
configRoutes copy.js
configRoutes.js
desktop.ini
exchangeRoutes.js
operationRoutes.js
sandboxOperationRoutes.js
spotRoutes.js
symbolRoutes.js
tradingRoutes.js

./sebo/src/server/utils:
config.js
desktop.ini
exchangeConnector.js
timeframeConverter.js
```
