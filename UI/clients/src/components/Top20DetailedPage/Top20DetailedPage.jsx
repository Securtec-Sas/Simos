// UI/clients/src/components/Top20DetailedPage/Top20DetailedPage.jsx
import React from 'react';

const Top20DetailedPage = ({ opportunities, activeTrades, sendV2Message, isProcessing }) => {

  const handleStartProcessing = () => {
    console.log("UI: Requesting to START processing opportunities.");
    if (sendV2Message) {
      sendV2Message({ type: 'start_processing' });
    } else {
      console.error("sendV2Message function not provided to Top20DetailedPage");
      alert("Error: Cannot send start command.");
    }
  };

  const handleStopProcessing = () => {
    console.log("UI: Requesting to STOP processing opportunities.");
    if (sendV2Message) {
      sendV2Message({ type: 'stop_processing' });
    } else {
      console.error("sendV2Message function not provided for stop command.");
      alert("Error: Cannot send stop command.");
    }
  };

  // Estilos básicos para la tabla
  const tableStyle = { width: '100%', borderCollapse: 'collapse', marginTop: '20px' };
  const tableHeaderStyle = { border: '1px solid #ddd', padding: '10px', textAlign: 'left', backgroundColor: '#e9ecef', fontWeight: 'bold' };
  const tableCellStyle = { border: '1px solid #ddd', padding: '10px', textAlign: 'left' };
  const evenRowStyle = { backgroundColor: '#f8f9fa' };
  const oddRowStyle = { backgroundColor: '#ffffff' };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Top 20 Oportunidades de Arbitraje (Detallado)</h1>
      <div style={{ marginBottom: '15px' }}>
        {isProcessing ? (
          <button
            onClick={handleStopProcessing}
            style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Detener Procesamiento
          </button>
        ) : (
          <button
            onClick={handleStartProcessing}
            style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Iniciar Procesamiento
          </button>
        )}
      </div>
      {opportunities.length === 0 ? (
        <p>Esperando datos de oportunidades...</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Símbolo</th>
              <th style={tableHeaderStyle}>Ruta de Arbitraje</th>
              <th style={tableHeaderStyle}>Diferencia Bruta (%)</th>
              <th style={tableHeaderStyle}>Fees Ex. Compra (T/M)</th>
              <th style={tableHeaderStyle}>Fees Ex. Venta (T/M)</th>
              <th style={tableHeaderStyle}>Fee Retiro Activo (Ex. Compra)</th>
            </tr>
          </thead>
          <tbody>
            {opportunities && opportunities.length > 0 ? (
              opportunities.map((op, index) => {
                return (
                  <tr key={op.analysis_id || index} style={index % 2 === 0 ? evenRowStyle : oddRowStyle}>
                    <td style={tableCellStyle}>
                      {op.symbol} <span style={{color: '#777', fontSize: '0.8em'}}>({op.symbol_name || 'N/A'})</span>
                      <div style={{fontSize: '0.7em', color: '#999'}}>
                        Análisis ID: {op.analysis_id}<br/>
                        {new Date(op.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{fontWeight: 'bold'}}>Compra:</div>
                      {op.exchange_min_name} ({op.exchange_min_id})
                      <div style={{fontSize: '0.9em'}}>Precio: {op.price_at_exMin_to_buy_asset?.toFixed(6)} USDT</div>
                      <div style={{fontWeight: 'bold', marginTop: '5px'}}>Venta:</div>
                      {op.exchange_max_name} ({op.exchange_max_id})
                      <div style={{fontSize: '0.9em'}}>Precio: {op.price_at_exMax_to_sell_asset?.toFixed(6)} USDT</div>
                    </td>
                    <td style={{ ...tableCellStyle, color: op.percentage_difference && parseFloat(op.percentage_difference) > 0 ? 'green' : 'red', fontWeight: 'bold', textAlign: 'center' }}>
                      {op.percentage_difference}%
                    </td>
                    <td style={tableCellStyle}>
                      T: {op.fees_exMin?.taker_fee != null ? (op.fees_exMin.taker_fee * 100).toFixed(3) + '%' : 'N/A'}<br/>
                      M: {op.fees_exMin?.maker_fee != null ? (op.fees_exMin.maker_fee * 100).toFixed(3) + '%' : 'N/A'}
                    </td>
                    <td style={tableCellStyle}>
                      T: {op.fees_exMax?.taker_fee != null ? (op.fees_exMax.taker_fee * 100).toFixed(3) + '%' : 'N/A'}<br/>
                      M: {op.fees_exMax?.maker_fee != null ? (op.fees_exMax.maker_fee * 100).toFixed(3) + '%' : 'N/A'}
                    </td>
                    <td style={tableCellStyle}>
                      Red: {op.fees_exMin?.withdrawal_network || 'N/A'}<br/>
                      Fee: {op.fees_exMin?.withdrawal_fee_asset != null ? `${op.fees_exMin.withdrawal_fee_asset} ${op.symbol_name || ''}`.trim() : 'N/A'}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan="6" style={{...tableCellStyle, textAlign: 'center'}}>
                  No hay oportunidades de arbitraje disponibles o esperando datos de V2...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Top20DetailedPage;
