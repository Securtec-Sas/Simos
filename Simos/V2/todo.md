## Tareas Pendientes

### Fase 1: Configuración inicial y estructura del proyecto
- [x] Crear la estructura de directorios del proyecto.
- [x] Crear el archivo `todo.md` (ya hecho).
- [x] Crear el archivo `config.py` para las claves de la API.
- [x] Crear el archivo `model.py` para el modelo de IA.
- [x] Crear el archivo `main.py` para la lógica principal.

### Fase 2: Implementación del cliente WebSocket y procesamiento de datos
- [x] Implementar el cliente WebSocket para consumir datos de 'localhost:3000/api/spot/arb'.
- [x] Procesar los datos recibidos del socket al formato requerido.

### Fase 3: Integración con CCXT y análisis de precios
- [x] Instalar la librería CCXT.
- [x] Realizar peticiones a CCXT para obtener valores de USDT en exchanges.
- [x] Calcular el valor máximo, mínimo y el porcentaje de diferencia.
- [x] Estructurar los datos en el formato `[ {btc/usdt, Binanace:1.20, okx:1.23,........., difer:5%} ]`.

### Fase 4: Implementación del modelo de IA y lógica de decisión
- [x] Definir la estructura del modelo de IA.
- [x] Implementar la lógica de decisión basada en el porcentaje de diferencia.
- [x] Implementar la lógica para la petición a `localhost:3000/api/spot/top-opportunit`.

### Fase 5: Sistema de trading automático y gestión de riesgos
- [x] Implementar la lógica de compra en el exchange con el valor más bajo.
- [x] Implementar la lógica de transferencia entre exchanges.
- [x] Implementar la lógica de venta si el porcentaje es mayor a 0.6 o no se espera alza.
- [x] Considerar gastos de transacción para el cálculo de ganancias.

### Fase 6: Servidor WebSocket para comunicación con React UI
- [x] Implementar un servidor WebSocket para enviar datos a la UI de React.

### Fase 7: Funciones de entrenamiento y testing del modelo
- [x] Crear funciones para entrenar el modelo de IA.
- [x] Crear funciones para testear el modelo de IA.
- [x] Crear datos de entrenamiento y prueba.

### Fase 8: Pruebas y documentación final
- [x] Realizar pruebas exhaustivas de la aplicación.
- [x] Documentar el código y el proceso.

