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

A continuación se presenta una vista detallada de la estructura del proyecto, destacando las carpetas y archivos más importantes.

```
.
├── UI/
│   ├── clients/
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── AIDataPage/
│   │   │   │   ├── SimulationPage/
│   │   │   │   └── ...
│   │   │   ├── pages/
│   │   │   │   ├── ConnectionPage/
│   │   │   │   └── ...
│   │   │   ├── App.jsx
│   │   │   └── main.jsx
│   │   ├── package.json
│   │   └── vite.config.js
│   └── README.md
│
├── V3/
│   ├── adapters/
│   │   ├── api/
│   │   ├── connectors/
│   │   └── ...
│   ├── core/
│   │   ├── advanced_simulation_engine.py
│   │   ├── ai_model.py
│   │   ├── arbitrage_calculator.py
│   │   └── simulation_engine.py
│   ├── models/
│   │   └── arbitrage_model.pkl
│   ├── scripts/
│   │   ├── simulate.py
│   │   └── train_model.py
│   ├── shared/
│   │   └── config_v3.py
│   ├── main_v3.py
│   └── requirements.txt
│
├── sebo/
│   ├── src/
│   │   ├── server/
│   │   │   ├── controllers/
│   │   │   │   ├── spotController.js
│   │   │   │   └── sandboxOperationController.js
│   │   │   ├── routes/
│   │   │   │   ├── spotRoutes.js
│   │   │   │   └── sandboxOperationRoutes.js
│   │   │   ├── data/
│   │   │   └── app.js
│   │   └── data/
│   ├── package.json
│   └── .env.example
│
├── simosRead.md
└── ... (otros archivos de configuración y documentación)
```
