import React, { useEffect, useState } from 'react';
import styles from './ActiveExchangesTable.module.css';

const API_BASE = 'http://localhost:3000/api/exchange-unique';

const ActiveExchangesTable = ({ selectedExchanges = [] }) => {
  const [exchangeStatus, setExchangeStatus] = useState({}); // { [id]: { connected, error } }

  useEffect(() => {
    let cancelled = false;
    const checkConnections = async () => {
      const statusObj = {};
      for (const ex of selectedExchanges) {
        // Inicializa como pendiente
        statusObj[ex.id] = { connected: false, error: null, loading: true };
        setExchangeStatus(prev => ({ ...prev, ...statusObj }));

        try {
          const res = await fetch(`${API_BASE}/${ex.id}`);
          const data = await res.json();
          if (cancelled) return;
          statusObj[ex.id] = {
            connected: !!data.connected,
            error: data.connected ? null : data.error || 'Error de conexión',
            loading: false
          };
        } catch (err) {
          if (cancelled) return;
          statusObj[ex.id] = {
            connected: false,
            error: 'Error de red',
            loading: false
          };
        }
        setExchangeStatus(prev => ({ ...prev, ...statusObj }));
      }
    };

    if (selectedExchanges.length > 0) {
      setExchangeStatus({});
      checkConnections();
    } else {
      setExchangeStatus({});
    }
    return () => { cancelled = true; };
  }, [selectedExchanges]);

  return (
    <div>
      <h2>Conexión de Exchanges Seleccionados</h2>
      <table id="activeExchangesTable" className={styles.activeExchangesTable}>
        <thead>
          <tr>
            <th id="exchangeNameHeader">Exchange Name</th>
            <th>Status</th>
            <th>
              <span id="apiAccessHeaderIcons" className={styles.apiAccessHeaderIcons}>
                <span className="api-header-icon" title="API Pública">👤</span>
                <span className="api-header-icon" title="API Privada">🔒</span>
              </span>
            </th>
            <th>Error Message</th>
          </tr>
        </thead>
        <tbody>
          {selectedExchanges.length === 0 ? (
            <tr id="noActiveExchangesMessage">
              <td colSpan={4}>No hay exchanges seleccionados.</td>
            </tr>
          ) : (
            selectedExchanges.map(ex => {
              const status = exchangeStatus[ex.id] || {};
              return (
                <tr key={ex.id}>
                  <td>{ex.name}</td>
                  <td>
                    {status.loading
                      ? <span className={styles.statusConnecting}>Conectando...</span>
                      : status.connected
                        ? <span className={styles.statusOnline}>Online</span>
                        : <span className={styles.statusError}>Desconectado</span>
                    }
                  </td>
                  <td>
                    <span
                      className={`api-icon ${status.connected ? styles.green : styles.red}`}
                      title="API Pública"
                    ></span>
                    <span
                      className={`api-icon private-api-icon ${styles.red}`}
                      title="API Privada"
                    ></span>
                  </td>
                  <td className={styles.errorMessageCell}>
                    {status.error || '-'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ActiveExchangesTable;