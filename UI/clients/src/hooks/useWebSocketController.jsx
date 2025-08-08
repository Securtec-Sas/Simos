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
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const connectV3 = () => {
      try {
        const wsUrl = 'ws://localhost:3001';
        const socket = new WebSocket(wsUrl);
        v3SocketRef.current = socket;
        window.v3SocketInstance = socket;

        socket.onopen = () => {
          console.log('Connected to V3 WebSocket server');
          setConnectionStatus(prev => ({ ...prev, v3: 'connected' }));
          v3ReconnectAttemptsRef.current = 0;
          socket.send(JSON.stringify({ type: 'get_system_status' }));
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('Message from V3:', message);

            switch (message.type) {
              case 'initial_state':
                console.log('Received initial_state from V3:', message.payload);
                setV3Data(prev => ({
                  ...prev,
                  ...message.payload,
                }));
                if (typeof message.payload.sebo_connection_status !== 'undefined') {
                  setConnectionStatus(prev => ({ ...prev, sebo: message.payload.sebo_connection_status ? 'connected' : 'disconnected' }));
                }
                break;
              case 'system_status':
              case 'trading_stats':
              case 'operation_result':
              case 'top20_data':
              case 'log_message':
              case 'ai_model_details':
<<<<<<< HEAD
                // Only set ai_model_details once when first received
                setV3Data(prev => {
                  // If ai_model_details already exists, don't update it
                  if (prev && prev.ai_model_details) {
                    return prev;
                  }
                  // Otherwise, set it with the new payload
                  return { ...prev, [message.type]: message.payload };
                });
=======
                setV3Data(prev => ({ ...prev, [message.type]: message.payload }));
>>>>>>> parent of 5b78e8f (prueba)
                break;
              case 'ai_training_update':
              case 'ai_test_results':
              case 'ai_simulation_update':
                setV3Data(prev => ({ ...prev, [message.type]: message.payload }));
                break;
              case 'balance_update':
                setBalances(message.payload);
                setV3Data(prev => ({ ...prev, balance_update: message.payload }));
                break;
              default:
                console.log('Unknown V3 message type:', message.type);
            }
          } catch (error) {
            console.error('Error parsing V3 message:', error);
          }
        };

        socket.onerror = (error) => {
          console.error('V3 WebSocket error:', error);
          setConnectionStatus(prev => ({ ...prev, v3: 'error' }));
        };

        socket.onclose = (event) => {
          console.log('V3 WebSocket disconnected:', event.reason, `Code: ${event.code}`);
          setConnectionStatus(prev => ({ ...prev, v3: 'disconnected' }));
          window.v3SocketInstance = null;

          if (event.code !== 1000 && v3ReconnectAttemptsRef.current < maxReconnectAttempts) {
            v3ReconnectAttemptsRef.current++;
            console.log(`Attempting to reconnect to V3 (\${v3ReconnectAttemptsRef.current}/\${maxReconnectAttempts})...`);
            v3ReconnectTimeoutRef.current = setTimeout(connectV3, 3000 * v3ReconnectAttemptsRef.current);
          }
        };
      } catch (error) {
        console.error('Error creating V3 WebSocket:', error);
        setConnectionStatus(prev => ({ ...prev, v3: 'error' }));
      }
    };

    connectV3();

    return () => {
      if (v3ReconnectTimeoutRef.current) {
        clearTimeout(v3ReconnectTimeoutRef.current);
      }
      if (v3SocketRef.current && (v3SocketRef.current.readyState === WebSocket.OPEN || v3SocketRef.current.readyState === WebSocket.CONNECTING)) {
        v3SocketRef.current.close(1000, 'Component unmounting');
      }
      window.v3SocketInstance = null;
    };
  }, []);

  const sendV3Command = (command, payload = {}) => {
    if (v3SocketRef.current && v3SocketRef.current.readyState === WebSocket.OPEN) {
      v3SocketRef.current.send(JSON.stringify({ type: command, payload }));
    } else {
      console.error('V3 WebSocket is not connected or ready. Cannot send command:', command);
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
