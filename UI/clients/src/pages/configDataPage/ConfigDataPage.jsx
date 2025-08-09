import React, { useEffect, useState, useRef } from 'react';
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
  
  // Ref para controlar si ya se cargaron los datos iniciales
  const initialDataLoaded = useRef(false);
  const lastDataUpdate = useRef(null);

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
      if (command === 'get_ai_model_details') {
        setIsLoading(true);
        setDataUpdateRequested(true);
      }
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
    // Solo permitir actualización manual si han pasado al menos 5 segundos desde la última actualización
    const now = Date.now();
    if (lastDataUpdate.current && (now - lastDataUpdate.current) < 5000) {
      console.log("Esperando antes de la próxima actualización...");
      return;
    }
    
    lastDataUpdate.current = now;
    handleRequest('get_ai_model_details');
  };

  // Eliminado: No cargar datos automáticamente al montar el componente
  // Los datos solo se cargarán cuando el usuario haga clic en "Actualizar Datos"

  // Ref para evitar procesamiento duplicado de mensajes
  const lastProcessedMessage = useRef(null);

  // Actualizar el estado cuando se reciben datos desde V3
  useEffect(() => {
    if (!v3Data) return;

    // Crear un identificador único para el mensaje
    const messageId = v3Data.type ?
      `${v3Data.type}_${JSON.stringify(v3Data.payload)}` :
      `legacy_${JSON.stringify(v3Data)}`;

    // Evitar procesar el mismo mensaje múltiples veces
    if (lastProcessedMessage.current === messageId) {
      return;
    }
    lastProcessedMessage.current = messageId;

    // Procesar datos del modelo AI
    if (v3Data.type === 'ai_model_details' && v3Data.payload) {
      console.log("Recibidos nuevos datos del modelo AI:", v3Data.payload);
      setAiModelDetails(prevDetails => {
        // Solo actualizar si los datos son diferentes o si no hay datos previos
        if (!prevDetails || JSON.stringify(prevDetails) !== JSON.stringify(v3Data.payload)) {
          return v3Data.payload;
        }
        return prevDetails;
      });
      setIsLoading(false);
      setDataUpdateRequested(false);
    }
    
    // Procesar actualizaciones de simulación
    else if (v3Data.type === 'ai_simulation_update' && v3Data.payload) {
      console.log("Recibida actualización de simulación:", v3Data.payload);
      setSimulationStatus(prevStatus => {
        // Solo actualizar si el estado ha cambiado
        if (prevStatus.status !== v3Data.payload.status ||
            JSON.stringify(prevStatus.data) !== JSON.stringify(v3Data.payload.data)) {
          return v3Data.payload;
        }
        return prevStatus;
      });
    }

    // Procesar otros tipos de datos si es necesario (compatibilidad con formato anterior)
    else if (v3Data.ai_model_details && !v3Data.type) {
      console.log("Recibidos datos del modelo AI (formato anterior):", v3Data.ai_model_details);
      setAiModelDetails(prevDetails => {
        if (!prevDetails || JSON.stringify(prevDetails) !== JSON.stringify(v3Data.ai_model_details)) {
          return v3Data.ai_model_details;
        }
        return prevDetails;
      });
      setIsLoading(false);
      setDataUpdateRequested(false);
    }

    else if (v3Data.ai_simulation_update && !v3Data.type) {
      console.log("Recibida actualización de simulación (formato anterior):", v3Data.ai_simulation_update);
      setSimulationStatus(prevStatus => {
        if (prevStatus.status !== v3Data.ai_simulation_update.status ||
            JSON.stringify(prevStatus.data) !== JSON.stringify(v3Data.ai_simulation_update.data)) {
          return v3Data.ai_simulation_update;
        }
        return prevStatus;
      });
    }
  }, [v3Data]);

  // Timeout para resetear el estado de carga si no se reciben datos
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.log("Timeout: No se recibieron datos del modelo AI");
        setIsLoading(false);
        setDataUpdateRequested(false);
      }, 10000); // 10 segundos de timeout

      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

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
              style={{
                ...buttonStyle,
                backgroundColor: isLoading || dataUpdateRequested ? '#6c757d' : '#007bff',
                cursor: isLoading || dataUpdateRequested ? 'not-allowed' : 'pointer'
              }}
              onClick={handleUpdateDataAI}
              disabled={isLoading || dataUpdateRequested}
            >
              {isLoading || dataUpdateRequested ? 'Actualizando...' : 'Actualizar Datos'}
            </button>
            {aiModelDetails && (
              <span style={{ 
                fontSize: '12px', 
                color: '#666', 
                marginLeft: '10px' 
              }}>
                Última actualización: {new Date().toLocaleTimeString()}
              </span>
            )}
          </div>
          
          {isLoading && !aiModelDetails ? (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <p>🔄 Cargando detalles del modelo AI...</p>
              <p style={{ fontSize: '12px', color: '#666' }}>
                Conectando con V3 para obtener información del modelo
              </p>
            </div>
          ) : aiModelDetails ? (
            <div>
              <div style={{
                ...chartPlaceholderStyle,
                backgroundColor: aiModelDetails.is_trained ? '#e6ffed' : '#fff3e0',
                borderColor: aiModelDetails.is_trained ? '#28a745' : '#ffc107'
              }}>
                <div>
                  <h3>📊 Estado del Modelo de IA</h3>
                  <p><strong>Estado:</strong> {aiModelDetails.is_trained ? '✅ Entrenado' : '⚠️ No entrenado'}</p>
                  <p><strong>Características:</strong> {aiModelDetails.feature_count || 0}</p>
                  <p><strong>Última actualización:</strong> {aiModelDetails.last_updated || 'N/A'}</p>
                  <p><strong>Umbral de confianza:</strong> {aiModelDetails.confidence_threshold || 'N/A'}</p>
                  {aiModelDetails.training_history && (
                    <p><strong>Último entrenamiento:</strong> {aiModelDetails.training_history.last_training || 'N/A'}</p>
                  )}
                </div>
              </div>
              <details style={{ marginTop: '20px' }}>
                <summary style={{ 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}>
                  🔍 Ver detalles completos del modelo
                </summary>
                <pre style={preStyle}>
                  {JSON.stringify(aiModelDetails, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <p>ℹ️ No hay detalles disponibles del modelo AI.</p>
              <p style={{ fontSize: '12px', color: '#666' }}>
                Presiona "Actualizar Datos" para cargar la información del modelo
              </p>
            </div>
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

