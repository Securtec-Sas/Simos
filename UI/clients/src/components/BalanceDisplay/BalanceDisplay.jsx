import React from 'react';
import styles from './BalanceDisplay.module.css'; // We'll create this CSS module

const BalanceDisplay = ({ balanceInfo }) => {
  if (!balanceInfo) {
    return <div className={styles.balanceDisplayContainer}>Loading balance...</div>;
  }
  
  // Assuming balanceInfo structure from Sebo/V2:
  // { id_exchange: 'binance', balance_usdt: 1234.56, exchange_name: 'Binance', ... }
  // Use exchange_name if available, otherwise id_exchange
  const exchangeName = balanceInfo.exchange_name || balanceInfo.id_exchange || 'N/A';
  const usdtBalance = balanceInfo.balance_usdt !== undefined && balanceInfo.balance_usdt !== null
    ? parseFloat(balanceInfo.balance_usdt).toFixed(2)
    : 'N/A';

  return (
    <div className={styles.balanceDisplayContainer}>
      <div className={styles.exchangeName}>{exchangeName.toUpperCase()}</div>
      <div className={styles.balanceAmount}>
        {usdtBalance} <span className={styles.currencySymbol}>USDT</span>
      </div>
    </div>
  );
};

export default BalanceDisplay;
