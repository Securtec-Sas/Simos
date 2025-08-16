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
import ConfigPage from './pages/ConfigPage/ConfigPage.jsx';
import MainPage from './pages/MainPage/MainPage.jsx';
import useWebSocketController from './hooks/useWebSocketController.jsx';
import './App.css';

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
            v3Data={v3Data}
          />
        }>
          <Route path="conexion" element={<ActiveExchangesTable selectedExchanges={selectedExchanges}/>}   />
          <Route path="spots" element={<SpotsMenu />} />
          <Route path="exchange-apis" element={<ExchangeAPIsPage />} />
          <Route path="top20" element={
            <Top20DetailedPage 
              v3Data={v3Data}
              sendV3Command={sendV3Command}
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
          <Route path="config" element={<ConfigPage />} />
          <Route path="data-view" element={<DataViewPage />} />
          <Route path="training" element={
            <TrainingPage
              v3Data={v3Data}
              sendV3Command={sendV3Command}
            />
          } />
          <Route index element={<MainPage allExchanges={allExchanges} setAllExchanges={setAllExchanges} balances={balances} />} />
        </Route>
      </Routes>
    </Router>
  );

}

export default App;

