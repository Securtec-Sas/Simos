import React, { useState, useEffect } from 'react';

const API_BASE = '/api/exchanges'; // Ajusta si tu backend usa otro prefijo

const ExchangeApis = () => {
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExchanges = async () => {
      try {
        const response = await fetch(`${API_BASE}/configured`);
        const data = await response.json();
        setExchanges(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchExchanges();
  }, []);

  const handleEdit = (exchangeId) => {
    window.location.href = `/exchanges/edit/${exchangeId}`;
  };

  const handleAdd = () => {
    window.location.href = '/exchanges/add';
  };

  if (loading) return <div>Cargando exchanges...</div>;

  return (
    <div>
      <h2>Exchanges configurados</h2>
      <table>
        <thead>
          <tr>
            <th>Exchange</th>
            <th>API configurada</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {exchanges.map((exchange) => (
            <tr key={exchange._id}>
              <td>{exchange.name}</td>
              <td>
                {exchange.apiConfigured ? (
                  <span style={{ color: 'green' }}>Sí</span>
                ) : (
                  <span style={{ color: 'red' }}>No</span>
                )}
              </td>
              <td>
                <button onClick={() => handleEdit(exchange._id)}>Editar</button>
                {exchange.apiConfigured ? (
                  <button onClick={handleAdd}>Agregar API</button>
                ) : (
                  <button onClick={handleAdd}>Agregar</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ExchangeApis;