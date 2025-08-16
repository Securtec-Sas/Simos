import React, { useState, useEffect, useCallback } from 'react';
import styles from '../Sidebar/Sidebar.module.css';
import exchangeListStyles from './ExchangeList.module.css';

const ExchangeList = ({ allExchanges, setAllExchanges }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar la lista de exchanges al montar el componente
  useEffect(() => {
    const fetchExchanges = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/exchanges/configured');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const exchangesData = await response.json();
        setAllExchanges(exchangesData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchExchanges();
  }, []);

  // Manejar el cambio de activación de un exchange
  const handleExchangeChange = useCallback(async (event) => {
    const checkbox = event.target;
    const exchangeId = checkbox.dataset.exchangeId;
    const exchangeName = checkbox.dataset.exchangeName;
    const isChecked = checkbox.checked;

    try {
      // Actualiza el estado en el backend
      await fetch('/api/update-exchange-active-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchangeId, isActive: isChecked, exchangeName })
      });

      // Actualiza el estado localmente para reflejar el cambio
      setAllExchanges(prev =>
        prev.map(ex =>
          ex.id === exchangeId ? { ...ex, isActive: isChecked } : ex
        )
      );
    } catch (serverError) {
      alert('Error actualizando el estado del exchange');
    }
  }, [setAllExchanges]);

  if (loading) {
    return (
      <div className={exchangeListStyles.exchangeListContainer}>
        <div className={exchangeListStyles.header}>
          <h3>Exchanges</h3>
        </div>
        <div className={exchangeListStyles.scrollableList}>
          <div className="spinner">Cargando exchanges...</div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={exchangeListStyles.exchangeListContainer}>
        <div className={exchangeListStyles.header}>
          <h3>Exchanges</h3>
        </div>
        <div className={exchangeListStyles.scrollableList}>
          <p>Error loading exchanges: {error}</p>
        </div>
      </div>
    );
  }

  const uniqueExchanges = [];
  const seen = new Set();
  allExchanges.forEach(ex => {
    if (ex.id && !seen.has(ex.id)) {
      uniqueExchanges.push(ex);
      seen.add(ex.id);
    }
  });

  return (
    <div className={exchangeListStyles.exchangeListContainer}>
      <div className={exchangeListStyles.header}>
        <h3>Exchanges</h3>
      </div>
      <div className={exchangeListStyles.scrollableList}>
        <ul id="allExchangesList" className={exchangeListStyles.exchangeList}>
          {uniqueExchanges.length === 0 && <li>No exchanges available.</li>}
          {uniqueExchanges.map(exchange => (
            <li key={exchange.id} className={exchangeListStyles.exchangeItem}>
              <input
                type="checkbox"
                id={`cb-sidebar-${exchange.id}`}
                data-exchange-id={exchange.id}
                data-exchange-name={exchange.name}
                checked={!!exchange.isActive}
                onChange={handleExchangeChange}
              />
              <label htmlFor={`cb-sidebar-${exchange.id}`}>{exchange.name}</label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ExchangeList;