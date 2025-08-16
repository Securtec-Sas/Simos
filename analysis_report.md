## Análisis del Proyecto Simos

### 1. Componente V3 (Python)

**Propósito:** Sistema de arbitraje de criptomonedas, análisis de datos, ejecución de acciones de trading, entrenamiento de modelos de IA y simulación.

**Comunicación:**
- **API REST (Flask):** Expone endpoints para la UI para interactuar con el sistema de entrenamiento, pruebas y simulación. (ej. `/api/v3/create-training-csv`, `/api/v3/start-simulation`).
- **WebSocket (integrado en `UIBroadcaster`):** Envía actualizaciones en tiempo real a la UI sobre el estado del sistema, estadísticas de trading, progreso de entrenamiento, resultados de pruebas, actualizaciones de simulación, datos del Top 20 y balances.
- **Conexión con Sebo (`sebo_connector.py`):** Se conecta a Sebo vía Socket.IO para recibir actualizaciones de balances y Top 20, y realiza llamadas a la API REST de Sebo para obtener configuraciones de balance, tarifas de retiro y oportunidades de arbitraje.

**Componentes clave:**
- `main_v3.py`: Aplicación principal que inicializa y coordina todos los componentes.
- `api_v3_routes.py`: Define las rutas de la API REST para la interacción con la UI.
- `training_handler.py`: Maneja la lógica de creación de CSV de entrenamiento, inicio de entrenamiento y ejecución de pruebas.
- `simulation_handler.py`: Maneja la lógica de inicio, estado y detención de simulaciones.
- `ai_model.py`: Contiene la lógica del modelo de IA para entrenamiento, predicción y gestión de características.
- `ui_broadcaster.py`: Gestiona la conexión WebSocket con la UI y el envío de mensajes en tiempo real.
- `sebo_connector.py`: Abstracción para la comunicación con el servidor Sebo (Socket.IO y API REST).
- `socket_optimizer.py`: Optimiza la frecuencia de envío de datos por WebSocket (Top 20 y balance).
- `exchange_manager.py`: Gestiona la interacción con los exchanges de criptomonedas.
- `data_persistence.py`: Maneja la persistencia de datos.
- `trading_logic.py`: Contiene la lógica para la ejecución de operaciones de trading.

### 2. Componente UI (React)

**Propósito:** Interfaz gráfica de usuario para interactuar con el sistema Simos, visualizar datos, configurar parámetros y monitorear operaciones.

**Comunicación:**
- **WebSocket (`useWebSocketController.jsx`):** Se conecta al servidor V3 (Python) vía WebSocket para recibir actualizaciones en tiempo real y enviar comandos a V3.
- **API REST (fetch):** Realiza llamadas a los endpoints de la API v3 de V3 para iniciar procesos como la creación de CSV de entrenamiento, inicio de simulación, etc.

**Componentes clave:**
- `App.jsx`: Componente principal de la aplicación React, define las rutas y la estructura general.
- `useWebSocketController.jsx`: Hook personalizado para gestionar la conexión WebSocket con V3 y el envío/recepción de mensajes.
- `Sidebar.jsx`: Componente de navegación lateral con enlaces a diferentes secciones de la UI.
- `ConfigDataPage.jsx`: Página para la configuración y visualización de datos del modelo de IA.
- `TrainingPage/`: Componentes para la interfaz de entrenamiento, pruebas y simulación del modelo de IA.
- `AIDataPage/`: Componentes relacionados con la visualización de datos de IA.

### 3. Interacción General

1.  **Inicio:** La UI se conecta a V3 vía WebSocket al cargar. V3, a su vez, se conecta a Sebo vía Socket.IO y API REST.
2.  **Datos en tiempo real:** Sebo emite datos de mercado (Top 20, balances) vía Socket.IO. V3 recibe estos datos a través de `sebo_connector.py` y los retransmite a la UI vía su propio WebSocket, optimizando la frecuencia de envío con `socket_optimizer.py`.
3.  **Acciones de usuario:** La UI envía comandos a V3 a través de su API REST (ej. iniciar entrenamiento, simulación) o vía WebSocket (ej. solicitar estado del sistema).
4.  **Procesamiento en V3:** V3 procesa los comandos, interactúa con Sebo si es necesario (ej. obtener símbolos), entrena modelos, ejecuta simulaciones, y envía actualizaciones de progreso y resultados a la UI vía WebSocket.
5.  **Persistencia:** Sebo persiste datos de mercado y configuración en MongoDB. V3 puede usar `data_persistence.py` para guardar y cargar datos relevantes para el modelo de IA y el trading.

