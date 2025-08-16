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
  const [activeSection, setActiveSection] = useState('ai-model-test');
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

  // Estados para pruebas del modelo AI
  const [aiTestType, setAiTestType] = useState('comprehensive');
  const [aiTestStatus, setAiTestStatus] = useState('idle');
  const [aiTestProgress, setAiTestProgress] = useState(0);
  const [aiTestResults, setAiTestResults] = useState(null);
  const [aiTestError, setAiTestError] = useState(null);
  const [aiModelStatus, setAiModelStatus] = useState(null);
  const [isRunningAiTest, setIsRunningAiTest] = useState(false);
  const [aiTestStartTime, setAiTestStartTime] = useState(null);
  const [aiTestFilename, setAiTestFilename] = useState(null);
  
  // Estados para operaciones de test
  const [testOperations, setTestOperations] = useState([]);
  const [testMessageReceived, setTestMessageReceived] = useState(false);

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
          if (files.length > 0) {
            const firstFile = files[0];
            const fileName = typeof firstFile === 'object' ? firstFile.filename || firstFile.name || firstFile.value : firstFile;
            setSelectedCsv(fileName);
          }
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
            } else if (files.length > 0) {
                const firstFile = files[0];
                const fileName = typeof firstFile === 'object' ? firstFile.filename || firstFile.name || firstFile.value : firstFile;
                setSelectedCsv(fileName);
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

    // Enviar comando con verificación de éxito - incluir ruta completa
    const fullCsvPath = `D:/\ProyectosTrade/\simos/\sebo/\src/\data/\csv_exports/\"${selectedCsv}"`;
    const success = sendV3Command('start_ai_test', {
      csv_filename: fullCsvPath
    });

    if (!success) {
      console.error("Error enviando comando de prueba");
      setTestStatus('idle');
      setTestError('Error de conexión al enviar comando de prueba');
      alert("Error: No se pudo enviar el comando de prueba. Verifique la conexión WebSocket.");
    }
  };

  // Función para detener pruebas normales
  const handleStopTest = () => {
    if (!sendV3Command) {
      alert("Error: No se puede enviar el comando a V3. Verifique la conexión.");
      return;
    }

    if (!['STARTING', 'IN_PROGRESS'].includes(testStatus)) {
      console.log('No hay pruebas en progreso para detener');
      return;
    }

    console.log('Deteniendo pruebas...');
    
    // Enviar comando para detener pruebas
    const success = sendV3Command('stop_test', {
      test_type: 'normal_test'
    });

    if (success) {
      setTestStatus('STOPPED');
      console.log('✅ Comando de detención de pruebas enviado exitosamente');
      alert('🛑 Pruebas detenidas');
      
      // Guardar estado detenido
      saveTestState({
        status: 'STOPPED',
        progress: testProgress,
        filename: testFilename,
        startTime: testStartTime,
        results: testResults,
        error: null
      });
    } else {
      console.error("Error enviando comando de detención de pruebas");
      alert("Error: No se pudo enviar el comando de detención. Verifique la conexión WebSocket.");
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
    
    // Procesar mensajes de confirmación de test
    if (v3Data.test_message_received) {
      console.log('📨 Mensaje de test recibido confirmado:', v3Data.test_message_received);
      setTestMessageReceived(true);
      setTimeout(() => setTestMessageReceived(false), 3000); // Ocultar después de 3 segundos
    }
    
    // Procesar progreso de pruebas
    if (v3Data.test_progress) {
      const { progress, current_operation, total_operations, current_balance } = v3Data.test_progress;
      console.log('📊 Progreso de prueba recibido:', { progress, current_operation, total_operations, current_balance });
      
      if (progress !== undefined) setTestProgress(progress);
      if (progress !== undefined && progress > 0) setTestStatus('IN_PROGRESS');
      
      // Si hay operación actual, agregarla a la lista
      if (current_operation) {
        setTestOperations(prev => {
          const updated = [...prev, current_operation];
          return updated.slice(-10); // Mantener últimas 10
        });
      }
    }
    
    // Procesar resultado final de pruebas
    if (v3Data.test_result) {
      const { total_operations, successful_operations, failed_operations, final_balance, initial_balance, total_profit_loss, operations_summary } = v3Data.test_result;
      console.log('🎯 Resultado final de prueba:', v3Data.test_result);
      
      setTestStatus('COMPLETED');
      setTestProgress(100);
      setTestResults({
        totalOperations: total_operations,
        successfulOperations: successful_operations,
        failedOperations: failed_operations,
        finalBalance: final_balance,
        initialBalance: initial_balance,
        totalProfitLoss: total_profit_loss,
        operationsSummary: operations_summary,
        ...v3Data.test_result
      });
      
      // Mostrar popup de éxito con datos relevantes
      alert(`🎉 ¡Pruebas Completadas!\n\n` +
            `Operaciones totales: ${total_operations}\n` +
            `Exitosas: ${successful_operations}\n` +
            `Fallidas: ${failed_operations}\n` +
            `Balance inicial: ${initial_balance} USDT\n` +
            `Balance final: ${final_balance} USDT\n` +
            `Ganancia/Pérdida total: ${total_profit_loss > 0 ? '+' : ''}${total_profit_loss} USDT`);
    }
    
    // Procesar operaciones individuales de test
    if (v3Data.test_operation_result) {
      const { operation, current_balance } = v3Data.test_operation_result;
      console.log('📤 Nueva operación de test recibida:', { operation, current_balance });
      
      if (operation) {
        setTestOperations(prev => {
          const updated = [...prev, { ...operation, current_balance }];
          return updated.slice(-10); // Mantener solo las últimas 10 operaciones
        });
      }
    }
    
    // Procesar inicio de pruebas
    if (v3Data.test_started) {
      const { config, initial_balance } = v3Data.test_started;
      console.log('🚀 Prueba iniciada:', { config, initial_balance });
      setTestStatus('IN_PROGRESS');
      setTestProgress(0);
      setTestResults(null);
      setTestError(null);
    }
    
    // Procesar detención de pruebas
    if (v3Data.test_stopped) {
      const { reason, final_balance } = v3Data.test_stopped;
      console.log('🛑 Prueba detenida:', { reason, final_balance });
      setTestStatus('STOPPED');
    }
    
    // Procesar errores de pruebas
    if (v3Data.test_error) {
      const { error } = v3Data.test_error;
      console.log('❌ Error en prueba:', error);
      setTestStatus('FAILED');
      setTestError(error);
      alert(`❌ Error en las Pruebas\n\nError: ${error}`);
    }
    
    // Procesar resumen de operaciones de test
    if (v3Data.test_operations_summary) {
      const { last_10_operations } = v3Data.test_operations_summary;
      console.log('📊 Resumen de operaciones de test:', last_10_operations);
      setTestOperations(last_10_operations || []);
    }
  }, [v3Data]);

  const renderTestResults = () => {
    if (!testResults) return null;
    
    return (
      <div style={{ marginTop: '20px' }}>
        <h4>Resultados de las Pruebas:</h4>
        
        {/* Resumen financiero */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #dee2e6'
        }}>
          <h5>💰 Resumen Financiero:</h5>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginTop: '10px'
          }}>
            <div>
              <strong>Balance Inicial:</strong>
              <div style={{ fontSize: '18px', color: '#6c757d', fontWeight: 'bold' }}>
                ${testResults.initialBalance || 0} USDT
              </div>
            </div>
            <div>
              <strong>Balance Final:</strong>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: (testResults.finalBalance || 0) > (testResults.initialBalance || 0) ? '#28a745' : '#dc3545'
              }}>
                ${testResults.finalBalance || 0} USDT
              </div>
            </div>
            <div>
              <strong>Ganancia/Pérdida Total:</strong>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: (testResults.totalProfitLoss || 0) > 0 ? '#28a745' : '#dc3545'
              }}>
                {(testResults.totalProfitLoss || 0) > 0 ? '+' : ''}${testResults.totalProfitLoss || 0} USDT
              </div>
            </div>
            <div>
              <strong>Porcentaje de Rendimiento:</strong>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: (testResults.totalProfitLoss || 0) > 0 ? '#28a745' : '#dc3545'
              }}>
                {testResults.initialBalance ?
                  `${((testResults.totalProfitLoss || 0) / testResults.initialBalance * 100).toFixed(2)}%` :
                  'N/A'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Métricas de operaciones */}
        <div style={{
          backgroundColor: '#e8f4fd',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #bee5eb'
        }}>
          <h5>📊 Métricas de Operaciones:</h5>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginTop: '10px'
          }}>
            <div>
              <strong>Total de Operaciones:</strong>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#495057' }}>
                {testResults.totalOperations || 0}
              </div>
            </div>
            <div>
              <strong>Operaciones Exitosas:</strong>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#28a745' }}>
                {testResults.successfulOperations || 0}
              </div>
            </div>
            <div>
              <strong>Operaciones Fallidas:</strong>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#dc3545' }}>
                {testResults.failedOperations || 0}
              </div>
            </div>
            <div>
              <strong>Tasa de Éxito:</strong>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#17a2b8' }}>
                {testResults.totalOperations ?
                  `${((testResults.successfulOperations || 0) / testResults.totalOperations * 100).toFixed(1)}%` :
                  'N/A'
                }
              </div>
            </div>
          </div>
        </div>

        {/* Métricas de precisión (si están disponibles) */}
        {(testResults.accuracy || testResults.recall || testResults.f1Score) && (
          <div style={{
            backgroundColor: '#fff3e0',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #ffcc80'
          }}>
            <h5>🎯 Métricas de Precisión del Modelo:</h5>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginTop: '10px'
            }}>
              {testResults.accuracy && (
                <div>
                  <strong>Precisión:</strong>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#28a745' }}>
                    {(testResults.accuracy * 100).toFixed(2)}%
                  </div>
                </div>
              )}
              {testResults.recall && (
                <div>
                  <strong>Recall:</strong>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#17a2b8' }}>
                    {(testResults.recall * 100).toFixed(2)}%
                  </div>
                </div>
              )}
              {testResults.f1Score && (
                <div>
                  <strong>F1-Score:</strong>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffc107' }}>
                    {(testResults.f1Score * 100).toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resumen de operaciones si está disponible */}
        {testResults.operationsSummary && testResults.operationsSummary.length > 0 && (
          <div style={{
            backgroundColor: '#ffffff',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #dee2e6'
          }}>
            <h5>📋 Resumen de Operaciones:</h5>
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              marginTop: '10px'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px'
              }}>
                <thead style={{ backgroundColor: '#e9ecef', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Símbolo</th>
                    <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'left' }}>Exchanges</th>
                    <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>Inversión</th>
                    <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>Take Profit</th>
                    <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>Stop Loss</th>
                    <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>% Beneficio</th>
                    <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.operationsSummary.map((operation, index) => (
                    <tr key={operation.operation_id || index} style={{
                      backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                    }}>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>
                        {operation.symbol}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', fontSize: '11px' }}>
                        <div style={{ color: '#28a745' }}>📈 {operation.exchange_buy}</div>
                        <div style={{ color: '#dc3545' }}>📉 {operation.exchange_sell}</div>
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 'bold' }}>
                        ${operation.investment_usdt || operation.investment || 0}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right', color: '#28a745' }}>
                        ${operation.take_profit || operation.sell_price_expected || operation.sell_price || 0}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right', color: '#dc3545' }}>
                        ${operation.stop_loss || operation.buy_price || 0}
                      </td>
                      <td style={{
                        padding: '8px',
                        border: '1px solid #dee2e6',
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: (operation.profit_percentage || operation.profit_loss_percentage || 0) > 0 ? '#28a745' : '#dc3545'
                      }}>
                        {(operation.profit_percentage || operation.profit_loss_percentage || 0) > 0 ? '+' : ''}
                        {(operation.profit_percentage || operation.profit_loss_percentage || 0).toFixed(2)}%
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          backgroundColor: operation.status === 'COMPLETED' ? '#d4edda' : '#f8d7da',
                          color: operation.status === 'COMPLETED' ? '#155724' : '#721c24'
                        }}>
                          {operation.status === 'COMPLETED' ? '✅' : '❌'} {operation.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 'bold' }}>
                        ${operation.current_balance || operation.balance_after || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detalles completos */}
        <details style={{ marginTop: '15px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            Ver detalles técnicos completos
          </summary>
          <pre style={{...preStyle, maxHeight: '400px', overflow: 'auto'}}>
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </details>
      </div>
    );
  };

  const possibleOperations = 0; // Placeholder

  // Función para ejecutar pruebas del modelo AI
  const handleRunAiTest = async () => {
    if (!selectedCsv) {
      alert('Por favor, seleccione un archivo CSV para las pruebas del modelo AI.');
      return;
    }

    if (!sendV3Command) {
      alert("Error: No se puede enviar el comando a V3. Verifique la conexión.");
      return;
    }

    if (isRunningAiTest || ['STARTING', 'IN_PROGRESS'].includes(aiTestStatus)) {
      console.log('Ya hay una prueba del modelo AI en progreso');
      return;
    }

    console.log(`Iniciando prueba del modelo AI con archivo: ${selectedCsv}`);
    const startTime = new Date();
    
    setIsRunningAiTest(true);
    setAiTestStatus('STARTING');
    setAiTestProgress(0);
    setAiTestResults(null);
    setAiTestError(null);
    setAiTestStartTime(startTime);
    setAiTestFilename(selectedCsv);

    // Enviar comando para ejecutar prueba del modelo AI - incluir ruta completa
    const fullCsvPath = `D:/\ProyectosTrade/\simos/\sebo\src/\data/\csv_exports/\"${selectedCsv}"`;
    const success = sendV3Command('start_ai_test', {
      csv_filename: fullCsvPath
    });

    if (!success) {
      console.error("Error enviando comando de prueba del modelo AI");
      setAiTestStatus('idle');
      setAiTestError('Error de conexión al enviar comando de prueba del modelo AI');
      setIsRunningAiTest(false);
      alert("Error: No se pudo enviar el comando de prueba del modelo AI. Verifique la conexión WebSocket.");
    }
  };

  // Función para detener pruebas del modelo AI
  const handleStopAiTest = () => {
    if (!sendV3Command) {
      alert("Error: No se puede enviar el comando a V3. Verifique la conexión.");
      return;
    }

    if (!['STARTING', 'IN_PROGRESS'].includes(aiTestStatus)) {
      console.log('No hay pruebas del modelo AI en progreso para detener');
      return;
    }

    console.log('Deteniendo pruebas del modelo AI...');
    
    // Enviar comando para detener pruebas
    const success = sendV3Command('stop_ai_test', {
      test_type: 'ai_model_test'
    });

    if (success) {
      setAiTestStatus('STOPPED');
      setIsRunningAiTest(false);
      console.log('✅ Comando de detención enviado exitosamente');
      alert('🛑 Pruebas del modelo AI detenidas');
    } else {
      console.error("Error enviando comando de detención");
      alert("Error: No se pudo enviar el comando de detención. Verifique la conexión WebSocket.");
    }
  };

  // Función para obtener estado del modelo AI
  const handleGetModelStatus = async () => {
    if (!sendV3Command) {
      alert("Error: No se puede enviar el comando a V3. Verifique la conexión.");
      return;
    }

    console.log('Solicitando estado del modelo AI...');
    const success = sendV3Command('get_ai_model_status');

    if (!success) {
      console.error("Error enviando comando para obtener estado del modelo AI");
      alert("Error: No se pudo obtener el estado del modelo AI. Verifique la conexión WebSocket.");
    }
  };

  // Procesar respuestas del modelo AI - integrado con el useEffect principal
  useEffect(() => {
    if (!v3Data) return;

    // Procesar mensajes de prueba del modelo AI (mismo formato que las pruebas normales)
    if (v3Data.ai_test_update) {
      const { progress, status, results, error, filepath } = v3Data.ai_test_update;
      
      console.log('🤖 Procesando actualización de prueba del modelo AI:', { status, progress, filepath });
      
      // Actualizar estados del modelo AI
      if (progress !== undefined) setAiTestProgress(progress);
      if (status) setAiTestStatus(status);
      if (filepath) setAiTestFilename(filepath);

      if (status === 'COMPLETED') {
        setAiTestResults(results);
        setAiTestError(null);
        setIsRunningAiTest(false);
        console.log('✅ Pruebas del modelo AI completadas exitosamente');
        
        // Mostrar popup de éxito
        alert(`🎉 ¡Pruebas del Modelo AI Completadas!\n\n` +
              `Archivo: ${filepath || aiTestFilename}\n` +
              `Progreso: 100%\n` +
              `Estado: Completado\n\n` +
              `Las pruebas del modelo AI han sido ejecutadas correctamente.`);
        
      } else if (status === 'FAILED') {
        setAiTestResults(null);
        setAiTestError(error || 'Ocurrió un error desconocido durante las pruebas del modelo AI.');
        setIsRunningAiTest(false);
        console.error('❌ Error en pruebas del modelo AI:', error);
        
        // Mostrar popup de error
        alert(`❌ Error en las Pruebas del Modelo AI\n\n` +
              `Archivo: ${filepath || aiTestFilename}\n` +
              `Error: ${error || 'Error desconocido'}\n\n` +
              `Por favor, revisa los datos e intenta nuevamente.`);
      }
    }

    // Procesar estado del modelo AI
    if (v3Data.ai_model_status) {
      console.log('📊 Estado del modelo AI recibido:', v3Data.ai_model_status);
      setAiModelStatus(v3Data.ai_model_status);
    }
  }, [v3Data, aiTestStatus, aiTestProgress, aiTestFilename]);

  const renderAiTestResults = () => {
    if (!aiTestResults) return null;

    return (
      <div style={{ marginTop: '20px' }}>
        <h4>Resultados de las Pruebas del Modelo AI:</h4>
        
        {/* Métricas principales */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px',
          marginTop: '10px',
          marginBottom: '20px'
        }}>
          <div>
            <label>Precisión:</label>
            <span style={{ marginLeft: '5px', fontWeight: 'bold', color: '#28a745' }}>
              {aiTestResults.accuracy ? `${aiTestResults.accuracy}%` : 'N/A'}
            </span>
          </div>
          <div>
            <label>Recall:</label>
            <span style={{ marginLeft: '5px', fontWeight: 'bold', color: '#17a2b8' }}>
              {aiTestResults.recall ? `${aiTestResults.recall}%` : 'N/A'}
            </span>
          </div>
          <div>
            <label>F1-Score:</label>
            <span style={{ marginLeft: '5px', fontWeight: 'bold', color: '#ffc107' }}>
              {aiTestResults.f1Score ? `${aiTestResults.f1Score}%` : 'N/A'}
            </span>
          </div>
          <div>
            <label>Operaciones Exitosas:</label>
            <span style={{ marginLeft: '5px', fontWeight: 'bold' }}>
              {aiTestResults.successfulOperations || 0}/{aiTestResults.totalOperations || 0}
            </span>
          </div>
        </div>

        {/* Métricas detalladas */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '15px'
        }}>
          <h5>📊 Métricas Detalladas:</h5>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '10px'
          }}>
            <div><strong>Verdaderos Positivos:</strong> {aiTestResults.truePositives || 0}</div>
            <div><strong>Falsos Positivos:</strong> {aiTestResults.falsePositives || 0}</div>
            <div><strong>Falsos Negativos:</strong> {aiTestResults.falseNegatives || 0}</div>
            <div><strong>Verdaderos Negativos:</strong> {aiTestResults.trueNegatives || 0}</div>
            <div><strong>Ganancia Promedio Predicha:</strong> {aiTestResults.avgPredictedProfit ? `${aiTestResults.avgPredictedProfit} USDT` : 'N/A'}</div>
            <div><strong>Ganancia Promedio Real:</strong> {aiTestResults.avgActualProfit ? `${aiTestResults.avgActualProfit} USDT` : 'N/A'}</div>
          </div>
        </div>

        {/* Muestra de predicciones */}
        {aiTestResults.predictions_sample && aiTestResults.predictions_sample.length > 0 && (
          <div style={{
            backgroundColor: '#e8f4fd',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '15px'
          }}>
            <h5>🔍 Muestra de Predicciones (Primeras 10):</h5>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#dee2e6' }}>
                    <th style={{ padding: '8px', border: '1px solid #ccc' }}>Símbolo</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc' }}>Predicho</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc' }}>Real</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc' }}>Correcto</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc' }}>Confianza</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc' }}>Ganancia Pred.</th>
                    <th style={{ padding: '8px', border: '1px solid #ccc' }}>Ganancia Real</th>
                  </tr>
                </thead>
                <tbody>
                  {aiTestResults.predictions_sample.map((pred, index) => (
                    <tr key={index}>
                      <td style={{ padding: '8px', border: '1px solid #ccc' }}>{pred.symbol}</td>
                      <td style={{ padding: '8px', border: '1px solid #ccc', color: pred.predicted ? '#28a745' : '#dc3545' }}>
                        {pred.predicted ? '✅' : '❌'}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #ccc', color: pred.actual ? '#28a745' : '#dc3545' }}>
                        {pred.actual ? '✅' : '❌'}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #ccc', color: pred.correct ? '#28a745' : '#dc3545' }}>
                        {pred.correct ? '✅' : '❌'}
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #ccc' }}>{(pred.confidence * 100).toFixed(1)}%</td>
                      <td style={{ padding: '8px', border: '1px solid #ccc' }}>{pred.predicted_profit.toFixed(4)}</td>
                      <td style={{ padding: '8px', border: '1px solid #ccc' }}>{pred.actual_profit.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detalles completos */}
        <details style={{ marginTop: '15px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            Ver detalles completos
          </summary>
          <pre style={{...preStyle, maxHeight: '400px', overflow: 'auto'}}>
            {JSON.stringify(aiTestResults, null, 2)}
          </pre>
        </details>
      </div>
    );
  };

  const renderModelStatus = () => {
    if (!aiModelStatus) return null;

    return (
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #dee2e6'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Estado Actual del Modelo AI</h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '10px'
        }}>
          <div>
            <strong>Estado:</strong> {aiModelStatus.model_info?.is_trained ? '✅ Entrenado' : '❌ No Entrenado'}
          </div>
          <div>
            <strong>Características:</strong> {aiModelStatus.model_info?.feature_count || 0}
          </div>
          <div>
            <strong>Umbral de Confianza:</strong> {aiModelStatus.model_info?.confidence_threshold || 'N/A'}
          </div>
          {aiModelStatus.model_info?.training_history?.last_training && (
            <div>
              <strong>Último Entrenamiento:</strong> {new Date(aiModelStatus.model_info.training_history.last_training).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="test-page">
      <h2>Pruebas del Modelo</h2>
      <div className="section-tabs">
        <button className={activeSection === 'ai-model-test' ? 'active' : ''} onClick={() => setActiveSection('ai-model-test')}>Pruebas del Modelo AI</button>
        <button className={activeSection === 'data-creation' ? 'active' : ''} onClick={() => setActiveSection('data-creation')}>Creación de Datos de Prueba</button>
        <button className={activeSection === 'testing' ? 'active' : ''} onClick={() => setActiveSection('testing')}>Pruebas de Datos</button>
      </div>

      {activeSection === 'ai-model-test' && (
        <div className="ai-model-test-section">
          <h3>Pruebas del Modelo de IA</h3>
          
          <div style={{
            backgroundColor: '#e8f4fd',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #bee5eb'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#0c5460' }}>
              🧪 Pruebas del Modelo AI
            </h4>
            <p style={{ margin: '0', color: '#495057' }}>
              Ejecuta pruebas del modelo de IA cargando datos desde archivos CSV de entrenamiento.
              El modelo evaluará cada oportunidad y generará métricas de precisión y rendimiento.
            </p>
          </div>

          {/* Estado del modelo */}
          {renderModelStatus()}

          {/* Información de las pruebas actuales */}
          {(aiTestStatus !== 'idle' || aiTestFilename) && (
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #dee2e6'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>Estado de las Pruebas del Modelo AI</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div><strong>Archivo:</strong> {aiTestFilename || 'N/A'}</div>
                <div><strong>Estado:</strong> {aiTestStatus}</div>
                <div><strong>Progreso:</strong> {aiTestProgress.toFixed(1)}%</div>
                {aiTestStartTime && (
                  <div><strong>Iniciado:</strong> {aiTestStartTime.toLocaleTimeString()}</div>
                )}
              </div>
            </div>
          )}

          {/* Controles de prueba */}
          <div style={controlGroupStyle}>
            <label htmlFor="csv-select-ai" style={{ marginRight: '10px' }}>Datos de Prueba:</label>
            <select
              id="csv-select-ai"
              value={selectedCsv}
              onChange={(e) => setSelectedCsv(e.target.value)}
              style={{ ...inputStyle, minWidth: '300px' }}
              disabled={csvFiles.length === 0 || ['STARTING', 'IN_PROGRESS'].includes(aiTestStatus)}
            >
              {csvFiles.length > 0 ? (
                csvFiles.map((file, index) => (
                  <option key={`csv-ai-${index}-${typeof file === 'object' ? file.filename || file.name : file}`}
                          value={typeof file === 'object' ? file.filename || file.name || file.value : file}>
                    {typeof file === 'object' ? file.filename || file.name || file.value : file}
                  </option>
                ))
              ) : (
                <option key="no-csv-ai" value="">No hay archivos CSV disponibles</option>
              )}
            </select>
            
            <button
              onClick={handleRunAiTest}
              disabled={!selectedCsv || ['STARTING', 'IN_PROGRESS'].includes(aiTestStatus)}
              style={{
                ...buttonStyle,
                backgroundColor: ['STARTING', 'IN_PROGRESS'].includes(aiTestStatus) ? '#6c757d' : '#17a2b8',
                marginLeft: '10px'
              }}
            >
              {['STARTING', 'IN_PROGRESS'].includes(aiTestStatus)
                ? `Probando... (${aiTestProgress.toFixed(0)}%)`
                : 'Iniciar Pruebas del Modelo AI'
              }
            </button>

            {/* Botón para detener pruebas del modelo AI */}
            {['STARTING', 'IN_PROGRESS'].includes(aiTestStatus) && (
              <button
                onClick={handleStopAiTest}
                style={{
                  ...buttonStyle,
                  backgroundColor: '#dc3545',
                  marginLeft: '10px'
                }}
              >
                🛑 Detener Pruebas
              </button>
            )}

            <button
              onClick={handleGetModelStatus}
              style={{
                ...buttonStyle,
                backgroundColor: '#28a745',
                marginLeft: '10px'
              }}
            >
              Actualizar Estado
            </button>
          </div>

          {/* Estados de la prueba */}
          {aiTestStatus === 'STARTING' && (
            <div style={statusBoxStyle('IN_PROGRESS')}>
              <p>🚀 Iniciando pruebas del modelo AI...</p>
            </div>
          )}

          {aiTestStatus === 'IN_PROGRESS' && (
            <div className="ai-test-progress" style={{ marginTop: '20px' }}>
              <p>🤖 Pruebas del modelo AI en progreso: {aiTestProgress.toFixed(2)}%</p>
              <div style={{
                width: '100%',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden',
                height: '25px',
                position: 'relative'
              }}>
                <div style={{
                  width: `${aiTestProgress}%`,
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
                  {aiTestProgress > 10 && `${aiTestProgress.toFixed(0)}%`}
                </div>
              </div>
            </div>
          )}

          {aiTestStatus === 'FAILED' && aiTestError && (
            <div style={statusBoxStyle('FAILED')}>
              <p>❌ Error en las pruebas del modelo AI:</p>
              <p style={{ fontFamily: 'monospace', fontSize: '12px' }}>{aiTestError}</p>
            </div>
          )}

          {aiTestStatus === 'STOPPED' && (
            <div style={statusBoxStyle('STOPPED')}>
              <p>🛑 Pruebas del modelo AI detenidas por el usuario.</p>
              <p>Progreso alcanzado: {aiTestProgress.toFixed(1)}%</p>
              {aiTestResults && renderAiTestResults()}
            </div>
          )}

          {aiTestStatus === 'COMPLETED' && (
            <div style={statusBoxStyle('COMPLETED')}>
              <p>✅ Pruebas del modelo AI completadas exitosamente.</p>
              {renderAiTestResults()}
            </div>
          )}
          
          {/* Mostrar confirmación de mensaje recibido */}
          {testMessageReceived && (
            <div style={{
              backgroundColor: '#d4edda',
              color: '#155724',
              padding: '10px',
              borderRadius: '4px',
              margin: '10px 0',
              border: '1px solid #c3e6cb'
            }}>
              ✅ Mensaje de test recibido y procesado correctamente
            </div>
          )}
          
          {/* Mostrar operaciones de test en tiempo real */}
          {testOperations.length > 0 && (
            <div style={{
              marginTop: '20px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #dee2e6',
              overflow: 'hidden'
            }}>
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '10px 15px',
                borderBottom: '1px solid #dee2e6',
                fontWeight: 'bold',
                color: '#495057'
              }}>
                🔄 Operaciones de Test en Tiempo Real (Últimas {testOperations.length}/10)
              </div>
              
              <div style={{
                maxHeight: '500px',
                overflowY: 'auto',
                overflowX: 'auto'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '11px',
                  minWidth: '1000px'
                }}>
                  <thead style={{ backgroundColor: '#e9ecef', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'left', minWidth: '80px' }}>Símbolo</th>
                      <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'left', minWidth: '120px' }}>Exchanges</th>
                      <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', minWidth: '80px' }}>Inversión</th>
                      <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', minWidth: '80px' }}>Take Profit</th>
                      <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', minWidth: '80px' }}>Stop Loss</th>
                      <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', minWidth: '80px' }}>% Beneficio</th>
                      <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'center', minWidth: '80px' }}>Estado</th>
                      <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', minWidth: '80px' }}>Balance</th>
                      <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'center', minWidth: '80px' }}>Tiempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testOperations.map((operation, index) => (
                      <tr key={operation.operation_id || `${operation.symbol}_${index}`} style={{
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                      }}>
                        <td style={{ padding: '6px', border: '1px solid #dee2e6' }}>
                          <div style={{ fontWeight: 'bold', color: '#495057', fontSize: '12px' }}>
                            {operation.symbol}
                          </div>
                        </td>
                        
                        <td style={{ padding: '6px', border: '1px solid #dee2e6', fontSize: '10px' }}>
                          <div style={{ color: '#28a745', marginBottom: '2px' }}>
                            📈 {operation.exchange_buy}
                          </div>
                          <div style={{ color: '#dc3545' }}>
                            📉 {operation.exchange_sell}
                          </div>
                        </td>
                        
                        <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 'bold' }}>
                          ${operation.investment_usdt || operation.investment || 0}
                        </td>
                        
                        <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', color: '#28a745' }}>
                          ${(operation.take_profit || operation.sell_price_expected || operation.sell_price || 0).toFixed(4)}
                        </td>
                        
                        <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', color: '#dc3545' }}>
                          ${(operation.stop_loss || operation.buy_price || 0).toFixed(4)}
                        </td>
                        
                        <td style={{
                          padding: '6px',
                          border: '1px solid #dee2e6',
                          textAlign: 'right',
                          fontWeight: 'bold',
                          color: (operation.profit_percentage || operation.profit_loss_percentage || 0) > 0 ? '#28a745' : '#dc3545'
                        }}>
                          {(operation.profit_percentage || operation.profit_loss_percentage || 0) > 0 ? '+' : ''}
                          {(operation.profit_percentage || operation.profit_loss_percentage || 0).toFixed(2)}%
                        </td>
                        
                        <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 4px',
                            borderRadius: '8px',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            backgroundColor: operation.status === 'COMPLETED' ? '#d4edda' : '#f8d7da',
                            color: operation.status === 'COMPLETED' ? '#155724' : '#721c24'
                          }}>
                            {operation.status === 'COMPLETED' ? '✅' : '❌'} {operation.status}
                          </span>
                        </td>
                        
                        <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', fontWeight: 'bold' }}>
                          ${operation.current_balance || operation.balance_after || 0}
                        </td>
                        
                        <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'center', fontSize: '9px', color: '#6c757d' }}>
                          {new Date(operation.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{
                padding: '12px 15px',
                backgroundColor: '#f8f9fa',
                borderTop: '1px solid #dee2e6',
                fontSize: '12px',
                color: '#495057'
              }}>
                {/* Resumen de operaciones */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '15px',
                  marginBottom: '10px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '10px' }}>OPERACIONES</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      {testOperations.length}/10 Total
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#28a745', fontSize: '10px' }}>POSITIVAS</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#28a745' }}>
                      {testOperations.filter(op => (op.profit_percentage || op.profit_loss_percentage || 0) > 0).length}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#dc3545', fontSize: '10px' }}>NEGATIVAS</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc3545' }}>
                      {testOperations.filter(op => (op.profit_percentage || op.profit_loss_percentage || 0) < 0).length}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#17a2b8', fontSize: '10px' }}>PRECISIÓN</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#17a2b8' }}>
                      {testOperations.length > 0 ?
                        `${((testOperations.filter(op => (op.profit_percentage || op.profit_loss_percentage || 0) > 0).length / testOperations.length) * 100).toFixed(1)}%` :
                        '0%'
                      }
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '10px' }}>GANANCIA TOTAL</div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: testOperations.reduce((sum, op) => sum + (op.net_profit_usdt || 0), 0) > 0 ? '#28a745' : '#dc3545'
                    }}>
                      {testOperations.reduce((sum, op) => sum + (op.net_profit_usdt || 0), 0) > 0 ? '+' : ''}
                      ${testOperations.reduce((sum, op) => sum + (op.net_profit_usdt || 0), 0).toFixed(2)}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '10px' }}>% GANANCIA FINAL</div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: (() => {
                        const initialBalance = testOperations.length > 0 ? (testOperations[0].current_balance || 1000) - (testOperations[0].net_profit_usdt || 0) : 1000;
                        const totalProfit = testOperations.reduce((sum, op) => sum + (op.net_profit_usdt || 0), 0);
                        return totalProfit > 0 ? '#28a745' : '#dc3545';
                      })()
                    }}>
                      {(() => {
                        const initialBalance = testOperations.length > 0 ? (testOperations[0].current_balance || 1000) - (testOperations[0].net_profit_usdt || 0) : 1000;
                        const totalProfit = testOperations.reduce((sum, op) => sum + (op.net_profit_usdt || 0), 0);
                        const percentage = initialBalance > 0 ? (totalProfit / initialBalance * 100) : 0;
                        return `${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%`;
                      })()}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: '#6c757d', fontSize: '10px' }}>BALANCE ACTUAL</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#495057' }}>
                      ${testOperations.length > 0 ?
                        (testOperations[testOperations.length - 1].current_balance || 0).toFixed(2) :
                        '0.00'
                      } USDT
                    </div>
                  </div>
                </div>
                
                {/* Línea separadora */}
                <div style={{
                  borderTop: '1px solid #dee2e6',
                  paddingTop: '8px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#6c757d'
                }}>
                  Última actualización: {testOperations.length > 0 ? new Date(testOperations[testOperations.length - 1].timestamp).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
                  {symbols.map((symbol, index) => (
                    <label key={`symbol-${index}-${symbol.id || symbol.name}`}>
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
                csvFiles.map((file, index) => (
                  <option key={`csv-test-${index}-${typeof file === 'object' ? file.filename || file.name : file}`}
                          value={typeof file === 'object' ? file.filename || file.name || file.value : file}>
                    {typeof file === 'object' ? file.filename || file.name || file.value : file}
                  </option>
                ))
              ) : (
                <option key="no-csv-test" value="">No hay archivos CSV disponibles</option>
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

            {/* Botón para detener pruebas normales */}
            {['STARTING', 'IN_PROGRESS'].includes(testStatus) && (
              <button
                onClick={handleStopTest}
                style={{
                  ...buttonStyle,
                  backgroundColor: '#dc3545',
                  marginLeft: '10px'
                }}
              >
                🛑 Detener Pruebas
              </button>
            )}
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

          {testStatus === 'STOPPED' && (
            <div style={statusBoxStyle('STOPPED')}>
              <p>🛑 Pruebas detenidas por el usuario.</p>
              <p>Progreso alcanzado: {testProgress.toFixed(1)}%</p>
              {testResults && renderTestResults()}
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
