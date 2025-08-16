# Documentación del Sistema de Simulación V3

## Resumen

El sistema V3 ha sido actualizado con un motor de simulación avanzado que permite dos modalidades distintas de simulación de arbitraje de criptomonedas:

1. **Simulación Local**: Utiliza datos del socket en tiempo real y procesa las operaciones localmente
2. **Simulación Sandbox**: Utiliza las APIs sandbox de Sebo para simular operaciones reales

## Arquitectura del Sistema

### Componentes Principales

#### 1. AdvancedSimulationEngine (`V3/core/advanced_simulation_engine.py`)
Motor principal que maneja ambas modalidades de simulación.

**Características:**
- Gestión de transacciones paso a paso
- Integración con modelo de IA
- Cálculo realista de fees y comisiones
- Monitoreo en tiempo real
- Estadísticas detalladas

#### 2. Rutas Sandbox de Sebo (`sebo/src/server/routes/sandboxOperationRoutes.js`)
Nuevas rutas API para simulación sandbox:
- `/api/sandbox-operations/withdraw_usdt`
- `/api/sandbox-operations/buy_asset`
- `/api/sandbox-operations/transfer_asset`
- `/api/sandbox-operations/sell_asset`

#### 3. Controlador Sandbox (`sebo/src/server/controllers/sandboxOperationController.js`)
Implementa la lógica de simulación para cada paso del arbitraje.

#### 4. Interfaz de Usuario (`UI/clients/src/components/SimulationPage/`)
Componente React para controlar y monitorear las simulaciones.

## Modalidades de Simulación

### 1. Simulación Local

**Descripción:**
- Toma datos del socket de Sebo en tiempo real
- Procesa las operaciones de forma local
- Simula todos los pasos del arbitraje
- Utiliza precios reales y fees estimados

**Flujo de Operación:**
1. Recibe oportunidades del socket `top_20_data`
2. El modelo de IA evalúa la rentabilidad
3. Si es rentable, inicia la simulación paso a paso:
   - Retiro de USDT
   - Compra del activo
   - Transferencia entre exchanges
   - Venta del activo
4. Calcula el resultado final con fees reales

**Configuración:**
```javascript
{
    mode: 'local',
    initial_balance: 1000.0,
    time_between_transfers: 2.0,
    simulation_duration: 3600,
    max_concurrent_operations: 3
}
```

### 2. Simulación Sandbox

**Descripción:**
- Utiliza las APIs sandbox de Sebo
- Simula operaciones reales a través de HTTP calls
- Incluye delays realistas de red
- Maneja respuestas de API reales

**Flujo de Operación:**
1. Recibe oportunidades del socket
2. El modelo de IA evalúa la rentabilidad
3. Si es rentable, hace llamadas a la API sandbox:
   - `POST /api/sandbox-operations/withdraw_usdt`
   - `POST /api/sandbox-operations/buy_asset`
   - `POST /api/sandbox-operations/transfer_asset`
   - `POST /api/sandbox-operations/sell_asset`
4. Procesa las respuestas y calcula el resultado

**Endpoints de API:**

#### Retirar USDT
```http
POST /api/sandbox-operations/withdraw_usdt
Content-Type: application/json

{
    "exchange_id": "binance",
    "amount": 100.0,
    "transaction_id": "tx_BTC_1234567890"
}
```

#### Comprar Activo
```http
POST /api/sandbox-operations/buy_asset
Content-Type: application/json

{
    "exchange_id": "binance",
    "symbol": "BTC/USDT",
    "amount_usdt": 99.0,
    "transaction_id": "tx_BTC_1234567890"
}
```

#### Transferir Activo
```http
POST /api/sandbox-operations/transfer_asset
Content-Type: application/json

{
    "from_exchange": "binance",
    "to_exchange": "okx",
    "symbol": "BTC/USDT",
    "amount": 0.002,
    "transaction_id": "tx_BTC_1234567890"
}
```

#### Vender Activo
```http
POST /api/sandbox-operations/sell_asset
Content-Type: application/json

{
    "exchange_id": "okx",
    "symbol": "BTC/USDT",
    "amount": 0.0019,
    "transaction_id": "tx_BTC_1234567890"
}
```

## Integración con Modelo de IA

### Proceso de Decisión

1. **Preparación de Datos:**
   - Extrae características de la oportunidad
   - Calcula monto de inversión basado en balance actual
   - Estima fees y comisiones

2. **Predicción de IA:**
   - Evalúa probabilidad de éxito
   - Predice ganancia esperada
   - Calcula nivel de riesgo
   - Determina confianza general

3. **Criterios de Ejecución:**
   - Probabilidad de éxito >= 70%
   - Riesgo < 30%
   - Ganancia predicha >= mínimo configurado
   - Confianza general >= umbral

### Retroalimentación

El sistema proporciona retroalimentación al modelo de IA con:
- Resultado real de la operación
- Tiempo de ejecución
- Ganancia/pérdida real
- Factores que afectaron el resultado

## Configuración del Sistema

### Archivo de Configuración (`V3/shared/config_v3.py`)

