import React, { useState, useEffect, useRef } from 'react';
import { API_URLS } from '../../config/api.js';

// Función helper para obtener el nombre del archivo de una ruta
const getFileName = (filePath) => {
  return filePath.split(/[\\/]/).pop();
};

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
  const [csvData, setCsvData] = useState([]);
  const [isLoadingCsv, setIsLoadingCsv] = useState(false);
  const [showCsvData, setShowCsvData] = useState(false);

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
        const symbolsResponse = await fetch(API_URLS.sebo.symbols);
        if (symbolsResponse.ok) setSymbols(await symbolsResponse.json());
      } catch (error) { console.error('Error fetching symbols:', error); }

      try {
        const csvResponse = await fetch(API_URLS.sebo.trainingFiles);
        if (csvResponse.ok) {
          const files = await csvResponse.json();
          setCsvFiles(files);
          if (files.length > 0) {
            // Usar solo el nombre del archivo
            setSelectedCsv(files[0].filename);
          }
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

    // Solicitar estado actual del entrenamiento desde V3
    if (sendV3Command) {
      console.log('🔍 Solicitando estado actual del entrenamiento...');
      sendV3Command('get_training_status');
    }

    fetchInitialData();
  }, [sendV3Command]);

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

  // Función para obtener la ruta completa del archivo
  const getFilePath = async (filename) => {
    try {
      const response = await fetch(API_URLS.sebo.getFilePath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename })
      });

      if (!response.ok) {
        throw new Error(`Error al obtener la ruta del archivo: ${response.status}`);
      }

      const result = await response.json();
      return result.fullPath;
    } catch (error) {
      console.error('Error obteniendo ruta del archivo:', error);
      throw error;
    }
  };

  const handleLoadCsv = async () => {
    if (!selectedCsv) {
      alert('Por favor, seleccione un archivo CSV para cargar.');
      return;
    }

    setIsLoadingCsv(true);
    setCsvData([]);
    setShowCsvData(false);

    try {
      // selectedCsv contiene el nombre del archivo
      const filename = selectedCsv;
      console.log('Nombre del archivo:', filename);

      // Construir la ruta para obtener el contenido del archivo CSV
      const csvPath = `${API_URLS.sebo.trainingFiles}/${filename}`;
      const response = await fetch(csvPath, {
        headers: {
          'Accept': 'text/csv, text/plain, */*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error al cargar el archivo: ${response.status} - ${response.statusText}`);
      }

      const csvText = await response.text();
      
      // Parsear CSV manualmente
      const lines = csvText.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('El archivo CSV está vacío o no tiene datos válidos');
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const data = [];

      // Tomar solo los primeros 20 registros (más el header)
      const dataLines = lines.slice(1, 21);
      
      for (const line of dataLines) {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }

      setCsvData(data);
      setShowCsvData(true);
      console.log(`CSV cargado exitosamente: ${data.length} registros`);
      
    } catch (error) {
      console.error('Error cargando CSV:', error);
      alert(`Error al cargar el archivo CSV: ${error.message}`);
    } finally {
      setIsLoadingCsv(false);
    }
  };

  const handleCreateCSV = async () => {
    setIsCreatingCsv(true);
    setCsvCreationStatus({ status: 'creating', data: null });
    try {
      const payload = { ...formData };
      const response = await fetch(API_URLS.v3.createTrainingCsv, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (response.ok) {
        setCsvCreationStatus({ status: 'completed', data: result });
        alert(result.message || 'CSV created successfully');
        const csvResponse = await fetch(API_URLS.sebo.trainingFiles);
        if (csvResponse.ok) {
            const files = await csvResponse.json();
            setCsvFiles(files);
            // Select the newly created file
            if (result.filename) {
                const newFile = files.find(f => f.filename === result.filename);
                if (newFile) {
                    setSelectedCsv(newFile.filename);
                }
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

  const handleStartTraining = async () => {
    if (!selectedCsv) {
      alert('Por favor, seleccione un archivo CSV para el entrenamiento.');
      return;
    }

    if (!sendV3Command) {
      console.error("No se pudo enviar el comando a V3 - función no disponible.");
      alert("Error: No se puede enviar el comando a V3. Verifique la conexión.");
      return;
    }

    // Verificar que no hay un entrenamiento en progreso
    if (['STARTING', 'IN_PROGRESS'].includes(trainingStatus)) {
      console.log('Ya hay un entrenamiento en progreso');
      return;
    }

    try {
      // selectedCsv contiene el nombre del archivo
      const filename = selectedCsv;
      // Obtener la ruta completa del archivo seleccionado
      const selectedFile = csvFiles.find(f => f.filename === filename);
      const fullFilePath = selectedFile ? selectedFile.value : '';
      
      console.log(`Iniciando entrenamiento con el archivo: ${filename}`);
      console.log('Ruta completa para entrenamiento:', fullFilePath);
      
      const startTime = new Date();
      
      setTrainingStatus('STARTING');
      setTrainingProgress(0);
      setTrainingResults(null);
      setTrainingError(null);
      setTrainingStartTime(startTime);
      setTrainingFilename(filename);

      // Guardar estado inicial en localStorage
      saveTrainingState({
        status: 'STARTING',
        progress: 0,
        filename: filename,
        startTime: startTime,
        results: null,
        error: null
      });

      // Enviar comando con la ruta completa del archivo
      const success = sendV3Command('start_ai_training', {
        csv_filename: filename,
        filepath: fullFilePath
      });

      if (!success) {
        console.error("Error enviando comando de entrenamiento");
        setTrainingStatus('idle');
        setTrainingError('Error de conexión al enviar comando de entrenamiento');
        alert("Error: No se pudo enviar el comando de entrenamiento. Verifique la conexión WebSocket.");
      }
    } catch (error) {
      console.error('Error obteniendo ruta del archivo para entrenamiento:', error);
      alert(`Error: No se pudo obtener la ruta del archivo. ${error.message}`);
    }
  };

  // Ref para evitar procesamiento duplicado de mensajes de entrenamiento
  const lastTrainingMessage = useRef(null);

  useEffect(() => {
    if (!v3Data) return;

    // Procesar respuesta del estado de entrenamiento
    if (v3Data.training_status) {
      const { status, progress, filepath, results, error } = v3Data.training_status;
      console.log('📊 Estado de entrenamiento recibido:', v3Data.training_status);
      
      // Actualizar estados con la información recibida
      if (status) setTrainingStatus(status);
      if (progress !== undefined) setTrainingProgress(progress);
      if (filepath) setTrainingFilename(filepath);
      if (results) setTrainingResults(results);
      if (error) setTrainingError(error);

      // Guardar estado actualizado
      const currentState = {
        status: status || trainingStatus,
        progress: progress !== undefined ? progress : trainingProgress,
        filename: filepath || trainingFilename,
        startTime: trainingStartTime,
        results: results || trainingResults,
        error: error || trainingError
      };
      saveTrainingState(currentState);
    }

    // Procesar mensajes de entrenamiento
    if (v3Data.ai_training_update) {
      const { progress, status, results, error, filepath } = v3Data.ai_training_update;
      
      // Crear identificador único para evitar procesamiento duplicado
      const messageId = `${status}_${progress}_${filepath}_${Date.now()}`;
      if (lastTrainingMessage.current === messageId) {
        return;
      }
      lastTrainingMessage.current = messageId;

      console.log('🎯 Procesando actualización de entrenamiento:', { status, progress, filepath });
      
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

    // También procesar mensajes de tipo 'training_result' si llegan
    else if (v3Data.type === 'ai_training_update' && v3Data.payload) {
      const { progress, status, results, error, filepath } = v3Data.payload;
      
      console.log('🎯 Procesando actualización de entrenamiento (formato nuevo):', v3Data.payload);
      
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
        console.log('✅ Entrenamiento completado exitosamente (formato nuevo)');
      } else if (status === 'FAILED') {
        setTrainingResults(null);
        setTrainingError(error || 'Ocurrió un error desconocido durante el entrenamiento.');
        console.error('❌ Error en entrenamiento (formato nuevo):', error);
      }
    }
  }, [v3Data]);

  const renderTrainingResults = () => {
    if (!trainingResults) return null;
    return (
      <div style={{ marginTop: '20px' }}>
        <h4>Training Results:</h4>
        <pre style={preStyle}>{JSON.stringify(trainingResults, null, 2)}</pre>
      </div>
    );
  };

  const renderCsvDataTable = () => {
    if (!showCsvData || !csvData.length) return null;

    const headers = Object.keys(csvData[0]);
    
    return (
      <div style={{
        marginTop: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#f9f9f9'
      }}>
        <div style={{
          backgroundColor: '#007bff',
          color: 'white',
          padding: '10px',
          fontWeight: 'bold'
        }}>
          Vista Previa del Archivo CSV - Primeros {csvData.length} registros
        </div>
        <div style={{
          maxHeight: '400px',
          overflowY: 'auto',
          overflowX: 'auto'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px'
          }}>
            <thead style={{
              backgroundColor: '#e9ecef',
              position: 'sticky',
              top: 0
            }}>
              <tr>
                {headers.map((header, index) => (
                  <th key={index} style={{
                    padding: '8px',
                    border: '1px solid #ddd',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    minWidth: '100px'
                  }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvData.map((row, rowIndex) => (
                <tr key={rowIndex} style={{
                  backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f8f9fa'
                }}>
                  {headers.map((header, colIndex) => (
                    <td key={colIndex} style={{
                      padding: '6px 8px',
                      border: '1px solid #ddd',
                      maxWidth: '150px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {row[header] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Función para calcular las operaciones posibles basado en fecha e intervalo
  const calculatePossibleOperations = () => {
    if (!formData.fecha || !formData.intervalo) return 0;
    
    const selectedDate = new Date(formData.fecha);
    const currentDate = new Date();
    
    // Calcular la diferencia en días
    const timeDiff = currentDate.getTime() - selectedDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff <= 0) return 0;
    
    // Definir minutos por intervalo
    const intervalMinutes = {
      '5m': 5,
      '10m': 10,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440
    };
    
    const minutesPerInterval = intervalMinutes[formData.intervalo] || 5;
    
    // Calcular operaciones por día (asumiendo 24 horas de trading)
    const operationsPerDay = (24 * 60) / minutesPerInterval;
    
    // Total de operaciones posibles
    const totalOperations = Math.floor(operationsPerDay * daysDiff);
    
    return totalOperations;
  };

  const possibleOperations = calculatePossibleOperations();

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
                <option value="5m">5 minutos</option>
                <option value="10m">10 minutos</option>
                <option value="15m">15 minutos</option>
                <option value="30m">30 minutos</option>
                <option value="1h">1 hora</option>
                <option value="4h">4 horas</option>
                <option value="1d">1 día</option>
              </select>
            </div>
            {formData.fecha && formData.intervalo && (
              <div className="form-group" style={{
                backgroundColor: '#e8f4fd',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #bee5eb'
              }}>
                <label style={{ fontWeight: 'bold', color: '#0c5460' }}>
                  📊 Operaciones calculadas automáticamente:
                </label>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#155724',
                  marginTop: '5px'
                }}>
                  {possibleOperations.toLocaleString()} operaciones
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6c757d',
                  marginTop: '3px'
                }}>
                  Basado en {Math.floor((new Date() - new Date(formData.fecha)) / (1000 * 3600 * 24))} días
                  con intervalos de {formData.intervalo}
                </div>
              </div>
            )}
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
                csvFiles.map(file => <option key={file.filename} value={file.filename}>{file.name}</option>)
              ) : (
                <option value="">No hay archivos CSV disponibles</option>
              )}
            </select>
            <button
              onClick={handleLoadCsv}
              disabled={!selectedCsv || isLoadingCsv}
              style={{
                ...buttonStyle,
                backgroundColor: isLoadingCsv ? '#6c757d' : '#17a2b8',
                marginLeft: '10px'
              }}
            >
              {isLoadingCsv ? 'Cargando...' : 'Cargar'}
            </button>
          </div>

          {/* Botones centrados */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '15px',
            marginTop: '20px',
            marginBottom: '20px'
          }}>
            <button
              onClick={handleStartTraining}
              disabled={!selectedCsv || ['STARTING', 'IN_PROGRESS'].includes(trainingStatus)}
              style={{
                ...buttonStyle,
                backgroundColor: ['STARTING', 'IN_PROGRESS'].includes(trainingStatus) ? '#6c757d' : '#28a745',
                minWidth: '200px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              {['STARTING', 'IN_PROGRESS'].includes(trainingStatus)
                ? `Entrenando... (${trainingProgress.toFixed(0)}%)`
                : 'Iniciar Entrenamiento'
              }
            </button>
          </div>

          {/* Tabla de datos del CSV */}
          {renderCsvDataTable()}

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
