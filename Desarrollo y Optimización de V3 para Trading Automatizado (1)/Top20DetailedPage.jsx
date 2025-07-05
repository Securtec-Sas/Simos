// UI/clients/src/components/Top20DetailedPage/Top20DetailedPage.jsx
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client'; // Necesitarás instalar socket.io-client si aún no está: npm install socket.io-client

const SEBO_WEBSOCKET_URL = 'ws://localhost:3031'; // NUEVO VALOR para el servidor Sebo
const NAMESPACE = '/api/spot/arb'; // Namespace definido en spotSocketController.js

const Top20DetailedPage = () => {
  const [opportunities, setOpportunities] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Conectar al namespace específico
    const socket = io(`${SEBO_WEBSOCKET_URL}${NAMESPACE}`, {
      transports: ['websocket'] // Forzar WebSocket para evitar long-polling si es posible
    });

    socket.on('connect', () => {
      console.log('Connected to Sebo WebSocket (Top 20 Detailed) on namespace:', NAMESPACE);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from Sebo WebSocket (Top 20 Detailed):', reason);
      // setError('Disconnected. Attempting to reconnect...'); // Podrías manejar la reconexión o mostrar un error
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error with Sebo WebSocket (Top 20 Detailed):', err);
      setError(`Connection Error: ${err.message}. Is Sebo server running on port 3000?`);
    });

    // Escuchar el evento 'spot-arb' que emite cada oportunidad
    socket.on('spot-arb', (opportunity) => {
      // console.log('Received opportunity:', opportunity);
      setOpportunities(prevOpportunities => {
        // Mantener una lista de, por ejemplo, las últimas 20 oportunidades únicas por analysis_id
        // o simplemente reemplazar si el backend envía el array completo cada vez.
        // Dado que el backend emite una por una, las acumularemos y mantendremos las 20 más recientes
        // Asumimos que cada 'opportunity' tiene un 'analysis_id' único o 'symbol' + timestamps para diferenciar

        const newOpportunities = [opportunity, ...prevOpportunities];
        // Filtrar para evitar duplicados basados en analysis_id si se emiten repetidamente
        const uniqueOpportunities = newOpportunities.filter(
            (op, index, self) => index === self.findIndex((o) => o.analysis_id === op.analysis_id)
        );
        return uniqueOpportunities.slice(0, 20); // Mantener solo las últimas 20
      });
    });

    return () => {
      console.log('Cleaning up Sebo WebSocket connection (Top 20 Detailed)');
      socket.disconnect();
    };
  }, []); // El efecto se ejecuta una vez al montar y se limpia al desmontar

  if (error) {
    return <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>;
  }

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
              <th style={tableHeaderStyle}>Diferencia (%)</th>
              <th style={tableHeaderStyle}>Ex. Compra: Fees (T/M)</th>
              <th style={tableHeaderStyle}>Ex. Venta: Fees (T/M)</th>
              <th style={tableHeaderStyle}>Retiro Óptimo (Activo desde Ex. Compra)</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((op, index) => (
              <tr key={op.analysis_id || index} style={index % 2 === 0 ? evenRowStyle : oddRowStyle}>
                <td style={tableCellStyle}>
                  {op.symbol} <span style={{color: '#777', fontSize: '0.8em'}}>({op.symbol_name})</span>
                  <div style={{fontSize: '0.8em', color: '#555'}}>
                    Compra: {op.exchange_min_name} ({op.price_at_exMin_to_buy_asset?.toFixed(6)} USDT)<br/>
                    Venta: {op.exchange_max_name} ({op.price_at_exMax_to_sell_asset?.toFixed(6)} USDT)
                  </div>
                  <div style={{fontSize: '0.7em', color: '#999'}}>Análisis: {new Date(op.timestamp).toLocaleString()}</div>
                </td>
                <td style={{ ...tableCellStyle, color: op.percentage_difference && parseFloat(op.percentage_difference) > 0 ? 'green' : 'red', fontWeight: 'bold' }}>
                  {op.percentage_difference}
                </td>
                <td style={tableCellStyle}>
                  {/* Exchange: {op.exchange_min_name} ({op.exchange_min_id})<br/> */}
                  Taker: {op.fees_exMin?.taker_fee != null ? (op.fees_exMin.taker_fee * 100).toFixed(3) + '%' : 'N/A'}<br/>
                  Maker: {op.fees_exMin?.maker_fee != null ? (op.fees_exMin.maker_fee * 100).toFixed(3) + '%' : 'N/A'}
                </td>
                <td style={tableCellStyle}>
                  {/* Exchange: {op.exchange_max_name} ({op.exchange_max_id})<br/> */}
                  Taker: {op.fees_exMax?.taker_fee != null ? (op.fees_exMax.taker_fee * 100).toFixed(3) + '%' : 'N/A'}<br/>
                  Maker: {op.fees_exMax?.maker_fee != null ? (op.fees_exMax.maker_fee * 100).toFixed(3) + '%' : 'N/A'}
                </td>
                <td style={tableCellStyle}>
                  Red: {op.fees_exMin?.withdrawal_network || 'N/A'}<br/>
                  Fee: {op.fees_exMin?.withdrawal_fee_asset != null ? op.fees_exMin.withdrawal_fee_asset : 'N/A'} {op.fees_exMin?.withdrawal_fee_asset != null ? op.symbol_name : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Top20DetailedPage;
