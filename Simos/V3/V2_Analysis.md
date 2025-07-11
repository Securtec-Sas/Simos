
## Análisis de V2 - `main.py`

El archivo `main.py` en V2 contiene la clase principal `CryptoArbitrageApp` que orquesta la lógica de arbitraje de criptomonedas. Sus funcionalidades clave incluyen:

### Conectividad:
- **Socket.IO con Sebo:** Se conecta a un servidor Sebo (presumiblemente un backend de datos) a través de Socket.IO para recibir datos de arbitraje (`spot-arb`), actualizaciones de balance (`balances-update`) y datos del top 20 (`top_20_data`).
- **WebSocket para UI:** Inicia un servidor WebSocket para comunicarse con la interfaz de usuario (UI), retransmitiendo datos recibidos de Sebo a los clientes de la UI.

### Lógica de Arbitraje:
- **Obtención de Instancias CCXT:** Gestiona instancias de CCXT (biblioteca de intercambio de criptomonedas) para interactuar con diferentes exchanges.
- **Obtención de Precios de Mercado:** Utiliza CCXT para obtener los precios `ask` y `bid` actuales de un símbolo en un exchange específico.
- **Información de Retiro de USDT:** Consulta a Sebo para obtener las tarifas de retiro de USDT y las redes disponibles para un exchange dado, identificando la red más económica.
- **Gestión de Balance:** Carga y actualiza la configuración del balance desde Sebo, incluyendo la lógica para un stop-loss global.
- **Procesamiento de Datos de Arbitraje (`on_spot_arb_data_method`):**
    - Recibe datos de oportunidades de arbitraje de Sebo.
    - Carga la configuración del balance del exchange que posee los USDT.
    - Calcula el monto a invertir basado en el balance actual y el modo de inversión (fijo o porcentaje).
    - Obtiene los precios de mercado actuales de los exchanges de compra y venta.
    - Calcula la rentabilidad neta utilizando la función `calculate_net_profitability` (importada de `arbitrage_calculator.py`).
    - Simula la operación de arbitraje utilizando `evaluate_and_simulate_arbitrage` (importada de `arbitrage_executor.py`).
    - Actualiza los balances en Sebo basándose en el resultado de la simulación.
    - Registra todas las operaciones en un archivo CSV (`logs/v2_operation_logs.csv`).

### Estructura General:
- Utiliza `asyncio` para la programación asíncrona, permitiendo operaciones de red concurrentes.
- La función `main()` inicia la aplicación, conectándose a Sebo y al servidor WebSocket de la UI simultáneamente.
- Incluye manejo de errores para conexiones de red y operaciones de exchange.

### Puntos Clave para V3:
- V3 deberá conectarse al mismo socket de Sebo y retransmitir datos a la UI, similar a V2.
- La lógica de procesamiento de datos para la IA, incluyendo la obtención del top 20, la creación del diccionario de símbolos, y la verificación de rentabilidad, será central en V3.
- La ejecución de operaciones (transferencias, compra, venta) y la retroalimentación del modelo serán pasos críticos.
- La persistencia del proceso de trading real, incluso si la UI se cierra, es un requisito importante.


## Análisis de V2 - `arbitrage_calculator.py`

El archivo `arbitrage_calculator.py` contiene la función `calculate_net_profitability`, que es fundamental para determinar la viabilidad financiera de una operación de arbitraje. Esta función toma como entrada los datos de la oportunidad de arbitraje (`ai_data`) y el monto de inversión en USDT (`investment_usdt`), y calcula la ganancia neta y el porcentaje de ganancia después de considerar todas las tarifas.

### Proceso de Cálculo:
1.  **Validación Inicial:** Verifica que el monto de inversión sea positivo.
2.  **Extracción de Datos Clave:** Obtiene los precios de compra y venta actuales, así como las diferentes tarifas (retiro de USDT, tarifas de taker en los exchanges de compra y venta, y tarifa de retiro del activo).
3.  **Cálculo de USDT Disponible:** Resta la tarifa de retiro inicial de USDT del monto de inversión para determinar el USDT real disponible en el exchange de compra.
4.  **Compra del Activo:** Calcula la cantidad bruta del activo que se puede comprar con el USDT disponible y luego resta la tarifa de trading del exchange de compra para obtener la cantidad neta del activo.
5.  **Transferencia del Activo:** Resta la tarifa de retiro del activo del exchange de compra para determinar la cantidad del activo que llega al exchange de venta.
6.  **Venta del Activo:** Calcula el USDT bruto obtenido de la venta del activo en el exchange de venta y luego resta la tarifa de trading del exchange de venta para obtener el USDT final después de todas las tarifas.
7.  **Cálculo de Ganancia Neta:** La ganancia neta en USDT se calcula restando la inversión inicial del USDT final. El porcentaje de ganancia neta se calcula en base a esta ganancia y la inversión inicial.
8.  **Determinación de Rentabilidad:** Establece un indicador booleano `is_profitable` si la ganancia neta es positiva.

