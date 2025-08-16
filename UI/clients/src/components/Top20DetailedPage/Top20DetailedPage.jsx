// UI/clients/src/components/Top20DetailedPage/Top20DetailedPage.jsx
import React, { useState, useEffect, useRef } from 'react';

// Utility function for deep comparison
const deepEqual = (obj1, obj2) => {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return false;
  
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (let key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
};

const Top20DetailedPage = ({ v3Data, sendV3Command }) => {
  const [opportunities, setOpportunities] = useState([]);
  const [tradingStatus, setTradingStatus] = useState('inactive');
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [autoTradingActive, setAutoTradingActive] = useState(false);
  const [currentOperations, setCurrentOperations] = useState([]);
  const [tradingStats, setTradingStats] = useState({
    total_operations: 0,
    successful_operations: 0,
    failed_operations: 0,
    total_profit_usdt: 0.0,
    current_balance: 1000.0
  });
  const [processingOpportunity, setProcessingOpportunity] = useState(null);
  const [operationLogs, setOperationLogs] = useState([]);
  const [tradingConfig, setTradingConfig] = useState({
    usdt_holder_exchange_id: 'binance',
    investment_mode: 'PERCENTAGE',
    investment_percentage: 10,
    fixed_investment_usdt: 100,
    max_concurrent_operations: 3,
    stop_loss_percentage: 50.0,
    take_profit_percentage: null
  });
  
  // Refs to store previous values for comparison
  const prevTop20DataRef = useRef();
  const prevSystemStatusRef = useRef();
  const autoTradingActiveRef = useRef(false);

  // Monitorear datos de top20 y estado de trading desde V3
  // Only update opportunities when top20_data actually changes
  useEffect(() => {
    if (v3Data) {
      // Check if top20_data has actually changed
      // Only update if the new data is a non-empty array to prevent flickering
      if (v3Data.top20_data && v3Data.top20_data.length > 0 && !deepEqual(v3Data.top20_data, prevTop20DataRef.current)) {
        setOpportunities(v3Data.top20_data.filter(op => op)); // Filter out nulls just in case
        prevTop20DataRef.current = v3Data.top20_data;
      }
      
      // Check if system_status has actually changed
      if (v3Data.system_status && !deepEqual(v3Data.system_status, prevSystemStatusRef.current)) {
        setTradingStatus(v3Data.system_status.trading_active ? 'active' : 'inactive');
        prevSystemStatusRef.current = v3Data.system_status;
      }
    }
  }, [v3Data]);

  // Función para agregar logs de operación
  const addOperationLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setOperationLogs(prev => [...prev.slice(-19), `[${timestamp}] ${message}`]);
  };

  // Función para actualizar estadísticas de trading
  const updateTradingStats = (success, profitUsdt) => {
    setTradingStats(prev => ({
      ...prev,
      total_operations: prev.total_operations + 1,
      successful_operations: success ? prev.successful_operations + 1 : prev.successful_operations,
      failed_operations: success ? prev.failed_operations : prev.failed_operations + 1,
      total_profit_usdt: prev.total_profit_usdt + profitUsdt,
      current_balance: prev.current_balance + profitUsdt
    }));
  };

  const startTrading = () => {
    if (sendV3Command) {
      sendV3Command('start_trading', { config: tradingConfig });
      setTradingStatus('starting');
    }
  };

  const stopTrading = () => {
    if (sendV3Command) {
      sendV3Command('stop_trading');
      setTradingStatus('stopping');
    }
  };

  // Función para iniciar trading automático secuencial
  const startAutoTrading = () => {
    setAutoTradingActive(true);
    autoTradingActiveRef.current = true;
    processOpportunitiesSequentially();
  };

  // Función para detener trading automático
  const stopAutoTrading = () => {
    setAutoTradingActive(false);
    autoTradingActiveRef.current = false;
    addOperationLog('Deteniendo trading automático...');
  };

  // Función para procesar oportunidades secuencialmente
  const processOpportunitiesSequentially = async () => {
    if (!opportunities || opportunities.length === 0) {
      addOperationLog('No hay oportunidades disponibles para procesar');
      setAutoTradingActive(false);
      autoTradingActiveRef.current = false;
      return;
    }

    addOperationLog('Iniciando procesamiento secuencial de oportunidades...');

    for (let i = 0; i < opportunities.length; i++) {
      if (!autoTradingActiveRef.current) {
        addOperationLog('Trading automático detenido por el usuario');
        break;
      }

      const opportunity = opportunities[i];
      setProcessingOpportunity(opportunity);
      addOperationLog(`Procesando oportunidad ${i + 1}/${opportunities.length}: ${opportunity.symbol}`);

      try {
        // Evaluar oportunidad con IA
        const aiEvaluation = await evaluateOpportunityWithAI(opportunity);
        
        if (aiEvaluation.should_execute) {
          addOperationLog(`✅ IA aprueba operación para ${opportunity.symbol} - Confianza: ${aiEvaluation.confidence}%`);
          
          // Ejecutar operación de arbitraje
          const result = await executeArbitrageOperation(opportunity, aiEvaluation);
          
          if (result.success) {
            addOperationLog(`🎉 Operación exitosa: ${result.profit_usdt.toFixed(4)} USDT de ganancia`);
            updateTradingStats(true, result.profit_usdt);
          } else {
            addOperationLog(`❌ Operación falló: ${result.error}`);
            updateTradingStats(false, 0);
          }
        } else {
          addOperationLog(`⚠️ IA rechaza operación para ${opportunity.symbol} - Razón: ${aiEvaluation.reason}`);
        }

        // Pausa entre operaciones
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        addOperationLog(`💥 Error procesando ${opportunity.symbol}: ${error.message}`);
        updateTradingStats(false, 0);
      }
    }

    setProcessingOpportunity(null);
    setAutoTradingActive(false);
    autoTradingActiveRef.current = false;
    addOperationLog('Procesamiento secuencial completado');
  };

  // Función para evaluar oportunidad con IA (simulación)
  const evaluateOpportunityWithAI = async (opportunity) => {
    addOperationLog(`🤖 Evaluando ${opportunity.symbol} con IA...`);
    
    // Simular evaluación de IA
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const profitPercentage = parseFloat(opportunity.profit_percentage);
    const confidence = Math.min(95, Math.max(10, profitPercentage * 20 + Math.random() * 20));
    
    // Criterios de evaluación simulados
    const shouldExecute = profitPercentage > 0.5 && confidence > 60;
    
    return {
      should_execute: shouldExecute,
      confidence: confidence.toFixed(1),
      reason: shouldExecute ?
        `Rentabilidad ${profitPercentage}% supera umbral mínimo` :
        `Rentabilidad ${profitPercentage}% insuficiente o baja confianza`
    };
  };

  // Función para ejecutar operación de arbitraje
  const executeArbitrageOperation = async (opportunity, aiEvaluation) => {
    addOperationLog(`⚡ Ejecutando arbitraje para ${opportunity.symbol}...`);
    
    try {
      // Simular ejecución de operación
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Calcular ganancia simulada
      const investmentAmount = tradingConfig.investment_mode === 'PERCENTAGE'
        ? (tradingStats.current_balance * tradingConfig.investment_percentage / 100)
        : tradingConfig.fixed_investment_usdt;
      
      const profitUsdt = investmentAmount * (parseFloat(opportunity.profit_percentage) / 100);
      
      // Simular éxito/fallo basado en confianza de IA
      const success = Math.random() * 100 < parseFloat(aiEvaluation.confidence);
      
      if (success) {
        // Enviar resultado al backend si está disponible
        if (sendV3Command) {
          sendV3Command('arbitrage_operation_result', {
            opportunity,
            result: {
              success: true,
              profit_usdt: profitUsdt,
              investment_amount: investmentAmount,
              execution_time: new Date().toISOString()
            }
          });
        }
        
        return {
          success: true,
          profit_usdt: profitUsdt,
          investment_amount: investmentAmount
        };
      } else {
        return {
          success: false,
          error: 'Operación falló durante la ejecución',
          investment_amount: investmentAmount
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        investment_amount: 0
      };
    }
  };

  const executeManualTrade = (opportunity) => {
    if (sendV3Command) {
      setSelectedOpportunity(opportunity);
      sendV3Command('execute_manual_trade', { 
        opportunity,
        config: tradingConfig 
      });
    }
  };

  const getProfitabilityColor = (percentage) => {
    const value = parseFloat(percentage);
    if (value > 2) return '#28a745'; // Verde fuerte
    if (value > 1) return '#6f9654'; // Verde medio
    if (value > 0.5) return '#ffc107'; // Amarillo
    if (value > 0) return '#fd7e14'; // Naranja
    return '#dc3545'; // Rojo
  };

  const formatPercentage = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? 'N/A' : `${num.toFixed(4)}%`;
  };

  const formatPrice = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? 'N/A' : num.toFixed(20);
  };

  // Estilos
  const containerStyle = { 
    padding: '20px', 
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1400px',
    margin: '0 auto'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const statusStyle = {
    display: 'flex',
    gap: '15px',
    alignItems: 'center'
  };

  const statusBadgeStyle = (status) => ({
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: 
      status === 'connected' || status === 'active' ? '#28a745' :
      status === 'error' ? '#dc3545' : '#6c757d'
  });

  const controlPanelStyle = {
    backgroundColor: '#e8f4fd',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #bee5eb'
  };

  const buttonStyle = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    margin: '5px'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#007bff',
    color: 'white'
  };

  const successButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#28a745',
    color: 'white'
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#dc3545',
    color: 'white'
  };

  const warningButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ffc107',
    color: '#212529'
  };

  const tableStyle = { 
    width: '100%', 
    borderCollapse: 'collapse', 
    marginTop: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    borderRadius: '8px',
    overflow: 'hidden'
  };

  const tableHeaderStyle = { 
    border: '1px solid #ddd', 
    padding: '12px', 
    textAlign: 'left', 
    backgroundColor: '#343a40', 
    fontWeight: 'bold',
    color: 'white',
    fontSize: '14px'
  };

  const tableCellStyle = { 
    border: '1px solid #ddd', 
    padding: '10px', 
    textAlign: 'left',
    fontSize: '13px'
  };

  const evenRowStyle = { backgroundColor: '#f8f9fa' };
  const oddRowStyle = { backgroundColor: '#ffffff' };

  return (
    <div style={containerStyle}>
      {/* Header con estado */}
      <div style={headerStyle}>
        <h1>Top 20 Oportunidades de Arbitraje</h1>
        <div style={statusStyle}>
          <div style={statusBadgeStyle(v3Data?.sebo_connection_status ? 'connected' : 'disconnected')}>
            Sebo: {v3Data?.sebo_connection_status ? 'connected' : 'disconnected'}
          </div>
          <div style={statusBadgeStyle(tradingStatus)}>
            Trading: {tradingStatus}
          </div>
        </div>
      </div>

      {/* Panel de control de trading */}
      <div style={controlPanelStyle}>
        <h3>Control de Trading Automatizado V3</h3>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label>Exchange Principal: </label>
            <select 
              value={tradingConfig.usdt_holder_exchange_id}
              onChange={(e) => setTradingConfig({
                ...tradingConfig, 
                usdt_holder_exchange_id: e.target.value
              })}
              style={{ padding: '5px', marginLeft: '5px' }}
            >
              <option value="binance">Binance</option>
              <option value="okx">OKX</option>
              <option value="kucoin">KuCoin</option>
              <option value="bybit">Bybit</option>
            </select>
          </div>
          
          <div>
            <label>Modo de Inversión: </label>
            <select 
              value={tradingConfig.investment_mode}
              onChange={(e) => setTradingConfig({
                ...tradingConfig, 
                investment_mode: e.target.value
              })}
              style={{ padding: '5px', marginLeft: '5px' }}
            >
              <option value="PERCENTAGE">Porcentaje</option>
              <option value="FIXED">Cantidad Fija</option>
            </select>
          </div>
          
          {tradingConfig.investment_mode === 'PERCENTAGE' ? (
            <div>
              <label>Porcentaje: </label>
              <input 
                type="number"
                min="1"
                max="50"
                value={tradingConfig.investment_percentage}
                onChange={(e) => setTradingConfig({
                  ...tradingConfig, 
                  investment_percentage: parseFloat(e.target.value)
                })}
                style={{ padding: '5px', marginLeft: '5px', width: '60px' }}
              />%
            </div>
          ) : (
            <div>
              <label>Cantidad Fija: </label>
              <input 
                type="number"
                min="10"
                max="1000"
                value={tradingConfig.fixed_investment_usdt}
                onChange={(e) => setTradingConfig({
                  ...tradingConfig, 
                  fixed_investment_usdt: parseFloat(e.target.value)
                })}
                style={{ padding: '5px', marginLeft: '5px', width: '80px' }}
              /> USDT
            </div>
          )}
          
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            {tradingStatus === 'active' ? (
              <button style={dangerButtonStyle} onClick={stopTrading}>
                🛑 Detener Trading V3
              </button>
            ) : (
              <button style={successButtonStyle} onClick={startTrading}>
                ▶️ Iniciar Trading V3
              </button>
            )}
            
            {autoTradingActive ? (
              <button style={dangerButtonStyle} onClick={stopAutoTrading}>
                🛑 Detener Auto Trading
              </button>
            ) : (
              <button style={primaryButtonStyle} onClick={startAutoTrading}>
                🤖 Auto Trading Secuencial
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Panel de estadísticas y logs de trading automático */}
      {(autoTradingActive || operationLogs.length > 0) && (
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          {/* Estadísticas de trading */}
          <div style={{
            flex: '1',
            backgroundColor: '#f8f9fa',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>📊 Estadísticas de Trading</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
              <div>
                <strong>Total Operaciones:</strong> {tradingStats.total_operations}
              </div>
              <div>
                <strong>Balance Actual:</strong> ${tradingStats.current_balance.toFixed(2)}
              </div>
              <div style={{ color: '#28a745' }}>
                <strong>Exitosas:</strong> {tradingStats.successful_operations}
              </div>
              <div style={{ color: '#dc3545' }}>
                <strong>Fallidas:</strong> {tradingStats.failed_operations}
              </div>
              <div style={{ color: tradingStats.total_profit_usdt >= 0 ? '#28a745' : '#dc3545' }}>
                <strong>Ganancia Total:</strong> ${tradingStats.total_profit_usdt.toFixed(4)} USDT
              </div>
              <div>
                <strong>Tasa de Éxito:</strong> {
                  tradingStats.total_operations > 0
                    ? ((tradingStats.successful_operations / tradingStats.total_operations) * 100).toFixed(1)
                    : 0
                }%
              </div>
            </div>
            
            {processingOpportunity && (
              <div style={{
                marginTop: '15px',
                padding: '10px',
                backgroundColor: '#e3f2fd',
                borderRadius: '5px',
                border: '1px solid #bbdefb'
              }}>
                <strong>🔄 Procesando:</strong> {processingOpportunity.symbol}
                <br />
                <small>Rentabilidad: {formatPercentage(processingOpportunity.profit_percentage)}</small>
              </div>
            )}
          </div>

          {/* Logs de operaciones */}
          <div style={{
            flex: '1',
            backgroundColor: '#f8f9fa',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>📝 Log de Operaciones</h4>
            <div style={{
              height: '200px',
              overflowY: 'auto',
              backgroundColor: '#ffffff',
              padding: '10px',
              borderRadius: '5px',
              border: '1px solid #dee2e6',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              {operationLogs.length === 0 ? (
                <div style={{ color: '#6c757d', textAlign: 'center', paddingTop: '80px' }}>
                  No hay logs disponibles
                </div>
              ) : (
                operationLogs.map((log, index) => (
                  <div key={index} style={{
                    marginBottom: '5px',
                    color: log.includes('✅') ? '#28a745' :
                          log.includes('❌') || log.includes('💥') ? '#dc3545' :
                          log.includes('🎉') ? '#007bff' :
                          log.includes('⚠️') ? '#ffc107' : '#495057'
                  }}>
                    {log}
                  </div>
                ))
              )}
            </div>
            
            {operationLogs.length > 0 && (
              <button
                style={{
                  ...buttonStyle,
                  backgroundColor: '#6c757d',
                  color: 'white',
                  marginTop: '10px',
                  fontSize: '12px',
                  padding: '5px 10px'
                }}
                onClick={() => setOperationLogs([])}
              >
                🗑️ Limpiar Logs
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabla de oportunidades */}
      {opportunities.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          color: '#6c757d'
        }}>
          <h3>Esperando oportunidades de arbitraje de V3...</h3>
          <p>Asegúrate de que V3 esté ejecutándose y conectado a Sebo.</p>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Símbolo</th>
              <th style={tableHeaderStyle}>Diferencia</th>
              <th style={tableHeaderStyle}>Exchange Venta</th>
              <th style={tableHeaderStyle}>Exchange Compra</th>
              <th style={tableHeaderStyle}>Fees Trading</th>
              <th style={tableHeaderStyle}>Retiro</th>
              <th style={tableHeaderStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((op, index) => (
              <tr 
                key={op.analysis_id || index} 
                style={index % 2 === 0 ? evenRowStyle : oddRowStyle}
              >
                <td style={tableCellStyle}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {op.symbol}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6c757d' }}>
                    {op.symbol_name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#999' }}>
                    {new Date(op.timestamp).toLocaleTimeString()}
                  </div>
                </td>
                
                <td style={{ 
                  ...tableCellStyle, 
                  color: getProfitabilityColor(op.profit_percentage),
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>
                  {formatPercentage(op.profit_percentage)}
                </td>
                
                <td style={tableCellStyle}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '15px',
                    color: '#28a745',
                    marginBottom: '4px'
                  }}>
                    {op.exchange_sell}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#000',
                    fontWeight: 'bold',
                    backgroundColor: '#e8f5e8',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'inline-block'
                  }}>
                    {formatPrice(op.sell_price)} USDT
                  </div>
                </td>
                
                <td style={tableCellStyle}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '15px',
                    color: '#dc3545',
                    marginBottom: '4px'
                  }}>
                    {op.exchange_buy}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#000',
                    fontWeight: 'bold',
                    backgroundColor: '#fde8e8',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'inline-block'
                  }}>
                    {formatPrice(op.buy_price)} USDT
                  </div>
                </td>
                
                <td style={tableCellStyle}>
                  <div style={{ fontSize: '11px' }}>
                    <strong>Compra:</strong><br/>
                    T: {op.taker_fee_buy? (op.taker_fee_buy * 100).toFixed(3) + '%' : 'N/A'}<br/>
                    M: {op.maker_fee_buy ? (op.maker_fee_buy * 100).toFixed(3) + '%' : 'N/A'}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '5px' }}>
                    <strong>Venta:</strong><br/>
                    T: {op.taker_fee_sell ? (op.taker_fee_sell * 100).toFixed(3) + '%' : 'N/A'}<br/>
                    M: {op.maker_fee_sell ? (op.maker_fee_sell * 100).toFixed(3) + '%' : 'N/A'}
                  </div>
                </td>
                
                <td style={tableCellStyle}>
                  <div style={{ fontSize: '11px' }}>
                    <strong>Red:</strong> {op.fees_exMin?.withdrawal_network || 'N/A'}<br/>
                    <strong>Fee:</strong> {op.fees_exMin?.withdrawal_fee_asset || 'N/A'} {op.symbol_name}
                  </div>
                </td>
                
                <td style={tableCellStyle}>
                  <button 
                    style={warningButtonStyle}
                    onClick={() => executeManualTrade(op)}
                    disabled={tradingStatus === 'active'}
                    title={tradingStatus === 'active' ? 'Trading automático activo' : 'Ejecutar trade manual'}
                  >
                    {tradingStatus === 'active' ? '⚡ Auto' : '🎯 Trade'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Información adicional */}
      {v3Data && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#e8f4fd', 
          borderRadius: '8px',
          border: '1px solid #bee5eb'
        }}>
          <h4>Estado de V3:</h4>
          <pre style={{ 
            fontSize: '12px', 
            backgroundColor: 'white', 
            padding: '10px', 
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '200px'
          }}>
            {JSON.stringify(v3Data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}; 

export default Top20DetailedPage;
