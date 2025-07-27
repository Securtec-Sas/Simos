import React from 'react';

const Simulation = ({
  simulationDuration,
  setSimulationDuration,
  handleRequest,
  simulationStatus,
  buttonStyle,
  inputStyle,
  controlGroupStyle,
  preStyle,
  statusBoxStyle,
  chartPlaceholderStyle,
  aiModelDetails,
}) => {
  return (
    <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>Simulación de Trading con IA (Interna V3)</h2>
      <div style={controlGroupStyle}>
        <label>Duración (min): <input type="number" value={simulationDuration} onChange={e => setSimulationDuration(parseInt(e.target.value))} style={inputStyle} /></label>
        <button
          onClick={() => handleRequest('start_ai_simulation', { duration_minutes: simulationDuration })}
          style={{...buttonStyle, backgroundColor: '#17a2b8'}}
          disabled={simulationStatus.status === 'REQUESTED' || simulationStatus.status === 'STARTED' || simulationStatus.status === 'RUNNING' || (!aiModelDetails || !aiModelDetails.is_trained)}
        >
          Iniciar Simulación Interna
        </button>
      </div>
      {simulationStatus.status !== 'IDLE' && (
        <div style={statusBoxStyle(simulationStatus.status)}>
          <p>Estado de Simulación: <strong>{simulationStatus.status}</strong></p>
          {simulationStatus.data && Object.keys(simulationStatus.data).length > 0 && (
            <>
              <pre style={{...preStyle, maxHeight: '200px'}}>{JSON.stringify(simulationStatus.data, null, 2)}</pre>
              <div style={chartPlaceholderStyle}>
                Gráfica de Resultados de Simulación (ej: P&L vs Tiempo) iría aquí.
                <br />
                Datos disponibles en "simulationStatus.data".
              </div>
            </>
          )}
        </div>
      )}
      {aiModelDetails && !aiModelDetails.is_trained && <p style={{color: 'orange', marginTop:'5px'}}>El modelo necesita ser entrenado antes de poder iniciar una simulación.</p>}
    </div>
  );
};

export default Simulation;
