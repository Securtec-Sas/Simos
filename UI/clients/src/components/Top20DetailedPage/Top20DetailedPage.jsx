// UI/clients/src/components/Top20DetailedPage/Top20DetailedPage.jsx
import React, { useState, useEffect } from 'react';
// import {io} from 'socket.io-client'; // Necesitarás instalar socket.io-client si aún no está: npm install socket.io-client

const Top20DetailedPage = ({ v3Data, sendV3Command }) => {
  const [topOpportunities, setTopOpportunities] = useState([]);
  // Suponiendo que el estado de procesamiento/trading activo vendrá de v3Data.system_status o similar
  const [isV3Processing, setIsV3Processing] = useState(false);

  useEffect(() => {
    if (v3Data && v3Data.top20_data) {
      setTopOpportunities(v3Data.top20_data);
    } else {
      setTopOpportunities([]);
    }

    // Ejemplo: obtener el estado de trading/procesamiento de V3
    if (v3Data && v3Data.system_status) {
      setIsV3Processing(v3Data.system_status.trading_active || false); // Ajusta según la estructura real
    }

  }, [v3Data]);

  const handleStartV3Processing = () => {
    console.log("UI: Requesting V3 to START REAL TRADING.");
    if (sendV3Command) {
      // Comando 'start_trading' es manejado explícitamente por UIBroadcaster
      sendV3Command('start_trading', { strategy: 'top20_based', mode: 'real' });
    } else {
      console.error("sendV3Command function not provided to Top20DetailedPage");
      alert("Error: Cannot send V3 start real trading command.");
    }
  };

  const handleStopV3Processing = () => {
    console.log("UI: Requesting V3 to STOP REAL TRADING.");
    if (sendV3Command) {
      // Comando 'stop_trading' es manejado explícitamente por UIBroadcaster
      sendV3Command('stop_trading', {}); // Payload vacío o según necesidad
    } else {
      console.error("sendV3Command function not provided for V3 stop real trading command.");
      alert("Error: Cannot send V3 stop real trading command.");
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
      <h1>Top 20 Oportunidades de Arbitraje (V3)</h1>
      <div style={{ marginBottom: '15px' }}>
        {isV3Processing ? (
          <button
            onClick={handleStopV3Processing}
            style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Detener Trading Real (V3)
          </button>
        ) : (
          <button
            onClick={handleStartV3Processing}
            style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Iniciar Trading Real (V3)
          </button>
        )}
      </div>
      {topOpportunities.length === 0 ? (
        <p>Esperando datos de Top 20 de V3...</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Símbolo</th>
              <th style={tableHeaderStyle}>Exchange Compra</th>
              <th style={tableHeaderStyle}>Precio Compra</th>
              <th style={tableHeaderStyle}>Exchange Venta</th>
              <th style={tableHeaderStyle}>Precio Venta</th>
              <th style={tableHeaderStyle}>Ganancia Bruta (%)</th>
              {/* Agregar más columnas si V3 provee más detalles relevantes como fees, etc. */}
            </tr>
          </thead>
          <tbody>
            {topOpportunities.map((op, index) => {
              const percentageValue = op.profit_percentage !== undefined ? op.profit_percentage : op.percentage_difference;
              let displayPercentage;

              if (typeof percentageValue === 'number' && !isNaN(percentageValue)) {
                displayPercentage = `${percentageValue.toFixed(3)}%`;
              } else {
                displayPercentage = 'N/A';
              }

              return (
                <tr key={op.id || op.symbol || index} style={index % 2 === 0 ? evenRowStyle : oddRowStyle}>
                  <td style={tableCellStyle}>{op.symbol || 'N/A'}</td>
                  <td style={tableCellStyle}>{op.exchange_buy_name || op.exchange_min_name || 'N/A'}</td>
                  <td style={tableCellStyle}>{typeof op.price_buy === 'number' ? op.price_buy.toFixed(6) : (typeof op.price_at_exMin_to_buy_asset === 'number' ? op.price_at_exMin_to_buy_asset.toFixed(6) : 'N/A')}</td>
                  <td style={tableCellStyle}>{op.exchange_sell_name || op.exchange_max_name || 'N/A'}</td>
                  <td style={tableCellStyle}>{typeof op.price_sell === 'number' ? op.price_sell.toFixed(6) : (typeof op.price_at_exMax_to_sell_asset === 'number' ? op.price_at_exMax_to_sell_asset.toFixed(6) : 'N/A')}</td>
                  <td style={{ ...tableCellStyle, color: typeof percentageValue === 'number' && percentageValue > 0 ? 'green' : (typeof percentageValue === 'number' && percentageValue < 0 ? 'red' : 'black'), fontWeight: 'bold', textAlign: 'center' }}>
                    {displayPercentage}
                  </td>
                  {/*
                  Si V3 envía datos de fees o IDs de análisis, se pueden añadir aquí:
                <td style={tableCellStyle}>{op.analysis_id || 'N/A'}</td>
                <td style={tableCellStyle}>
                  T: {op.fees_exMin?.taker_fee != null ? (op.fees_exMin.taker_fee * 100).toFixed(3) + '%' : 'N/A'}<br/>
                  M: {op.fees_exMin?.maker_fee != null ? (op.fees_exMin.maker_fee * 100).toFixed(3) + '%' : 'N/A'}
                </td>
                */}
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Top20DetailedPage;
