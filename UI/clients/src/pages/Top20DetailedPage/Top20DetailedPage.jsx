<<<<<<< HEAD
import React from 'react';

const Top20DetailedPage = ({ opportunities, activeTrades, sendV2Message }) => {

  const handleStartTrading = (opportunity) => {
    console.log("UI: Requesting to start REAL trading for:", opportunity.symbol);
    // Default investment amount from UI, V2 can override or use its own logic.
    // V2's trigger_real_trade expects 'investment_amount_usdt' in payload if UI specifies it.
    const defaultInvestmentFromUI = 10; // Example: 10 USDT, or could be from a UI input later

    if (sendV2Message) {
      sendV2Message({
        type: 'start_real_trade',
        payload: {
          opportunity: opportunity, // Send the whole opportunity object
          investment_amount_usdt: defaultInvestmentFromUI
        }
      });
    } else {
      console.error("sendV2Message function not provided to Top20DetailedPage");
      alert("Error: Cannot send trade command.");
    }
  };

  const handleStopTrading = (tradeId) => {
    console.log("UI: Requesting to STOP trade:", tradeId);
    if (sendV2Message && tradeId) {
      sendV2Message({
        type: 'stop_real_trade',
        payload: {
          trade_id: tradeId
        }
      });
    } else {
      console.error("sendV2Message function not provided or no tradeId for stop command.");
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
              <th style={tableHeaderStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {opportunities && opportunities.length > 0 ? (
              opportunities.map((op, index) => {
                // Find if this opportunity is part of an active trade
                let activeTradeForOp = null;
                let currentTradeId = null;
                if (activeTrades && typeof activeTrades === 'object') {
                  for (const tradeId in activeTrades) {
                    if (activeTrades[tradeId]?.opportunity?.analysis_id === op.analysis_id) {
                      activeTradeForOp = activeTrades[tradeId];
                      currentTradeId = tradeId;
                      break;
                    }
                  }
                }

                const isTrading = activeTradeForOp &&
                                  (activeTradeForOp.status === 'starting_real_trade' ||
                                   activeTradeForOp.status === 'PENDING_IMPLEMENTATION' || // Assuming this is an active phase for now
                                   activeTradeForOp.status === 'processing'); // Add any other "active" statuses

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
                    <td style={tableCellStyle}>
                      {isTrading ? (
                        <>
                          <div style={{marginBottom: '5px', fontWeight:'bold', color: 'orange'}}>En Proceso... ({activeTradeForOp.status})</div>
                          {activeTradeForOp.tradeMessage && <div style={{fontSize: '0.8em', marginBottom: '5px'}}>{activeTradeForOp.tradeMessage}</div>}
                          <button
                            onClick={() => handleStopTrading(currentTradeId)}
                            style={{padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                            disabled={!currentTradeId} // Disable if no tradeId somehow
                          >
                            Detener Trade
                          </button>
                        </>
                      ) : activeTradeForOp && (activeTradeForOp.status === 'stop_attempted' || activeTradeForOp.status === 'failed' || activeTradeForOp.status === 'COMPLETED_SUCCESSFULLY' || activeTradeForOp.status === 'stop_failed') ? (
                        <>
                          <div style={{marginBottom: '5px', fontWeight:'bold', color: activeTradeForOp.status === 'failed' || activeTradeForOp.status === 'stop_failed' ? 'red' : 'grey'}}>
                            Estado: {activeTradeForOp.status}
                          </div>
                           {activeTradeForOp.tradeMessage && <div style={{fontSize: '0.8em', marginBottom: '5px'}}>{activeTradeForOp.tradeMessage}</div>}
                           {activeTradeForOp.error && <div style={{fontSize: '0.8em', color: 'red', marginBottom: '5px'}}>Error: {activeTradeForOp.error}</div>}
                           {/* Could show a 'Clear Status' or 'Retry' button here */}
                        </>
                      ) : (
                        <button
                          onClick={() => handleStartTrading(op)}
                          style={{padding: '5px 10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                        >
                          Iniciar Trading Real
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan="7" style={{...tableCellStyle, textAlign: 'center'}}>
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
=======
// s
>>>>>>> jules/multi-fixes-optimizations
