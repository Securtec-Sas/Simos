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
  const [trainingStatus, setTrainingStatus] = useState({ status: "IDLE", progress: 0, details: {} });
  const [testResults, setTestResults] = useState(null);
  const [simulationStatus, setSimulationStatus] = useState({ status: "IDLE", data: {} });
  const [testFile, setTestFile] = useState(null);
  const [testFileError, setTestFileError] = useState('');
  const [simulationDuration, setSimulationDuration] = useState(30); // en minutos

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
      if (command === 'train_ai_model') {
        setTrainingStatus({ status: "REQUESTED", progress: 0, details: {} });
        setTestResults(null); // Limpiar resultados de test anteriores
      }
      if (command === 'test_ai_model') {
        setTestResults(null); // Limpiar para mostrar nuevos resultados
      }
      if (command === 'start_ai_simulation') {
        setSimulationStatus({ status: "REQUESTED", data: {} });
      }
    } else {
      console.error("No se pudo enviar el comando a V3.");
      alert("Error: No se puede enviar el comando a V3.");
    }
  };

  const handleTestFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        setTestFile(file);
        setTestFileError('');
      } else {
        setTestFile(null);
        setTestFileError('Por favor, selecciona un archivo CSV válido para probar.');
        alert('Por favor, selecciona un archivo CSV válido para probar.');
      }
    }
  };

  // Enviar el comando para obtener detalles del modelo AI al cargar la página
  useEffect(() => {
    handleRequest('get_ai_model_details');
  }, []);

  // Actualizar el estado cuando se reciben los detalles del modelo AI desde V3
  useEffect(() => {
    if (v3Data && v3Data.ai_model_details) {
      setAiModelDetails(v3Data.ai_model_details);
      setIsLoading(false);
    }
    // Actualizar otros estados según los datos recibidos
    if (v3Data && v3Data.ai_training_update) {
      setTrainingStatus(v3Data.ai_training_update);
    }
    if (v3Data && v3Data.ai_test_results) {
      setTestResults(v3Data.ai_test_results);
    }
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
          {isLoading ? (
            <p>Cargando detalles del modelo AI...</p>
          ) : aiModelDetails ? (
            <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {JSON.stringify(aiModelDetails, null, 2)}
            </pre>
          ) : (
            <p>No hay detalles disponibles del modelo AI.</p>
          )}
          <DataAI aiModelDetails={aiModelDetails} isLoading={isLoading} handleRequest={handleRequest} />
        </Box>
      )}
      {tabIndex === 1 && (
        <Box sx={{ p: 3 }}>
          <Training 
            handleRequest={handleRequest}
            trainingStatus={trainingStatus}
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
      {tabIndex === 2 && (
        <Box sx={{ p: 3 }}>
          <Test
            testFile={testFile}
            testFileError={testFileError}
            handleTestFileChange={handleTestFileChange}
            handleRequest={handleRequest}
            aiModelDetails={aiModelDetails}
            testResults={testResults}
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
