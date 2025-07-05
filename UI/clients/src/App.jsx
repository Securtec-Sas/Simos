import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout.jsx';
import ActiveExchangesTable from './components/ActiveExchangesTable/ActiveExchangesTable.jsx';
import SpotsMenu from './components/SpotsMenu/SpotsMenu.jsx';
import Top20DetailedPage from './components/Top20DetailedPage/Top20DetailedPage';
import ExchangeApis from './pages/exchangesApis/exhangeApis'
import DataViewPage from './pages/DataViewPage/DataViewPage'; // Import DataViewPage

function App() {
  const [allExchanges, setAllExchanges] = useState([]);
  const [selectedExchanges, setSelectedExchanges] = useState([]);
  const [v2Data, setV2Data] = useState(null); // State for V2 WebSocket data (generic)
  const [lastBalanceInfo, setLastBalanceInfo] = useState(null); // State for last balance
  const [top20Opportunities, setTop20Opportunities] = useState([]); // State for Top 20 data
  const [activeTrades, setActiveTrades] = useState({}); // { [trade_id]: { status, opportunity, ... } }
  const [v2Socket, setV2Socket] = useState(null); // State for the V2 WebSocket instance

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
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to V2 WebSocket server');
      setV2Socket(ws); // Store the WebSocket instance
      // Example: ws.send(JSON.stringify({ type: 'ui_hello', payload: 'Client connected' }));
    };

    ws.onmessage = (event) => { // Changed from socket to ws
      try {
        const message = JSON.parse(event.data);
        console.log('Message from V2:', message);
        if (message.type === 'arbitrage_update') { // Keep if still used
          setV2Data(message.payload);
        } else if (message.type === 'full_balance_update_from_v2') {
          setLastBalanceInfo(message.payload);
          // console.log('Balance info updated:', message.payload);
        } else if (message.type === 'top_20_update') {
          setTop20Opportunities(message.payload || []); // Ensure it's an array
          // console.log('Top 20 opportunities updated:', message.payload);
        } else if (message.type === 'real_trading_update') {
          // console.log('Real trading update received:', message.payload);
          const { trade_id, status, opportunity, results, error, message: tradeMessage } = message.payload;
          if (trade_id) {
            setActiveTrades(prevTrades => ({
              ...prevTrades,
              [trade_id]: {
                ...prevTrades[trade_id], // Preserve previous data if any
                status,
                opportunity: opportunity || (prevTrades[trade_id] ? prevTrades[trade_id].opportunity : null), // Preserve opportunity if not in update
                results,
                error,
                tradeMessage,
                lastUpdate: new Date().toISOString()
              }
            }));
          }
        }
      } catch (error) {
        console.error('Error parsing message from V2 or unexpected format:', error);
      }
    };

    ws.onerror = (error) => { // Changed from socket to ws
      console.error('V2 WebSocket error:', error);
      setV2Socket(null); // Clear socket on error
    };

    ws.onclose = (event) => { // Changed from socket to ws
      console.log('Disconnected from V2 WebSocket server:', event.reason, `Code: ${event.code}`);
      setV2Socket(null); // Clear socket on close
    };

    // Cleanup function to close the WebSocket when the component unmounts
    return () => {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) { // Changed from socket to ws
        ws.close();
      }
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  const sendV2Message = (messageObject) => {
    if (v2Socket && v2Socket.readyState === WebSocket.OPEN) {
      v2Socket.send(JSON.stringify(messageObject));
      return true;
    } else {
      console.error("Cannot send message: V2 WebSocket is not connected.");
      alert("Cannot send command: Not connected to V2 server. Please check connection.");
      return false;
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <Layout
            allExchanges={allExchanges}
            setAllExchanges={setAllExchanges}
            lastBalanceInfo={lastBalanceInfo} // Pass lastBalanceInfo here
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
          <Route
            path="/top20-detailed"
            element={<Top20DetailedPage
                        opportunities={top20Opportunities}
                        activeTrades={activeTrades}
                        sendV2Message={sendV2Message}
                      />}
          />
          <Route path="/data-view" element={<DataViewPage />} /> {/* DataViewPage manages its own socket for now, or could also use sendV2Message */}
          <Route path="/exchanges/apis" element={<ExchangeApis />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
