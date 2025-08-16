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
  v3Data, // Agregar v3Data para recibir mensajes WebSocket
}) => {
  // Estados para operaciones de simulación
  const [simulationOperations, setSimulationOperations] = useState({
    local: [],
    sebo_sandbox: [],
    real: []
  });
  
  // Estados para confirmaciones de mensajes
  const [simulationMessageReceived, setSimulationMessageReceived] = useState({
    local: false,
    sebo_sandbox: false,
    real: false
  });
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

  // Procesar mensajes WebSocket de simulaciones
  useEffect(() => {
    if (!v3Data) {
      console.log('🔍 v3Data es null o undefined');
      return;
    }

    console.log('🔍 v3Data recibido en Simulation:', Object.keys(v3Data));

    // Procesar confirmación de mensaje de simulación recibido
    if (v3Data.simulation_message_received) {
      const { mode } = v3Data.simulation_message_received;
      console.log('📨 Confirmación de simulación recibida:', mode);
      
      setSimulationMessageReceived(prev => ({
        ...prev,
        [mode]: true
      }));
      
      // Ocultar confirmación después de 3 segundos
      setTimeout(() => {
        setSimulationMessageReceived(prev => ({
          ...prev,
          [mode]: false
        }));
      }, 3000);
    }

    // Procesar actualizaciones de simulación
    if (v3Data.simulation_update) {
      const { mode, status, progress, results } = v3Data.simulation_update;
      console.log('🔄 Actualización de simulación:', { mode, status, progress });
      
      // Aquí podrías actualizar estados específicos de simulación si es necesario
    }

    // Procesar resultados de operaciones individuales
    if (v3Data.simulation_operation_result) {
      const { mode, operation } = v3Data.simulation_operation_result;
      console.log('📤 Nueva operación de simulación:', { mode, operation });
      console.log('📤 Operación completa:', operation);
      
      setSimulationOperations(prev => {
        const newOperations = {
          ...prev,
          [mode]: [...(prev[mode] || []), operation].slice(-20) // Mantener últimas 20
        };
        console.log('📤 Estado actualizado de operaciones:', newOperations);
        return newOperations;
      });
    }

    // Procesar resumen de operaciones
    if (v3Data.simulation_operations_summary) {
      const { mode, operations } = v3Data.simulation_operations_summary;
      console.log('📊 Resumen de operaciones de simulación:', { mode, total: operations?.length || 0 });
      console.log('📊 Operaciones recibidas:', operations);
      
      setSimulationOperations(prev => {
        const newOperations = {
          ...prev,
          [mode]: operations || []
        };
        console.log('📊 Estado actualizado con resumen:', newOperations);
        return newOperations;
      });
    }

    // Procesar errores de simulación
    if (v3Data.simulation_error) {
      const { error, mode } = v3Data.simulation_error;
      console.error('❌ Error en simulación:', { mode, error });
      alert(`Error en simulación ${mode}: ${error}`);
    }
  }, [v3Data]);

  // Función para manejar comandos de simulación
  const handleSimulationCommand = (command, mode, config = {}) => {
    const payload = {
      mode: mode,
      config: config
    };
    
    // Usar handleRequest que ya está configurado para enviar mensajes al WebSocket
    handleRequest(command, payload);
  };

  // Función de prueba para generar operaciones simuladas localmente con datos completos
  const generateTestOperations = (mode) => {
    const testOperations = [
      {
        operation_id: `test_${Date.now()}_1`,
        symbol: "BTC/USDT",
        symbol_name: "BTCUSDT",
        
        // Exchanges
        exchange_buy: "binance",
        exchange_sell: "okx",
        exchange_buy_name: "Binance",
        exchange_sell_name: "OKX",
        
        // Precios
        buy_price: 45000.12345678,
        sell_price_expected: 45200.87654321,
        sell_price_actual: 45123.87654321,
        investment_usdt: 100,
        
        // Porcentajes
        profit_percentage_expected: 0.4456,
        profit_percentage_actual: 0.2745,
        profit_difference: -0.1711,
        
        // Ganancias
        gross_profit_usdt: 0.37,
        net_profit_usdt: 0.27,
        trading_fees_usdt: 0.08,
        withdrawal_fees_usdt: 0.02,
        
        // Estado
        status: "COMPLETED",
        status_detail: "Operación completada exitosamente",
        success: true,
        
        // Timing
        detection_time_seconds: 1.2,
        execution_time_seconds: 45.2,
        transfer_time_seconds: 120.5,
        total_time_seconds: 166.9,
        
        // Metadatos
        timestamp: new Date().toISOString(),
        simulation_type: "automated",
        risk_level: "medium",
        market_conditions: "favorable",
        liquidity_score: 0.85,
        slippage_percentage: 0.05,
        volume_24h_usdt: 15000000,
        order_book_depth: 1.2
      },
      {
        operation_id: `test_${Date.now()}_2`,
        symbol: "ETH/USDT",
        symbol_name: "ETHUSDT",
        
        // Exchanges
        exchange_buy: "kucoin",
        exchange_sell: "bybit",
        exchange_buy_name: "KuCoin",
        exchange_sell_name: "Bybit",
        
        // Precios
        buy_price: 2800.98765432,
        sell_price_expected: 2820.12345678,
        sell_price_actual: 2815.12345678,
        investment_usdt: 100,
        
        // Porcentajes
        profit_percentage_expected: 0.6834,
        profit_percentage_actual: 0.5045,
        profit_difference: -0.1789,
        
        // Ganancias
        gross_profit_usdt: 0.60,
        net_profit_usdt: 0.50,
        trading_fees_usdt: 0.07,
        withdrawal_fees_usdt: 0.03,
        
        // Estado
        status: "COMPLETED",
        status_detail: "Operación completada exitosamente",
        success: true,
        
        // Timing
        detection_time_seconds: 0.8,
        execution_time_seconds: 32.8,
        transfer_time_seconds: 95.3,
        total_time_seconds: 128.9,
        
        // Metadatos
        timestamp: new Date().toISOString(),
        simulation_type: "automated",
        risk_level: "medium",
        market_conditions: "neutral",
        liquidity_score: 0.92,
        slippage_percentage: 0.03,
        volume_24h_usdt: 8500000,
        order_book_depth: 1.5
      },
      {
        operation_id: `test_${Date.now()}_3`,
        symbol: "ADA/USDT",
        symbol_name: "ADAUSDT",
        
        // Exchanges
        exchange_buy: "gate",
        exchange_sell: "mexc",
        exchange_buy_name: "Gate.io",
        exchange_sell_name: "MEXC",
        
        // Precios
        buy_price: 0.45123456,
        sell_price_expected: 0.46234567,
        sell_price_actual: 0.44987654,
        investment_usdt: 100,
        
        // Porcentajes
        profit_percentage_expected: 2.4623,
        profit_percentage_actual: -0.3012,
        profit_difference: -2.7635,
        
        // Ganancias
        gross_profit_usdt: -0.40,
        net_profit_usdt: -0.50,
        trading_fees_usdt: 0.08,
        withdrawal_fees_usdt: 0.02,
        
        // Estado
        status: "FAILED",
        status_detail: "Operación falló - precio no alcanzado",
        success: false,
        
        // Timing
        detection_time_seconds: 2.1,
        execution_time_seconds: 78.5,
        transfer_time_seconds: 180.2,
        total_time_seconds: 260.8,
        
        // Metadatos
        timestamp: new Date().toISOString(),
        simulation_type: "automated",
        risk_level: "high",
        market_conditions: "volatile",
        liquidity_score: 0.65,
        slippage_percentage: 0.12,
        volume_24h_usdt: 2300000,
        order_book_depth: 0.8
      }
    ];

    console.log(`🧪 Generando ${testOperations.length} operaciones de prueba completas para modo: ${mode}`);
    
    setSimulationOperations(prev => ({
      ...prev,
      [mode]: [...(prev[mode] || []), ...testOperations].slice(-20)
    }));
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

  // Función para renderizar tabla de operaciones con datos completos
  const renderOperationsTable = (mode, operations) => {
    if (!operations || operations.length === 0) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#666',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          margin: '10px 0'
        }}>
          No hay operaciones de simulación {mode} aún
        </div>
      );
    }

    return (
      <div style={{
        marginTop: '15px',
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
          🔄 Operaciones de Simulación {mode.charAt(0).toUpperCase() + mode.slice(1)} (Últimas {operations.length})
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
            minWidth: '1200px'
          }}>
            <thead style={{ backgroundColor: '#e9ecef', position: 'sticky', top: 0 }}>
              <tr>
                <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'left', minWidth: '80px' }}>Símbolo</th>
                <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'left', minWidth: '120px' }}>Exchanges</th>
                <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', minWidth: '100px' }}>Precios</th>
                <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', minWidth: '80px' }}>Inversión</th>
                <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', minWidth: '100px' }}>% Esperado</th>
                <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', minWidth: '100px' }}>% Real</th>
                <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', minWidth: '100px' }}>Ganancia</th>
                <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'center', minWidth: '80px' }}>Estado</th>
                <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'center', minWidth: '80px' }}>Tiempo</th>
                <th style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'center', minWidth: '60px' }}>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((operation, index) => (
                <tr key={operation.operation_id || index} style={{
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                }}>
                  <td style={{ padding: '6px', border: '1px solid #dee2e6' }}>
                    <div style={{ fontWeight: 'bold', color: '#495057', fontSize: '12px' }}>
                      {operation.symbol}
                    </div>
                    <div style={{ fontSize: '9px', color: '#6c757d' }}>
                      {operation.risk_level || 'medium'}
                    </div>
                  </td>
                  
                  <td style={{ padding: '6px', border: '1px solid #dee2e6', fontSize: '10px' }}>
                    <div style={{ color: '#28a745', marginBottom: '2px' }}>
                      📈 {operation.exchange_buy || operation.exchange_buy_name}
                    </div>
                    <div style={{ color: '#dc3545' }}>
                      📉 {operation.exchange_sell || operation.exchange_sell_name}
                    </div>
                  </td>
                  
                  <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right', fontSize: '10px' }}>
                    <div style={{ color: '#28a745', fontWeight: 'bold' }}>
                      Compra: ${(operation.buy_price || 0).toFixed(4)}
                    </div>
                    <div style={{ color: '#6c757d' }}>
                      Esp: ${(operation.sell_price_expected || operation.sell_price || 0).toFixed(4)}
                    </div>
                    <div style={{ color: '#dc3545', fontWeight: 'bold' }}>
                      Real: ${(operation.sell_price_actual || operation.sell_price || 0).toFixed(4)}
                    </div>
                  </td>
                  
                  <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold' }}>
                      ${operation.investment_usdt}
                    </div>
                  </td>
                  
                  <td style={{
                    padding: '6px',
                    border: '1px solid #dee2e6',
                    textAlign: 'right',
                    color: '#6c757d',
                    fontWeight: 'bold'
                  }}>
                    {operation.profit_percentage_expected ?
                      `${operation.profit_percentage_expected > 0 ? '+' : ''}${operation.profit_percentage_expected}%` :
                      `${operation.profit_percentage > 0 ? '+' : ''}${operation.profit_percentage}%`
                    }
                  </td>
                  
                  <td style={{
                    padding: '6px',
                    border: '1px solid #dee2e6',
                    textAlign: 'right',
                    fontWeight: 'bold'
                  }}>
                    <div style={{
                      color: (operation.profit_percentage_actual || operation.profit_percentage) > 0 ? '#28a745' : '#dc3545'
                    }}>
                      {operation.profit_percentage_actual ?
                        `${operation.profit_percentage_actual > 0 ? '+' : ''}${operation.profit_percentage_actual}%` :
                        `${operation.profit_percentage > 0 ? '+' : ''}${operation.profit_percentage}%`
                      }
                    </div>
                    {operation.profit_difference && (
                      <div style={{
                        fontSize: '9px',
                        color: operation.profit_difference > 0 ? '#28a745' : '#dc3545'
                      }}>
                        ({operation.profit_difference > 0 ? '+' : ''}{operation.profit_difference}%)
                      </div>
                    )}
                  </td>
                  
                  <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                    <div style={{
                      color: operation.net_profit_usdt > 0 ? '#28a745' : '#dc3545',
                      fontWeight: 'bold'
                    }}>
                      {operation.net_profit_usdt > 0 ? '+' : ''}${operation.net_profit_usdt}
                    </div>
                    {operation.gross_profit_usdt && (
                      <div style={{ fontSize: '9px', color: '#6c757d' }}>
                        Bruto: ${operation.gross_profit_usdt}
                      </div>
                    )}
                    {operation.trading_fees_usdt && (
                      <div style={{ fontSize: '9px', color: '#dc3545' }}>
                        Fees: -${operation.trading_fees_usdt}
                      </div>
                    )}
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
                    {operation.status_detail && (
                      <div style={{ fontSize: '8px', color: '#6c757d', marginTop: '2px' }}>
                        {operation.status_detail.substring(0, 20)}...
                      </div>
                    )}
                  </td>
                  
                  <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'center', fontSize: '9px', color: '#6c757d' }}>
                    <div>{new Date(operation.timestamp).toLocaleTimeString()}</div>
                    {operation.total_time_seconds && (
                      <div style={{ marginTop: '2px' }}>
                        {operation.total_time_seconds}s
                      </div>
                    )}
                  </td>
                  
                  <td style={{ padding: '6px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                    <details>
                      <summary style={{
                        cursor: 'pointer',
                        fontSize: '10px',
                        color: '#007bff',
                        fontWeight: 'bold'
                      }}>
                        📊
                      </summary>
                      <div style={{
                        position: 'absolute',
                        zIndex: 1000,
                        backgroundColor: 'white',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        padding: '8px',
                        fontSize: '10px',
                        minWidth: '200px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                      }}>
                        <div><strong>ID:</strong> {operation.operation_id}</div>
                        {operation.detection_time_seconds && (
                          <div><strong>Detección:</strong> {operation.detection_time_seconds}s</div>
                        )}
                        {operation.execution_time_seconds && (
                          <div><strong>Ejecución:</strong> {operation.execution_time_seconds}s</div>
                        )}
                        {operation.market_conditions && (
                          <div><strong>Mercado:</strong> {operation.market_conditions}</div>
                        )}
                        {operation.liquidity_score && (
                          <div><strong>Liquidez:</strong> {(operation.liquidity_score * 100).toFixed(1)}%</div>
                        )}
                        {operation.slippage_percentage && (
                          <div><strong>Slippage:</strong> {operation.slippage_percentage}%</div>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{
          padding: '8px 15px',
          backgroundColor: '#f8f9fa',
          borderTop: '1px solid #dee2e6',
          fontSize: '12px',
          color: '#6c757d',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              Total: {operations.length} |
              Exitosas: {operations.filter(op => op.status === 'COMPLETED').length} |
              Fallidas: {operations.filter(op => op.status === 'FAILED').length}
            </div>
            <div>
              Ganancia Neta: ${operations.reduce((sum, op) => sum + (op.net_profit_usdt || 0), 0).toFixed(2)} USDT |
              Ganancia Bruta: ${operations.reduce((sum, op) => sum + (op.gross_profit_usdt || 0), 0).toFixed(2)} USDT |
              Fees Total: ${operations.reduce((sum, op) => sum + (op.trading_fees_usdt || 0) + (op.withdrawal_fees_usdt || 0), 0).toFixed(2)} USDT
            </div>
          </div>
        </div>
      </div>
    );
  };

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
        
        {/* Mostrar confirmación de mensaje recibido */}
        {simulationMessageReceived[mode] && (
          <div style={{
            backgroundColor: '#d4edda',
            color: '#155724',
            padding: '8px 12px',
            borderRadius: '4px',
            margin: '10px 0',
            border: '1px solid #c3e6cb',
            fontSize: '14px'
          }}>
            ✅ Mensaje de simulación {mode} recibido y procesado correctamente
          </div>
        )}
        
        {/* Mostrar tabla de operaciones */}
        {renderOperationsTable(mode, simulationOperations[mode])}
      </div>
    );
  };

  return (
    <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>Simulaciones de Trading con IA</h2>
      
      {/* Panel de Debug - Temporal para identificar problemas */}
      <div style={{
        marginBottom: '20px',
        padding: '10px',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        <h4>🔍 Debug Info (Temporal)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <strong>v3Data:</strong> {v3Data ? 'Conectado' : 'No conectado'}
            <br />
            <strong>Keys:</strong> {v3Data ? Object.keys(v3Data).join(', ') : 'N/A'}
          </div>
          <div>
            <strong>Operaciones Local:</strong> {simulationOperations.local?.length || 0}
            <br />
            <strong>Operaciones Sandbox:</strong> {simulationOperations.sebo_sandbox?.length || 0}
            <br />
            <strong>Operaciones Real:</strong> {simulationOperations.real?.length || 0}
          </div>
          <div>
            <strong>Confirmaciones:</strong>
            <br />
            Local: {simulationMessageReceived.local ? '✅' : '❌'}
            <br />
            Sandbox: {simulationMessageReceived.sebo_sandbox ? '✅' : '❌'}
            <br />
            Real: {simulationMessageReceived.real ? '✅' : '❌'}
          </div>
        </div>
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => generateTestOperations('local')}
            style={{
              ...buttonStyle,
              backgroundColor: '#17a2b8',
              fontSize: '11px',
              padding: '5px 10px'
            }}
          >
            🧪 Test Local
          </button>
          <button
            onClick={() => generateTestOperations('sebo_sandbox')}
            style={{
              ...buttonStyle,
              backgroundColor: '#28a745',
              fontSize: '11px',
              padding: '5px 10px'
            }}
          >
            🧪 Test Sandbox
          </button>
          <button
            onClick={() => generateTestOperations('real')}
            style={{
              ...buttonStyle,
              backgroundColor: '#dc3545',
              fontSize: '11px',
              padding: '5px 10px'
            }}
          >
            🧪 Test Real
          </button>
        </div>
        {v3Data && (
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Ver v3Data completo</summary>
            <pre style={{
              backgroundColor: '#f8f9fa',
              padding: '10px',
              borderRadius: '4px',
              maxHeight: '200px',
              overflow: 'auto',
              fontSize: '10px'
            }}>
              {JSON.stringify(v3Data, null, 2)}
            </pre>
          </details>
        )}
      </div>
      
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
