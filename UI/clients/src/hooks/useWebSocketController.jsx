import { useState, useEffect, useRef } from 'react';

// Singleton para manejar la conexión WebSocket globalmente
class WebSocketSingleton {
  constructor() {
    this.socket = null;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.subscribers = new Set();
    this.connectionStatus = 'disconnected';
    this.isConnecting = false;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    // Enviar estado actual al suscriptor
    callback({
      type: 'connection_status',
      status: this.connectionStatus,
      reconnectAttempts: this.reconnectAttempts
    });
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  broadcast(data) {
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error en callback de subscriber:', error);
      }
    });
  }

  async connect() {
    // Evitar múltiples conexiones simultáneas
    if (this.isConnecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) {
      console.log('🔄 Conexión ya existe o está en proceso');
      return;
    }

    this.isConnecting = true;

    try {
      // Cerrar conexión anterior si existe
      if (this.socket) {
        this.socket.close(1000, 'Creating new connection');
        this.socket = null;
      }

      const wsUrl = 'ws://localhost:3002';
      console.log(`🔌 Conectando a V3 WebSocket: ${wsUrl}`);
      
      this.socket = new WebSocket(wsUrl);
      window.v3SocketInstance = this.socket;

      this.socket.onopen = () => {
        console.log('✅ Conectado al servidor WebSocket V3');
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        
        this.broadcast({
          type: 'connection_status',
          status: 'connected',
          reconnectAttempts: this.reconnectAttempts
        });
        
        // Solicitar estado inicial del sistema
        this.send({ type: 'get_system_status' });
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Mensaje de V3:', message.type, message.payload);
          
          this.broadcast({
            type: 'websocket_message',
            message: message
          });
        } catch (error) {
          console.error('❌ Error parseando mensaje de V3:', error, event.data);
        }
      };

      this.socket.onerror = (error) => {
        console.error('❌ Error en WebSocket V3:', error);
        this.connectionStatus = 'error';
        this.isConnecting = false;
        
        this.broadcast({
          type: 'connection_status',
          status: 'error',
          reconnectAttempts: this.reconnectAttempts
        });
      };

      this.socket.onclose = (event) => {
        console.log(`🔌 WebSocket V3 desconectado - Código: ${event.code}, Razón: ${event.reason}`);
        this.connectionStatus = 'disconnected';
        this.isConnecting = false;
        window.v3SocketInstance = null;

        this.broadcast({
          type: 'connection_status',
          status: 'disconnected',
          reconnectAttempts: this.reconnectAttempts
        });

        // Intentar reconectar si no fue un cierre intencional
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Máximo número de intentos de reconexión alcanzado para V3');
          this.connectionStatus = 'failed';
          this.broadcast({
            type: 'connection_status',
            status: 'failed',
            reconnectAttempts: this.reconnectAttempts
          });
        }
      };
    } catch (error) {
      console.error('❌ Error creando WebSocket V3:', error);
      this.connectionStatus = 'error';
      this.isConnecting = false;
      this.broadcast({
        type: 'connection_status',
        status: 'error',
        reconnectAttempts: this.reconnectAttempts
      });
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`🔄 Reintentando conexión V3 (${this.reconnectAttempts}/${this.maxReconnectAttempts}) en ${delay}ms...`);
    
    this.connectionStatus = 'reconnecting';
    this.broadcast({
      type: 'connection_status',
      status: 'reconnecting',
      reconnectAttempts: this.reconnectAttempts
    });
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      console.log(`📤 Enviando comando a V3: ${data.type}`, data.payload);
      this.socket.send(message);
      return true;
    } else {
      console.error(`❌ WebSocket V3 no está conectado. No se puede enviar comando: ${data.type}`);
      console.log('Estado actual del socket:', this.socket?.readyState);
      return false;
    }
  }

  forceReconnect() {
    console.log('🔄 Forzando reconexión a V3...');
    this.reconnectAttempts = 0;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.socket) {
      this.socket.close(1000, 'Force reconnect');
    }
  }

  disconnect() {
    console.log('🧹 Desconectando WebSocket V3...');
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket && 
        (this.socket.readyState === WebSocket.OPEN || 
         this.socket.readyState === WebSocket.CONNECTING)) {
      this.socket.close(1000, 'Manual disconnect');
    }
    
    this.socket = null;
    window.v3SocketInstance = null;
    this.connectionStatus = 'disconnected';
    this.isConnecting = false;
  }

  getConnectionDetails() {
    return {
      v3: {
        status: this.connectionStatus,
        readyState: this.socket?.readyState,
        reconnectAttempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        subscribersCount: this.subscribers.size
      }
    };
  }
}

// Instancia singleton global
const webSocketSingleton = new WebSocketSingleton();

const useWebSocketController = () => {
  const [connectionStatus, setConnectionStatus] = useState({
    v3: 'disconnected',
    sebo: 'disconnected'
  });
  const [v3Data, setV3Data] = useState(null);
  const [balances, setBalances] = useState(null);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    // Suscribirse a los eventos del singleton
    const handleWebSocketEvent = (event) => {
      switch (event.type) {
        case 'connection_status':
          setConnectionStatus(prev => ({ 
            ...prev, 
            v3: event.status 
          }));
          break;
          
        case 'websocket_message':
          handleWebSocketMessage(event.message);
          break;
      }
    };

    const handleWebSocketMessage = (message) => {
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
    };

    // Suscribirse al singleton
    unsubscribeRef.current = webSocketSingleton.subscribe(handleWebSocketEvent);

    // Iniciar conexión si no está conectada
    if (webSocketSingleton.connectionStatus === 'disconnected') {
      webSocketSingleton.connect();
    }

    // Cleanup al desmontar componente
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const sendV3Command = (command, payload = {}) => {
    return webSocketSingleton.send({ type: command, payload });
  };

  const forceReconnectV3 = () => {
    webSocketSingleton.forceReconnect();
  };

  const getConnectionDetails = () => {
    const details = webSocketSingleton.getConnectionDetails();
    return {
      ...details,
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
