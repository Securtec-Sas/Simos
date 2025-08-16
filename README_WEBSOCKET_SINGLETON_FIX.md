# Fix para Múltiples Conexiones WebSocket

## Problema Identificado

El cliente UI estaba creando múltiples conexiones WebSocket constantemente en lugar de mantener una sola conexión persistente. Los logs mostraban:

```
2025-08-11 02:30:58,510 - V3.UIBroadcaster - INFO - Cliente UI conectado: 127.0.0.1:53638 (path: /)
2025-08-11 02:30:58,527 - V3.UIBroadcaster - INFO - Cliente UI conectado: 127.0.0.1:53640 (path: /)
2025-08-11 02:31:00,509 - V3.UIBroadcaster - INFO - Cliente UI conectado: 127.0.0.1:53642 (path: /)
```

## Causas del Problema

1. **Re-renderizados del componente**: Si el componente que usa el hook se re-monta frecuentemente
2. **Múltiples instancias**: Si hay varios componentes usando el mismo hook
3. **Reconexión agresiva**: La lógica de reconexión podría estar creando nuevas conexiones antes de cerrar las anteriores

## Solución Implementada

### 1. Patrón Singleton en el Cliente (useWebSocketController.jsx)

Se implementó una clase `WebSocketSingleton` que garantiza una sola conexión WebSocket en toda la aplicación:

#### Características principales:
- **Una sola instancia**: Solo puede existir una conexión WebSocket activa
- **Sistema de suscriptores**: Múltiples componentes pueden suscribirse a los eventos
- **Prevención de conexiones múltiples**: Verifica si ya existe una conexión antes de crear una nueva
- **Mejor manejo de reconexión**: Evita reconexiones simultáneas

#### Código clave:
```javascript
class WebSocketSingleton {
  async connect() {
    // Evitar múltiples conexiones simultáneas
    if (this.isConnecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) {
      console.log('🔄 Conexión ya existe o está en proceso');
      return;
    }
    // ... resto de la lógica
  }
}
```

### 2. Mejoras en el Servidor (ui_broadcaster.py)

Se mejoró el manejo de conexiones múltiples en el servidor:

#### Características principales:
- **Detección de conexiones duplicadas**: Identifica conexiones desde la misma IP
- **Cierre automático de conexiones anteriores**: Cierra conexiones previas cuando llega una nueva
- **Limpieza periódica**: Tarea que ejecuta cada minuto para limpiar conexiones muertas
- **Mejor logging**: Información detallada sobre conexiones y desconexiones

#### Código clave:
```python
# Verificar si ya existe una conexión desde la misma IP
existing_connections = [
    client for client in self.ui_clients 
    if hasattr(client, 'remote_address') and 
    client.remote_address[0] == websocket.remote_address[0]
]

if existing_connections:
    # Cerrar conexiones anteriores de la misma IP
    for old_client in existing_connections:
        await old_client.close(code=1000, reason="Nueva conexión desde la misma IP")
```

## Archivos Modificados

1. **`UI/clients/src/hooks/useWebSocketController.jsx`**
   - Implementación completa del patrón singleton
   - Sistema de suscriptores para múltiples componentes
   - Mejor manejo de estados de conexión

2. **`V3/adapters/socket/ui_broadcaster.py`**
   - Detección y cierre de conexiones duplicadas
   - Limpieza periódica de conexiones muertas
   - Mejor logging y manejo de errores

## Beneficios de la Solución

1. **Una sola conexión**: Garantiza que solo haya una conexión WebSocket activa
2. **Mejor rendimiento**: Reduce el overhead de múltiples conexiones
3. **Menos logs**: Elimina el spam de conexiones constantes
4. **Mejor estabilidad**: Manejo más robusto de reconexiones
5. **Escalabilidad**: Permite múltiples componentes usando la misma conexión

## Cómo Probar la Solución

### 1. Verificar en el Cliente
```javascript
// En la consola del navegador, verificar que solo hay una instancia
console.log(window.v3SocketInstance); // Debe mostrar una sola instancia
```

### 2. Verificar en los Logs del Servidor
Los logs ahora deben mostrar:
```
Cliente UI conectado: 127.0.0.1:53638 (path: /) - Total clientes: 1
```

En lugar de múltiples conexiones constantes.

### 3. Verificar Reconexión
1. Detener el servidor WebSocket
2. Verificar que el cliente intenta reconectar
3. Reiniciar el servidor
4. Verificar que se establece una sola conexión

### 4. Verificar Múltiples Componentes
1. Abrir múltiples pestañas de la aplicación
2. Verificar que cada pestaña tiene su propia conexión (comportamiento esperado)
3. Pero dentro de cada pestaña, solo debe haber una conexión

## Monitoreo Continuo

Para monitorear que la solución funciona correctamente:

1. **Logs del servidor**: Verificar que no hay conexiones constantes
2. **Consola del navegador**: Verificar mensajes de conexión/desconexión
3. **Network tab**: Verificar que solo hay una conexión WebSocket activa
4. **Performance**: Verificar que el uso de recursos es estable

## Notas Técnicas

- El singleton se mantiene a nivel de ventana/pestaña del navegador
- Cada pestaña tendrá su propia instancia del singleton (comportamiento esperado)
- La limpieza se realiza automáticamente al cerrar la pestaña
- El servidor maneja automáticamente las conexiones duplicadas desde la misma IP