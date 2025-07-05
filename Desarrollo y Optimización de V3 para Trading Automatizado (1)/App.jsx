import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout.jsx';
import ActiveExchangesTable from './components/ActiveExchangesTable/ActiveExchangesTable.jsx';
import SpotsMenu from './components/SpotsMenu/SpotsMenu.jsx';
import Top20DetailedPage from './components/Top20DetailedPage/Top20DetailedPage'; // Import new page

function App() {
  const [allExchanges, setAllExchanges] = useState([]);
  const [selectedExchanges, setSelectedExchanges] = useState([]);
  const [v2Data, setV2Data] = useState(null); // State for V2 WebSocket data

  useEffect(() => {
    fetch('/api/configured-exchanges')
      .then(res => res.json())
      .then(data => setAllExchanges(data));
  }, []);

  useEffect(() => {
    setSelectedExchanges(allExchanges.filter(ex => ex.isActive));
  }, [allExchanges]);

  // useEffect for V2 WebSocket connection
  useEffect(() => {
    // V2's WebSocket server (Python `websockets` based) should run on 3001
    const wsUrl = 'ws://localhost:3001'; // NUEVO VALOR para el WS de V2
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Connected to V2 WebSocket server');
      // Example: socket.send(JSON.stringify({ type: 'ui_hello', payload: 'Client connected' }));
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Message from V2:', message);
        // Expecting data in the format: {"type": "arbitrage_update", "payload": processed_data}
        if (message.type === 'arbitrage_update') {
          setV2Data(message.payload);
        }
      } catch (error) {
        console.error('Error parsing message from V2 or unexpected format:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('V2 WebSocket error:', error);
    };

    socket.onclose = (event) => {
      console.log('Disconnected from V2 WebSocket server:', event.reason, `Code: ${event.code}`);
    };

    // Cleanup function to close the WebSocket when the component unmounts
    return () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <Layout
            allExchanges={allExchanges}
            setAllExchanges={setAllExchanges}
          />
        }>
          <Route path="conexion" element={<ActiveExchangesTable selectedExchanges={selectedExchanges} />} />
          <Route path="spots" element={<SpotsMenu />} />
          <Route index element={
            <div>
              <div>Bienvenido al Dashboard</div>
              <hr />
              <h2>Data from V2:</h2>
              {v2Data ? (
                <pre style={{ textAlign: 'left', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>
                  {JSON.stringify(v2Data, null, 2)}
                </pre>
              ) : (
                <p>No data received from V2 yet...</p>
              )}
            </div>
          } />
          <Route path="/top20-detailed" element={<Top20DetailedPage />} /> {/* Add new route */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
