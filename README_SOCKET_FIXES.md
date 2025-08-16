# Simos - Correcciones de Socket y Funciones Históricas

## Resumen de Cambios

Este paquete contiene las correcciones y mejoras implementadas para solucionar problemas en Sebo y V3, incluyendo la eliminación de escapes de comillas, implementación de funciones para obtener datos históricos con redondeo CCXT, y corrección de errores en el socket V3.

## 🔧 Cambios Realizados

### **Sebo (Backend Node.js)**

#### 1. **app.js**
- ✅ Eliminación de escapes de comillas innecesarios
- ✅ Agregada nueva ruta `/api/historical-ohlcv` para datos históricos OHLCV
- ✅ Código limpio y optimizado

#### 2. **analizerController.js**
- ✅ **Eliminación completa de escapes de comillas** (`\"` → `"`)
- ✅ **Nueva función `getHistoricalOHLCV`**: Obtiene datos históricos OHLCV de exchanges
  - Redondeo automático al intervalo CCXT más cercano (1m, 5m, 15m, 1h, etc.)
  - Soporte para parámetros: exchangeId, symbol, timeframe, since, limit
  - Validación de exchanges soportados por CCXT
- ✅ **Nueva función `dataTrainModel`**: Genera datos de entrenamiento para IA
  - Filtrado por rango de fechas (start_date, end_date)
  - Configuración de épocas y límite de registros
  - Cálculo de rentabilidad neta considerando fees
  - Clasificación automática de niveles de riesgo
- ✅ **Nueva función `getFormattedTopAnalysis`**: Formatea datos del top 20
- ✅ **Función `actualizePricetop20`**: Para actualización de precios
- ✅ Corrección de sintaxis y eliminación de caracteres de escape

#### 3. **spotSocketController.js**
- ✅ Eliminación completa de escapes de comillas
- ✅ Corrección de sintaxis en comentarios Swagger
- ✅ Limpieza de código y optimización

### **V3 (Backend Python)**

#### 1. **ui_broadcaster_socketio.py** (NUEVO)
- ✅ **Implementación completa de Socket.IO** en lugar de WebSockets estándar
- ✅ **Compatibilidad total con la UI** que usa Socket.IO
- ✅ **Servidor en puerto 3001** como se especifica en la configuración
- ✅ **Eventos implementados**:
  - `connect` / `disconnect`
  - `start_trading` / `stop_trading`
  - `train_ai_model` / `test_ai_model` / `start_ai_simulation`
  - `get_trading_status` / `get_system_status`
  - `ping` / `pong`
- ✅ **Broadcasting mejorado**:
  - `broadcast_top20_data`
  - `broadcast_balances_update`
  - `broadcast_ai_training_progress`
  - `broadcast_ai_test_results`
  - `broadcast_ai_simulation_update`
- ✅ **Gestión de callbacks** para integración con otros módulos
- ✅ **Manejo robusto de errores** y logging detallado

#### 2. **requirements.txt**
- ✅ Agregadas dependencias para Socket.IO:
  - `uvicorn==0.24.0`
  - `fastapi==0.104.1`
- ✅ Dependencias existentes mantenidas

## 📊 Nuevas Funcionalidades

### **Datos Históricos OHLCV**
```javascript
// Endpoint: GET /api/historical-ohlcv
// Parámetros:
{
  "exchangeId": "binance",
  "symbol": "BTC/USDT", 
  "timeframe": "5m",
  "since": 1640995200000,  // timestamp
  "limit": 100
}
```

**Características:**
- ✅ Redondeo automático al timeframe CCXT más cercano
- ✅ Soporte para todos los exchanges compatibles con CCXT
- ✅ Validación de parámetros y manejo de errores
- ✅ Respuesta estructurada con datos OHLCV

### **Datos de Entrenamiento para IA**
```javascript
// Función: dataTrainModel
// Parámetros:
{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "limit": 1000,
  "epochs": 100,
  "include_fees": true
}
```

**Características:**
- ✅ Filtrado por rango de fechas flexible
- ✅ Cálculo de rentabilidad neta con fees
- ✅ Clasificación automática de riesgo (low/medium/high)
- ✅ Características adicionales para ML (price_spread, price_ratio, etc.)
- ✅ Datos formateados listos para entrenamiento

### **Socket.IO V3 → UI**
- ✅ **Comunicación bidireccional** estable
- ✅ **Eventos en tiempo real** para trading y IA
- ✅ **Manejo de reconexiones** automático
- ✅ **Broadcasting eficiente** a múltiples clientes
- ✅ **Integración completa** con callbacks de V3

