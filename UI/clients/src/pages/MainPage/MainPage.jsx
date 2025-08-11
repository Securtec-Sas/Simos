import React from 'react';
import { Link } from 'react-router-dom';
import ExchangeList from '../../components/ExchangeList/ExchangeList';
import BalanceDisplay from '../../components/BalanceDisplay/BalanceDisplay';
import styles from './MainPage.module.css';

const MainPage = ({ allExchanges, setAllExchanges, balances }) => {
  return (
    <div className={styles.mainPage}>
      <div className={styles.leftColumn}>
        <ExchangeList allExchanges={allExchanges} setAllExchanges={setAllExchanges} />
      </div>
      <div className={styles.rightColumn}>
        <div className={styles.balanceContainer}>
          <BalanceDisplay balanceInfo={balances} />
        </div>
        <div className={styles.buttonsContainer}>
          <Link to="/operar" className={styles.button}>Operar</Link>
          <Link to="/config-data" className={styles.button}>Configurar</Link>
          <Link to="/entrenamiento" className={styles.button}>Entrenar</Link>
          <Link to="/datos" className={styles.button}>Datos</Link>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
