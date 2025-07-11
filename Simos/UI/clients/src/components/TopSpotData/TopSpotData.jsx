import React, { useState, useEffect, useRef } from 'react';

const TopSpotData = () => {
  const [data, setData] = useState([]); // Initialize with an empty array for list data
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const socketRef = useRef(null);

  // Esta URL debe coincidir con la UI_WEBSOCKET_URL de tu configuración de Python
  // y el servidor WebSocket que has implementado.
  const WEBSOCKET_URL = "ws://localhost:8000/api/spot/ui";

  useEffect(() => {
    setConnectionStatus('Connecting...');
    socketRef.current = new WebSocket(WEBSOCKET_URL);

    socketRef.current.onopen = () => {
      console.log('TopSpotData: WebSocket connected to UI server');
      setConnectionStatus('Connected');
    };

    socketRef.current.onmessage = (event) => {
      try {
        const receivedData = JSON.parse(event.data);
        console.log('TopSpotData: Message received from Python UI WebSocket:', receivedData);

        // Assuming Python sends messages with a 'type' and 'payload'
        if (receivedData.type === 'arbitrage_data') {
          setData(receivedData.payload); // Payload is expected to be the array of opportunities
        } else if (receivedData.type === 'arbitrage_opportunity_analysis' || receivedData.type === 'arbitrage_executed' || receivedData.type === 'arbitrage_error' || receivedData.type === 'arbitrage_skipped_net_loss') {
          // Handle other types of messages, e.g., update status or log
          // For now, just log them or prepend to a log array
          console.log('TopSpotData: Status/Event update:', receivedData);
        }
      } catch (error) {
        console.error('TopSpotData: Error parsing WebSocket message:', error);
        // Optionally, display an error message in the UI
      }
    };

    socketRef.current.onerror = (error) => {
      console.error('TopSpotData: WebSocket Error:', error);
      setConnectionStatus('Error connecting');
      setData({ error: 'WebSocket connection error. Is the Python UI WebSocket server running on port 8000?' });
      // Consider implementing a retry mechanism here
    };

    socketRef.current.onclose = (event) => {
      console.log('TopSpotData: WebSocket disconnected from UI server:', event.reason);
      setConnectionStatus(`Closed: ${event.reason || (event.wasClean ? 'Normal closure' : 'Connection died')}`);
    };

    // Limpieza al desmontar el componente
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []); // El array vacío asegura que el efecto se ejecute solo al montar y desmontar

  return (
    <div className="top-spot-data-container" style={{ marginTop: '10px', padding: '10px', border: '1px solid #ccc' }}>
      <h4>Live Top Spot Data</h4>
      <p><strong>Status:</strong> {connectionStatus}</p>
      <div style={{ maxHeight: '300px', overflowY: 'auto', background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
        {Array.isArray(data) && data.length > 0 ? (
          <pre>{JSON.stringify(data, null, 2)}</pre>
        ) : typeof data === 'object' && data !== null && data.error ? (
          <pre>{JSON.stringify(data, null, 2)}</pre>
        ) : (
          'Waiting for data or no opportunities found...'
        )}
      </div>
    </div>
  );
};

export default TopSpotData;