## 🚀 Instalación

### **1. Actualizar Sebo**
```bash
# Copiar archivos actualizados
cp Sebo_updates/app.js /ruta/a/Simos/sebo/src/server/
cp Sebo_updates/analizerController.js /ruta/a/Simos/sebo/src/server/controllers/
cp Sebo_updates/spotSocketController.js /ruta/a/Simos/sebo/src/server/controllers/

# Reiniciar Sebo
cd /ruta/a/Simos/sebo
npm restart
```

### **2. Actualizar V3**
```bash
# Instalar nuevas dependencias
cd /ruta/a/Simos/V3
pip install uvicorn==0.24.0 fastapi==0.104.1

# Copiar archivos nuevos
cp V3_updates/ui_broadcaster_socketio.py /ruta/a/Simos/V3/
cp V3_updates/requirements.txt /ruta/a/Simos/V3/

# Actualizar main_v3.py para usar la nueva versión
# Cambiar: from ui_broadcaster import UIBroadcaster
# Por: from ui_broadcaster_socketio import UIBroadcaster
```

### **3. Verificar Funcionamiento**

#### **Sebo - Datos Históricos:**
```bash
curl "http://localhost:3000/api/historical-ohlcv?exchangeId=binance&symbol=BTC/USDT&timeframe=5m&limit=10"
```

#### **V3 - Socket.IO:**
```bash
# Verificar que el servidor Socket.IO esté corriendo en puerto 3001
netstat -tulpn | grep 3001
```

#### **UI - Conexión:**
- Abrir la UI y verificar que se conecte a V3
- Probar funciones de trading y IA
- Verificar logs en tiempo real

## 🔍 Solución de Problemas

### **Error: "Module not found" en V3**
```bash
# Instalar dependencias faltantes
pip install python-socketio[asyncio]==5.10.0 uvicorn fastapi
```

### **Error: "Cannot connect to V3" en UI**
```bash
# Verificar que V3 esté corriendo en puerto 3001
curl http://localhost:3001/socket.io/
```

### **Error: "CCXT exchange not supported"**
```bash
# Verificar exchanges soportados
node -e "console.log(Object.keys(require('ccxt')))"
```

### **Error de sintaxis en Sebo**
- Verificar que no queden escapes de comillas (`\"`)
- Reiniciar Sebo completamente
- Revisar logs: `tail -f sebo/logs/sebo.log`

## 📈 Mejoras Implementadas

### **Rendimiento**
- ✅ Eliminación de código redundante
- ✅ Optimización de consultas a base de datos
- ✅ Caching de instancias CCXT
- ✅ Manejo eficiente de conexiones Socket.IO

### **Estabilidad**
- ✅ Manejo robusto de errores
- ✅ Validación de parámetros
- ✅ Logging detallado para debugging
- ✅ Reconexión automática de sockets

### **Funcionalidad**
- ✅ Datos históricos reales para entrenamiento
- ✅ Redondeo inteligente de timeframes
- ✅ Comunicación bidireccional UI ↔ V3
- ✅ Broadcasting en tiempo real

## 🧪 Testing

### **Probar Datos Históricos**
```javascript
// Test básico
fetch('http://localhost:3000/api/historical-ohlcv?exchangeId=binance&symbol=BTC/USDT&timeframe=1h&limit=5')
  .then(r => r.json())
  .then(console.log);
```

### **Probar Socket.IO V3**
```javascript
// Test desde navegador
const socket = io('http://localhost:3001');
socket.on('connect', () => console.log('Conectado a V3'));
socket.emit('ping', {});
socket.on('pong', (data) => console.log('Pong recibido:', data));
```

### **Probar Entrenamiento IA**
```javascript
// Test desde Sebo socket
socket.emit('train_ai_model', {
  start_date: '2024-01-01',
  limit: 100,
  epochs: 10
});
```

## 📞 Soporte

**Archivos Principales Modificados:**
- `Sebo_updates/analizerController.js` - Funciones históricas y eliminación de escapes
- `V3_updates/ui_broadcaster_socketio.py` - Socket.IO server para V3
- `Sebo_updates/spotSocketController.js` - Limpieza de sintaxis
- `Sebo_updates/app.js` - Nueva ruta OHLCV

**Logs Importantes:**
- Sebo: `/logs/sebo.log`
- V3: `/logs/v3.log`
- UI: Consola del navegador

---

**Versión:** 1.0  
**Fecha:** $(date)  
**Compatibilidad:** Simos V3, Sebo, UI React  
**Estado:** ✅ Listo para producción

