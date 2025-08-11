import React, { useState, useEffect } from 'react';

const Simulation = ({
  simulationDuration,
  setSimulationDuration,
  handleRequest,
  simulationStatus,
  localSimulationStatus,
  sandboxSimulationStatus,
  realSimulationStatus,
  buttonStyle,
  inputStyle,
  controlGroupStyle,
  preStyle,
  statusBoxStyle,
  chartPlaceholderStyle,
  aiModelDetails,
}) => {
  // Estados locales para configuraciones (mantenemos estos para la UI)
  const [localConfig, setLocalConfig] = useState({
    initial_balance: 1000,
    time_between_transfers: 2,
    max_concurrent_operations: 3,
    success_rate: 85,
    investment_per_operation: 100
  });
  
  const [sandboxConfig, setSandboxConfig] = useState({
    initial_balance: 1000,
    investment_per_operation: 100
  });
  
  const [realConfig, setRealConfig] = useState({
    initial_balance: 1000,
    investment_per_operation: 50
  });

  // Función para manejar comandos de simulación
  const handleSimulationCommand = (command, mode, config = {}) => {
    const payload = {
      mode: mode,
      config: config
    };
    
    // Usar handleRequest que ya está configurado para enviar mensajes al WebSocket
    handleRequest(command, payload);
  };

  // Función para renderizar controles de configuración
  const renderConfigControls = (config, setConfig, title) => (
    <div style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
      <h4>{title}</h4>
      <div style={controlGroupStyle}>
        <label>
          Balance inicial (USDT):
          <input
            type="number"
            value={config.initial_balance}
            onChange={(e) => setConfig({...config, initial_balance: parseFloat(e.target.value)})}
            style={inputStyle}
            min="1"
          />
        </label>
        {config.time_between_transfers !== undefined && (
          <label>
            Tiempo entre transferencias (seg):
            <input
              type="number"
              value={config.time_between_transfers}
              onChange={(e) => setConfig({...config, time_between_transfers: parseFloat(e.target.value)})}
              style={inputStyle}
              min="0.5"
              step="0.5"
            />
          </label>
        )}
        {config.max_concurrent_operations !== undefined && (
          <label>
            Operaciones concurrentes:
            <input
              type="number"
              value={config.max_concurrent_operations}
              onChange={(e) => setConfig({...config, max_concurrent_operations: parseInt(e.target.value)})}
              style={inputStyle}
              min="1"
              max="10"
            />
          </label>
        )}
        {config.investment_per_operation !== undefined && (
          <label>
            Inversión por operación (USDT):
            <input
              type="number"
              value={config.investment_per_operation}
              onChange={(e) => setConfig({...config, investment_per_operation: parseFloat(e.target.value)})}
              style={inputStyle}
              min="1"
            />
          </label>
        )}
      </div>
    </div>
  );

  // Función para renderizar botones de control
  const renderSimulationControls = (mode, status, config, title, description) => {
    const isRunning = status.status === "STARTING" || status.status === "RUNNING";
    const isStopping = status.status === "STOPPING";
    
    return (
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h3>{title}</h3>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>{description}</p>
        
        <div style={controlGroupStyle}>
          <button
            onClick={() => handleSimulationCommand('start_simulation', mode, config)}
            style={{
              ...buttonStyle,
              backgroundColor: isRunning || isStopping ? '#6c757d' : '#28a745',
              cursor: isRunning || isStopping ? 'not-allowed' : 'pointer'
            }}
            disabled={isRunning || isStopping}
          >
            {isRunning ? 'Ejecutándose...' : 'Iniciar Simulación'}
          </button>
          
          <button
            onClick={() => handleSimulationCommand('stop_simulation', mode)}
            style={{
              ...buttonStyle,
              backgroundColor: !isRunning ? '#6c757d' : '#dc3545',
              cursor: !isRunning ? 'not-allowed' : 'pointer'
            }}
            disabled={!isRunning}
          >
            {isStopping ? 'Deteniendo...' : 'Detener'}
          </button>
        </div>
        
        {status.status !== 'IDLE' && (
          <div style={statusBoxStyle(status.status)}>
            <p>Estado: <strong>{status.status}</strong></p>
            {status.data && Object.keys(status.data).length > 0 && (
              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Ver detalles</summary>
                <pre style={{...preStyle, maxHeight: '150px', fontSize: '12px'}}>
                  {JSON.stringify(status.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>Simulaciones de Trading con IA</h2>
      
      {/* Simulación Interna V3 (existente) */}
      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
        <h3>Simulación Interna V3</h3>
        <div style={controlGroupStyle}>
          <label>Duración (min): 
            <input 
              type="number" 
              value={simulationDuration} 
              onChange={e => setSimulationDuration(parseInt(e.target.value))} 
              style={inputStyle} 
            />
          </label>
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

      {/* Simulación Local */}
      {renderConfigControls(localConfig, setLocalConfig, "Configuración Simulación Local")}
      {renderSimulationControls(
        'local',
        localSimulationStatus,
        localConfig,
        '🖥️ Simulación Local',
        'Simulación paso a paso con datos del socket. Usa datos emitidos por sebo/ y simula operaciones localmente.'
      )}

      {/* Simulación Sandbox */}
      {renderConfigControls(sandboxConfig, setSandboxConfig, "Configuración Simulación Sandbox")}
      {renderSimulationControls(
        'sebo_sandbox',
        sandboxSimulationStatus,
        sandboxConfig,
        '🧪 Simulación Sandbox',
        'Simulación usando la API sandbox de Sebo. Operaciones simuladas en el entorno de pruebas de los exchanges.'
      )}

      {/* Simulación Real */}
      {renderConfigControls(realConfig, setRealConfig, "Configuración Simulación Real")}
      {renderSimulationControls(
        'real',
        realSimulationStatus,
        realConfig,
        '💰 Simulación Real',
        '⚠️ CUIDADO: Operaciones con USDT reales. Solo usar con cantidades pequeñas para pruebas.'
      )}

      {/* Advertencia para simulación real */}
      <div style={{ 
        padding: '10px', 
        backgroundColor: '#fff3cd', 
        border: '1px solid #ffeaa7', 
        borderRadius: '4px',
        marginTop: '20px'
      }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
          <strong>⚠️ Advertencia:</strong> La simulación real utiliza fondos reales. 
          Asegúrate de configurar cantidades pequeñas para pruebas y ten en cuenta que puedes perder dinero.
        </p>
      </div>
    </div>
  );
};

export default Simulation;
