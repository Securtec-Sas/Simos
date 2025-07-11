# Instrucciones de Instalación - Simos Socket Fixes

## 📋 Orden de Instalación

**IMPORTANTE:** Aplicar los cambios en el siguiente orden para evitar conflictos:

### **1. Detener Servicios**
```bash
# Detener Sebo
cd /ruta/a/Simos/sebo
npm stop
# o
pkill -f "node.*sebo"

# Detener V3 (si está corriendo)
cd /ruta/a/Simos/V3
pkill -f "python.*main_v3"
```

### **2. Actualizar Sebo**
```bash
# Navegar al directorio de Sebo
cd /ruta/a/Simos/sebo/src/server

# Hacer backup de archivos originales
cp app.js app.js.backup
cp controllers/analizerController.js controllers/analizerController.js.backup
cp controllers/spotSocketController.js controllers/spotSocketController.js.backup

# Copiar archivos actualizados
cp /ruta/a/Simos_Socket_Fixes/Sebo_updates/app.js ./
cp /ruta/a/Simos_Socket_Fixes/Sebo_updates/analizerController.js ./controllers/
cp /ruta/a/Simos_Socket_Fixes/Sebo_updates/spotSocketController.js ./controllers/

# Verificar que no hay errores de sintaxis
node -c app.js
node -c controllers/analizerController.js
node -c controllers/spotSocketController.js
```

### **3. Actualizar V3**
```bash
# Navegar al directorio de V3
cd /ruta/a/Simos/V3

# Hacer backup del requirements original
cp requirements.txt requirements.txt.backup

# Copiar archivos nuevos
cp /ruta/a/Simos_Socket_Fixes/V3_updates/ui_broadcaster_socketio.py ./
cp /ruta/a/Simos_Socket_Fixes/V3_updates/requirements.txt ./

# Instalar nuevas dependencias
pip install uvicorn==0.24.0 fastapi==0.104.1

# Verificar instalación
python -c "import socketio, uvicorn, fastapi; print('Dependencias instaladas correctamente')"
```

### **4. Modificar main_v3.py**
```bash
# Editar main_v3.py para usar la nueva versión de ui_broadcaster
cd /ruta/a/Simos/V3

# Buscar la línea:
# from ui_broadcaster import UIBroadcaster

# Reemplazar por:
# from ui_broadcaster_socketio import UIBroadcaster

# Comando sed para hacer el cambio automáticamente:
sed -i 's/from ui_broadcaster import UIBroadcaster/from ui_broadcaster_socketio import UIBroadcaster/g' main_v3.py
```

### **5. Reiniciar Servicios**
```bash
# Iniciar Sebo
cd /ruta/a/Simos/sebo
npm start
# Verificar que esté corriendo en puerto 3000
curl http://localhost:3000/api/exchanges-status

# Iniciar V3
cd /ruta/a/Simos/V3
python main_v3.py
# Verificar que esté corriendo en puerto 3001
curl http://localhost:3001/socket.io/
```

## 🧪 Verificación de Funcionamiento

### **1. Probar Datos Históricos (Sebo)**
```bash
# Test básico de la nueva función OHLCV
curl "http://localhost:3000/api/historical-ohlcv?exchangeId=binance&symbol=BTC/USDT&timeframe=5m&limit=5"

# Respuesta esperada:
# {
#   "success": true,
#   "data": [
#     [timestamp, open, high, low, close, volume],
#     ...
#   ],
#   "exchange": "binance",
#   "symbol": "BTC/USDT",
#   "timeframe": "5m"
# }
```

### **2. Probar Socket V3 → UI**
```bash
# Verificar que el puerto 3001 esté abierto
netstat -tulpn | grep 3001

# Test de conexión Socket.IO
curl http://localhost:3001/socket.io/

# Respuesta esperada: código de respuesta 200
```

