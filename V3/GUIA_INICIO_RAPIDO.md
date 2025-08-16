# 🚀 Guía de Inicio Rápido - Sistema de Simulación V3

## ✅ Estado Actual

- **Simulación Local**: ✅ **FUNCIONAL** - Lista para usar
- **Simulación Sebo Sandbox**: ⚠️ Implementada, requiere servidor Sebo activo

## 🎯 Cómo Usar Simulación Local (Disponible Ahora)

### 1. Iniciar V3
```bash
cd V3
python main_v3.py
```

### 2. Acceder a la UI
- Abrir navegador en: `http://localhost:3001` (o la URL de tu UI)
- Navegar a la página de simulación

### 3. Configurar Simulación Local
- **Modo**: Seleccionar "Local"
- **Balance Inicial**: $10,000 USDT (configurable)
- **Duración**: 60 minutos (configurable)
- **Operaciones Concurrentes**: 3 máximo

### 4. Iniciar Simulación
- Hacer clic en "Iniciar Simulación"
- El sistema comenzará a procesar oportunidades de arbitraje automáticamente

### 5. Monitorear en Tiempo Real
- **Transacciones Activas**: Ver progreso paso a paso
- **Métricas**: Balance actual, ROI, tasa de éxito
- **Estados**: PENDING → WITHDRAWING → BUYING → TRANSFERRING → SELLING → COMPLETED

## 📊 Métricas Disponibles

- **Balance Inicial vs Actual**
- **Total de Operaciones**
- **Operaciones Exitosas vs Fallidas**
- **ROI (Return on Investment)**
- **Ganancia/Pérdida Total en USDT**
- **Tiempo de Ejecución**

## 🔧 Configuración Avanzada

### Parámetros Modificables en `V3/shared/config_v3.py`:
```python
ADVANCED_SIMULATION_CONFIG = {
    'initial_balance': 10000.0,           # Balance inicial
    'time_between_transfers_seconds': 30, # Tiempo entre operaciones
    'simulation_duration_minutes': 60,    # Duración total
    'max_concurrent_operations': 3,       # Operaciones simultáneas
    'ai_confidence_threshold': 0.7        # Umbral de confianza AI
}
```

## 🎮 Controles de Simulación

### Desde la UI:
- **Iniciar**: Comienza nueva simulación
- **Detener**: Para simulación actual
- **Estado**: Ver métricas en tiempo real
- **Exportar**: Guardar resultados

### Comandos WebSocket:
- `start_simulation`: Iniciar simulación
- `stop_simulation`: Detener simulación
- `get_simulation_status`: Obtener estado actual
- `get_simulation_summary`: Resumen completo

## 🔍 Verificar que Todo Funciona

Ejecutar script de pruebas:
```bash
python V3/simple_test.py
```
**Resultado esperado**: 6/6 pruebas pasaron ✅

## ⚠️ Para Activar Simulación Sebo Sandbox

### Requisitos:
1. Servidor Sebo ejecutándose
2. Rutas sandbox implementadas en Sebo:
   - `/api/sandbox/withdraw_usdt`
   - `/api/sandbox/buy_asset`
   - `/api/sandbox/transfer_asset`
   - `/api/sandbox/sell_asset`

### Archivos Implementados:
- `sebo/src/server/routes/sandboxOperationRoutes.js`
- `sebo/src/server/controllers/sandboxOperationController.js`

### Para Activar:
1. Iniciar servidor Sebo con las nuevas rutas
2. Seleccionar modo "Sebo Sandbox" en la UI
3. Las operaciones se ejecutarán contra las APIs sandbox reales

## 🎉 ¡Listo para Usar!

El sistema de simulación local está **completamente funcional**. Puedes:

1. ✅ **Iniciar V3** y comenzar simulaciones locales inmediatamente
2. ✅ **Monitorear** transacciones en tiempo real
3. ✅ **Analizar** métricas de rendimiento
4. ✅ **Configurar** parámetros según tus necesidades
5. ⚠️ **Activar** simulaciones sandbox cuando tengas Sebo ejecutándose

---

**¿Problemas?** Revisar logs en `logs/v3_operations.log` o ejecutar `python V3/simple_test.py` para diagnóstico.