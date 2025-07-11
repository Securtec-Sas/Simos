import React, { useState, useEffect } from 'react';
import ActiveExchangesTable from '../../components/ActiveExchangesTable/ActiveExchangesTable';

const fetchExchangeStatus = async (exchangeId, exchangeName, connectionType, ccxtSupported) => {
  if (connectionType === "ccxt" && !ccxtSupported) {
    return {
      id: exchangeId,
      name: exchangeName,
      status: 'Error',
      error: `Exchange '${exchangeName}' (CCXT type) not supported or misconfigured.`
    };
  }
  try {
    const response = await fetch(`/api/exchange-status/${exchangeId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Failed to connect. Status: ${response.status}`);
    }
    return {
      id: exchangeId,
      name: exchangeName,
      status: data.connected ? 'Online' : 'Offline',
      error: data.connected ? null : (data.error || 'Failed to connect.')
    };
  } catch (err) {
    return { id: exchangeId, name: exchangeName, status: 'Error', error: err.message };
  }
};

const ConnectionPage = ({ allExchanges = [] }) => {
  const [activeExchanges, setActiveExchanges] = useState([]);

  useEffect(() => {
    const exchangesToConnect = allExchanges.filter(ex => ex.isActive);

    const initialPlaceholders = exchangesToConnect.map(ex => {
      const isSupported = String(ex.ccxtSupported) === 'true';
      const isCore = String(ex.isCoreExchange) === 'true';

      if (isCore || isSupported) {
        return { id: ex.id, name: ex.name, status: 'Connecting...', error: null };
      }
      return {
        id: ex.id,
        name: ex.name,
        status: 'Error',
        error: `Exchange '${ex.name}' is active but not supported for connection.`
      };
    });
    setActiveExchanges(initialPlaceholders);

    exchangesToConnect.forEach(ex => {
      const isSupported = String(ex.ccxtSupported) === 'true';
      const isCore = String(ex.isCoreExchange) === 'true';

      if (isCore || isSupported) {
        fetchExchangeStatus(ex.id, ex.name, ex.connectionType, isSupported)
          .then(statusData => {
            setActiveExchanges(prevList =>
              prevList.map(item =>
                item.id === statusData.id ? { ...statusData, name: ex.name } : item
              )
            );
          });
      }
    });
  }, [allExchanges]);

  return <ActiveExchangesTable activeExchanges={activeExchanges} />;
};

export default ConnectionPage;