### Salida:
La función devuelve un diccionario `results` que incluye:
-   `net_profit_usdt`: Ganancia neta en USDT.
-   `net_profit_percentage`: Porcentaje de ganancia neta.
-   `initial_investment_usdt`: Monto de inversión inicial.
-   Valores intermedios de cada etapa del cálculo (útil para depuración y análisis).
-   `is_profitable`: Booleano que indica si la operación es rentable.
-   `error_message`: Mensaje de error si ocurre algún problema durante el cálculo (ej. precios inválidos, balance insuficiente).

### Relevancia para V3:
Esta lógica de cálculo de rentabilidad será directamente aplicable en V3 para evaluar las oportunidades de arbitraje antes de decidir si se ejecuta una operación real. La IA utilizará estos resultados para tomar decisiones informadas.


## Análisis de V2 - `arbitrage_executor.py`

El archivo `arbitrage_executor.py` contiene la función asíncrona `evaluate_and_simulate_arbitrage`, que es responsable de tomar la decisión final sobre si ejecutar una operación de arbitraje y simular su resultado. Esta función actúa como el cerebro de la decisión, aplicando lógicas de Stop Loss (SL) y Take Profit (TP) tanto en la evaluación inicial como después de una re-verificación de precios.

### Proceso de Evaluación y Simulación:
1.  **Inicialización de Resultados:** Prepara un diccionario `simulation_results` para almacenar el resultado de la decisión, la ganancia simulada final, el último precio de venta y los pasos simulados.
2.  **Manejo de Errores de Rentabilidad:** Si el cálculo de rentabilidad inicial (`net_profitability_results`) ya indicó un error, la simulación se marca como `NO_VIABLE_CALC_ERROR` y termina.
3.  **Aplicación de Stop Loss por Operación (SL_OP):**
    -   Calcula el umbral de Stop Loss basado en un porcentaje del capital invertido en la operación.
    -   Si la ganancia neta calculada inicialmente cae por debajo de este umbral, la operación se marca como `NO_VIABLE_SL_OPERACION` y se aborta.
4.  **Aplicación de Take Profit por Operación (TP_OP) - Evaluación Inicial:**
    -   Calcula el umbral de Take Profit basado en un porcentaje del capital invertido.
    -   Si la ganancia neta calculada inicialmente alcanza o supera este umbral, la operación se marca como `EJECUTADA_SIMULADA_TP_INICIAL` y se considera exitosa sin necesidad de re-verificación de precios.
5.  **Umbral Mínimo de Ganancia:** Si la operación no fue abortada por SL ni activó TP, verifica si la ganancia neta inicial es al menos un umbral mínimo absoluto (ej. 0.01 USDT). Si no lo es, se marca como `NO_VIABLE_UMBRAL_PROFIT`.
6.  **Simulación de Pasos:** Registra los pasos simulados de la operación (retiro de USDT, compra de activo, transferencia de activo).
7.  **Re-verificación de Precios:** Introduce un pequeño retraso (`asyncio.sleep`) para simular el tiempo que tomaría la ejecución real y luego obtiene el precio `bid` más reciente del exchange de venta (`ex_max_id_sebo`) utilizando `app_instance.get_current_market_prices`.
8.  **Recálculo de Ganancia con Precio Actualizado:** Si se obtiene un nuevo precio de venta, recalcula la ganancia neta final considerando este precio actualizado y las tarifas de trading.
9.  **Re-aplicación de SL/TP:** Vuelve a aplicar las lógicas de Stop Loss y Take Profit con la ganancia neta recalculada:
    -   Si la ganancia final cae por debajo del SL, se marca como `ABORTADA_EXMAX_SL_REPRICE`.
    -   Si la ganancia final alcanza o supera el TP, se marca como `EJECUTADA_SIMULADA_TP_FINAL`.
10. **Decisión Final:**
    -   Si la ganancia final es mayor o igual al umbral mínimo de ganancia, la operación se marca como `EJECUTADA_SIMULADA`.
    -   De lo contrario, se marca como `ABORTADA_EXMAX_NO_RENTABLE_REPRICE`.

### Salida:
La función devuelve el diccionario `simulation_results` con la decisión final y los detalles de la simulación.

### Relevancia para V3:
La lógica de decisión y simulación de `arbitrage_executor.py` es crucial para V3. Se adaptará para interactuar con el modelo de IA, que proporcionará el diccionario de símbolos y tomará decisiones basadas en la rentabilidad calculada y los umbrales de riesgo. La simulación será una parte vital del entrenamiento y las pruebas, y la lógica de ejecución real se basará en estas decisiones simuladas.


