import React, { useState, useEffect } from 'react';
import TrainingVisualization from './TrainingVisualization.jsx';
import './TrainingPage.css';

const TrainingPage = ({ sendV3Command, v3Data }) => {
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
  const [testResults, setTestResults] = useState(null);
  const [simulationResults, setSimulationResults] = useState(null);

  // Obtener símbolos de Sebo
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/symbol/symbols');
        const data = await response.json();
        setSymbols(data);
      } catch (error) {
        console.error('Error obteniendo símbolos:', error);
      }
    };
    fetchSymbols();
  }, []);

  // Solicitar estado de entrenamiento a V3 al cargar la página
  useEffect(() => {
    sendV3Command({
      type: 'get_training_status',
      payload: {}
    });
  }, [sendV3Command]);

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
    try {
      const payload = {
        fecha: formData.fecha,
        operaciones: formData.operaciones || calculatePossibleOperations(),
        cantidadSimbolos: formData.symbolSelectionType === 'cantidad' ? parseInt(formData.cantidadSimbolos) : null,
        listaSimbolos: formData.symbolSelectionType === 'lista' ? formData.listaSimbolos : [],
        intervalo: formData.intervalo
      };

      const response = await fetch('http://localhost:3000/api/trading/create-training-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        setCsvData(result.data);
        alert('CSV de entrenamiento creado exitosamente');
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error creando CSV:', error);
      alert('Error creando CSV de entrenamiento');
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

      // Enviar la ruta del archivo CSV a V3 a través de un comando de socket
      sendV3Command({
        type: 'start_ai_training',
        payload: { filepath: csvData.filepath }
      });
      
      console.log('Entrenamiento iniciado (vía socket)');

    } catch (error) {
      console.error('Error iniciando entrenamiento:', error);
      setTrainingStatus('idle');
      alert('Error iniciando entrenamiento');
    }
  };

  const handleRunTests = async (testCsvFile) => {
    try {
      const formData = new FormData();
      formData.append('testCsv', testCsvFile);

      const response = await fetch('http://localhost:3000/api/v3/run-tests', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        setTestResults(result.data);
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error ejecutando pruebas:', error);
      alert('Error ejecutando pruebas');
    }
  };

  const handleStartSimulation = async () => {
    try {
      const simulationConfig = {
        duration_days: parseInt(document.getElementById('simulationDays').value),
        initial_balance: parseFloat(document.getElementById('initialBalance').value),
        symbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'], // Símbolos por defecto
        interval: document.getElementById('simulationInterval').value,
        risk_tolerance: document.getElementById('riskTolerance').value
      };

      const response = await fetch('http://localhost:3000/api/v3/start-simulation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(simulationConfig)
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        console.log('Simulación iniciada');
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error iniciando simulación:', error);
      alert('Error iniciando simulación');
    }
  };

  // Escuchar actualizaciones de entrenamiento vía WebSocket
  useEffect(() => {
    if (v3Data) {
      if (v3Data.type === 'training_progress') {
        setTrainingProgress(v3Data.payload.progress);
        if (v3Data.payload.completed) {
          setTrainingStatus('completed');
        } else {
          setTrainingStatus('training');
        }
      } else if (v3Data.type === 'training_complete') {
        setTrainingStatus('completed');
        setTrainingProgress(100);
        alert('Entrenamiento completado!');
      } else if (v3Data.type === 'training_error') {
        setTrainingStatus('idle');
        setTrainingProgress(0);
        alert(`Error en entrenamiento: ${v3Data.payload.message}`);
      } else if (v3Data.type === 'training_status') { // Nuevo tipo de mensaje para el estado inicial
        setTrainingStatus(v3Data.payload.status);
        setTrainingProgress(v3Data.payload.progress);
        if (v3Data.payload.filepath) {
          setCsvData({ filepath: v3Data.payload.filepath }); // Restaurar csvData si hay un entrenamiento en curso
        }
      }
      
      if (v3Data.type === 'simulation_complete') {
        setSimulationResults(v3Data.payload.results);
      }
    }
  }, [v3Data]);

  const possibleOperations = calculatePossibleOperations();

  return (
    <div className="training-page">
      <h1>Entrenamiento de Modelo de IA</h1>
      
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
          <button 
            className={activeSection === 'testing' ? 'active' : ''}
            onClick={() => setActiveSection('testing')}
          >
            Pruebas
          </button>
          <button 
            className={activeSection === 'simulation' ? 'active' : ''}
            onClick={() => setActiveSection('simulation')}
          >
            Simulación
          </button>
        </div>

        {activeSection === 'data-creation' && (
          <div className="data-creation-section">
            <h2>Crear CSV de Datos para Entrenamiento</h2>
            
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
            )}

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
              disabled={!formData.fecha}
            >
              Crear CSV de Entrenamiento
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
            <h2>Entrenamiento del Modelo</h2>
            
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
                >
                  {trainingStatus === 'training' ? 'Entrenando...' : 'Iniciar Entrenamiento'}
                </button>

                {trainingStatus === 'training' && (
                  <div className="training-progress">
                    <div 
                      className="progress-bar"
                      style={{ width: `${trainingProgress}%` }}
                    ></div>
                    <p>Progreso: {trainingProgress}%</p>
                  </div>
                )}

                <TrainingVisualization
                  trainingStatus={trainingStatus}
                  trainingProgress={trainingProgress}
                  trainingData={v3Data}
                />
              </div>
            )}
          </div>
        )}

        {activeSection === 'testing' && (
          <div className="testing-section">
            <h2>Pruebas del Modelo</h2>
            
            <div className="test-upload">
              <label htmlFor="testCsv">Cargar CSV de pruebas (diferente al de entrenamiento):</label>
              <input
                type="file"
                id="testCsv"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files[0]) {
                    handleRunTests(e.target.files[0]);
                  }
                }}
              />
              <small>El archivo debe tener el mismo formato que el CSV de entrenamiento</small>
            </div>

            {testResults && (
              <div className="test-results">
                <h3>Resultados de las Pruebas</h3>
                <div className="results-grid">
                  <div className="result-item">
                    <label>Precisión:</label>
                    <span className="metric-value accuracy">{testResults.accuracy}%</span>
                  </div>
                  <div className="result-item">
                    <label>Recall:</label>
                    <span className="metric-value">{testResults.recall}%</span>
                  </div>
                  <div className="result-item">
                    <label>F1-Score:</label>
                    <span className="metric-value">{testResults.f1Score}%</span>
                  </div>
                  <div className="result-item">
                    <label>Operaciones Exitosas:</label>
                    <span className="metric-value">{testResults.successfulOperations}</span>
                  </div>
                  <div className="result-item">
                    <label>Operaciones Totales:</label>
                    <span className="metric-value">{testResults.totalOperations}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'simulation' && (
          <div className="simulation-section">
            <h2>Simulación de Trading</h2>
            <p>Configure los parámetros para la simulación de trading.</p>
            
            <div className="form-group">
              <label htmlFor="simulationDays">Duración de la simulación (días):</label>
              <input type="number" id="simulationDays" defaultValue="30" />
            </div>
            <div className="form-group">
              <label htmlFor="initialBalance">Balance inicial (USDT):</label>
              <input type="number" id="initialBalance" defaultValue="1000" />
            </div>
            <div className="form-group">
              <label htmlFor="simulationInterval">Intervalo de datos:</label>
              <select id="simulationInterval">
                <option value="1h">1 hora</option>
                <option value="4h">4 horas</option>
                <option value="1d">1 día</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="riskTolerance">Tolerancia al riesgo:</label>
              <select id="riskTolerance">
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <button onClick={handleStartSimulation}>Iniciar Simulación</button>

            {simulationResults && (
              <div className="simulation-results">
                <h3>Resultados de la Simulación</h3>
                <p>Ganancia Total: {simulationResults.totalProfitUsdt} USDT</p>
                <p>Operaciones Exitosas: {simulationResults.successfulOperations}</p>
                <p>Operaciones Totales: {simulationResults.totalOperations}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


export default TrainingPage;

