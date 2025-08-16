// UI/clients/src/pages/AIDataPage/AIDataPage.jsx
// Versión con botones de Entrenamiento, Test y Simulación restaurados/implementados
import React, { useEffect, useState } from 'react';
import DataAI from '../components/AIDataPage/DataAI.jsx';
// import styles from './AIDataPage.module.css'; // Descomentar si se crean estilos específicos

const AIDataPage = ({ v3Data, sendV3Command }) => {
  const [aiModelDetails, setAiModelDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState({ status: "IDLE", progress: 0, details: {} });
  const [testResults, setTestResults] = useState(null);
  const [simulationStatus, setSimulationStatus] = useState({ status: "IDLE", data: {} });

  // Parámetros para entrenamiento/prueba
  const [numSamplesTrain, setNumSamplesTrain] = useState(1000);
  const [trainDataSource, setTrainDataSource] = useState('sebo_api'); // Eliminada opción de simulación interna, solo 'sebo_api' o 'csv_upload'
  const [numSamplesTest, setNumSamplesTest] = useState(200);
  const [simulationDuration, setSimulationDuration] = useState(30); // en minutos

  // Nuevos parámetros para entrenamiento con 'sebo_api'
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [numSymbols, setNumSymbols] = useState(20);
  const [numOperations, setNumOperations] = useState(10000);
  const [trainingFile, setTrainingFile] = useState(null);
  const [trainingFileError, setTrainingFileError] = useState('');
  const [testFile, setTestFile] = useState(null);
  const [testFileError, setTestFileError] = useState('');
  const [apiKeyMissingPopup, setApiKeyMissingPopup] = useState({ isOpen: false, exchangeId: '', message: '' });

  useEffect(() => {
    // Cargar automáticamente detalles del modelo al cargar la página
    console.log('🔍 Solicitando detalles del modelo AI al cargar la página...');
    handleRequest('get_ai_model_details');
  }, [sendV3Command]);

  // Efecto para procesar respuestas de V3
  useEffect(() => {
    if (!v3Data) return;

    // Procesar detalles del modelo AI
    if (v3Data.ai_model_details) {
      console.log('🤖 Detalles del modelo AI recibidos:', v3Data.ai_model_details);
      setAiModelDetails(v3Data.ai_model_details);
      setIsLoading(false);
    }

    // Procesar actualizaciones de entrenamiento
    if (v3Data.ai_training_update) {
      const { status, progress, results, error } = v3Data.ai_training_update;
      console.log('🎯 Actualización de entrenamiento recibida:', v3Data.ai_training_update);
      
      setTrainingStatus({
        status: status || trainingStatus.status,
        progress: progress !== undefined ? progress : trainingStatus.progress,
        details: results || trainingStatus.details
      });

      // Si el entrenamiento se completó, actualizar detalles del modelo
      if (status === 'COMPLETED') {
        console.log('✅ Entrenamiento completado, actualizando detalles del modelo...');
        setTimeout(() => {
          handleRequest('get_ai_model_details');
        }, 1000);
      }
    }

    // Procesar resultados de pruebas
    if (v3Data.ai_test_results) {
      console.log('🧪 Resultados de prueba recibidos:', v3Data.ai_test_results);
      setTestResults(v3Data.ai_test_results);
    }

    // Procesar actualizaciones de simulación
    if (v3Data.ai_simulation_update) {
      console.log('🎮 Actualización de simulación recibida:', v3Data.ai_simulation_update);
      const { status, data } = v3Data.ai_simulation_update;
      setSimulationStatus({
        status: status || simulationStatus.status,
        data: data || simulationStatus.data
      });
    }
  }, [v3Data]);

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
    } else if (trainDataSource === 'csv_upload') {
      if (!trainingFile) {
        setTrainingFileError('Por favor, selecciona un archivo CSV para entrenar.');
        alert('Por favor, selecciona un archivo CSV para entrenar.');
        return;
      }
      // Aquí leeríamos el archivo. Por ahora, simularemos que el backend lo maneja.
      // En una implementación real, podríamos enviar el archivo vía FormData
      // o leer su contenido y enviarlo como string si es pequeño.
      // Por simplicidad en este paso, solo enviaremos el nombre del archivo
      // y asumiremos que el backend tiene acceso a él o se implementará la subida.
      payload.file_name = trainingFile.name;
      // payload.file_content = await trainingFile.text(); // Ejemplo si se envía contenido
      setTrainingFileError('');
    }

    handleRequest('train_ai_model', payload);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        setTrainingFile(file);
        setTrainingFileError('');
      } else {
        setTrainingFile(null);
        setTrainingFileError('Por favor, selecciona un archivo CSV válido.');
        alert('Por favor, selecciona un archivo CSV válido.');
      }
    }
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

  // Estilos para el Popup Modal
  const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000
  };
  const modalContentStyle = {
    backgroundColor: 'white', padding: '30px', borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)', textAlign: 'center',
    maxWidth: '400px', width: '90%'
  };
  const modalCloseButtonStyle = {
    padding: '8px 15px', backgroundColor: '#007bff', color: 'white',
    border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '20px'
  };

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

  return (
    <div style={pageStyle}>
      {apiKeyMissingPopup.isOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3>API Key Requerida</h3>
            <p>{apiKeyMissingPopup.message}</p>
            <p>Exchange: <strong>{apiKeyMissingPopup.exchangeId.toUpperCase()}</strong></p>
            <p>Por favor, configura las API keys en la página de <a href="/exchange-apis" style={{color: '#007bff'}}>Configuración de APIs</a>.</p>
            <button
              onClick={() => setApiKeyMissingPopup({ isOpen: false, exchangeId: '', message: '' })}
              style={modalCloseButtonStyle}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <h1 style={headerStyle}>Gestión y Simulación del Modelo de IA (V3)</h1>

      {/* Sección de Detalles del Modelo usando DataAI */}
      <DataAI
        aiModelDetails={aiModelDetails}
        isLoading={isLoading}
        handleRequest={handleRequest}
        buttonStyle={buttonStyle}
        headerStyle={headerStyle}
        sectionStyle={sectionStyle}
      />

      {/* Sección de Entrenamiento */}
      <div style={sectionStyle}>
        <h2>Entrenamiento del Modelo</h2>
        <div style={controlGroupStyle}>
          <label>Fuente:
          <select value={trainDataSource} onChange={e => setTrainDataSource(e.target.value)} style={selectStyle}>
              {/* Eliminada opción de simulación interna */}
              <option value="sebo_api">Sebo API (Histórico)</option>
              <option value="csv_upload">Subir CSV</option>
            </select>
          </label>
          {trainDataSource === 'sebo_api' && (
            <>
              <label>Fecha Inicial: <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} /></label>
              <label>Fecha Final: <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} /></label>
              <label>Cant. Símbolos: <input type="number" value={numSymbols} onChange={e => setNumSymbols(parseInt(e.target.value))} style={inputStyle} /></label>
              <label>Cant. Operaciones: <input type="number" value={numOperations} onChange={e => setNumOperations(parseInt(e.target.value))} style={inputStyle} /></label>
            </>
          )}
          {trainDataSource === 'csv_upload' && (
            <div>
              <input type="file" accept=".csv" onChange={handleFileChange} style={{ ...inputStyle, width: 'auto' }} />
              {trainingFile && <p style={{marginTop: '5px', fontSize: '12px'}}>Archivo seleccionado: {trainingFile.name}</p>}
              {trainingFileError && <p style={{ color: 'red', marginTop: '5px', fontSize: '12px' }}>{trainingFileError}</p>}
            </div>
          )}
        </div>

        {/* New form for creating CSV for training */}
        {trainDataSource === 'sebo_api' && (
          <div style={{ ...sectionStyle, marginTop: '20px' }}>
            <h3>Crear CSV para Entrenamiento</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const response = await fetch('/api/trading/create-training-csv', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      fecha_inicio: startDate,
                      intervalo: '1h', // Example interval, could be made dynamic
                      cantidad_operaciones: numOperations,
                      cantidad_simbolos: numSymbols,
                      lista_simbolos: [], // Could add UI to input list if needed
                    }),
                  });
                  if (!response.ok) {
                    throw new Error('Error al crear CSV');
                  }
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'training_data.csv';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                } catch (error) {
                  alert('Error al crear CSV: ' + error.message);
                }
              }}
            >
              <button type="submit" style={{ ...buttonStyle, backgroundColor: '#007bff' }}>
                Descargar CSV de Entrenamiento
              </button>
            </form>
          </div>
        )}

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
            {/* Placeholder para gráfica de entrenamiento */}
            {trainingStatus.status === 'TRAINING_IN_PROGRESS' && trainingStatus.progress > 0 && (
              <div style={chartPlaceholderStyle}>
                Gráfica de Progreso de Entrenamiento (ej: Loss vs Epochs) iría aquí.
                <br />
                Progreso actual: {(trainingStatus.progress * 100).toFixed(1)}%
              </div>
            )}
            {trainingStatus.status === 'COMPLETED' && trainingStatus.details && (
                 <div style={chartPlaceholderStyle}>
                    Gráfica de Resultados de Entrenamiento (ej: Métricas finales) iría aquí.
                    <br/>
                    Datos disponibles en "trainingStatus.details".
                 </div>
            )}
          </div>
        )}
      </div>

      {/* Sección de Pruebas */}
      <div style={sectionStyle}>
        <h2>Prueba del Modelo</h2>
        <div style={controlGroupStyle}>
          <div>
            <label htmlFor="testFileUpload" style={{ display: 'block', marginBottom: '5px' }}>Archivo CSV para Prueba:</label>
            <input id="testFileUpload" type="file" accept=".csv" onChange={handleTestFileChange} style={{ ...inputStyle, width: 'auto' }} />
            {testFile && <p style={{marginTop: '5px', fontSize: '12px'}}>Archivo seleccionado: {testFile.name}</p>}
            {testFileError && <p style={{ color: 'red', marginTop: '5px', fontSize: '12px' }}>{testFileError}</p>}
          </div>
        </div>
        <div style={controlGroupStyle}>
          <button
            onClick={() => {
              if (!testFile) {
                setTestFileError('Por favor, selecciona un archivo CSV para probar.');
                alert('Por favor, selecciona un archivo CSV para probar.');
                return;
              }
              setTestFileError('');
              handleRequest('test_ai_model', { file_name: testFile.name /*, file_content: await testFile.text() */ });
            }}
            style={{...buttonStyle, backgroundColor: '#ffc107', color: 'black'}}
            disabled={!aiModelDetails || !aiModelDetails.is_trained || testResults?.status === "REQUESTED" || !testFile}
          >
            Probar Modelo con CSV
          </button>
        </div>
        {testResults && (
          <div style={statusBoxStyle(testResults.error ? 'FAILED' : 'COMPLETED')}>
            <h3>Resultados de Prueba:</h3>
            <pre style={preStyle}>{JSON.stringify(testResults, null, 2)}</pre>
            {/* Placeholder para gráfica de resultados de prueba */}
            {!testResults.error && Object.keys(testResults).length > 0 && (
              <div style={chartPlaceholderStyle}>
                Gráfica de Resultados de Prueba (ej: Accuracy, Precision, Recall, Curva ROC) iría aquí.
                <br />
                Datos disponibles en "testResults".
              </div>
            )}
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
              <>
                <pre style={{...preStyle, maxHeight: '200px'}}>{JSON.stringify(simulationStatus.data, null, 2)}</pre>
                {/* Placeholder para gráfica de simulación */}
                <div style={chartPlaceholderStyle}>
                  Gráfica de Resultados de Simulación (ej: P&L vs Tiempo) iría aquí.
                  <br />
                  Datos disponibles en "simulationStatus.data".
                </div>
              </>
            )}
          </div>
        )}
        {aiModelDetails && !aiModelDetails.is_trained && <p style={{color: 'orange', marginTop:'5px'}}>El modelo necesita ser entrenado antes de poder iniciar una simulación.</p>}
      </div>
    </div>
  );
};

export default AIDataPage;
