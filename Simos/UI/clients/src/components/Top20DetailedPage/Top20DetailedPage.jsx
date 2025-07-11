// UI/clients/src/components/Top20DetailedPage/Top20DetailedPage.jsx
import React, { useState, useEffect } from 'react';

const Top20DetailedPage = ({ v3Data, sendV3Command }) => {
  const [opportunities, setOpportunities] = useState([]);
  const [tradingStatus, setTradingStatus] = useState('inactive');
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [tradingConfig, setTradingConfig] = useState({
    usdt_holder_exchange_id: 'binance',
    investment_mode: 'PERCENTAGE',
    investment_percentage: 10,
    fixed_investment_usdt: 100
  });

  // Monitorear datos de top20 y estado de trading desde V3
  useEffect(() => {
    if (v3Data) {
      if (v3Data.top20_data) {
        setOpportunities(v3Data.top20_data);
      }
      if (v3Data.system_status) {
        setTradingStatus(v3Data.system_status.trading_active ? 'active' : 'inactive');
      }
    }
  }, [v3Data]);

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
    return isNaN(num) ? 'N/A' : num.toFixed(6);
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
          
          <div style={{ marginLeft: 'auto' }}>
            {tradingStatus === 'active' ? (
              <button style={dangerButtonStyle} onClick={stopTrading}>
                🛑 Detener Trading
              </button>
            ) : (
              <button style={successButtonStyle} onClick={startTrading}>
                ▶️ Iniciar Trading
              </button>
            )}
          </div>
        </div>
      </div>

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
              <th style={tableHeaderStyle}>Exchange Compra</th>
              <th style={tableHeaderStyle}>Exchange Venta</th>
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
                  color: getProfitabilityColor(op.percentage_difference),
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}>
                  {formatPercentage(op.percentage_difference)}
                </td>
                
                <td style={tableCellStyle}>
                  <div style={{ fontWeight: 'bold' }}>
                    {op.exchange_min_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6c757d' }}>
                    {formatPrice(op.price_at_exMin_to_buy_asset)} USDT
                  </div>
                </td>
                
                <td style={tableCellStyle}>
                  <div style={{ fontWeight: 'bold' }}>
                    {op.exchange_max_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6c757d' }}>
                    {formatPrice(op.price_at_exMax_to_sell_asset)} USDT
                  </div>
                </td>
                
                <td style={tableCellStyle}>
                  <div style={{ fontSize: '11px' }}>
                    <strong>Compra:</strong><br/>
                    T: {op.fees_exMin?.taker_fee ? (op.fees_exMin.taker_fee * 100).toFixed(3) + '%' : 'N/A'}<br/>
                    M: {op.fees_exMin?.maker_fee ? (op.fees_exMin.maker_fee * 100).toFixed(3) + '%' : 'N/A'}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '5px' }}>
                    <strong>Venta:</strong><br/>
                    T: {op.fees_exMax?.taker_fee ? (op.fees_exMax.taker_fee * 100).toFixed(3) + '%' : 'N/A'}<br/>
                    M: {op.fees_exMax?.maker_fee ? (op.fees_exMax.maker_fee * 100).toFixed(3) + '%' : 'N/A'}
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

