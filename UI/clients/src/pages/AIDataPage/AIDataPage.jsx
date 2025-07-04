// UI/clients/src/pages/AIDataPage/AIDataPage.jsx
import React, { useEffect, useState } from 'react';
// import styles from './AIDataPage.module.css'; // Descomentar si se crean estilos específicos

const AIDataPage = ({ v3Data, sendV3Command }) => {
  const [aiModelDetails, setAiModelDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Suponemos que los detalles del modelo AI vendrán en v3Data.ai_model_details
    // o un campo similar que se actualice vía WebSocket.
    if (v3Data && v3Data.ai_model_details) {
      setAiModelDetails(v3Data.ai_model_details);
      setIsLoading(false);
    }
  }, [v3Data]);

  const handleRefreshAIData = () => {
    if (sendV3Command) {
      console.log("UI: Requesting AI Model Details from V3.");
      setIsLoading(true);
      // El tipo de comando 'get_ai_model_details' es una suposición.
      // Deberá coincidir con lo que el backend V3 espera.
      sendV3Command('get_ai_model_details');
    } else {
      console.error("sendV3Command function not provided to AIDataPage");
      alert("Error: Cannot send command to V3.");
    }
  };

  // Estilos básicos (pueden moverse a un archivo .module.css)
  const pageStyle = { padding: '20px', fontFamily: 'Arial, sans-serif' };
  const headerStyle = { borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' };
  const sectionStyle = { marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '5px' };
  const preStyle = { backgroundColor: '#eee', padding: '10px', borderRadius: '4px', overflowX: 'auto' };
  const buttonStyle = { padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' };
  const loadingStyle = { fontStyle: 'italic'};

  return (
    <div style={pageStyle}>
      <h1 style={headerStyle}>Datos del Modelo de IA (V3)</h1>

      <button onClick={handleRefreshAIData} disabled={isLoading} style={buttonStyle}>
        {isLoading ? 'Cargando...' : 'Actualizar Datos del Modelo'}
      </button>

      {isLoading && !aiModelDetails && <p style={loadingStyle}>Solicitando datos del modelo al servidor...</p>}

      {aiModelDetails ? (
        <div style={sectionStyle}>
          <h2>Detalles del Modelo</h2>
          <pre style={preStyle}>{JSON.stringify(aiModelDetails, null, 2)}</pre>
        </div>
      ) : (
        !isLoading && <p>No hay datos del modelo de IA disponibles. Presiona "Actualizar" para solicitarlos.</p>
      )}

      {/* Aquí se podrían agregar más secciones para diferentes aspectos del modelo de IA */}
      {/* Por ejemplo:
        <div style={sectionStyle}>
          <h2>Métricas de Rendimiento</h2>
          {aiModelDetails && aiModelDetails.performance_metrics ? (
            <pre style={preStyle}>{JSON.stringify(aiModelDetails.performance_metrics, null, 2)}</pre>
          ) : (
            <p>No hay métricas de rendimiento disponibles.</p>
          )}
        </div>

        <div style={sectionStyle}>
          <h2>Estado del Entrenamiento</h2>
          {aiModelDetails && aiModelDetails.training_status ? (
            <p>{aiModelDetails.training_status}</p>
          ) : (
            <p>No hay información sobre el estado del entrenamiento.</p>
          )}
        </div>
      */}
    </div>
  );
};

export default AIDataPage;
