# Instrucciones de Instalación - Actualizaciones V3

## Estructura del ZIP

```
Simos_Actualizaciones_V3/
├── UI_updates/                 # Archivos actualizados de la UI
│   ├── App.jsx                # Aplicación principal con conexiones V2/V3
│   ├── Layout.jsx             # Layout con navegación mejorada
│   ├── Top20DetailedPage.jsx  # Página Top20 con control de trading
│   └── ExchangeAPIsPage.jsx   # Nueva página de gestión de APIs
├── Sebo_updates/              # Archivos actualizados de Sebo
│   ├── app.js                 # Servidor principal optimizado
│   └── spotSocketController.js # Controlador WebSocket mejorado
├── docs/                      # Documentación
│   └── README_ACTUALIZACIONES.md
└── INSTRUCCIONES_INSTALACION.md # Este archivo
```

## Pasos de Instalación

### 1. Hacer Backup (IMPORTANTE)

Antes de aplicar las actualizaciones, haz backup de los archivos originales:

```bash
# Backup de UI
cd /ruta/a/Simos/UI/clients/src
cp App.jsx App.jsx.backup
cp components/Layout/Layout.jsx components/Layout/Layout.jsx.backup
cp components/Top20DetailedPage/Top20DetailedPage.jsx components/Top20DetailedPage/Top20DetailedPage.jsx.backup

# Backup de Sebo
cd /ruta/a/Simos/sebo/src/server
cp app.js app.js.backup
cp controllers/spotSocketController.js controllers/spotSocketController.js.backup
```

### 2. Aplicar Actualizaciones de UI

```bash
# Navegar al directorio de la UI
cd /ruta/a/Simos/UI/clients/src

# Reemplazar archivo principal
cp /ruta/a/actualizaciones/UI_updates/App.jsx App.jsx

# Reemplazar Layout
cp /ruta/a/actualizaciones/UI_updates/Layout.jsx components/Layout/Layout.jsx

# Reemplazar Top20DetailedPage
cp /ruta/a/actualizaciones/UI_updates/Top20DetailedPage.jsx components/Top20DetailedPage/Top20DetailedPage.jsx

# Crear nueva página de APIs (crear directorio si no existe)
mkdir -p components/ExchangeAPIsPage
cp /ruta/a/actualizaciones/UI_updates/ExchangeAPIsPage.jsx components/ExchangeAPIsPage/ExchangeAPIsPage.jsx
```

### 3. Aplicar Actualizaciones de Sebo

```bash
# Navegar al directorio de Sebo
cd /ruta/a/Simos/sebo/src/server

# Reemplazar app.js
cp /ruta/a/actualizaciones/Sebo_updates/app.js app.js

# Reemplazar spotSocketController.js
cp /ruta/a/actualizaciones/Sebo_updates/spotSocketController.js controllers/spotSocketController.js
```

### 4. Verificar Instalación

#### UI:
```bash
cd /ruta/a/Simos/UI/clients
npm install  # Por si hay nuevas dependencias
npm start
```

**Verificaciones:**
- La UI debe cargar sin errores
- Debe mostrar indicadores de conexión para V2, V3 y Sebo
- La nueva página "APIs Exchanges" debe estar disponible
- La página "Top 20 Trading" debe tener controles de trading

#### Sebo:
```bash
cd /ruta/a/Simos/sebo
npm start
```

**Verificaciones:**
- Sebo debe iniciar sin errores en puerto 3031
- Debe emitir datos en el namespace `/api/spot/arb`
- Los logs deben mostrar "SpotSocketController: Namespace /api/spot/arb inicializado"

### 5. Probar Integración con V3

```bash
# Iniciar V3 (si ya está instalado)
cd /ruta/a/Simos/V3
python start_v3.py
```

**Verificaciones:**
- V3 debe conectarse a Sebo (puerto 3031)
- La UI debe mostrar V3 como "connected"
- Los datos Top20 deben aparecer en la página correspondiente
- Los controles de trading deben funcionar

## Nuevas Funcionalidades Disponibles

### 1. Dashboard Principal
- **Indicadores de estado** en tiempo real para V2, V3 y Sebo
- **Navegación mejorada** con iconos y diseño moderno
- **Datos en tiempo real** de ambos sistemas

### 2. Página "APIs Exchanges" (NUEVA)
- **Gestión completa** de credenciales de exchanges
- **Configuración de API keys** de forma segura
- **Modo sandbox** para pruebas
- **Prueba de conectividad** para cada exchange
- **Activación/desactivación** de exchanges

### 3. Página "Top 20 Trading" (MEJORADA)
- **Control de trading automatizado** desde la UI
- **Configuración de parámetros** de inversión
- **Selección de exchange principal** para balance
- **Modo de inversión** (porcentaje o cantidad fija)
- **Botones de inicio/parada** de trading real
- **Ejecución de trades manuales**
- **Visualización mejorada** con colores por rentabilidad

### 4. Integración V2/V3
- **Conexión simultánea** a ambos sistemas
- **Manejo independiente** de cada versión
- **Compatibilidad total** con funcionalidades existentes
- **Comunicación bidireccional** con V3

## Configuración Recomendada

### Puertos:
- **V2**: 3001
- **V3**: 3002  
- **Sebo**: 3031
- **UI**: 3000

### Orden de Inicio:
1. Sebo (puerto 3031)
2. V2 (puerto 3001) - opcional
3. V3 (puerto 3002)
4. UI (puerto 3000)

## Solución de Problemas

### Error: "Cannot find module ExchangeAPIsPage"
```bash
# Verificar que el archivo esté en la ubicación correcta
ls -la components/ExchangeAPIsPage/ExchangeAPIsPage.jsx
```

### Error: UI no se conecta a V3
```bash
# Verificar que V3 esté ejecutándose en puerto 3002
netstat -an | grep 3002
# Verificar logs de V3 para errores de WebSocket
```

### Error: Sebo no emite datos
```bash
# Verificar logs de Sebo
tail -f /ruta/a/Simos/sebo/logs/server.log
# Verificar conexión a base de datos
```

### Error: Trading no funciona
```bash
# Verificar configuración de APIs en la nueva página
# Verificar que V3 esté en modo real (no simulación)
# Verificar logs de V3 para errores de trading
```

## Rollback (Restaurar Versión Anterior)

Si necesitas volver a la versión anterior:

```bash
# Restaurar UI
cd /ruta/a/Simos/UI/clients/src
cp App.jsx.backup App.jsx
cp components/Layout/Layout.jsx.backup components/Layout/Layout.jsx
cp components/Top20DetailedPage/Top20DetailedPage.jsx.backup components/Top20DetailedPage/Top20DetailedPage.jsx
rm -rf components/ExchangeAPIsPage  # Eliminar nueva página

# Restaurar Sebo
cd /ruta/a/Simos/sebo/src/server
cp app.js.backup app.js
cp controllers/spotSocketController.js.backup controllers/spotSocketController.js

# Reiniciar servicios
npm restart
```

## Notas Importantes

1. **Compatibilidad**: Estas actualizaciones mantienen total compatibilidad con V2
2. **V3 Requerido**: Las nuevas funcionalidades de trading requieren V3 instalado
3. **Base de Datos**: No se requieren cambios en la base de datos
4. **APIs**: La gestión de APIs es nueva y opcional
5. **Backup**: Siempre mantén backup de los archivos originales

## Soporte

Para problemas técnicos:
1. Verificar logs de cada componente
2. Comprobar que todos los servicios estén ejecutándose
3. Verificar configuración de puertos
4. Revisar la documentación completa en `docs/README_ACTUALIZACIONES.md`

