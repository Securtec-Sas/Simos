import React, { useEffect } from 'react';

const DataAI = ({
  aiModelDetails,
  isLoading,
  handleRequest,
  buttonStyle,
  headerStyle,
  sectionStyle,
}) => {
  // Eliminado: No solicitar automáticamente los detalles del modelo
  // Solo se solicitarán cuando el usuario haga clic en "Actualizar Detalles"

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={headerStyle}>Gestión y Simulación del Modelo de IA (V3)</h1>

      <div style={sectionStyle}>
        <h2>Detalles del Modelo AI</h2>
        <button onClick={() => handleRequest('get_ai_model_details')} disabled={isLoading} style={buttonStyle}>
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
