import React, { useEffect, useState } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import DataAI from '../../components/AIDataPage/DataAI';
import Training from '../../components/AIDataPage/Training'
import Test from '../../components/AIDataPage/Test'
import Simulation from '../../components/AIDataPage/Simulation'
import useWebSocketController from '../../hooks/useWebSocketController.jsx';

const ConfigDataPage = () => {
  const { sendV3Command, v3Data } = useWebSocketController();

  const [tabIndex, setTabIndex] = useState(0);
  const [aiModelDetails, setAiModelDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState({ status: "IDLE", data: {} });
  const [simulationDuration, setSimulationDuration] = useState(30); // en minutos
  const [dataUpdateRequested, setDataUpdateRequested] = useState(false);

  // Estilos básicos (copiados de AIDataPage)
  const buttonStyle = { padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px', fontSize: '14px', minWidth: '150px' };
  const inputStyle = { marginRight: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '80px' };
  const controlGroupStyle = { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' };
  const preStyle = { backgroundColor: '#eee', padding: '10px', borderRadius: '4px', overflowX: 'auto', maxHeight: '300px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' };
  const statusBoxStyle = (status) => ({
    padding: '10px',
    marginTop: '10px',
    border: `1px solid ${status === 'COMPLETED' || status === 'IDLE' ? 'green' : status === 'FAILED' || status === 'ERROR_SIMULACION' ? 'red' : 'orange'}`,
    backgroundColor: `${status === 'COMPLETED' || status === 'IDLE' ? '#e6ffed' : status === 'FAILED' || status === 'ERROR_SIMULACION' ? '#ffe6e6' : '#fff3e0'}`,
    borderRadius: '4px'
  });
  const chartPlaceholderStyle = {
    width: '100%',
    height: '200px',
    backgroundColor: '#e0e0e0',
    border: '1px solid #ccc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: '#666',
    fontSize: '16px',
    marginTop: '15px',
    borderRadius: '4px',
  };

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  const handleRequest = (command, payload = {}) => {
    if (sendV3Command) {
      sendV3Command(command, payload);
      if (command === 'get_ai_model_details') setIsLoading(true);
      // Resetear estados visuales para nuevas acciones
      if (command === 'start_ai_simulation') {
        setSimulationStatus({ status: "REQUESTED", data: {} });
      }
    } else {
      console.error("No se pudo enviar el comando a V3.");
      alert("Error: No se puede enviar el comando a V3.");
    }
  };

  const handleUpdateDataAI = () => {
    setDataUpdateRequested(true);
    fetchDataAI();
  };

  const fetchDataAI = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v3/data-ai');
      const result = await response.json();
      
      if (result.status === 'success') {
        setAiModelDetails(result.data);
      } else {
        console.error('Error obteniendo datos AI:', result.message);
      }
    } catch (error) {
      console.error('Error en fetchDataAI:', error);
    } finally {
      setIsLoading(false);
      setDataUpdateRequested(false);
    }
  };

  // Cargar datos AI solo una vez al montar el componente
  useEffect(() => {
    fetchDataAI();
  }, []);

  // Actualizar el estado cuando se reciben datos desde V3
  useEffect(() => {
    if (v3Data && v3Data.ai_model_details) {
      setAiModelDetails(v3Data.ai_model_details);
      setIsLoading(false);
    }
    // Actualizar otros estados según los datos recibidos
    if (v3Data && v3Data.ai_simulation_update) {
      setSimulationStatus(v3Data.ai_simulation_update);
    }
  }, [v3Data]);

  return (
    <Box sx={{ width: '100%' }}>
      <Tabs value={tabIndex} onChange={handleTabChange} aria-label="Pestañas de Configuración de Datos">
        <Tab label="Datos AI" />
        <Tab label="Entrenamiento" />
        <Tab label="Prueba" />
        <Tab label="Simulación" />
      </Tabs>
      {tabIndex === 0 && (
        <Box sx={{ p: 3 }}>
          <h2>Detalles del Modelo AI</h2>
          <div style={controlGroupStyle}>
            <button 
              style={buttonStyle} 
              onClick={handleUpdateDataAI}
              disabled={isLoading || dataUpdateRequested}
            >
              {isLoading || dataUpdateRequested ? 'Actualizando...' : 'Actualizar Datos'}
            </button>
          </div>
          {isLoading ? (
            <p>Cargando detalles del modelo AI...</p>
          ) : aiModelDetails ? (
            <div>
              <div style={chartPlaceholderStyle}>
                <div>
                  <h3>Visualización de Datos del Modelo</h3>
                  <p>Estado: {aiModelDetails.is_trained ? 'Entrenado' : 'No entrenado'}</p>
                  <p>Características: {aiModelDetails.feature_count || 0}</p>
                  <p>Última actualización: {aiModelDetails.last_updated || 'N/A'}</p>
                  <p>Umbral de confianza: {aiModelDetails.confidence_threshold || 'N/A'}</p>
                </div>
              </div>
              <details style={{ marginTop: '20px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                  Ver detalles completos del modelo
                </summary>
                <pre style={preStyle}>
                  {JSON.stringify(aiModelDetails, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <p>No hay detalles disponibles del modelo AI.</p>
          )}
          <DataAI aiModelDetails={aiModelDetails} isLoading={isLoading} handleRequest={handleRequest} />
        </Box>
      )}
      {tabIndex === 1 && (
        <Box sx={{ p: 3 }}>
          <Training 
            sendV3Command={sendV3Command}
            v3Data={v3Data}
            buttonStyle={buttonStyle}
            inputStyle={inputStyle}
            controlGroupStyle={controlGroupStyle}
            preStyle={preStyle}
            statusBoxStyle={statusBoxStyle}
            chartPlaceholderStyle={chartPlaceholderStyle}
          />
        </Box>
      )}
      {tabIndex === 2 && (
        <Box sx={{ p: 3 }}>
          <Test
            sendV3Command={sendV3Command}
            v3Data={v3Data}
            buttonStyle={buttonStyle}
            inputStyle={inputStyle}
            controlGroupStyle={controlGroupStyle}
            preStyle={preStyle}
            statusBoxStyle={statusBoxStyle}
          />
        </Box>
      )}
      {tabIndex === 3 && (
        <Box sx={{ p: 3 }}>
          <Simulation
            simulationDuration={simulationDuration}
            setSimulationDuration={setSimulationDuration}
            handleRequest={handleRequest}
            simulationStatus={simulationStatus}
            buttonStyle={buttonStyle}
            inputStyle={inputStyle}
            controlGroupStyle={controlGroupStyle}
            preStyle={preStyle}
            statusBoxStyle={statusBoxStyle}
            chartPlaceholderStyle={chartPlaceholderStyle}
            aiModelDetails={aiModelDetails}
          />
        </Box>
      )}
    </Box>
  );
};

export default ConfigDataPage;
