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

  // Cargar datos del localStorage al montar el componente
  useEffect(() => {
    try {
      const savedAiModelDetails = localStorage.getItem('dataAI_modelDetails');
      if (savedAiModelDetails) {
        const parsedData = JSON.parse(savedAiModelDetails);
        // Solo cargar si los datos son recientes (menos de 1 hora)
        if (parsedData.timestamp && (Date.now() - parsedData.timestamp) < 3600000) {
          setLocalAiModelDetails(parsedData.data);
          console.log('Datos del modelo AI cargados desde localStorage en DataAI');
        }
      }
    } catch (error) {
      console.error('Error cargando datos del localStorage en DataAI:', error);
    }
  }, []);

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
      console.log('Solicitud throttled - esperando antes de la próxima solicitud');
      return;
    }
    
    lastRequestTime.current = now;
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
            <p><strong>Estado del Modelo:</strong> {aiModelDetails.is_trained ? 'Entrenado' : 'No Entrenado'}</p>
            {aiModelDetails.is_trained ? (
              <>
                <p><strong>Último Entrenamiento:</strong> {aiModelDetails.training_history?.last_training || 'N/A'}</p>
                <p><strong>Número de Características:</strong> {aiModelDetails.feature_count || 0}</p>
                <p><strong>Umbral de Confianza:</strong> {aiModelDetails.confidence_threshold || 'No definido'}</p>
                {/* Aquí se pueden agregar más detalles o gráficos de importancia de características, precisión, etc. */}
              </>
            ) : <p>El modelo necesita ser entrenado para mostrar más detalles.</p>
            }
          </div>
        ) : (
          !isLoading && <p>No hay datos del modelo disponibles. Presiona "Actualizar".</p>
        )}
      </div>
    </div>
  );
};

export default DataAI;
