import { useState, useEffect, useRef } from 'react';

const useWebSocketController = () => {
  const [connectionStatus, setConnectionStatus] = useState({
    v3: 'disconnected',
    sebo: 'disconnected'
  });
  const [v3Data, setV3Data] = useState(null);
  const [balances, setBalances] = useState(null);

  const v3SocketRef = useRef(null);
  const v3ReconnectTimeoutRef = useRef(null);
  const v3ReconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;  

  useEffect(() => {
    const connectV3 = () => {
      try {
        // Limpiar conexión anterior si existe
        if (v3SocketRef.current) {
          v3SocketRef.current.close();
          v3SocketRef.current = null;
        }

        const wsUrl = 'ws://localhost:3002';
        console.log(`Intentando conectar a V3 WebSocket: ${wsUrl}`);
        
        const socket = new WebSocket(wsUrl);
        v3SocketRef.current = socket;
        window.v3SocketInstance = socket;

        socket.onopen = () => {
          console.log('✅ Conectado al servidor WebSocket V3');
          setConnectionStatus(prev => ({ ...prev, v3: 'connected' }));
          v3ReconnectAttemptsRef.current = 0;
          
          // Solicitar estado inicial del sistema
          socket.send(JSON.stringify({ type: 'get_system_status' }));
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('📨 Mensaje de V3:', message.type, message.payload);

            switch (message.type) {
              case 'initial_state':
                console.log('🔄 Estado inicial recibido de V3:', message.payload);
                setV3Data(prev => ({
                  ...prev,
                  ...message.payload,
                }));
                if (typeof message.payload.sebo_connection_status !== 'undefined') {
                  setConnectionStatus(prev => ({ 
                    ...prev, 
                    sebo: message.payload.sebo_connection_status ? 'connected' : 'disconnected' 
                  }));
                }
                break;
                
              case 'system_status':
                console.log('📊 Estado del sistema:', message.payload);
                setV3Data(prev => ({ ...prev, system_status: message.payload }));
                if (typeof message.payload.sebo_connection !== 'undefined') {
                  setConnectionStatus(prev => ({ 
                    ...prev, 
                    sebo: message.payload.sebo_connection ? 'connected' : 'disconnected' 
                  }));
                }
                break;
                
              case 'trading_status':
              case 'trading_status_change':
                console.log('💹 Estado de trading:', message.payload);
                setV3Data(prev => ({ ...prev, trading_status: message.payload }));
                break;
                
              case 'top20_data':
                console.log('📈 Datos Top 20 recibidos:', message.payload?.length || 0, 'elementos');
                setV3Data(prev => ({ ...prev, top20_data: message.payload }));
                break;
                
              case 'balance_update':
                console.log('💰 Actualización de balance:', message.payload);
                setBalances(message.payload);
                setV3Data(prev => ({ ...prev, balance_update: message.payload }));
                break;
                
              case 'operation_result':
                console.log('⚡ Resultado de operación:', message.payload);
                setV3Data(prev => ({ ...prev, operation_result: message.payload }));
                break;
                
              case 'log_message':
                console.log(`📝 Log [${message.payload.level}]:`, message.payload.message);
                setV3Data(prev => ({ 
                  ...prev, 
                  logs: [...(prev?.logs || []), message.payload].slice(-100) // Mantener últimos 100 logs
                }));
                break;
                
              case 'ai_model_details':
                console.log('🤖 Detalles del modelo de IA:', message.payload);
                setV3Data(prev => ({ ...prev, ai_model_details: message.payload }));
                break;
                
              case 'ai_training_update':
                console.log('🎯 Actualización de entrenamiento IA:', message.payload);
                setV3Data(prev => ({ ...prev, ai_training_update: message.payload }));
                break;
                
              case 'ai_test_results':
                console.log('🧪 Resultados de prueba IA:', message.payload);
                setV3Data(prev => ({ ...prev, ai_test_results: message.payload }));
                break;
                
              case 'ai_simulation_update':
                console.log('🎮 Actualización de simulación IA:', message.payload);
                setV3Data(prev => ({ ...prev, ai_simulation_update: message.payload }));
                break;
                
              case 'csv_creation_result':
                console.log('📄 Resultado de creación CSV:', message.payload);
                setV3Data(prev => ({ ...prev, csv_creation_result: message.payload }));
                break;
                
              case 'training_result':
                console.log('🎓 Resultado de entrenamiento:', message.payload);
                setV3Data(prev => ({ ...prev, training_result: message.payload }));
                break;
                
              case 'simulation_result':
                console.log('🎯 Resultado de simulación:', message.payload);
                setV3Data(prev => ({ ...prev, simulation_result: message.payload }));
                break;
                
              case 'heartbeat':
                console.log('💓 Heartbeat de V3:', message.payload);
                // No actualizar estado para heartbeat, solo confirmar conexión
                break;
                
              default:
                console.log('❓ Tipo de mensaje desconocido de V3:', message.type, message.payload);
                setV3Data(prev => ({ ...prev, [message.type]: message.payload }));
            }
          } catch (error) {
            console.error('❌ Error parseando mensaje de V3:', error, event.data);
          }
        };

        socket.onerror = (error) => {
          console.error('❌ Error en WebSocket V3:', error);
          setConnectionStatus(prev => ({ ...prev, v3: 'error' }));
        };

        socket.onclose = (event) => {
          console.log(`🔌 WebSocket V3 desconectado - Código: ${event.code}, Razón: ${event.reason}`);
          setConnectionStatus(prev => ({ ...prev, v3: 'disconnected' }));
          window.v3SocketInstance = null;

          // Intentar reconectar si no fue un cierre intencional
          if (event.code !== 1000 && v3ReconnectAttemptsRef.current < maxReconnectAttempts) {
            v3ReconnectAttemptsRef.current++;
            const delay = Math.min(1000 * Math.pow(2, v3ReconnectAttemptsRef.current - 1), 30000); // Backoff exponencial
            console.log(`🔄 Reintentando conexión V3 (${v3ReconnectAttemptsRef.current}/${maxReconnectAttempts}) en ${delay}ms...`);
            
            setConnectionStatus(prev => ({ ...prev, v3: 'reconnecting' }));
            
            v3ReconnectTimeoutRef.current = setTimeout(() => {
              connectV3();
            }, delay);
          } else if (v3ReconnectAttemptsRef.current >= maxReconnectAttempts) {
            console.error('❌ Máximo número de intentos de reconexión alcanzado para V3');
            setConnectionStatus(prev => ({ ...prev, v3: 'failed' }));
          }
        };
      } catch (error) {
        console.error('❌ Error creando WebSocket V3:', error);
        setConnectionStatus(prev => ({ ...prev, v3: 'error' }));
      }
    };

    // Iniciar conexión
    connectV3();

    // Cleanup al desmontar componente
    return () => {
      console.log('🧹 Limpiando WebSocket V3...');
      
      if (v3ReconnectTimeoutRef.current) {
        clearTimeout(v3ReconnectTimeoutRef.current);
      }
      
      if (v3SocketRef.current && 
          (v3SocketRef.current.readyState === WebSocket.OPEN || 
           v3SocketRef.current.readyState === WebSocket.CONNECTING)) {
        v3SocketRef.current.close(1000, 'Component unmounting');
      }
      
      window.v3SocketInstance = null;
    };
  }, []);

  const sendV3Command = (command, payload = {}) => {
    if (v3SocketRef.current && v3SocketRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type: command, payload });
      console.log(`📤 Enviando comando a V3: ${command}`, payload);
      v3SocketRef.current.send(message);
      return true;
    } else {
      console.error(`❌ WebSocket V3 no está conectado. No se puede enviar comando: ${command}`);
      console.log('Estado actual del socket:', v3SocketRef.current?.readyState);
      return false;
    }
  };

  // Función para forzar reconexión
  const forceReconnectV3 = () => {
    console.log('🔄 Forzando reconexión a V3...');
    v3ReconnectAttemptsRef.current = 0;
    
    if (v3SocketRef.current) {
      v3SocketRef.current.close(1000, 'Force reconnect');
    }
    
    // La reconexión se manejará automáticamente en el evento onclose
  };

  // Función para obtener estado de conexión detallado
  const getConnectionDetails = () => {
    return {
      v3: {
        status: connectionStatus.v3,
        readyState: v3SocketRef.current?.readyState,
        reconnectAttempts: v3ReconnectAttemptsRef.current,
        maxAttempts: maxReconnectAttempts
      },
      sebo: {
        status: connectionStatus.sebo
      }
    };
  };

  return {
    connectionStatus,
    v3Data,
    balances,
    sendV3Command,
    forceReconnectV3,
    getConnectionDetails,
  };
};

export default useWebSocketController;
