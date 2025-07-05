## Planificación de V3: Sistema de Arbitraje de Criptomonedas con IA

### Objetivo General:
Desarrollar una aplicación V3 que reemplace a V2, conectándose al socket de Sebo, retransmitiendo datos a la UI, implementando una lógica de trading avanzada basada en IA para arbitraje, resolviendo errores de UI, y permitiendo entrenamiento, simulación y trading real persistente.

### Estructura Propuesta para V3:
Se mantendrá una estructura modular similar a V2, pero con una clara separación de responsabilidades y una mayor robustez para el trading real y la IA.

-   **`main_v3.py`**: Punto de entrada principal de la aplicación. Orquestará los componentes, gestionará las conexiones Socket.IO y WebSocket, y el ciclo de vida de la aplicación.
-   **`sebo_connector.py`**: Módulo dedicado a la conexión con el servidor Sebo (Socket.IO y API REST). Encargado de recibir datos de `spot-arb`, `balances-update`, `top_20_data` y realizar consultas a la API de Sebo (ej. tarifas de retiro, balances).
-   **`ui_broadcaster.py`**: Módulo para gestionar la conexión WebSocket con la UI y retransmitir datos relevantes (top 20, balances, estado de operaciones, logs) a los clientes de la UI.
-   **`trading_logic.py`**: Contendrá la lógica central de trading. Recibirá el diccionario de símbolos del `sebo_connector`, interactuará con el `ai_model` para la toma de decisiones, y coordinará las operaciones de trading (transferencias, compra, venta) a través del `exchange_manager`.
-   **`ai_model.py`**: Módulo que contendrá la implementación real del modelo de IA (`ArbitrageIntelligenceModel`). Será responsable de procesar los datos de entrada (símbolos, precios, fees, balances), calcular la rentabilidad, y emitir una decisión sobre la ejecución de la operación. Incluirá métodos para entrenamiento, predicción y evaluación.
-   **`exchange_manager.py`**: Abstracción para interactuar con los exchanges (usando CCXT). Manejará la obtención de precios, la ejecución de órdenes (compra/venta), y las transferencias de fondos entre exchanges. Deberá gestionar las credenciales de API de forma segura.
-   **`data_persistence.py`**: Módulo para gestionar la persistencia de datos (balances, configuraciones, logs de operaciones, datos de entrenamiento). Podría interactuar con Sebo (si Sebo es la base de datos principal) o con una base de datos local si es necesario para el entrenamiento/simulación.
-   **`simulation_engine.py`**: Módulo para el entrenamiento, test y trading simulado. Utilizará el `ai_model` y el `trading_logic` en un entorno simulado para evaluar estrategias y entrenar el modelo sin riesgo real.
-   **`config_v3.py`**: Archivo de configuración para V3, similar a `config.py` de V2, pero con parámetros adicionales para la IA, simulación y trading real.
-   **`utils.py`**: Funciones de utilidad generales (ej. formateo de datos, manejo de errores comunes).

### Flujo de Operación de V3:
1.  **Inicio:** `main_v3.py` inicia `sebo_connector` y `ui_broadcaster`.
2.  **Recepción de Datos de Sebo:** `sebo_connector` recibe `spot-arb`, `balances-update` y `top_20_data` del socket de Sebo.
3.  **Retransmisión a UI:** `ui_broadcaster` retransmite `balances-update` y `top_20_data` a la UI.
4.  **Activación de Trading (desde UI):** Cuando la UI activa el trading (ej. botón en Top20), `ui_broadcaster` envía una señal a `trading_logic`.
5.  **Procesamiento de Oportunidad (Trading Logic):**
    -   `trading_logic` obtiene el primer dato del diccionario `top_20_data` (o el que se seleccione).
    -   Construye un diccionario de símbolos con `symbol`, `id_exchange` de compra/venta de CCXT.
    -   Consulta a `exchange_manager` para obtener precios de compra/venta actuales y tarifas de retiro/transferencia.
    -   Consulta a `data_persistence` (o Sebo) para obtener el balance actual y la configuración del exchange que posee los USDT.
    -   Envía todos estos datos al `ai_model`.
6.  **Decisión de IA (AI Model):**
    -   `ai_model` calcula el porcentaje de diferencia, resta fees de operación y comisiones de transferencia.
    -   Determina la red más económica para transferencias.
    -   Evalúa si la operación es rentable.
    -   Devuelve una decisión (`ejecutar`, `no_ejecutar`) y los parámetros óptimos.
7.  **Ejecución de Operación (Trading Logic & Exchange Manager):** Si la IA decide ejecutar:
    -   `trading_logic` coordina con `exchange_manager` para:
        -   Transferir USDT del exchange de balance al exchange de compra (si es diferente).
        -   Comprar el símbolo en el exchange de compra.
        -   Transferir el símbolo al exchange de venta.
        -   Vender el símbolo por USDT en el exchange de venta.
        -   Devolver los USDT obtenidos al exchange donde se almacena el balance (si es posible y rentable).
8.  **Actualización y Retroalimentación:**
    -   `data_persistence` actualiza los balances en Sebo.
    -   `trading_logic` retroalimenta al `ai_model` con el resultado real de la operación para futuras mejoras.
    -   `ui_broadcaster` envía actualizaciones de estado y logs a la UI.
9.  **Persistencia del Proceso:** El `trading_logic` (o un nuevo `trade_orchestrator.py`) debe ejecutarse de forma independiente, posiblemente como un proceso en segundo plano o un servicio, para continuar operando incluso si la UI se cierra. Al reabrir la UI, debe poder conectarse y mostrar el estado actual, y permitir detener el proceso.

### Tareas Específicas:
-   **Resolver errores de UI:** Analizar los errores existentes en la UI de V2 y corregirlos. Completar la vista de APIs de exchanges y la funcionalidad de actualización.
-   **Entrenamiento, Test y Trading Simulado:** Implementar un entorno para entrenar el modelo de IA con datos históricos, probar su rendimiento y simular operaciones de trading sin riesgo real. Esto implicará la generación de datos de entrenamiento y la definición de métricas de evaluación.
-   **Conexión Trading Real:** Conectar el botón de 

