import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ExchangeList from '../../components/ExchangeList/ExchangeList';
import BalanceDisplay from '../../components/BalanceDisplay/BalanceDisplay';
import { API_URLS } from '../../config/api';
import styles from './MainPage.module.css';

const MainPage = ({ allExchanges, setAllExchanges }) => {
  const [balances, setBalances] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [balanceError, setBalanceError] = useState(null);

  // Cargar balances desde sebo
  useEffect(() => {
    const fetchBalances = async () => {
      setLoadingBalances(true);
      setBalanceError(null);
      try {
        const response = await fetch(API_URLS.sebo.balance);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const balanceData = await response.json();
        
        // Si la respuesta es un array, usar directamente
        // Si es un objeto, convertir a array
        if (Array.isArray(balanceData)) {
          setBalances(balanceData);
        } else if (balanceData && typeof balanceData === 'object') {
          // Si es un objeto único, convertir a array
          setBalances([balanceData]);
        } else {
          setBalances([]);
        }
      } catch (error) {
        console.error('Error fetching balances:', error);
        setBalanceError(error.message);
        setBalances([]);
      } finally {
        setLoadingBalances(false);
      }
    };

    fetchBalances();
    
    // Actualizar balances cada 30 segundos
    const intervalId = setInterval(fetchBalances, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  const renderBalances = () => {
    if (loadingBalances) {
      return <div className={styles.loadingMessage}>Cargando balances...</div>;
    }

    if (balanceError) {
      return <div className={styles.errorMessage}>Error cargando balances: {balanceError}</div>;
    }

    if (!balances || balances.length === 0) {
      return <div className={styles.noBalancesMessage}>No hay balances disponibles</div>;
    }

    // Mostrar los primeros 3 balances
    const displayBalances = balances.slice(0, 3);
    
    return (
      <div className={styles.balancesGrid}>
        {displayBalances.map((balance, index) => (
          <BalanceDisplay
            key={balance.id_exchange || balance.exchange_name || index}
            balanceInfo={balance}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={styles.mainPage}>
      <div className={styles.leftColumn}>
        <ExchangeList allExchanges={allExchanges} setAllExchanges={setAllExchanges} />
      </div>
      <div className={styles.rightColumn}>
        <div className={styles.fixedSection}>
          <div className={styles.balanceContainer}>
            <h3 className={styles.balanceTitle}>Balances</h3>
            {renderBalances()}
          </div>
          <div className={styles.buttonsContainer}>
            <Link to="/operar" className={styles.button}>Operar</Link>
            <Link to="/config-data" className={styles.button}>Configurar</Link>
            <Link to="/entrenamiento" className={styles.button}>Entrenar</Link>
            <Link to="/datos" className={styles.button}>Datos</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
