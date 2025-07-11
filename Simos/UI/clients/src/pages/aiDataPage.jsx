// UI/clients/src/pages/aiDataPage.jsx
// Versión actualizada con visualización de datos de entrenamiento en tiempo real
import React, { useEffect, useState } from 'react';

const AIDataPage = ({ v3Data, sendV3Command }) => {
  const [aiModelDetails, setAiModelDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState({ status: "IDLE", progress: 0, details: {} });
  const [testResults, setTestResults] = useState(null);
  const [simulationStatus, setSimulationStatus] = useState({ status: "IDLE", data: {} });
  
  // Nuevos estados para datos de entrenamiento en tiempo real
  const [trainingData, setTrainingData] = useState([]);
  const [trainingLogs, setTrainingLogs] = useState([]);
  const [trainingMetrics, setTrainingMetrics] = useState({});

  // Parámetros para entrenamiento/prueba
  const [numSamplesTrain, setNumSamplesTrain] = useState(1000);
  const [trainDataSource, setTrainDataSource] = useState('sebo_api'); // Cambiar default a 'sebo_api'
  const [numSamplesTest, setNumSamplesTest] = useState(200);
  const [simulationDuration, setSimulationDuration] = useState(30);

  // Parámetros para entrenamiento con datos reales de Sebo
  const [daysBack, setDaysBack] = useState(30);
  const [dataLimit, setDataLimit] = useState(1000);
  const [includeFees, setIncludeFees] = useState(true);

  useEffect(() => {
    if (v3Data) {
      if (v3Data.ai_model_details) {
        setAiModelDetails(v3Data.ai_model_details);
        if (isLoading && v3Data.ai_model_details) setIsLoading(false);
      }
      
      if (v3Data.ai_training_update) {
        const update = v3Data.ai_training_update;
        setTrainingStatus(update);
        
        // Agregar logs de entrenamiento
        if (update.message) {
          setTrainingLogs(prev => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            message: update.message,
            progress: update.progress || 0
          }].slice(-50)); // Mantener solo los últimos 50 logs
        }
        
        // Actualizar métricas de entrenamiento
        if (update.stats) {
          setTrainingMetrics(update.stats);
        }
        
        // Si hay datos de entrenamiento, agregarlos a la tabla
        if (update.data && update.data.training_samples) {
          setTrainingData(prev => {
            const newData = [...prev, ...update.data.training_samples];
            return newData.slice(-100); // Mantener solo los últimos 100 registros
          });
        }
      }
      
      if (v3Data.ai_test_results) {
        setTestResults(v3Data.ai_test_results);
      }
      
      if (v3Data.ai_simulation_update) {
        setSimulationStatus(v3Data.ai_simulation_update);
      }
    }
  }, [v3Data, isLoading]);

  const handleRequest = (command, payload = {}) => {
    if (sendV3Command) {
      sendV3Command(command, payload);
      if (command === 'get_ai_model_details') setIsLoading(true);
      
      if (command === 'train_ai_model') {
        setTrainingStatus({ status: "REQUESTED", progress: 0, details: {} });
        setTestResults(null);
        setTrainingData([]);
        setTrainingLogs([]);
        setTrainingMetrics({});
      }
      
      if (command === 'test_ai_model') {
        setTestResults(null);
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
      payload.days_back = daysBack;
      payload.limit = dataLimit;
      payload.include_fees = includeFees;
    }

    handleRequest('train_ai_model', payload);
  };

  // Estilos
  const pageStyle = { 
    padding: '20px', 
    fontFamily: 'Arial, sans-serif', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '20px',
    maxWidth: '1200px',
    margin: '0 auto'
  };
  
  const headerStyle = { 
    borderBottom: '2px solid #eee', 
    paddingBottom: '10px', 
    marginBottom: '0px' 
  };
  
  const sectionStyle = { 
    padding: '15px', 
    backgroundColor: '#f9f9f9', 
    borderRadius: '8px', 
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
  };
  
  const preStyle = { 
    backgroundColor: '#eee', 
    padding: '10px', 
    borderRadius: '4px', 
    overflowX: 'auto', 
    maxHeight: '300px', 
    whiteSpace: 'pre-wrap', 
    wordBreak: 'break-all' 
  };
  
  const buttonStyle = { 
    padding: '10px 15px', 
    backgroundColor: '#007bff', 
    color: 'white', 
    border: 'none', 
    borderRadius: '4px', 
    cursor: 'pointer', 
    marginRight: '10px', 
    fontSize: '14px', 
    minWidth: '150px' 
  };
  
  const inputStyle = { 
    marginRight: '10px', 
    padding: '8px', 
    borderRadius: '4px', 
    border: '1px solid #ccc', 
    minWidth: '80px' 
  };
  
  const selectStyle = { 
    marginRight: '10px', 
    padding: '8px', 
    borderRadius: '4px', 
    border: '1px solid #ccc' 
  };
  
  const statusBoxStyle = (status) => ({
    padding: '10px',
    marginTop: '10px',
    border: `1px solid ${status === 'COMPLETED' || status === 'IDLE' ? 'green' : status === 'FAILED' || status === 'ERROR_SIMULACION' ? 'red' : 'orange'}`,
    backgroundColor: `${status === 'COMPLETED' || status === 'IDLE' ? '#e6ffed' : status === 'FAILED' || status === 'ERROR_SIMULACION' ? '#ffe6e6' : '#fff3e0'}`,
    borderRadius: '4px'
  });
  
  const controlGroupStyle = { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px', 
    flexWrap: 'wrap', 
    marginBottom: '10px' 
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '10px',
    fontSize: '12px'
  };

  const thStyle = {
    backgroundColor: '#007bff',
    color: 'white',
    padding: '8px',
    textAlign: 'left',
    border: '1px solid #ddd'
  };

  const tdStyle = {
    padding: '6px',
    border: '1px solid #ddd',
    textAlign: 'center'
  };

  const logBoxStyle = {
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    padding: '10px',
    maxHeight: '200px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '12px',
    marginTop: '10px'
  };

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
        <h2>Entrenamiento del Modelo con Datos Reales</h2>
        <div style={controlGroupStyle}>
          <label>Fuente:
            <select value={trainDataSource} onChange={e => setTrainDataSource(e.target.value)} style={selectStyle}>
              <option value="sebo_api">Sebo API (Datos Históricos Reales)</option>
              <option value="simulation">Simulación (Interna V3)</option>
            </select>
          </label>
          
          {trainDataSource === 'simulation' ? (
            <label>Muestras: 
              <input 
                type="number" 
                value={numSamplesTrain} 
                onChange={e => setNumSamplesTrain(parseInt(e.target.value))} 
                style={inputStyle} 
              />
            </label>
          ) : (
            <>
              <label>Días Atrás: 
                <input 
                  type="number" 
                  value={daysBack} 
                  onChange={e => setDaysBack(parseInt(e.target.value))} 
                  style={inputStyle} 
                  min="1"
                  max="365"
                />
              </label>
              <label>Límite Registros: 
                <input 
                  type="number" 
                  value={dataLimit} 
                  onChange={e => setDataLimit(parseInt(e.target.value))} 
                  style={inputStyle} 
                  min="100"
                  max="10000"
                />
              </label>
              <label>
                <input 
                  type="checkbox" 
                  checked={includeFees} 
                  onChange={e => setIncludeFees(e.target.checked)} 
                />
                Incluir Fees
              </label>
            </>
          )}
        </div>
        
        <div style={controlGroupStyle}>
          <button
            onClick={handleTrainClick}
            style={{...buttonStyle, backgroundColor: '#28a745'}}
            disabled={trainingStatus.status === 'REQUESTED' || trainingStatus.status === 'STARTED' || trainingStatus.status === 'fetching_data' || trainingStatus.status === 'processing_data' || trainingStatus.status === 'training_model'}
          >
            Entrenar Modelo
          </button>
        </div>

        {/* Estado y progreso del entrenamiento */}
        {trainingStatus.status !== 'IDLE' && (
          <div style={statusBoxStyle(trainingStatus.status)}>
            <p>Estado de Entrenamiento: <strong>{trainingStatus.status}</strong></p>
            {trainingStatus.progress !== null && typeof trainingStatus.progress === 'number' && (
              <div>
                <p>Progreso: {trainingStatus.progress.toFixed(1)}%</p>
                <div style={{
                  width: '100%',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${trainingStatus.progress}%`,
                    backgroundColor: '#28a745',
                    height: '20px',
                    transition: 'width 0.3s ease'
                  }}></div>
                </div>
              </div>
            )}
            
            {/* Métricas de entrenamiento */}
            {Object.keys(trainingMetrics).length > 0 && (
              <div style={{marginTop: '10px'}}>
                <h4>Métricas de Entrenamiento:</h4>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px'}}>
                  <div>Total de Registros: <strong>{trainingMetrics.total_records || 0}</strong></div>
                  <div>Registros Procesados: <strong>{trainingMetrics.processed_records || 0}</strong></div>
                  <div>Registros Válidos: <strong>{trainingMetrics.valid_records || 0}</strong></div>
                  <div>Precisión: <strong>{(trainingMetrics.training_accuracy * 100 || 0).toFixed(2)}%</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logs de entrenamiento */}
        {trainingLogs.length > 0 && (
          <div>
            <h4>Logs de Entrenamiento:</h4>
            <div style={logBoxStyle}>
              {trainingLogs.map((log, index) => (
                <div key={index} style={{marginBottom: '5px'}}>
                  <span style={{color: '#666'}}>[{log.timestamp}]</span> {log.message}
                  {log.progress > 0 && <span style={{color: '#28a745'}}> ({log.progress.toFixed(1)}%)</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabla de datos de entrenamiento */}
        {trainingData.length > 0 && (
          <div>
            <h4>Datos de Entrenamiento (Últimos {trainingData.length} registros):</h4>
            <div style={{overflowX: 'auto', maxHeight: '300px'}}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Símbolo</th>
                    <th style={thStyle}>Exchange Compra</th>
                    <th style={thStyle}>Exchange Venta</th>
                    <th style={thStyle}>Precio Compra</th>
                    <th style={thStyle}>Precio Venta</th>
                    <th style={thStyle}>Diferencia %</th>
                    <th style={thStyle}>Rentable</th>
                    <th style={thStyle}>Ganancia Neta %</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingData.slice(-20).map((record, index) => (
                    <tr key={index}>
                      <td style={tdStyle}>{record.symbol}</td>
                      <td style={tdStyle}>{record.buy_exchange_id}</td>
                      <td style={tdStyle}>{record.sell_exchange_id}</td>
                      <td style={tdStyle}>{record.current_price_buy?.toFixed(6)}</td>
                      <td style={tdStyle}>{record.current_price_sell?.toFixed(6)}</td>
                      <td style={tdStyle}>{record.price_difference_percentage?.toFixed(2)}%</td>
                      <td style={{...tdStyle, color: record.is_profitable ? 'green' : 'red'}}>
                        {record.is_profitable ? 'SÍ' : 'NO'}
                      </td>
                      <td style={{...tdStyle, color: record.net_profit_percentage > 0 ? 'green' : 'red'}}>
                        {record.net_profit_percentage?.toFixed(3)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Sección de Pruebas */}
      <div style={sectionStyle}>
        <h2>Prueba del Modelo</h2>
        <div style={controlGroupStyle}>
          <label>Muestras de Prueba: 
            <input 
              type="number" 
              value={numSamplesTest} 
              onChange={e => setNumSamplesTest(parseInt(e.target.value))} 
              style={inputStyle} 
            />
          </label>
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
        {aiModelDetails && !aiModelDetails.is_trained && (
          <p style={{color: 'orange', marginTop:'5px'}}>
            El modelo necesita ser entrenado antes de poder probarlo.
          </p>
        )}
      </div>

      {/* Sección de Simulación de Trading */}
      <div style={sectionStyle}>
        <h2>Simulación de Trading con IA (Sandbox)</h2>
        <div style={controlGroupStyle}>
          <label>Duración (min): 
            <input 
              type="number" 
              value={simulationDuration} 
              onChange={e => setSimulationDuration(parseInt(e.target.value))} 
              style={inputStyle} 
            />
          </label>
          <button
            onClick={() => handleRequest('start_ai_simulation', { duration_minutes: simulationDuration })}
            style={{...buttonStyle, backgroundColor: '#17a2b8'}}
            disabled={simulationStatus.status === 'REQUESTED' || simulationStatus.status === 'STARTED' || simulationStatus.status === 'RUNNING' || (!aiModelDetails || !aiModelDetails.is_trained)}
          >
            Iniciar Simulación Sandbox
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
        {aiModelDetails && !aiModelDetails.is_trained && (
          <p style={{color: 'orange', marginTop:'5px'}}>
            El modelo necesita ser entrenado antes de poder iniciar una simulación.
          </p>
        )}
      </div>
    </div>
  );
};

export default AIDataPage;