### **3. Probar desde la UI**
1. Abrir la UI en el navegador
2. Verificar en la consola del navegador que aparezca: "Conectado a V3"
3. Probar funciones de trading y IA
4. Verificar que los datos se actualicen en tiempo real

## 🔧 Configuración Adicional

### **Variables de Entorno (Opcional)**
```bash
# En Sebo (.env)
SPOT_ARB_DATA_NAMESPACE=/api/spot/arb
PORT=3000

# En V3 (config_v3.py)
UI_WEBSOCKET_URL=ws://localhost:3001/api/spot/ui
WEBSOCKET_URL=ws://localhost:3000/api/spot/arb
```

### **Firewall (Si es necesario)**
```bash
# Abrir puertos necesarios
sudo ufw allow 3000  # Sebo
sudo ufw allow 3001  # V3 Socket.IO
```

## 🚨 Solución de Problemas Comunes

### **Error: "SyntaxError" en Sebo**
```bash
# Verificar que no queden escapes de comillas
grep -n '\\\"' /ruta/a/Simos/sebo/src/server/controllers/*.js

# Si encuentra resultados, los archivos no se copiaron correctamente
# Volver a copiar desde Sebo_updates/
```

### **Error: "Module not found" en V3**
```bash
# Reinstalar dependencias
cd /ruta/a/Simos/V3
pip install -r requirements.txt

# Si persiste el error:
pip install python-socketio[asyncio]==5.10.0 uvicorn==0.24.0 fastapi==0.104.1
```

### **Error: "Cannot connect to V3" en UI**
```bash
# Verificar que V3 esté corriendo
ps aux | grep main_v3

# Verificar logs de V3
tail -f /ruta/a/Simos/V3/logs/v3.log

# Verificar puerto
lsof -i :3001
```

### **Error: "CCXT exchange not supported"**
```bash
# Verificar que CCXT esté instalado en Sebo
cd /ruta/a/Simos/sebo
npm list ccxt

# Si no está instalado:
npm install ccxt
```

### **Error: "Database connection" en Sebo**
```bash
# Verificar que MongoDB esté corriendo
sudo systemctl status mongod

# Si no está corriendo:
sudo systemctl start mongod
```

## 📊 Logs y Debugging

### **Logs de Sebo**
```bash
# Ver logs en tiempo real
tail -f /ruta/a/Simos/sebo/logs/sebo.log

# Buscar errores específicos
grep -i error /ruta/a/Simos/sebo/logs/sebo.log
```

### **Logs de V3**
```bash
# Ver logs en tiempo real
tail -f /ruta/a/Simos/V3/logs/v3.log

# Logs de Socket.IO
grep -i socket /ruta/a/Simos/V3/logs/v3.log
```

### **Logs de UI (Navegador)**
```javascript
// En la consola del navegador
localStorage.setItem('debug', 'socket.io-client:*');
// Recargar la página para ver logs detallados
```

## ✅ Checklist de Verificación

- [ ] Sebo corriendo en puerto 3000
- [ ] V3 corriendo en puerto 3001
- [ ] Endpoint `/api/historical-ohlcv` responde correctamente
- [ ] Socket.IO V3 acepta conexiones
- [ ] UI se conecta a V3 sin errores
- [ ] Datos del Top 20 se actualizan cada 5 segundos
- [ ] Funciones de IA responden desde la UI
- [ ] No hay errores de sintaxis en logs

## 📞 Contacto de Soporte

**Si encuentras problemas:**
1. Revisar logs de Sebo y V3
2. Verificar que todos los puertos estén abiertos
3. Confirmar que las dependencias estén instaladas
4. Verificar que los archivos se copiaron correctamente

**Archivos críticos:**
- `Sebo_updates/analizerController.js` - Funciones históricas
- `V3_updates/ui_broadcaster_socketio.py` - Socket.IO server
- `main_v3.py` - Debe importar ui_broadcaster_socketio

---

**¡Instalación completada!** 🎉

