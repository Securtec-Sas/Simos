// UI/clients/src/App.jsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout.jsx';
import ActiveExchangesTable from './components/ActiveExchangesTable/ActiveExchangesTable.jsx';
import SpotsMenu from './components/SpotsMenu/SpotsMenu.jsx';
import Top20DetailedPage from './components/Top20DetailedPage/Top20DetailedPage.jsx';
import TrainingPage from './components/TrainingPage/TrainingPage.jsx';
import ExchangeAPIsPage from './pages/exchangesApis/ExchangeAPIsPage.jsx';
import DataViewPage from './pages/DataViewPage/DataViewPage.jsx';
import AIDataPage from './pages/aiDataPage.jsx';
import ConfigDataPage from './pages/configDataPage/ConfigDataPage.jsx';
import useWebSocketController from './hooks/useWebSocketController.jsx';

function App() {
  const {
    connectionStatus,
    v3Data,
    balances,
    sendV3Command,
  } = useWebSocketController();

  const [allExchanges, setAllExchanges] = React.useState([]);
  const [selectedExchanges, setSelectedExchanges] = React.useState([]);

  React.useEffect(() => {
    fetch('/api/configured-exchanges')
      .then(res => res.json())
      .then(data => setAllExchanges(data))
      .catch(err => console.error('Error fetching exchanges:', err));
  }, []);

  React.useEffect(() => {
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
          <Route path="exchange-apis" element={<ExchangeAPIsPage />} />
          <Route path="top20" element={
            <Top20DetailedPage 
              sendV3Command={sendV3Command}
              v3Data={v3Data}
            />
          } />
          <Route path="datos" element={<DataViewPage />} />
          <Route path="ai-data" element={
            <AIDataPage
              v3Data={v3Data}
              sendV3Command={sendV3Command}
            />
          } />
          <Route path="entrenamiento" element={
            <TrainingPage
              v3Data={v3Data}
              sendV3Command={sendV3Command}
            />
          } />
          <Route path="config-data" element={<ConfigDataPage />} />
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
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

