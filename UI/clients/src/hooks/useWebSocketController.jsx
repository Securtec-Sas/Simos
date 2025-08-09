import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const useWebSocketController = () => {
  const [connectionStatus, setConnectionStatus] = useState({
    v3: 'disconnected',
    sebo: 'disconnected'
  });
  const [v3Data, setV3Data] = useState(null);
  const [balances, setBalances] = useState(null);

  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io('ws://localhost:3001', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });
    socketRef.current = socket;
    window.v3SocketInstance = socket;

    socket.on('connect', () => {
      console.log('Connected to V3 Socket.IO server');
      setConnectionStatus(prev => ({ ...prev, v3: 'connected' }));
      socket.emit('ui_message', { type: 'get_system_status' });
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from V3 Socket.IO server:', reason);
      setConnectionStatus(prev => ({ ...prev, v3: 'disconnected' }));
    });

    socket.on('connect_error', (error) => {
      console.error('V3 Socket.IO connection error:', error);
      setConnectionStatus(prev => ({ ...prev, v3: 'error' }));
    });

    // Listen for specific events from the server
    const eventHandlers = {
      'initial_state': (payload) => {
        console.log('Received initial_state from V3:', payload);
        setV3Data(prev => ({ ...prev, ...payload }));
        if (typeof payload.sebo_connection_status !== 'undefined') {
          setConnectionStatus(prev => ({ ...prev, sebo: payload.sebo_connection_status ? 'connected' : 'disconnected' }));
        }
      },
      'system_status': (payload) => setV3Data(prev => ({ ...prev, system_status: payload })),
      'trading_stats': (payload) => setV3Data(prev => ({ ...prev, trading_stats: payload })),
      'operation_result': (payload) => setV3Data(prev => ({ ...prev, operation_result: payload })),
      'top_20_data': (payload) => {
        // The server wraps it in a 'data' property
        setV3Data(prev => ({ ...prev, top20_data: payload.data }));
      },
      'log_message': (payload) => setV3Data(prev => ({ ...prev, log_message: payload })),
      'ai_model_details': (payload) => setV3Data(prev => ({ ...prev, ai_model_details: payload })),
      'ai_training_update': (payload) => setV3Data(prev => ({ ...prev, ai_training_update: payload })),
      'ai_test_results': (payload) => setV3Data(prev => ({ ...prev, ai_test_results: payload })),
      'ai_simulation_update': (payload) => setV3Data(prev => ({ ...prev, ai_simulation_update: payload })),
      'balance_update': (data) => {
        // The server wraps it in a 'payload' property
        setBalances(data.payload);
        setV3Data(prev => ({ ...prev, balance_update: data.payload }));
      },
      'trading_status_change': (payload) => {
          setV3Data(prev => ({ ...prev, trading_active: payload.trading_active, trading_stats: payload.trading_stats }));
      },
      'training_progress': (payload) => {
          setV3Data(prev => ({ ...prev, training_progress: payload }));
      },
      'training_complete': (payload) => {
          setV3Data(prev => ({ ...prev, training_complete: payload }));
      },
      'training_error': (payload) => {
          setV3Data(prev => ({ ...prev, training_error: payload }));
      }
    };

    Object.entries(eventHandlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      console.log('Cleaning up socket connection.');
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
      socket.disconnect();
      socketRef.current = null;
      window.v3SocketInstance = null;
    };
  }, []);

  const sendV3Command = (command, payload = {}) => {
    if (socketRef.current && socketRef.current.connected) {
      // The server expects a 'ui_message' event for generic commands
      socketRef.current.emit('ui_message', { type: command, payload });
    } else {
      console.error('V3 Socket.IO is not connected. Cannot send command:', command);
    }
  };

  return {
    connectionStatus,
    v3Data,
    balances,
    sendV3Command,
  };
};

export default useWebSocketController;
