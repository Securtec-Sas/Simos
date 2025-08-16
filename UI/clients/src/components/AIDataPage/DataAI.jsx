import React, { useEffect, useRef, useCallback, useState } from 'react';

const DataAI = ({
  aiModelDetails: propAiModelDetails,
  isLoading,
  handleRequest,
  buttonStyle,
  headerStyle,
  sectionStyle,
}) => {
  // Estado local para mantener los datos del modelo AI
  const [localAiModelDetails, setLocalAiModelDetails] = useState(propAiModelDetails);
  
  // Ref para controlar el throttling de solicitudes
  const lastRequestTime = useRef(0);
  const requestThrottleMs = 10000; // 10 segundos entre solicitudes

  // Cargar datos del localStorage al montar el componente y solicitar datos automáticamente
  useEffect(() => {
    let shouldRequestData = true;
    
    try {
      const savedAiModelDetails = localStorage.getItem('dataAI_modelDetails');
      if (savedAiModelDetails) {
        const parsedData = JSON.parse(savedAiModelDetails);
        // Solo cargar si los datos son recientes (menos de 1 hora)
        if (parsedData.timestamp && (Date.now() - parsedData.timestamp) < 3600000) {
          setLocalAiModelDetails(parsedData.data);
          shouldRequestData = false; // No solicitar si tenemos datos recientes
          console.log('✅ Datos del modelo AI cargados desde localStorage en DataAI');
        }
      }
    } catch (error) {
      console.error('❌ Error cargando datos del localStorage en DataAI:', error);
    }
    
    // Solicitar datos automáticamente si no hay datos recientes
    if (shouldRequestData && handleRequest) {
      console.log('🔍 Solicitando datos del modelo AI automáticamente...');
      setTimeout(() => {
        handleRequest('get_ai_model_details');
      }, 1000); // Esperar 1 segundo para asegurar que la conexión esté lista
    }
  }, [handleRequest]);

  // Actualizar estado local cuando cambian las props
  useEffect(() => {
    if (propAiModelDetails) {
      setLocalAiModelDetails(propAiModelDetails);
      // Guardar en localStorage
      try {
        localStorage.setItem('dataAI_modelDetails', JSON.stringify({
          data: propAiModelDetails,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error guardando datos en localStorage desde DataAI:', error);
      }
    }
  }, [propAiModelDetails]);

  // Función throttled para manejar solicitudes
  const handleThrottledRequest = useCallback(() => {
    const now = Date.now();
    if (now - lastRequestTime.current < requestThrottleMs) {
      console.log('⏳ Solicitud throttled - esperando antes de la próxima solicitud');
      return;
    }
    
    lastRequestTime.current = now;
    console.log('📤 Enviando solicitud de detalles del modelo AI...');
    handleRequest('get_ai_model_details');
  }, [handleRequest]);

  // Usar datos locales o de props
  const aiModelDetails = localAiModelDetails || propAiModelDetails;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={headerStyle}>Gestión y Simulación del Modelo de IA (V3)</h1>

      <div style={sectionStyle}>
        <h2>Detalles del Modelo AI</h2>
        <button
          onClick={handleThrottledRequest}
          disabled={isLoading}
          style={{
            ...buttonStyle,
            backgroundColor: isLoading ? '#6c757d' : buttonStyle?.backgroundColor || '#007bff',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? 'Cargando...' : 'Actualizar Detalles'}
        </button>
        {isLoading && !aiModelDetails && <p>Solicitando datos del modelo...</p>}
        {aiModelDetails ? (
          <div style={{ marginTop: '10px' }}>
            <p><strong>Estado del Modelo:</strong> {aiModelDetails.is_trained ? '✅ Entrenado' : '❌ No Entrenado'}</p>
            {aiModelDetails.is_trained ? (
              <>
                <p><strong>Último Entrenamiento:</strong> {aiModelDetails.training_history?.last_training || 'N/A'}</p>
                <p><strong>Número de Características:</strong> {aiModelDetails.feature_count || 0}</p>
                <p><strong>Umbral de Confianza:</strong> {aiModelDetails.confidence_threshold || 'No definido'}</p>
                
                {/* Mostrar resultados de entrenamiento si están disponibles */}
                {aiModelDetails.training_history?.results && (
                  <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '5px' }}>
                    <h4>📊 Métricas del Modelo:</h4>
                    {Object.entries(aiModelDetails.training_history.results).map(([key, value]) => (
                      <p key={key} style={{ margin: '5px 0' }}>
                        <strong>{key.replace(/_/g, ' ').toUpperCase()}:</strong> {
                          typeof value === 'number' ? value.toFixed(4) : value
                        }
                      </p>
                    ))}
                  </div>
                )}
                
                {/* Aquí se pueden agregar más detalles o gráficos de importancia de características, precisión, etc. */}
              </>
            ) : <p>⚠️ El modelo necesita ser entrenado para mostrar más detalles.</p>
            }
          </div>
        ) : (
          !isLoading && <p>❓ No hay datos del modelo disponibles. Presiona "Actualizar".</p>
        )}
      </div>
    </div>
  );
};

export default DataAI;
