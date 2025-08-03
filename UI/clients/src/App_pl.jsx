import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout.jsx';
import ActiveExchangesTable from './components/ActiveExchangesTable/ActiveExchangesTable.jsx';
import SpotsMenu from './components/SpotsMenu/SpotsMenu.jsx';
import Top20DetailedPage from './components/Top20DetailedPage/Top20DetailedPage';
import ExchangeApis from './pages/exchangesApis/exhangeApis'
import DataViewPage from './pages/DataViewPage/DataViewPage'; // Import DataViewPage
import useWebSocketController from './hooks/useWebSocketController.jsx';

function App() {
  const {
    connectionStatus,
    v3Data,
    balances,
    sendV3Command,
  } = useWebSocketController();

  const [allExchanges, setAllExchanges] = useState([]);
  const [selectedExchanges, setSelectedExchanges] = useState([]);

  useEffect(() => {
    fetch('/api/configured-exchanges')
      .then(res => res.json())
      .then(data => setAllExchanges(data));
  }, []);

  useEffect(() => {
    setSelectedExchanges(allExchanges.filter(ex => ex.isActive));
  }, [allExchanges]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <Layout
            allExchanges={allExchanges}
            setAllExchanges={setAllExchanges}
            connectionStatus={connectionStatus}
            balances={balances}
          />
        }>
          <Route path="conexion" element={<ActiveExchangesTable selectedExchanges={selectedExchanges} />} />
          <Route path="spots" element={<SpotsMenu />} />
          <Route index element={
            <div>
              <div>Bienvenido al Dashboard</div>
              <hr />
              <h2>Datos de V3:</h2>
              {v3Data ? (
                <pre style={{ textAlign: 'left', backgroundColor: '#e8f4fd', padding: '10px', borderRadius: '4px', overflowX: 'auto' }}>
                  {JSON.stringify(v3Data, null, 2)}
                </pre>
              ) : (
                <p>No hay datos de V3 disponibles...</p>
              )}
            </div>
          } />
          <Route
            path="/top20-detailed"
            element={<Top20DetailedPage
                        sendV3Command={sendV3Command}
                        v3Data={v3Data}
                      />}
          />
          <Route path="/data-view" element={<DataViewPage />} />
          <Route path="/exchanges/apis" element={<ExchangeApis />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
