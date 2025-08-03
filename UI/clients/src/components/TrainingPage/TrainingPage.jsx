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
        const response = await fetch('/api/sebo/symbols');
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
    try {
      const payload = {
        fecha: formData.fecha,
        operaciones: formData.operaciones || calculatePossibleOperations(),
        cantidadSimbolos: formData.symbolSelectionType === 'cantidad' ? parseInt(formData.cantidadSimbolos) : null,
        listaSimbolos: formData.symbolSelectionType === 'lista' ? formData.listaSimbolos : [],
        intervalo: formData.intervalo
      };

      const response = await fetch('/api/v3/create-training-csv', {
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

  const handleRunTests = async (testCsvFile) => {
    try {
      const formData = new FormData();
      formData.append('testCsv', testCsvFile);

      const response = await fetch('/api/v3/run-tests', {
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

      const response = await fetch('/api/v3/start-simulation', {
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
    if (v3Data && v3Data.type === 'training_progress') {
      setTrainingProgress(v3Data.payload.progress);
      if (v3Data.payload.completed) {
        setTrainingStatus('completed');
      }
    }
    
    if (v3Data && v3Data.type === 'simulation_complete') {
      setSimulationResults(v3Data.payload.results);
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
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${trainingProgress}%` }}
                      ></div>
                    </div>
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
                    <label>Operaciones exitosas:</label>
                    <span className="metric-value">{testResults.successfulOperations}/{testResults.totalOperations}</span>
                  </div>
                </div>
                
                <div className="test-summary">
                  <h4>Resumen de Pruebas</h4>
                  <p>
                    El modelo procesó {testResults.totalOperations} operaciones de prueba, 
                    de las cuales {testResults.successfulOperations} fueron predichas correctamente.
                  </p>
                  <p>
                    Esto representa una precisión del {testResults.accuracy}% en datos no vistos durante el entrenamiento.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'simulation' && (
          <div className="simulation-section">
            <h2>Simulación del Modelo</h2>
            
            <div className="simulation-config">
              <h3>Configuración de Simulación</h3>
              
              <div className="config-grid">
                <div className="form-group">
                  <label htmlFor="simulationDays">Duración (días):</label>
                  <input
                    type="number"
                    id="simulationDays"
                    min="1"
                    max="30"
                    defaultValue="7"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="initialBalance">Balance inicial (USDT):</label>
                  <input
                    type="number"
                    id="initialBalance"
                    min="100"
                    max="10000"
                    defaultValue="1000"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="simulationInterval">Intervalo:</label>
                  <select id="simulationInterval" defaultValue="1h">
                    <option value="5m">5 minutos</option>
                    <option value="15m">15 minutos</option>
                    <option value="30m">30 minutos</option>
                    <option value="1h">1 hora</option>
                    <option value="4h">4 horas</option>
                    <option value="1d">1 día</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="riskTolerance">Tolerancia al riesgo:</label>
                  <select id="riskTolerance" defaultValue="medium">
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              </div>
              
              <button 
                className="start-simulation-btn"
                onClick={handleStartSimulation}
                disabled={!csvData}
              >
                Iniciar Simulación
              </button>
              
              {!csvData && (
                <p className="warning-text">
                  Debe entrenar el modelo antes de ejecutar simulaciones
                </p>
              )}
            </div>
            
            {simulationResults && (
              <div className="simulation-results">
                <h3>Resultados de Simulación</h3>
                
                <div className="results-summary">
                  <div className="summary-grid">
                    <div className="summary-item profit">
                      <label>Ganancia Total:</label>
                      <span>{simulationResults.total_profit?.toFixed(2)} USDT</span>
                    </div>
                    <div className="summary-item roi">
                      <label>ROI:</label>
                      <span>{simulationResults.roi_percentage}%</span>
                    </div>
                    <div className="summary-item operations">
                      <label>Operaciones:</label>
                      <span>{simulationResults.total_operations}</span>
                    </div>
                    <div className="summary-item success-rate">
                      <label>Tasa de Éxito:</label>
                      <span>{simulationResults.success_rate}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="simulation-chart">
                  <h4>Evolución del Balance</h4>
                  <div className="chart-placeholder">
                    {/* Aquí se mostraría un gráfico de la evolución del balance */}
                    <p>Gráfico de evolución del balance durante la simulación</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingPage;

