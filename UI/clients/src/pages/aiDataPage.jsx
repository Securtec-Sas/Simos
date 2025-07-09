// UI/clients/src/pages/AIDataPage/AIDataPage.jsx
// Versión con botones de Entrenamiento, Test y Simulación restaurados/implementados
import React, { useEffect, useState } from 'react';
// import styles from './AIDataPage.module.css'; // Descomentar si se crean estilos específicos

const AIDataPage = ({ v3Data, sendV3Command }) => {
  const [aiModelDetails, setAiModelDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState({ status: "IDLE", progress: 0, details: {} });
  const [testResults, setTestResults] = useState(null);
  const [simulationStatus, setSimulationStatus] = useState({ status: "IDLE", data: {} });

  // Parámetros para entrenamiento/prueba
  const [numSamplesTrain, setNumSamplesTrain] = useState(1000);
  const [trainDataSource, setTrainDataSource] = useState('simulation'); // 'simulation' o 'sebo_api'
  const [numSamplesTest, setNumSamplesTest] = useState(200);
  const [simulationDuration, setSimulationDuration] = useState(30); // en minutos

  // Nuevos parámetros para entrenamiento con 'sebo_api'
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [numSymbols, setNumSymbols] = useState(20);
  const [numOperations, setNumOperations] = useState(10000);

  useEffect(() => {
    if (v3Data) {
      if (v3Data.ai_model_details) {
        setAiModelDetails(v3Data.ai_model_details);
        if (isLoading && v3Data.ai_model_details) setIsLoading(false); // Detener carga si los detalles llegaron
      }
      if (v3Data.ai_training_update) {

        setTrainingStatus(v3Data.ai_training_update);
      }
      if (v3Data.ai_test_results) {
        setTestResults(v3Data.ai_test_results);
      }
      if (v3Data.ai_simulation_update) {
        setSimulationStatus(v3Data.ai_simulation_update);
      }
    }
  }, [v3Data, isLoading]); // Añadir isLoading a las dependencias de useEffect

  const handleRequest = (command, payload = {}) => {
    if (sendV3Command) {
      sendV3Command(command, payload);
      if (command === 'get_ai_model_details') setIsLoading(true);
      // Resetear estados visuales para nuevas acciones
      if (command === 'train_ai_model') {



        /**
        * obtebet de payload el taraindatasource si es ihial a simulautad debe llamar el metdo de simulation_engine => generate_training_data
         * si e igual sebo-api, debe emitirlos por el socket y esperar actualizacines de avanxe cada 10 segundos
         * enviar mensaje de entrenamiento a V3 emitir payload, obtner lo datos de 'train_ai_model' del socket para recibir
         * estado del entrenamiento,y actualizar los datos del entrenamiento en vivo, (por ahora actualizar estado y progreso data 
         * solo imprimirlo en una caja de teto) en la vista 
         *  al finalizar el entrenamiento motrar resultados y dejar de recibir 'train_ai_model' del socket, 
         */
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
      console.error("sendV3Command function not provided to AIDataPage");
      alert("Error: Cannot send command to V3.");
    }
  };

  const handleTrainClick = () => {
    let payload = {
      data_source: trainDataSource,
    };

    if (trainDataSource === 'simulation') {
      payload.num_samples = numSamplesTrain;
    } else if (trainDataSource === 'sebo_api') {
      payload.start_date = startDate;
      payload.end_date = endDate;
      payload.num_symbols = numSymbols;
      payload.num_operations = numOperations;
    }

    handleRequest('train_ai_model', payload);
  };

  // Estilos básicos
  const pageStyle = { padding: '20px', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', gap: '20px' };
  const headerStyle = { borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '0px' };
  const sectionStyle = { padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
  const preStyle = { backgroundColor: '#eee', padding: '10px', borderRadius: '4px', overflowX: 'auto', maxHeight: '300px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' };
  const buttonStyle = { padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px', fontSize: '14px', minWidth: '150px' };
  const inputStyle = { marginRight: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '80px' };
  const selectStyle = { marginRight: '10px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' };
  const statusBoxStyle = (status) => ({
    padding: '10px',
    marginTop: '10px',
    border: `1px solid ${status === 'COMPLETED' || status === 'IDLE' ? 'green' : status === 'FAILED' || status === 'ERROR_SIMULACION' ? 'red' : 'orange'}`,
    backgroundColor: `${status === 'COMPLETED' || status === 'IDLE' ? '#e6ffed' : status === 'FAILED' || status === 'ERROR_SIMULACION' ? '#ffe6e6' : '#fff3e0'}`,
    borderRadius: '4px'
  });
  const controlGroupStyle = { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' };


  return (
    <div style={pageStyle}>
      <h1 style={headerStyle}>Gestión y Simulación del Modelo de IA (V3)</h1>

      {/* Sección de Detalles del Modelo */}
      <div style={sectionStyle}>
        <h2>Detalles del Modelo AI</h2>
        <button onClick={() => handleRequest('get_ai_model_details')} disabled={isLoading} style={buttonStyle}>
          {isLoading ? 'Cargando...' : 'Actualizar Detalles'}
        </button>
        {isLoading && !aiModelDetails && <p>Solicitando datos del modelo...</p>}
        {aiModelDetails ? (
          <pre style={preStyle}>{JSON.stringify(aiModelDetails, null, 2)}</pre>
        ) : (
          !isLoading && <p>No hay datos del modelo disponibles. Presiona "Actualizar".</p>
        )}
      </div>

      {/* Sección de Entrenamiento */}
      <div style={sectionStyle}>
        <h2>Entrenamiento del Modelo</h2>
        <div style={controlGroupStyle}>
          <label>Fuente:
            <select value={trainDataSource} onChange={e => setTrainDataSource(e.target.value)} style={selectStyle}>
              <option value="simulation">Simulación (Interna V3)</option>
              <option value="sebo_api">Sebo API (Histórico)</option>
              {/* <option value="csv_upload">Subir CSV</option>  // Opción futura */}
            </select>
          </label>
          {trainDataSource === 'simulation' ? (
            <label>Muestras: <input type="number" value={numSamplesTrain} onChange={e => setNumSamplesTrain(parseInt(e.target.value))} style={inputStyle} /></label>
          ) : (
            <>
              <label>Fecha Inicial: <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} /></label>
              <label>Fecha Final: <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} /></label>
              <label>Cant. Símbolos: <input type="number" value={numSymbols} onChange={e => setNumSymbols(parseInt(e.target.value))} style={inputStyle} /></label>
              <label>Cant. Operaciones: <input type="number" value={numOperations} onChange={e => setNumOperations(parseInt(e.target.value))} style={inputStyle} /></label>
            </>
          )}
        </div>
        <div style={controlGroupStyle}>
          <button
            onClick={handleTrainClick}
            style={{...buttonStyle, backgroundColor: '#28a745'}}
            disabled={trainingStatus.status === 'REQUESTED' || trainingStatus.status === 'STARTED' || trainingStatus.status === 'GENERATING_SIM_DATA' || trainingStatus.status === 'FETCHING_DATA_SEBO' || trainingStatus.status === 'TRAINING_IN_PROGRESS'}
          >
            Entrenar Modelo
          </button>
        </div>
        {trainingStatus.status !== 'IDLE' && (
          <div style={statusBoxStyle(trainingStatus.status)}>
            <p>Estado de Entrenamiento: <strong>{trainingStatus.status}</strong></p>
            {trainingStatus.progress !== null && typeof trainingStatus.progress === 'number' && <p>Progreso: {(trainingStatus.progress * 100).toFixed(1)}%</p>}
            {trainingStatus.details && Object.keys(trainingStatus.details).length > 0 && (
              <pre style={{...preStyle, maxHeight: '150px'}}>{JSON.stringify(trainingStatus.details, null, 2)}</pre>
            )}
          </div>
        )}
      </div>

      {/* Sección de Pruebas */}
      <div style={sectionStyle}>
        <h2>Prueba del Modelo</h2>
        <div style={controlGroupStyle}>
          <label>Muestras de Prueba: <input type="number" value={numSamplesTest} onChange={e => setNumSamplesTest(parseInt(e.target.value))} style={inputStyle} /></label>
          <button
            onClick={() => handleRequest('test_ai_model', { num_samples: numSamplesTest })}
            style={{...buttonStyle, backgroundColor: '#ffc107', color: 'black'}}
            disabled={!aiModelDetails || !aiModelDetails.is_trained || testResults?.status === "REQUESTED"}
          >
            Probar Modelo
          </button>
        </div>
        {testResults && (
          <div style={statusBoxStyle(testResults.error ? 'FAILED' : 'COMPLETED')}>
            <h3>Resultados de Prueba:</h3>
            <pre style={preStyle}>{JSON.stringify(testResults, null, 2)}</pre>
          </div>
        )}
         {aiModelDetails && !aiModelDetails.is_trained && <p style={{color: 'orange', marginTop:'5px'}}>El modelo necesita ser entrenado antes de poder probarlo.</p>}
      </div>

      {/* Sección de Simulación de Trading */}
      <div style={sectionStyle}>
        <h2>Simulación de Trading con IA (Interna V3)</h2>
        <div style={controlGroupStyle}>
          <label>Duración (min): <input type="number" value={simulationDuration} onChange={e => setSimulationDuration(parseInt(e.target.value))} style={inputStyle} /></label>
          <button
            onClick={() => handleRequest('start_ai_simulation', { duration_minutes: simulationDuration })}
            style={{...buttonStyle, backgroundColor: '#17a2b8'}}
            disabled={simulationStatus.status === 'REQUESTED' || simulationStatus.status === 'STARTED' || simulationStatus.status === 'RUNNING' || (!aiModelDetails || !aiModelDetails.is_trained)}
          >
            Iniciar Simulación Interna
          </button>
        </div>
        {simulationStatus.status !== 'IDLE' && (
           <div style={statusBoxStyle(simulationStatus.status)}>
            <p>Estado de Simulación: <strong>{simulationStatus.status}</strong></p>
            {simulationStatus.data && Object.keys(simulationStatus.data).length > 0 && (
              <pre style={{...preStyle, maxHeight: '200px'}}>{JSON.stringify(simulationStatus.data, null, 2)}</pre>
            )}
          </div>
        )}
        {aiModelDetails && !aiModelDetails.is_trained && <p style={{color: 'orange', marginTop:'5px'}}>El modelo necesita ser entrenado antes de poder iniciar una simulación.</p>}
      </div>
    </div>
  );
};

export default AIDataPage;
