import React, { useState, useEffect, useRef } from 'react';
import { API_URLS } from '../../config/api.js';

const Test = ({
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
  const [testStatus, setTestStatus] = useState('idle');
  const [testProgress, setTestProgress] = useState(0);
  const [isCreatingCsv, setIsCreatingCsv] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [testError, setTestError] = useState(null);
  const [testStartTime, setTestStartTime] = useState(null);
  const [testFilename, setTestFilename] = useState(null);

  const [csvFiles, setCsvFiles] = useState([]);
  const [selectedCsv, setSelectedCsv] = useState('');

  // Función para guardar estado en localStorage
  const saveTestState = (state) => {
    try {
      localStorage.setItem('testState', JSON.stringify({
        ...state,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error guardando estado de prueba:', error);
    }
  };

  // Función para cargar estado desde localStorage
  const loadTestState = () => {
    try {
      const saved = localStorage.getItem('testState');
      if (saved) {
        const state = JSON.parse(saved);
        // Solo restaurar si el estado es reciente (menos de 1 hora)
        if (Date.now() - state.timestamp < 3600000) {
          return state;
        }
      }
    } catch (error) {
      console.error('Error cargando estado de prueba:', error);
    }
    return null;
  };

  // Función para limpiar estado de localStorage
  const clearTestState = () => {
    try {
      localStorage.removeItem('testState');
    } catch (error) {
      console.error('Error limpiando estado de prueba:', error);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const symbolsResponse = await fetch(API_URLS.sebo.symbols);
        if (symbolsResponse.ok) setSymbols(await symbolsResponse.json());
      } catch (error) { console.error('Error fetching symbols:', error); }

      try {
        const csvResponse = await fetch(API_URLS.sebo.trainingFiles);
        if (csvResponse.ok) {
          const files = await csvResponse.json();
          setCsvFiles(files);
          if (files.length > 0) setSelectedCsv(files[0]);
        }
      } catch (error) { console.error('Error fetching CSV files:', error); }
    };

    // Cargar estado guardado de las pruebas
    const savedState = loadTestState();
    if (savedState) {
      console.log('Restaurando estado de prueba:', savedState);
      setTestStatus(savedState.status || 'idle');
      setTestProgress(savedState.progress || 0);
      setTestFilename(savedState.filename || null);
      setTestStartTime(savedState.startTime ? new Date(savedState.startTime) : null);
      setTestResults(savedState.results || null);
      setTestError(savedState.error || null);
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

  const handleCreateTestCSV = async () => {
    setIsCreatingCsv(true);
    setCsvCreationStatus({ status: 'creating', data: null });
    try {
      const payload = { ...formData };
      const response = await fetch(API_URLS.v3.createTestCsv, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (response.ok) {
        setCsvCreationStatus({ status: 'completed', data: result });
        alert(result.message || 'CSV de prueba creado exitosamente');
        const csvResponse = await fetch(API_URLS.sebo.trainingFiles);
        if (csvResponse.ok) {
            const files = await csvResponse.json();
            setCsvFiles(files);
            if (result.filename) {
                setSelectedCsv(result.filename);
            }
        }
      } else {
        setCsvCreationStatus({ status: 'error', data: result });
        alert(`Error: ${result.error || 'Ocurrió un error desconocido.'}`);
      }
    } catch (error) {
      console.error('Error creating test CSV:', error);
      setCsvCreationStatus({ status: 'error', data: { error: error.message } });
      alert('Error creando CSV de prueba');
    } finally {
      setIsCreatingCsv(false);
    }
  };

  const handleStartTest = () => {
    if (!selectedCsv) {
      alert('Por favor, seleccione un archivo CSV para las pruebas.');
      return;
    }

    if (!sendV3Command) {
      console.error("No se pudo enviar el comando a V3 - función no disponible.");
      alert("Error: No se puede enviar el comando a V3. Verifique la conexión.");
      return;
    }

    // Verificar que no hay una prueba en progreso
    if (['STARTING', 'IN_PROGRESS'].includes(testStatus)) {
      console.log('Ya hay una prueba en progreso');
      return;
    }

    console.log(`Iniciando pruebas con el archivo: ${selectedCsv}`);
    const startTime = new Date();
    
    setTestStatus('STARTING');
    setTestProgress(0);
    setTestResults(null);
    setTestError(null);
    setTestStartTime(startTime);
    setTestFilename(selectedCsv);

    // Guardar estado inicial en localStorage
    saveTestState({
      status: 'STARTING',
      progress: 0,
      filename: selectedCsv,
      startTime: startTime,
      results: null,
      error: null
    });

    // Enviar comando con verificación de éxito
    const success = sendV3Command('start_ai_test', {
      csv_filename: selectedCsv
    });

    if (!success) {
      console.error("Error enviando comando de prueba");
      setTestStatus('idle');
      setTestError('Error de conexión al enviar comando de prueba');
      alert("Error: No se pudo enviar el comando de prueba. Verifique la conexión WebSocket.");
    }
  };

  // Ref para evitar procesamiento duplicado de mensajes de prueba
  const lastTestMessage = useRef(null);

  useEffect(() => {
    if (!v3Data) return;

    // Procesar mensajes de prueba
    if (v3Data.ai_test_update) {
      const { progress, status, results, error, filepath } = v3Data.ai_test_update;
      
      // Crear identificador único para evitar procesamiento duplicado
      const messageId = `${status}_${progress}_${filepath}_${Date.now()}`;
      if (lastTestMessage.current === messageId) {
        return;
      }
      lastTestMessage.current = messageId;

      console.log('🧪 Procesando actualización de prueba:', { status, progress, filepath });
      
      // Actualizar estados
      if (progress !== undefined) setTestProgress(progress);
      if (status) setTestStatus(status);
      if (filepath) setTestFilename(filepath);

      // Guardar estado en localStorage
      const currentState = {
        status: status || testStatus,
        progress: progress !== undefined ? progress : testProgress,
        filename: filepath || testFilename,
        startTime: testStartTime,
        results: results || testResults,
        error: error || testError
      };
      saveTestState(currentState);

      if (status === 'COMPLETED') {
        setTestResults(results);
        setTestError(null);
        console.log('✅ Pruebas completadas exitosamente');
        
        // Mostrar popup de éxito
        alert(`🎉 ¡Pruebas Completadas Exitosamente!\n\n` +
              `Archivo: ${filepath || testFilename}\n` +
              `Progreso: 100%\n` +
              `Estado: Completado\n\n` +
              `Las pruebas del modelo han sido ejecutadas correctamente.`);
        
        // Limpiar estado después de un tiempo
        setTimeout(() => {
          clearTestState();
        }, 5000);
        
      } else if (status === 'FAILED') {
        setTestResults(null);
        setTestError(error || 'Ocurrió un error desconocido durante las pruebas.');
        console.error('❌ Error en pruebas:', error);
        
        // Mostrar popup de error
        alert(`❌ Error en las Pruebas\n\n` +
              `Archivo: ${filepath || testFilename}\n` +
              `Error: ${error || 'Error desconocido'}\n\n` +
              `Por favor, revisa los datos de prueba e intenta nuevamente.`);
        
        // Limpiar estado después de un tiempo
        setTimeout(() => {
          clearTestState();
        }, 10000);
      }
    }

    // También procesar mensajes de tipo 'ai_test_results' si llegan
    else if (v3Data.type === 'ai_test_results' && v3Data.payload) {
      const { progress, status, results, error, filepath } = v3Data.payload;
      
      console.log('🧪 Procesando resultados de prueba (formato nuevo):', v3Data.payload);
      
      // Actualizar estados
      if (progress !== undefined) setTestProgress(progress);
      if (status) setTestStatus(status);
      if (filepath) setTestFilename(filepath);

      // Guardar estado en localStorage
      const currentState = {
        status: status || testStatus,
        progress: progress !== undefined ? progress : testProgress,
        filename: filepath || testFilename,
        startTime: testStartTime,
        results: results || testResults,
        error: error || testError
      };
      saveTestState(currentState);

      if (status === 'COMPLETED') {
        setTestResults(results);
        setTestError(null);
        console.log('✅ Pruebas completadas exitosamente (formato nuevo)');
      } else if (status === 'FAILED') {
        setTestResults(null);
        setTestError(error || 'Ocurrió un error desconocido durante las pruebas.');
        console.error('❌ Error en pruebas (formato nuevo):', error);
      }
    }
  }, [v3Data]);

  const renderTestResults = () => {
    if (!testResults) return null;
    return (
      <div style={{ marginTop: '20px' }}>
        <h4>Resultados de las Pruebas:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '10px' }}>
          <div>
            <label>Precisión:</label>
            <span style={{ marginLeft: '5px' }}>{testResults.accuracy ? (testResults.accuracy * 100).toFixed(2) + '%' : 'N/A'}</span>
          </div>
          <div>
            <label>Recall:</label>
            <span style={{ marginLeft: '5px' }}>{testResults.recall ? (testResults.recall * 100).toFixed(2) + '%' : 'N/A'}</span>
          </div>
          <div>
            <label>F1-Score:</label>
            <span style={{ marginLeft: '5px' }}>{testResults.f1Score ? (testResults.f1Score * 100).toFixed(2) + '%' : 'N/A'}</span>
          </div>
          <div>
            <label>Operaciones exitosas:</label>
            <span style={{ marginLeft: '5px' }}>{testResults.successfulOperations || 0}/{testResults.totalOperations || 0}</span>
          </div>
        </div>
        <pre style={preStyle}>{JSON.stringify(testResults, null, 2)}</pre>
      </div>
    );
  };

  const possibleOperations = 0; // Placeholder

  return (
    <div className="test-page">
      <h2>Pruebas del Modelo</h2>
      <div className="section-tabs">
        <button className={activeSection === 'data-creation' ? 'active' : ''} onClick={() => setActiveSection('data-creation')}>Creación de Datos de Prueba</button>
        <button className={activeSection === 'testing' ? 'active' : ''} onClick={() => setActiveSection('testing')}>Pruebas</button>
      </div>

      {activeSection === 'data-creation' && (
        <div className="data-creation-section">
            <h3>Crear CSV de Datos para Pruebas</h3>
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
            <button onClick={handleCreateTestCSV} disabled={!formData.fecha || isCreatingCsv} style={{...buttonStyle}}>
              {isCreatingCsv ? 'Creando CSV...' : 'Crear CSV de Prueba'}
            </button>
            {csvCreationStatus.status === 'completed' && <div style={statusBoxStyle('COMPLETED')}><p>✅ CSV de Prueba Creado: {csvCreationStatus.data.filename}</p></div>}
            {csvCreationStatus.status === 'error' && <div style={statusBoxStyle('FAILED')}><p>❌ Error: {csvCreationStatus.data.error}</p></div>}
        </div>
      )}

      {activeSection === 'testing' && (
        <div className="testing-section">
          <h3>Pruebas del Modelo</h3>
          
          {/* Información de las pruebas actuales */}
          {(testStatus !== 'idle' || testFilename) && (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #dee2e6'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Estado de las Pruebas</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div><strong>Archivo:</strong> {testFilename || 'N/A'}</div>
                <div><strong>Estado:</strong> {testStatus}</div>
                <div><strong>Progreso:</strong> {testProgress.toFixed(1)}%</div>
                {testStartTime && (
                  <div><strong>Iniciado:</strong> {testStartTime.toLocaleTimeString()}</div>
                )}
              </div>
            </div>
          )}

          <div style={controlGroupStyle}>
            <label htmlFor="csv-select" style={{ marginRight: '10px' }}>Datos de Prueba:</label>
            <select
              id="csv-select"
              value={selectedCsv}
              onChange={(e) => setSelectedCsv(e.target.value)}
              style={{ ...inputStyle, minWidth: '300px' }}
              disabled={csvFiles.length === 0 || ['STARTING', 'IN_PROGRESS'].includes(testStatus)}
            >
              {csvFiles.length > 0 ? (
                csvFiles.map(file => <option key={file} value={file}>{file}</option>)
              ) : (
                <option value="">No hay archivos CSV disponibles</option>
              )}
            </select>
            <button
              onClick={handleStartTest}
              disabled={!selectedCsv || ['STARTING', 'IN_PROGRESS'].includes(testStatus)}
              style={{
                ...buttonStyle,
                backgroundColor: ['STARTING', 'IN_PROGRESS'].includes(testStatus) ? '#6c757d' : '#17a2b8'
              }}
            >
              {['STARTING', 'IN_PROGRESS'].includes(testStatus)
                ? `Probando... (${testProgress.toFixed(0)}%)`
                : 'Iniciar Pruebas'
              }
            </button>
          </div>

          {testStatus === 'STARTING' && (
            <div style={statusBoxStyle('IN_PROGRESS')}>
              <p>🚀 Iniciando pruebas...</p>
            </div>
          )}

          {testStatus === 'IN_PROGRESS' && (
            <div className="test-progress" style={{ marginTop: '20px' }}>
              <p>🧪 Pruebas en progreso: {testProgress.toFixed(2)}%</p>
              <div style={{
                width: '100%',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden',
                height: '25px',
                position: 'relative'
              }}>
                <div style={{
                  width: `${testProgress}%`,
                  height: '100%',
                  backgroundColor: '#17a2b8',
                  transition: 'width 0.3s ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {testProgress > 10 && `${testProgress.toFixed(0)}%`}
                </div>
              </div>
            </div>
          )}

          {testStatus === 'FAILED' && testError && (
            <div style={statusBoxStyle('FAILED')}>
              <p>❌ Error en las pruebas:</p>
              <p style={{ fontFamily: 'monospace', fontSize: '12px' }}>{testError}</p>
            </div>
          )}

          {testStatus === 'COMPLETED' && (
            <div style={statusBoxStyle('COMPLETED')}>
              <p>✅ Pruebas completadas exitosamente.</p>
              {renderTestResults()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Test;
