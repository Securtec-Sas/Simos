<<<<<<< HEAD
import React from 'react';

const Training = ({
  trainDataSource,
  setTrainDataSource,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  numSymbols,
  setNumSymbols,
  numOperations,
  setNumOperations,
  trainingFile,
  setTrainingFile,
  trainingFileError,
  handleFileChange,
  handleTrainClick,
  trainingStatus,
  buttonStyle,
  inputStyle,
  selectStyle,
  controlGroupStyle,
  sectionStyle,
  chartPlaceholderStyle,
  preStyle,
  statusBoxStyle,
}) => {
  return (
    // datos para generar diccionario de entrenamiento 
    /**
     * fecha_inicio, intervalo, cantidad_operaciones, cantidad_simbolos o lista_simbolos
     */
    <div style={sectionStyle}>
      <h2>Entrenamiento del Modelo</h2>
      <div style={controlGroupStyle}>
        <label>Fuente:
          <select value={trainDataSource} onChange={e => setTrainDataSource(e.target.value)} style={selectStyle}>
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
                    intervalo: '1h',
                    cantidad_operaciones: numOperations,
                    cantidad_simbolos: numSymbols,
                    lista_simbolos: [],
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
=======
import React, { useState, useEffect } from 'react';

const Training = ({ 
  sendV3Command, 
  v3Data, 
  buttonStyle, 
  inputStyle, 
  controlGroupStyle, 
  preStyle, 
  statusBoxStyle, 
  chartPlaceholderStyle 
}) => {
  const [activeSection, setActiveSection] = useState('data-creation');
  const [symbols, setSymbols] = useState([]);
  const [formData, setFormData] = useState({
    fecha: '',
    operaciones: '',
    cantidadSimbolos: '',
    listaSimbolos: [],
    intervalo: '5m',
    symbolSelectionType: 'cantidad' // 'cantidad' o 'lista'
  });
  const [csvData, setCsvData] = useState(null);
  const [trainingStatus, setTrainingStatus] = useState('idle'); // idle, training, completed
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [isCreatingCsv, setIsCreatingCsv] = useState(false); // Estado para el proceso de creación de CSV

  // Obtener símbolos de Sebo
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        // La ruta correcta probablemente es /api/symbol/symbols, no /api/sebo/symbols.
        const response = await fetch('/api/symbols/symbols');
        const data = await response.json();
        setSymbols(data);
      } catch (error) {
        console.error('Error obteniendo símbolos:', error);
      }
    };
    fetchSymbols();
  }, []);

  // Calcular operaciones posibles basado en fecha e intervalo
  const calculatePossibleOperations = () => {
    if (!formData.fecha || !formData.intervalo) return 0;
    
    const selectedDate = new Date(formData.fecha);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - selectedDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Convertir intervalo a minutos
    const intervalMinutes = {
      '5m': 5,
      '10m': 10,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '2h': 120,
      '3h': 180,
      '4h': 240,
      '6h': 360,
      '12h': 720,
      '1d': 1440
    };
    
    const minutes = intervalMinutes[formData.intervalo] || 5;
    const operationsPerDay = (24 * 60) / minutes;
    const totalOperations = Math.floor(operationsPerDay * diffDays);
    
    return totalOperations;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSymbolSelectionChange = (symbolId) => {
    setFormData(prev => ({
      ...prev,
      listaSimbolos: prev.listaSimbolos.includes(symbolId)
        ? prev.listaSimbolos.filter(id => id !== symbolId)
        : [...prev.listaSimbolos, symbolId]
    }));
  };

  const handleCreateCSV = async () => {
    setIsCreatingCsv(true); // Bloquear botón y mostrar estado de carga
    try {
      const payload = {
        fecha: formData.fecha,
        operaciones: formData.operaciones || calculatePossibleOperations(),
        cantidadSimbolos: formData.symbolSelectionType === 'cantidad' ? parseInt(formData.cantidadSimbolos) : null,
        listaSimbolos: formData.symbolSelectionType === 'lista' ? formData.listaSimbolos : [],
        intervalo: formData.intervalo
      };

      const response = await fetch('/api/trading/create-training-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // Check if the response was successful (status code 2xx)
      if (response.ok) {
        const result = await response.json();
        setCsvData(result); // The entire response is the data object
        alert(result.message || 'CSV de entrenamiento creado exitosamente');
      } else {
        // Handle HTTP errors
        const errorResult = await response.json();
        alert(`Error: ${errorResult.error || 'Ocurrió un error desconocido.'}`);
      }
    } catch (error) {
      console.error('Error creando CSV:', error);
      alert('Error creando CSV de entrenamiento');
    } finally {
      setIsCreatingCsv(false); // Desbloquear el botón al finalizar
    }
  };

  const handleStartTraining = async () => {
    if (!csvData) {
      alert('Primero debe crear un CSV de datos');
      return;
    }

    try {
      setTrainingStatus('training');
      setTrainingProgress(0);

      const response = await fetch('/api/v3/start-training', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ csvData })
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        // El progreso se actualizará vía WebSocket
        console.log('Entrenamiento iniciado');
      } else {
        setTrainingStatus('idle');
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error iniciando entrenamiento:', error);
      setTrainingStatus('idle');
      alert('Error iniciando entrenamiento');
    }
  };

  // Escuchar actualizaciones de entrenamiento vía WebSocket
  useEffect(() => {
    if (v3Data && v3Data.type === 'training_progress') {
      setTrainingProgress(v3Data.payload.progress);
      if (v3Data.payload.completed) {
        setTrainingStatus('completed');
      }
    }
  }, [v3Data]);

  const possibleOperations = calculatePossibleOperations();

  return (
    <div className="training-page">
      <h2>Entrenamiento del Modelo</h2>
      
      <div className="training-sections">
        <div className="section-tabs">
          <button 
            className={activeSection === 'data-creation' ? 'active' : ''}
            onClick={() => setActiveSection('data-creation')}
          >
            Creación de Datos
          </button>
          <button 
            className={activeSection === 'training' ? 'active' : ''}
            onClick={() => setActiveSection('training')}
          >
            Entrenamiento
          </button>
        </div>

        {activeSection === 'data-creation' && (
          <div className="data-creation-section">
            <h3>Crear CSV de Datos para Entrenamiento</h3>
            
            <div className="form-group">
              <label htmlFor="fecha">Fecha (anterior a la actual):</label>
              <input
                type="date"
                id="fecha"
                name="fecha"
                value={formData.fecha}
                onChange={handleInputChange}
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="operaciones">Número de operaciones:</label>
              <input
                type="number"
                id="operaciones"
                name="operaciones"
                value={formData.operaciones}
                onChange={handleInputChange}
                placeholder={`Calculado automáticamente: ${possibleOperations}`}
              />
              <small>Operaciones completas (transferencia → compra → transferencia → venta → transferencia)</small>
              {possibleOperations > 0 && (
                <div className="calculated-operations">
                  Operaciones posibles en el período: {possibleOperations}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Selección de símbolos:</label>
              <div className="symbol-selection">
                <label>
                  <input
                    type="radio"
                    name="symbolSelectionType"
                    value="cantidad"
                    checked={formData.symbolSelectionType === 'cantidad'}
                    onChange={handleInputChange}
                  />
                  Cantidad de símbolos
                </label>
                <label>
                  <input
                    type="radio"
                    name="symbolSelectionType"
                    value="lista"
                    checked={formData.symbolSelectionType === 'lista'}
                    onChange={handleInputChange}
                  />
                  Lista específica de símbolos
                </label>
              </div>
            </div>

            {formData.symbolSelectionType === 'cantidad' && (
              <div className="form-group">
                <label htmlFor="cantidadSimbolos">Cantidad de símbolos:</label>
                <input
                  type="number"
                  id="cantidadSimbolos"
                  name="cantidadSimbolos"
                  value={formData.cantidadSimbolos}
                  onChange={handleInputChange}
                  min="1"
                  max="50"
                />
              </div>
            )}

            {formData.symbolSelectionType === 'lista' && (
              <div className="form-group">
                <label>Seleccionar símbolos:</label>
                <div className="symbols-list">
                  {symbols.map(symbol => (
                    <label key={symbol.id} className="symbol-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.listaSimbolos.includes(symbol.id)}
                        onChange={() => handleSymbolSelectionChange(symbol.id)}
                      />
                      {symbol.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="intervalo">Intervalo de tiempo:</label>
              <select
                id="intervalo"
                name="intervalo"
                value={formData.intervalo}
                onChange={handleInputChange}
              >
                <option value="5m">5 minutos</option>
                <option value="10m">10 minutos</option>
                <option value="15m">15 minutos</option>
                <option value="30m">30 minutos</option>
                <option value="1h">1 hora</option>
                <option value="2h">2 horas</option>
                <option value="3h">3 horas</option>
                <option value="4h">4 horas</option>
                <option value="6h">6 horas</option>
                <option value="12h">12 horas</option>
                <option value="1d">1 día</option>
              </select>
            </div>

            <button 
              className="create-csv-btn"
              onClick={handleCreateCSV}
              disabled={!formData.fecha || isCreatingCsv}
              style={{
                ...buttonStyle,
                backgroundColor: isCreatingCsv ? '#ffc107' : (buttonStyle?.backgroundColor || '#007bff'),
                color: isCreatingCsv ? '#212529' : (buttonStyle?.color || 'white'),
                cursor: isCreatingCsv ? 'not-allowed' : 'pointer',
                opacity: isCreatingCsv ? 0.7 : 1
              }}
            >
              {isCreatingCsv ? 'Creando CSV...' : 'Crear CSV de Entrenamiento'}
            </button>

            {csvData && (
              <div className="csv-status">
                <h3>CSV Creado Exitosamente</h3>
                <p>Registros: {csvData.records}</p>
                <p>Archivo: {csvData.filename}</p>
              </div>
            )}
          </div>
        )}

        {activeSection === 'training' && (
          <div className="training-section">
            <h3>Entrenamiento del Modelo</h3>
            
            {!csvData && (
              <div className="warning">
                <p>Primero debe crear un CSV de datos en la sección "Creación de Datos"</p>
              </div>
            )}

            {csvData && (
              <div className="training-controls">
                <button 
                  className="start-training-btn"
                  onClick={handleStartTraining}
                  disabled={trainingStatus === 'training'}
                  style={{...buttonStyle, backgroundColor: '#28a745'}}
                >
                  {trainingStatus === 'training' ? 'Entrenando...' : 'Iniciar Entrenamiento'}
                </button>

                {trainingStatus === 'training' && (
                  <div className="training-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${trainingProgress}%` }}
                      ></div>
                    </div>
                    <p>Progreso: {trainingProgress}%</p>
                  </div>
                )}

                {trainingStatus === 'training' && trainingProgress > 0 && (
                  <div style={chartPlaceholderStyle}>
                    Gráfica de Progreso de Entrenamiento (ej: Loss vs Epochs) iría aquí.
                    <br />
                    Progreso actual: {trainingProgress}%
                  </div>
                )}
                
                {trainingStatus === 'completed' && (
                  <div style={chartPlaceholderStyle}>
                    Gráfica de Resultados de Entrenamiento (ej: Métricas finales) iría aquí.
                    <br/>
                    Entrenamiento completado.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
>>>>>>> parent of 5b78e8f (prueba)
    </div>
  );
};

export default Training;
