# Descripción del Proceso V3

## Visión General

V3 es un componente central en la arquitectura de la plataforma de trading. Su principal objetivo es actuar como un **orquestador y procesador de datos en tiempo real**, facilitando la comunicación y la lógica de negocio entre los diferentes servicios y la interfaz de usuario (UI).

## Funcionalidades Principales y Flujo de Datos

1.  **Recepción y Procesamiento de Datos del Motor de Trading (Sebo):**
    *   V3 se conecta a servicios del motor de trading (`sebo`), como `update_balance`, `exchangeList`, y datos de mercado.
    *   Recibe actualizaciones de balance de las cuentas de usuario en los diferentes exchanges.
    *   Recibe la lista de exchanges disponibles y la información relevante de cada uno.
    *   Procesa datos de mercado, como precios, volúmenes y otra información relevante para las estrategias de trading.

2.  **Comunicación con la Interfaz de Usuario (UI):**
    *   V3 establece una conexión (probablemente mediante WebSockets) con la interfaz de usuario.
    *   Transmite en tiempo real la información procesada a la UI para su visualización. Esto incluye:
        *   Balances de cuenta actualizados.
        *   Lista de exchanges.
        *   Datos de mercado para gráficos y tablas (ej. Top20 Trading).
        *   Notificaciones y alertas.

3.  **Gestión de Lógica de Negocio Específica:**
    *   V3 puede contener lógica para filtrar, agregar o transformar datos antes de enviarlos a la UI.
    *   Implementa reglas específicas, como la exclusión del exchange principal en el Top20 Trading cuando el trading automático está activo.
    *   Maneja la frecuencia de actualización de ciertos componentes de la UI, como el Top20 Trading.

4.  **Interacción con Otros Servicios (Potencial):**
    *   Aunque no se especifica en detalle, V3 podría interactuar con otros microservicios para obtener información adicional o ejecutar acciones (ej. servicios de gestión de órdenes, análisis de riesgo, etc.).

## Objetivos Clave

*   **Centralización de Datos:** Servir como un punto central para la recolección y distribución de datos relevantes para el usuario.
*   **Tiempo Real:** Proveer actualizaciones instantáneas a la UI para una experiencia de usuario fluida y reactiva.
*   **Desacoplamiento:** Separar la lógica de presentación (UI) de la lógica de procesamiento de datos y trading (Sebo y otros servicios).
*   **Escalabilidad y Mantenibilidad:** Facilitar la adición de nuevas funcionalidades y la gestión del sistema al tener un componente dedicado a la orquestación de datos.

## Flujo Típico (Ejemplo: Actualización de Balance)

1.  El servicio `sebo/update_balance` detecta un cambio en el balance de una cuenta en un exchange.
2.  `sebo/update_balance` envía la actualización a V3 a través de un socket.
3.  V3 recibe la información del balance.
4.  V3 procesa esta información (si es necesario, ej. formateo).
5.  V3 retransmite la actualización del balance a todas las instancias de UI conectadas.
6.  La UI recibe la información y actualiza la visualización del balance para el usuario.

## Consideraciones Futuras (Basadas en los Cambios Solicitados)

*   **No cargar `spot_arb`:** V3 será modificado para ignorar o no solicitar datos relacionados con `spot_arb`, optimizando los recursos y el flujo de datos si esta funcionalidad ya no es requerida.
*   **Actualización dinámica del Top20:** La UI dependerá de V3 para recibir los datos actualizados del Top20 Trading cada 5 segundos, lo que implica que V3 debe gestionar esta periodicidad o simplemente transmitir los datos que recibe con esa frecuencia.

En resumen, V3 es un intermediario inteligente y eficiente que asegura que la información correcta llegue a la interfaz de usuario de manera oportuna, al mismo tiempo que aplica ciertas lógicas de negocio para adaptar la información a las necesidades de la plataforma.