## Análisis de V2 - `model.py`

El archivo `model.py` define la clase `ArbitrageIntelligenceModel`, que está destinada a albergar el modelo de inteligencia artificial para la toma de decisiones de arbitraje. Sin embargo, en la versión actual de V2, esta clase contiene principalmente **placeholders** para sus funcionalidades clave:

### Funcionalidades Placeholder:
-   **`__init__`**: Inicializa el modelo. Intenta cargar un modelo existente si se proporciona una ruta, de lo contrario, llama a `_build_model()`.
-   **`_build_model()`**: Un método placeholder que debería definir la arquitectura y el tipo del modelo de IA (ej. un modelo de scikit-learn como `RandomForestClassifier`). Actualmente, solo imprime un mensaje indicando que debe ser reemplazado.
-   **`train(X_train, y_train, ...)`**: Un método placeholder para el entrenamiento del modelo. Simula un proceso de entrenamiento y devuelve un historial ficticio. Aquí es donde se integraría la lógica de entrenamiento real con datos históricos.
-   **`predict(X)`**: Un método placeholder para realizar predicciones. Actualmente, devuelve valores ficticios. Este método sería crucial para que la IA prediga la rentabilidad o la decisión de ejecutar una operación.
-   **`evaluate(X_test, y_test)`**: Un método placeholder para evaluar el rendimiento del modelo. Devuelve métricas de evaluación ficticias.
-   **`save_model(filepath)` y `load_model(filepath)`**: Utilizan la librería `joblib` para guardar y cargar el modelo, lo que sugiere que el modelo de IA final podría ser compatible con formatos de serialización de scikit-learn.

### Relevancia para V3:
La implementación del modelo de IA es una parte central de los requisitos de V3. Para V3, será necesario:
-   **Desarrollar el Modelo de IA Real:** Implementar la lógica del modelo de IA dentro de la clase `ArbitrageIntelligenceModel`. Este modelo deberá ser capaz de:
    -   Procesar el diccionario de símbolos, IDs de exchange de compra/venta, y datos de tarifas/balance.
    -   Calcular el porcentaje de diferencia entre compra y venta, restar fees de operación y comisiones de transferencia.
    -   Determinar si una operación es rentable y si debe ejecutarse.
    -   Definir la red más económica para transferencias.
-   **Implementar Entrenamiento y Evaluación:** Completar los métodos `train` y `evaluate` para permitir el entrenamiento del modelo con datos históricos y su posterior evaluación para asegurar su rendimiento.
-   **Integración con la Lógica de Trading:** El modelo `predict` será invocado por la lógica de trading de V3 para tomar decisiones en tiempo real sobre las oportunidades de arbitraje.


## Análisis de V2 - `config.py`

El archivo `config.py` centraliza la configuración de la aplicación V2. Contiene información vital para la conectividad y los parámetros operativos:

### Contenido:
-   **`API_KEYS`**: Un diccionario que almacena las claves de API y claves secretas para diferentes exchanges (Binance, OKX, etc.). Actualmente, son placeholders y deberán ser configuradas con credenciales reales para operaciones de trading.
-   **`WEBSOCKET_URL`**: La URL del WebSocket al que V2 se conecta para recibir datos de arbitraje de Sebo. En la configuración actual, apunta a `ws://localhost:3031/api/spot/arb`.
-   **`UI_WEBSOCKET_URL`**: La URL del WebSocket que V2 utiliza para comunicarse con la interfaz de usuario (UI). Apunta a `ws://localhost:3001/api/spot/ui`.
-   **`TOP_OPPORTUNITY_URL`**: La URL de la API de Sebo para obtener las principales oportunidades de arbitraje, `http://localhost:3031/api/spot/top-opportunit`.
-   **`MIN_PROFIT_PERCENTAGE`**: Un parámetro de configuración que define el porcentaje mínimo de ganancia requerido para que una operación de arbitraje sea considerada. Actualmente, está configurado en 0.6%.

### Relevancia para V3:
-   V3 deberá utilizar las mismas URLs de WebSocket para conectarse a Sebo y a la UI, asegurando la compatibilidad y la retransmisión de datos.
-   Las `API_KEYS` serán esenciales para que V3 pueda interactuar con los exchanges para realizar operaciones de trading real (transferencias, compras, ventas).
-   El `MIN_PROFIT_PERCENTAGE` y otros parámetros de configuración similares serán importantes para la lógica de decisión de la IA en V3, aunque la IA podría tener sus propios umbrales dinámicos o aprendidos.
-   La existencia de `TOP_OPPORTUNITY_URL` sugiere que V3 podría necesitar hacer solicitudes HTTP a Sebo para obtener datos adicionales, además de los datos de WebSocket.

