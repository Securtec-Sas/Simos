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
    symbolSelectionType: 'cantidad'
  });
  const [csvCreationStatus, setCsvCreationStatus] = useState({ status: 'idle', data: null });
  const [trainingStatus, setTrainingStatus] = useState('idle');
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [isCreatingCsv, setIsCreatingCsv] = useState(false);
  const [trainingResults, setTrainingResults] = useState(null);
  const [trainingError, setTrainingError] = useState(null);
  const [trainingStartTime, setTrainingStartTime] = useState(null);
  const [trainingFilename, setTrainingFilename] = useState(null);

  const [csvFiles, setCsvFiles] = useState([]);
  const [selectedCsv, setSelectedCsv] = useState('');

  // Función para guardar estado en localStorage
  const saveTrainingState = (state) => {
    try {
      localStorage.setItem('trainingState', JSON.stringify({
        ...state,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error guardando estado de entrenamiento:', error);
    }
  };

  // Función para cargar estado desde localStorage
  const loadTrainingState = () => {
    try {
      const saved = localStorage.getItem('trainingState');
      if (saved) {
        const state = JSON.parse(saved);
        // Solo restaurar si el estado es reciente (menos de 1 hora)
        if (Date.now() - state.timestamp < 3600000) {
          return state;
        }
      }
    } catch (error) {
      console.error('Error cargando estado de entrenamiento:', error);
    }
    return null;
  };

  // Función para limpiar estado de localStorage
  const clearTrainingState = () => {
    try {
      localStorage.removeItem('trainingState');
    } catch (error) {
      console.error('Error limpiando estado de entrenamiento:', error);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const symbolsResponse = await fetch('/api/symbols');
        if (symbolsResponse.ok) setSymbols(await symbolsResponse.json());
      } catch (error) { console.error('Error fetching symbols:', error); }

      try {
        const csvResponse = await fetch('/api/spot/training-files');
        if (csvResponse.ok) {
          const files = await csvResponse.json();
          setCsvFiles(files);
          if (files.length > 0) setSelectedCsv(files[0]);
        }
      } catch (error) { console.error('Error fetching CSV files:', error); }
    };

    // Cargar estado guardado del entrenamiento
    const savedState = loadTrainingState();
    if (savedState) {
      console.log('Restaurando estado de entrenamiento:', savedState);
      setTrainingStatus(savedState.status || 'idle');
      setTrainingProgress(savedState.progress || 0);
      setTrainingFilename(savedState.filename || null);
      setTrainingStartTime(savedState.startTime ? new Date(savedState.startTime) : null);
      setTrainingResults(savedState.results || null);
      setTrainingError(savedState.error || null);
    }

    fetchInitialData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
    setIsCreatingCsv(true);
    setCsvCreationStatus({ status: 'creating', data: null });
    try {
      const payload = { ...formData };
      const response = await fetch('/api/trading/create-training-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (response.ok) {
        setCsvCreationStatus({ status: 'completed', data: result });
        alert(result.message || 'CSV created successfully');
        const csvResponse = await fetch('/api/spot/training-files');
        if (csvResponse.ok) {
            const files = await csvResponse.json();
            setCsvFiles(files);
            // Select the newly created file
            if (result.filename) {
                setSelectedCsv(result.filename);
            }
        }
      } else {
        setCsvCreationStatus({ status: 'error', data: result });
        alert(`Error: ${result.error || 'An unknown error occurred.'}`);
      }
    } catch (error) {
      console.error('Error creating CSV:', error);
      setCsvCreationStatus({ status: 'error', data: { error: error.message } });
      alert('Error creating training CSV');
    } finally {
      setIsCreatingCsv(false);
    }
  };

  const handleStartTraining = () => {
    if (!selectedCsv) {
      alert('Por favor, seleccione un archivo CSV para el entrenamiento.');
      return;
    }

    if (sendV3Command) {
      console.log(`Iniciando entrenamiento con el archivo: ${selectedCsv}`);
      const startTime = new Date();
      
      setTrainingStatus('STARTING');
      setTrainingProgress(0);
      setTrainingResults(null);
      setTrainingError(null);
      setTrainingStartTime(startTime);
      setTrainingFilename(selectedCsv);

      // Guardar estado inicial en localStorage
      saveTrainingState({
        status: 'STARTING',
        progress: 0,
        filename: selectedCsv,
        startTime: startTime,
        results: null,
        error: null
      });

      sendV3Command('start_ai_training', {
        csv_filename: selectedCsv
      });
    } else {
      console.error("No se pudo enviar el comando a V3.");
      alert("Error: No se puede enviar el comando a V3.");
    }
  };

  useEffect(() => {
    if (v3Data && v3Data.ai_training_update) {
      const { progress, status, results, error, filepath } = v3Data.ai_training_update;
      
      // Actualizar estados
      if (progress !== undefined) setTrainingProgress(progress);
      if (status) setTrainingStatus(status);
      if (filepath) setTrainingFilename(filepath);

      // Guardar estado en localStorage
      const currentState = {
        status: status || trainingStatus,
        progress: progress !== undefined ? progress : trainingProgress,
        filename: filepath || trainingFilename,
        startTime: trainingStartTime,
        results: results || trainingResults,
        error: error || trainingError
      };
      saveTrainingState(currentState);

      if (status === 'COMPLETED') {
        setTrainingResults(results);
        setTrainingError(null);
        console.log('✅ Entrenamiento completado exitosamente');
        
        // Mostrar popup de éxito
        alert(`🎉 ¡Entrenamiento Completado Exitosamente!\n\n` +
              `Archivo: ${filepath || trainingFilename}\n` +
              `Progreso: 100%\n` +
              `Estado: Completado\n\n` +
              `El modelo ha sido entrenado correctamente.`);
        
        // Limpiar estado después de un tiempo
        setTimeout(() => {
          clearTrainingState();
        }, 5000);
        
      } else if (status === 'FAILED') {
        setTrainingResults(null);
        setTrainingError(error || 'Ocurrió un error desconocido durante el entrenamiento.');
        console.error('❌ Error en entrenamiento:', error);
        
        // Mostrar popup de error
        alert(`❌ Error en el Entrenamiento\n\n` +
              `Archivo: ${filepath || trainingFilename}\n` +
              `Error: ${error || 'Error desconocido'}\n\n` +
              `Por favor, revisa los datos de entrenamiento e intenta nuevamente.`);
        
        // Limpiar estado después de un tiempo
        setTimeout(() => {
          clearTrainingState();
        }, 10000);
      }
    }
  }, [v3Data, trainingStatus, trainingProgress, trainingFilename, trainingStartTime, trainingResults, trainingError]);

  const renderTrainingResults = () => {
    if (!trainingResults) return null;
    return (
      <div style={{ marginTop: '20px' }}>
        <h4>Training Results:</h4>
        <pre style={preStyle}>{JSON.stringify(trainingResults, null, 2)}</pre>
      </div>
    );
  };

  const possibleOperations = 0; // Placeholder, as original logic was complex and might be removed

  return (
    <div className="training-page">
      <h2>Entrenamiento del Modelo</h2>
      <div className="section-tabs">
        <button className={activeSection === 'data-creation' ? 'active' : ''} onClick={() => setActiveSection('data-creation')}>Creación de Datos</button>
        <button className={activeSection === 'training' ? 'active' : ''} onClick={() => setActiveSection('training')}>Entrenamiento</button>
      </div>

      {activeSection === 'data-creation' && (
        <div className="data-creation-section">
            <h3>Crear CSV de Datos para Entrenamiento</h3>
            <div className="form-group">
              <label htmlFor="fecha">Fecha (anterior a la actual):</label>
              <input type="date" id="fecha" name="fecha" value={formData.fecha} onChange={handleInputChange} max={new Date().toISOString().split('T')[0]} required />
            </div>
            <div className="form-group">
              <label htmlFor="operaciones">Número de operaciones:</label>
              <input type="number" id="operaciones" name="operaciones" value={formData.operaciones} onChange={handleInputChange} placeholder={`Calculado automáticamente: ${possibleOperations}`} />
            </div>
            <div className="form-group">
              <label>Selección de símbolos:</label>
              <div>
                <label><input type="radio" name="symbolSelectionType" value="cantidad" checked={formData.symbolSelectionType === 'cantidad'} onChange={handleInputChange} /> Cantidad</label>
                <label><input type="radio" name="symbolSelectionType" value="lista" checked={formData.symbolSelectionType === 'lista'} onChange={handleInputChange} /> Lista</label>
              </div>
            </div>
            {formData.symbolSelectionType === 'cantidad' && (
              <div className="form-group">
                <label htmlFor="cantidadSimbolos">Cantidad de símbolos:</label>
                <input type="number" id="cantidadSimbolos" name="cantidadSimbolos" value={formData.cantidadSimbolos} onChange={handleInputChange} min="1" max="50" />
              </div>
            )}
            {formData.symbolSelectionType === 'lista' && (
              <div className="form-group">
                <label>Seleccionar símbolos:</label>
                <div className="symbols-list" style={{maxHeight: '150px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px'}}>
                  {symbols.map(symbol => (
                    <label key={symbol.id}><input type="checkbox" checked={formData.listaSimbolos.includes(symbol.id)} onChange={() => handleSymbolSelectionChange(symbol.id)} /> {symbol.name}</label>
                  ))}
                </div>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="intervalo">Intervalo de tiempo:</label>
              <select id="intervalo" name="intervalo" value={formData.intervalo} onChange={handleInputChange}>
                <option value="5m">5 minutos</option><option value="1h">1 hora</option><option value="4h">4 horas</option><option value="1d">1 día</option>
              </select>
            </div>
            <button onClick={handleCreateCSV} disabled={!formData.fecha || isCreatingCsv} style={{...buttonStyle}}>
              {isCreatingCsv ? 'Creando CSV...' : 'Crear CSV de Entrenamiento'}
            </button>
            {csvCreationStatus.status === 'completed' && <div style={statusBoxStyle('COMPLETED')}><p>✅ CSV Creado: {csvCreationStatus.data.filename}</p></div>}
            {csvCreationStatus.status === 'error' && <div style={statusBoxStyle('FAILED')}><p>❌ Error: {csvCreationStatus.data.error}</p></div>}
        </div>
      )}

      {activeSection === 'training' && (
        <div className="training-section">
          <h3>Entrenamiento del Modelo</h3>
          
          {/* Información del entrenamiento actual */}
          {(trainingStatus !== 'idle' || trainingFilename) && (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #dee2e6'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Estado del Entrenamiento</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div><strong>Archivo:</strong> {trainingFilename || 'N/A'}</div>
                <div><strong>Estado:</strong> {trainingStatus}</div>
                <div><strong>Progreso:</strong> {trainingProgress.toFixed(1)}%</div>
                {trainingStartTime && (
                  <div><strong>Iniciado:</strong> {trainingStartTime.toLocaleTimeString()}</div>
                )}
              </div>
            </div>
          )}

          <div style={controlGroupStyle}>
            <label htmlFor="csv-select" style={{ marginRight: '10px' }}>Datos de Entrenamiento:</label>
            <select
              id="csv-select"
              value={selectedCsv}
              onChange={(e) => setSelectedCsv(e.target.value)}
              style={{ ...inputStyle, minWidth: '300px' }}
              disabled={csvFiles.length === 0 || ['STARTING', 'IN_PROGRESS'].includes(trainingStatus)}
            >
              {csvFiles.length > 0 ? (
                csvFiles.map(file => <option key={file} value={file}>{file}</option>)
              ) : (
                <option value="">No hay archivos CSV disponibles</option>
              )}
            </select>
            <button
              onClick={handleStartTraining}
              disabled={!selectedCsv || ['STARTING', 'IN_PROGRESS'].includes(trainingStatus)}
              style={{
                ...buttonStyle,
                backgroundColor: ['STARTING', 'IN_PROGRESS'].includes(trainingStatus) ? '#6c757d' : '#28a745'
              }}
            >
              {['STARTING', 'IN_PROGRESS'].includes(trainingStatus)
                ? `Entrenando... (${trainingProgress.toFixed(0)}%)`
                : 'Iniciar Entrenamiento'
              }
            </button>
          </div>

          {trainingStatus === 'STARTING' && (
            <div style={statusBoxStyle('IN_PROGRESS')}>
              <p>🚀 Iniciando entrenamiento...</p>
            </div>
          )}

          {trainingStatus === 'IN_PROGRESS' && (
            <div className="training-progress" style={{ marginTop: '20px' }}>
              <p>🤖 Entrenamiento en progreso: {trainingProgress.toFixed(2)}%</p>
              <div style={{
                width: '100%',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden',
                height: '25px',
                position: 'relative'
              }}>
                <div style={{
                  width: `${trainingProgress}%`,
                  height: '100%',
                  backgroundColor: '#4caf50',
                  transition: 'width 0.3s ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {trainingProgress > 10 && `${trainingProgress.toFixed(0)}%`}
                </div>
              </div>
            </div>
          )}

          {trainingStatus === 'FAILED' && trainingError && (
            <div style={statusBoxStyle('FAILED')}>
              <p>❌ Error en el entrenamiento:</p>
              <p style={{ fontFamily: 'monospace', fontSize: '12px' }}>{trainingError}</p>
            </div>
          )}

          {trainingStatus === 'COMPLETED' && (
            <div style={statusBoxStyle('COMPLETED')}>
              <p>✅ Entrenamiento completado exitosamente.</p>
              {renderTrainingResults()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Training;
