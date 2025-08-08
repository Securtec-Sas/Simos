# Aplicación de Arbitraje de Criptomonedas con IA

Esta aplicación de Python está diseñada para identificar y ejecutar oportunidades de arbitraje en el mercado de criptomonedas, utilizando inteligencia artificial para la toma de decisiones.

## Estructura del Proyecto

```
crypto_arb_app/
├── config.py
├── main.py
├── model.py
├── todo.md
└── data/
```

- `config.py`: Contiene las configuraciones de la API, URLs de WebSockets y parámetros de la lógica de arbitraje.
- `main.py`: La lógica principal de la aplicación, incluyendo la conexión WebSocket, procesamiento de datos, integración con CCXT, y la lógica de decisión de arbitraje.
- `model.py`: Define el modelo de IA para el análisis de oportunidades y las funciones para entrenar y testear el modelo.
- `todo.md`: Archivo de seguimiento de tareas del proyecto.
- `data/`: Directorio para almacenar datos de entrenamiento o cualquier otro dato necesario.

## Configuración y Ejecución

### 1. Requisitos

- Python 3.8 o superior
- pip (administrador de paquetes de Python)

### 2. Instalación de Dependencias

Navega al directorio `crypto_arb_app` y ejecuta el siguiente comando para instalar las librerías necesarias:

```bash
pip install websockets ccxt scikit-learn pandas aiohttp
```

### 3. Configuración de API Keys

Abre el archivo `config.py` y reemplaza los placeholders con tus claves de API reales para los exchanges que desees utilizar. Por ejemplo:

```python
API_KEYS = {
    "BINANCE_API_KEY": "TU_BINANCE_API_KEY",
    "BINANCE_SECRET_KEY": "TU_BINANCE_SECRET_KEY",
    "OKX_API_KEY": "TU_OKX_API_KEY",
    "OKX_SECRET_KEY": "TU_OKX_SECRET_KEY",
}
```

### 4. Entrenamiento del Modelo de IA (Opcional, pero recomendado)

Antes de ejecutar la aplicación principal, es recomendable entrenar el modelo de IA. Puedes hacerlo ejecutando el archivo `model.py` directamente. Este archivo contiene una función para generar datos de ejemplo y entrenar un modelo básico. Para un uso real, deberías usar datos históricos de mercado.

```bash
python model.py
```

Esto creará un archivo `arbitrage_model.pkl` en el directorio raíz de la aplicación.

### 5. Ejecución de la Aplicación

Para iniciar la aplicación de arbitraje, ejecuta el archivo `main.py`:

```bash
python main.py
```

La aplicación se conectará al WebSocket especificado en `config.py` (`localhost:3000/api/spot/arb`), procesará los datos, analizará las oportunidades de arbitraje y, si se cumplen las condiciones, simulará las operaciones de compra/venta y transferencia.

### 6. Servidor WebSocket para UI (Futura Implementación)

La aplicación incluye la estructura para un servidor WebSocket que enviará datos a una interfaz de usuario de React. Actualmente, esta funcionalidad está comentada en `main.py` para evitar conflictos de puerto con el cliente WebSocket. Una vez que la UI de React esté lista, se deberá descomentar y asegurar que el puerto utilizado sea diferente al del socket de entrada de datos.

## Lógica de Arbitraje

La aplicación realiza los siguientes pasos:

1.  **Consumo de Datos**: Se conecta a un socket (`localhost:3000/api/spot/arb`) para recibir datos de oportunidades de arbitraje.
2.  **Procesamiento de Datos**: Los datos recibidos se procesan para obtener los precios actuales de los exchanges utilizando la librería CCXT.
3.  **Análisis de Oportunidades**: Calcula la diferencia porcentual entre el precio más bajo y el más alto de un par de criptomonedas en diferentes exchanges.
4.  **Decisión de IA**: Utiliza un modelo de IA (actualmente un modelo de regresión lineal básico) para predecir la rentabilidad de la operación. Si la diferencia porcentual es mayor que un umbral (`MIN_PROFIT_PERCENTAGE` en `config.py`) o la IA predice una ganancia, se considera una oportunidad.
5.  **Ejecución de Operaciones (Simulada)**: Si la operación generaría ganancias netas (considerando costos de transacción), la aplicación simula:
    -   Compra en el exchange con el precio más bajo.
    -   Transferencia de la criptomoneda al exchange con el precio más alto.
    -   Venta en el exchange con el precio más alto.
6.  **Gestión de Riesgos**: Si la operación no genera ganancias netas, la aplicación solicita nuevas oportunidades a `localhost:3000/api/spot/top-opportunit`.

## Futuras Mejoras

-   Integración real con las APIs de los exchanges para la ejecución de órdenes y transferencias.
-   Modelo de IA más avanzado para predicción de precios y análisis de tendencias.
-   Interfaz de usuario de React para visualización y control.
-   Manejo de errores y reintentos más robusto.
-   Gestión de cartera y cálculo de ganancias/pérdidas en tiempo real.


