// UI/clients/src/App.jsx - VERSIÓN CORREGIDA

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout.jsx';
import ActiveExchangesTable from './components/ActiveExchangesTable/ActiveExchangesTable.jsx';
import SpotsMenu from './components/SpotsMenu/SpotsMenu.jsx';
<<<<<<< HEAD
import Top20DetailedPage from './components/Top20DetailedPage/Top20DetailedPage';
import ExchangeApis from './pages/exchangesApis/ExchangeAPIsPage.jsx';
import DataViewPage from './pages/DataViewPage/DataViewPage.jsx'; // Asegúrate que la importación esté presente
import AIDataPage from './pages/AIDataPage/AIDataPage.jsx'; // Importar la nueva página
=======
import Top20DetailedPage from './components/Top20DetailedPage/Top20DetailedPage'; // Import new page
import Datos from '../Datos.jsx'; // Importar Datos.jsx desde la raíz de UI/clients
>>>>>>> jules/multi-fixes-optimizations

function App() {
  const [allExchanges, setAllExchanges] = useState([]);
  const [selectedExchanges, setSelectedExchanges] = useState([]);
  const [v2Data, setV2Data] = useState(null);
  const [v3Data, setV3Data] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    v2: 'disconnected',
    v3: 'disconnected',
    sebo: 'disconnected'
  });

  useEffect(() => {
    fetch('/api/configured-exchanges')
      .then(res => res.json())
      .then(data => setAllExchanges(data))
      .catch(err => console.error('Error fetching exchanges:', err));
  }, []);

  useEffect(() => {
    setSelectedExchanges(allExchanges.filter(ex => ex.isActive));
  }, [allExchanges]);

  // V2 WebSocket connection con manejo de errores mejorado
  useEffect(() => {
    let v2Socket = null;
    let reconnectTimeout = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectV2 = () => {
      try {
        const wsUrl = 'ws://localhost:3001';
        v2Socket = new WebSocket(wsUrl);

        v2Socket.onopen = () => {
          console.log('Connected to V2 WebSocket server');
          setConnectionStatus(prev => ({ ...prev, v2: 'connected' }));
          reconnectAttempts = 0;
        };

        v2Socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('Message from V2:', message);
            if (message.type === 'arbitrage_update') {
              setV2Data(message.payload);
            }
          } catch (error) {
            console.error('Error parsing V2 message:', error);
          }
        };

        v2Socket.onerror = (error) => {
          console.error('V2 WebSocket error:', error);
          setConnectionStatus(prev => ({ ...prev, v2: 'error' }));
        };

        v2Socket.onclose = (event) => {
          console.log('V2 WebSocket disconnected:', event.reason, `Code: ${event.code}`);
          setConnectionStatus(prev => ({ ...prev, v2: 'disconnected' }));
          
          // Intentar reconectar si no fue un cierre intencional
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect to V2 (${reconnectAttempts}/${maxReconnectAttempts})...`);
            reconnectTimeout = setTimeout(connectV2, 3000 * reconnectAttempts);
          }
        };
      } catch (error) {
        console.error('Error creating V2 WebSocket:', error);
        setConnectionStatus(prev => ({ ...prev, v2: 'error' }));
      }
    };

    connectV2();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (v2Socket && (v2Socket.readyState === WebSocket.OPEN || v2Socket.readyState === WebSocket.CONNECTING)) {
        v2Socket.close(1000, 'Component unmounting');
      }
    };
  }, []);

  // Función para enviar comandos a V3
  const sendV3Command = (command, payload = {}) => {
    // Esta función será pasada a los componentes que necesiten comunicarse con V3
    // Reutiliza la conexión v3Socket establecida en el useEffect
    if (window.v3SocketInstance && window.v3SocketInstance.readyState === WebSocket.OPEN) {
      window.v3SocketInstance.send(JSON.stringify({ type: command, payload }));
    } else {
      console.error('V3 WebSocket no está conectado o no está listo. No se pudo enviar el comando:', command);
      // Podrías intentar reconectar o encolar el mensaje si es necesario
      // alert('Error: V3 WebSocket no está conectado.');
    }
  };

  // V3 WebSocket connection
  useEffect(() => {
    let v3Socket = null; // Mantener v3Socket local al efecto para la gestión de la conexión
    let reconnectTimeout = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectV3 = () => {
      try {
        const wsUrl = 'ws://localhost:3001'; // Puerto para V3 CAMBIADO A 3001
        const currentSocket = new WebSocket(wsUrl);
        window.v3SocketInstance = currentSocket; // Asignar a una variable global/accesible

        currentSocket.onopen = () => {
          console.log('Connected to V3 WebSocket server');
          setConnectionStatus(prev => ({ ...prev, v3: 'connected' }));
          reconnectAttempts = 0;

          // Solicitar estado inicial
          currentSocket.send(JSON.stringify({ type: 'get_system_status' }));
        };

        currentSocket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('Message from V3:', message);

            switch (message.type) {
              case 'initial_state': // Manejar el estado inicial completo
                console.log('Received initial_state from V3:', message.payload);
                setV3Data(prev => ({
                  ...prev,
                  ...message.payload, // Fusiona todo el payload del estado inicial
                  // Asegurar que las claves específicas como top20_data y balance_update se manejen bien
                  // si el payload de initial_state las tiene directamente con esos nombres.
                  // El backend V3 fue diseñado para usar estas claves en el payload de initial_state.
                }));
                // Actualizar también el estado de conexión de Sebo si viene en el initial_state
                if (typeof message.payload.sebo_connection_status !== 'undefined') {
                    setConnectionStatus(prev => ({ ...prev, sebo: message.payload.sebo_connection_status ? 'connected' : 'disconnected' }));
                }
                break;
              case 'system_status':
              case 'trading_stats':
              case 'operation_result':
              // 'balance_update' y 'top20_data' se manejarán individualmente para asegurar el reemplazo
              // y también se incluyen en 'initial_state'.
              // case 'balance_update':
              // case 'top20_data':
              //   setV3Data(prev => ({ ...prev, [message.type]: message.payload }));
              //   break;
              case 'balance_update':
                setV3Data(prev => ({ ...prev, balance_update: message.payload }));
                break;
              case 'top20_data':
                setV3Data(prev => ({ ...prev, top20_data: message.payload }));
                break;
              case 'log_message':
                console.log(`V3 Log: [${message.payload.level}] ${message.payload.message}`);
                // Podrías tener un estado para mostrar logs en la UI si es necesario
                break;
              // Nuevos tipos de mensajes para IA
              case 'ai_model_details':
                setV3Data(prev => ({ ...prev, ai_model_details: message.payload }));
                break;
              case 'ai_training_update':
                setV3Data(prev => ({ ...prev, ai_training_update: message.payload }));
                break;
              case 'ai_test_results':
                setV3Data(prev => ({ ...prev, ai_test_results: message.payload }));
                break;
              case 'ai_simulation_update':
                setV3Data(prev => ({ ...prev, ai_simulation_update: message.payload }));
                break;
              default:
                console.log('Unknown V3 message type:', message.type);
            }
          } catch (error) {
            console.error('Error parsing V3 message:', error);
          }
        };

        currentSocket.onerror = (error) => {
          console.error('V3 WebSocket error:', error);
          setConnectionStatus(prev => ({ ...prev, v3: 'error' }));
        };

        currentSocket.onclose = (event) => {
          console.log('V3 WebSocket disconnected:', event.reason, `Code: ${event.code}`);
          setConnectionStatus(prev => ({ ...prev, v3: 'disconnected' }));
          window.v3SocketInstance = null; // Limpiar la referencia global

          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect to V3 (${reconnectAttempts}/${maxReconnectAttempts})...`);
            reconnectTimeout = setTimeout(connectV3, 3000 * reconnectAttempts);
          }
        };
        // Asignar currentSocket a v3Socket para la lógica de limpieza al desmontar
        v3Socket = currentSocket;
      } catch (error) {
        console.error('Error creating V3 WebSocket:', error);
        setConnectionStatus(prev => ({ ...prev, v3: 'error' }));
      }
    };

    connectV3();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (v3Socket && (v3Socket.readyState === WebSocket.OPEN || v3Socket.readyState === WebSocket.CONNECTING)) {
        v3Socket.close(1000, 'Component unmounting');
      }
      window.v3SocketInstance = null; // Asegurar limpieza al desmontar
    };
  }, []);


  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <Layout
            allExchanges={allExchanges}
            setAllExchanges={setAllExchanges}
            connectionStatus={connectionStatus}
          />
        }>
          <Route path="conexion" element={<ActiveExchangesTable selectedExchanges={selectedExchanges} />} />
          <Route path="spots" element={<SpotsMenu />} />
          <Route path="exchange-apis" element={<ExchangeApis />} />
          <Route path="top20-detailed" element={
            <Top20DetailedPage 
              sendV3Command={sendV3Command}
              v3Data={v3Data}
            />
          } />
          <Route path="data-view" element={<DataViewPage />} />
          <Route path="ai-data" element={
            <AIDataPage
              v3Data={v3Data}
              sendV3Command={sendV3Command}
            />
          } />
          <Route index element={
            <div style={{ padding: '20px' }}>
              <div>
                <h1>Bienvenido al Dashboard de Arbitraje</h1>
                <div style={{ marginBottom: '20px' }}>
                  <h3>Estado de Conexiones:</h3>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ 
                      padding: '10px', 
                      borderRadius: '5px', 
                      backgroundColor: connectionStatus.v2 === 'connected' ? '#d4edda' : '#f8d7da',
                      color: connectionStatus.v2 === 'connected' ? '#155724' : '#721c24'
                    }}>
                      V2: {connectionStatus.v2}
                    </div>
                    <div style={{ 
                      padding: '10px', 
                      borderRadius: '5px', 
                      backgroundColor: connectionStatus.v3 === 'connected' ? '#d4edda' : '#f8d7da',
                      color: connectionStatus.v3 === 'connected' ? '#155724' : '#721c24'
                    }}>
                      V3: {connectionStatus.v3}
                    </div>
                  </div>
                </div>
              </div>
              <hr />
              
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                  <h2>Datos de V2:</h2>
                  {v2Data ? (
                    <pre style={{ 
                      textAlign: 'left', 
                      backgroundColor: '#f5f5f5', 
                      padding: '10px', 
                      borderRadius: '4px', 
                      overflowX: 'auto',
                      maxHeight: '300px',
                      overflow: 'auto'
                    }}>
                      {JSON.stringify(v2Data, null, 2)}
                    </pre>
                  ) : (
                    <p>No hay datos de V2 disponibles...</p>
                  )}
                </div>
                
                <div style={{ flex: 1 }}>
                  <h2>Datos de V3:</h2>
                  {v3Data ? (
                    <pre style={{ 
                      textAlign: 'left', 
                      backgroundColor: '#e8f4fd', 
                      padding: '10px', 
                      borderRadius: '4px', 
                      overflowX: 'auto',
                      maxHeight: '300px',
                      overflow: 'auto'
                    }}>
                      {JSON.stringify(v3Data, null, 2)}
                    </pre>
                  ) : (
                    <p>No hay datos de V3 disponibles...</p>
                  )}
                </div>
              </div>
            </div>
          } />
<<<<<<< HEAD
=======
          <Route path="/top20-detailed" element={<Top20DetailedPage />} /> {/* Mantener por si Sidebar aún se usa o por enlaces directos */}
          <Route path="/top20" element={<Top20DetailedPage />} /> {/* Nueva ruta para Navigation.jsx */}
          <Route path="/datos" element={<Datos />} /> {/* Nueva ruta para Navigation.jsx */}
>>>>>>> jules/multi-fixes-optimizations
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

