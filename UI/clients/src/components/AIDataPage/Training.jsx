import React, { useState, useEffect, useRef } from 'react';

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
  const [trainingStatus, setTrainingStatus] = useState('idle');
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingResults, setTrainingResults] = useState(null);
  const [trainingError, setTrainingError] = useState(null);
  const [trainingStartTime, setTrainingStartTime] = useState(null);
  const [trainingFilename, setTrainingFilename] = useState(null);
  const [trainingCompleted, setTrainingCompleted] = useState(false);

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
    // NO cargar estado guardado - solicitar estado actual desde V3
    console.log('📱 Página de entrenamiento cargada - solicitando estado actual');
    
    // Solicitar estado actual del entrenamiento desde V3 (solo una vez)
    if (sendV3Command) {
      console.log('🔍 Solicitando estado actual del entrenamiento...');
      sendV3Command('get_training_status');
    }
  }, [sendV3Command]);

  const handleStartTraining = async () => {
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
      const startTime = new Date();
      
      console.log('Iniciando entrenamiento directo...');
      
      setTrainingStatus('STARTING');
      setTrainingProgress(0);
      setTrainingResults(null);
      setTrainingError(null);
      setTrainingStartTime(startTime);
      setTrainingFilename('analysis_training_5m');

      // Guardar estado inicial en localStorage
      saveTrainingState({
        status: 'STARTING',
        progress: 0,
        filename: 'analysis_training_5m',
        startTime: startTime,
        results: null,
        error: null
      });

      // Enviar comando de entrenamiento con el archivo específico analysis_training_5m
      const success = sendV3Command('start_ai_training', {
        csv_filename: 'analysis_training_5m',
        csv_source: 'D:/\ProyectosTrade/\simos/\sebo/\src/\data/\csv_exports/',
        timestamp: startTime.toISOString()
      });

      if (!success) {
        console.error("Error enviando comando de entrenamiento");
        setTrainingStatus('idle');
        setTrainingError('Error de conexión al enviar comando de entrenamiento');
        alert("Error: No se pudo enviar el comando de entrenamiento. Verifique la conexión WebSocket.");
      }
    } catch (error) {
      console.error('Error iniciando entrenamiento:', error);
      alert(`Error: No se pudo iniciar el entrenamiento. ${error.message}`);
    }
  };

  // Ref para evitar procesamiento duplicado de mensajes de entrenamiento
  const lastTrainingMessage = useRef(null);

  useEffect(() => {
    if (!v3Data || trainingCompleted) return;

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
        setTrainingCompleted(true); // Marcar como completado para dejar de procesar mensajes
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
        setTrainingCompleted(true); // Marcar como completado para dejar de procesar mensajes
        console.error('❌ Error en entrenamiento:', error);
        
        // Mostrar popup de error
        alert(`❌ Error en el Entrenamiento\n\n` +
              `Archivo: ${filepath || trainingFilename}\n` +
              `Error: ${error || 'Error desconocido'}\n\n` +
              `Por favor, revisa los datos de entrenamiento e intenta nuevamente.`);
        
        // Limpiar estado después de un tiempo
        setTimeout(() => {
          clearTrainingState();
          setTrainingCompleted(false); // Permitir nuevo entrenamiento
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
        setTrainingCompleted(true); // Marcar como completado para dejar de procesar mensajes
        console.log('✅ Entrenamiento completado exitosamente (formato nuevo)');
      } else if (status === 'FAILED') {
        setTrainingResults(null);
        setTrainingError(error || 'Ocurrió un error desconocido durante el entrenamiento.');
        setTrainingCompleted(true); // Marcar como completado para dejar de procesar mensajes
        console.error('❌ Error en entrenamiento (formato nuevo):', error);
        
        // Mostrar popup de error para formato nuevo también
        alert(`❌ Error en el Entrenamiento\n\n` +
              `Archivo: ${filepath || trainingFilename}\n` +
              `Error: ${error || 'Error desconocido'}\n\n` +
              `Por favor, revisa los datos de entrenamiento e intenta nuevamente.`);
        
        // Limpiar estado después de un tiempo
        setTimeout(() => {
          clearTrainingState();
          setTrainingCompleted(false); // Permitir nuevo entrenamiento
        }, 10000);
      }
    }
  }, [v3Data, trainingStatus, trainingProgress, trainingFilename, trainingStartTime, trainingResults, trainingError]);

  const renderTrainingResults = () => {
    if (!trainingResults) return null;
    return (
      <div style={{ marginTop: '20px' }}>
        <h4>Resultados del Entrenamiento:</h4>
        <pre style={preStyle}>{JSON.stringify(trainingResults, null, 2)}</pre>
      </div>
    );
  };

  return (
    <div className="training-page">
      <h2>Entrenamiento del Modelo de IA</h2>
      
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
            <div><strong>Configuración:</strong> {trainingFilename || 'N/A'}</div>
            <div><strong>Estado:</strong> {trainingStatus}</div>
            <div><strong>Progreso:</strong> {trainingProgress.toFixed(1)}%</div>
            {trainingStartTime && (
              <div><strong>Iniciado:</strong> {trainingStartTime.toLocaleTimeString()}</div>
            )}
          </div>
        </div>
      )}

      {/* Descripción del entrenamiento */}
      <div style={{
        backgroundColor: '#e8f4fd',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #bee5eb'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#0c5460' }}>
          🤖 Entrenamiento con Archivos CSV
        </h4>
        <p style={{ margin: '0', color: '#495057' }}>
          El entrenamiento se realizará utilizando el archivo <strong>analysis_training_5m</strong>
          ubicado en la carpeta <strong>sebo/src/data/csv_exports</strong>. El modelo cargará
          automáticamente este archivo de datos de entrenamiento para optimizar sus predicciones
          de arbitraje con intervalos de 5 minutos.
        </p>
      </div>

      {/* Botón de entrenamiento */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '15px',
        marginTop: '20px',
        marginBottom: '20px'
      }}>
        <button
          onClick={handleStartTraining}
          disabled={['STARTING', 'IN_PROGRESS'].includes(trainingStatus)}
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

      {/* Estados del entrenamiento */}
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
  );
};

export default Training;