```python
ADVANCED_SIMULATION_CONFIG = {
    'default_initial_balance': 1000.0,
    'default_time_between_transfers': 2.0,
    'default_simulation_duration': 3600,
    'default_max_concurrent_operations': 3,
    'default_success_rate': 0.85,
    'commission_rates': {
        'usdt_withdrawal': 1.0,  # 1 USDT fijo
        'asset_withdrawal_percentage': 0.001,  # 0.1%
        'trading_fee_percentage': 0.001  # 0.1%
    },
    'network_delay_range': (0.5, 3.0),
    'slippage_range': (0.001, 0.01)
}
```

### Parámetros Configurables

- **Balance Inicial**: Cantidad de USDT para iniciar la simulación
- **Tiempo entre Transferencias**: Delay simulado entre operaciones
- **Duración de Simulación**: Tiempo total de ejecución
- **Operaciones Concurrentes**: Máximo número de transacciones simultáneas
- **Tasas de Comisión**: Fees realistas para cada tipo de operación

## Interfaz de Usuario

### Características de la UI

1. **Panel de Configuración:**
   - Selección de modo (Local/Sandbox)
   - Configuración de parámetros
   - Controles de inicio/parada

2. **Panel de Estadísticas:**
   - Balance actual
   - Operaciones totales y exitosas
   - Ganancia/pérdida total
   - Tasa de éxito

3. **Transacciones en Curso:**
   - Lista de operaciones activas
   - Estado actual de cada transacción
   - Indicadores visuales de progreso

4. **Historial:**
   - Últimas transacciones completadas
   - Resultados de ganancia/pérdida
   - Timestamps de ejecución

### Mensajes WebSocket

#### Desde UI a V3:
- `start_simulation`: Iniciar simulación
- `stop_simulation`: Detener simulación
- `get_simulation_status`: Obtener estado actual

#### Desde V3 a UI:
- `simulation_started`: Simulación iniciada
- `simulation_stopped`: Simulación detenida
- `transaction_update`: Actualización de transacción
- `simulation_status`: Estado completo del sistema

## Monitoreo y Logging

### Logs del Sistema

El sistema genera logs detallados para:
- Inicio/fin de simulaciones
- Decisiones del modelo de IA
- Ejecución de cada paso de transacción
- Errores y excepciones
- Estadísticas de rendimiento

### Métricas Monitoreadas

- **Rendimiento:**
  - Tiempo promedio por operación
  - Throughput de transacciones
  - Latencia de API calls

- **Precisión del Modelo:**
  - Tasa de acierto en predicciones
  - Error en estimación de ganancias
  - Calibración de confianza

- **Operaciones:**
  - Distribución de tipos de error
  - Patrones de fallo
  - Eficiencia por exchange

## Casos de Uso

### 1. Entrenamiento del Modelo de IA
- Ejecutar simulaciones largas para generar datos
- Evaluar diferentes configuraciones de parámetros
- Validar mejoras en el modelo

### 2. Testing de Estrategias
- Probar nuevas lógicas de arbitraje
- Validar cambios en fees y comisiones
- Evaluar impacto de diferentes configuraciones

### 3. Demostración y Análisis
- Mostrar funcionamiento del sistema a stakeholders
- Analizar comportamiento en diferentes condiciones de mercado
- Generar reportes de rendimiento

## Limitaciones y Consideraciones

### Limitaciones Actuales

1. **Simulación Local:**
   - No incluye latencia real de red
   - Precios pueden cambiar durante la simulación
   - No considera liquidez real del mercado

2. **Simulación Sandbox:**
   - Dependiente de la disponibilidad de APIs de Sebo
   - Puede no reflejar condiciones reales de exchanges
   - Limitada por la implementación sandbox

### Consideraciones de Rendimiento

- Máximo 10 operaciones concurrentes recomendadas
- Monitoreo de memoria para simulaciones largas
- Limpieza periódica de logs y datos históricos

### Seguridad

- Todas las operaciones son simuladas (no hay riesgo real)
- APIs sandbox aisladas del trading real
- Validación de parámetros de entrada
- Rate limiting en endpoints de API

## Próximas Mejoras

### Funcionalidades Planificadas

1. **Simulación Híbrida:**
   - Combinar datos reales con simulación local
   - Integración con datos históricos

2. **Análisis Avanzado:**
   - Métricas de Sharpe ratio
   - Análisis de drawdown
   - Backtesting con datos históricos

3. **Optimización:**
   - Paralelización de operaciones
   - Cache de precios y fees
   - Optimización de memoria

4. **Reporting:**
   - Exportación de resultados a CSV/JSON
   - Gráficos de rendimiento
   - Reportes automatizados

## Conclusión

El sistema de simulación V3 proporciona una plataforma robusta para probar y validar estrategias de arbitraje sin riesgo financiero. Las dos modalidades (Local y Sandbox) ofrecen diferentes niveles de realismo y complejidad, permitiendo adaptarse a diferentes necesidades de testing y desarrollo.

La integración con el modelo de IA asegura que las simulaciones reflejen el comportamiento real del sistema de trading, mientras que la interfaz de usuario proporciona visibilidad completa del proceso y resultados.