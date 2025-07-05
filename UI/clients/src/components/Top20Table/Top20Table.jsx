import React from 'react';
import styles from './Top20Table.module.css';

const Top20Table = ({ opportunities }) => {
  if (!opportunities || opportunities.length === 0) {
    return <p className={styles.noData}>No hay oportunidades Top 20 disponibles en este momento.</p>;
  }

  return (
    <div className={styles.tableContainer}>
      <h2 className={styles.tableTitle}>Top 20 Oportunidades (Live Data)</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Símbolo</th>
            <th className={styles.th}>Ex. Compra</th>
            <th className={styles.th}>P. Compra</th>
            <th className={styles.th}>Ex. Venta</th>
            <th className={styles.th}>P. Venta</th>
            <th className={styles.th}>Ganancia Bruta (%)</th>
            <th className={styles.th}>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((op, index) => {
            const percentageValue = op.profit_percentage !== undefined
                                    ? op.profit_percentage
                                    : (op.percentage_difference !== undefined
                                        ? op.percentage_difference
                                        : null);
            let displayPercentage;

            if (typeof percentageValue === 'number' && !isNaN(percentageValue)) {
              displayPercentage = `${percentageValue.toFixed(3)}%`;
            } else {
              displayPercentage = 'N/A';
            }

            const buyPrice = op.price_buy !== undefined
                              ? op.price_buy
                              : (op.price_at_exMin_to_buy_asset !== undefined
                                  ? op.price_at_exMin_to_buy_asset
                                  : null);

            const sellPrice = op.price_sell !== undefined
                              ? op.price_sell
                              : (op.price_at_exMax_to_sell_asset !== undefined
                                  ? op.price_at_exMax_to_sell_asset
                                  : null);

            const timestamp = op.timestamp ? new Date(op.timestamp).toLocaleString() : 'N/A';

            return (
              <tr key={op.id || op.symbol || op.analysis_id || index} className={styles.tr}>
                <td className={styles.td}>{op.symbol || 'N/A'}</td>
                <td className={styles.td}>{op.exchange_buy_name || op.exchange_min_name || 'N/A'}</td>
                <td className={styles.td}>
                  {typeof buyPrice === 'number' ? buyPrice.toFixed(6) : 'N/A'}
                </td>
                <td className={styles.td}>{op.exchange_sell_name || op.exchange_max_name || 'N/A'}</td>
                <td className={styles.td}>
                  {typeof sellPrice === 'number' ? sellPrice.toFixed(6) : 'N/A'}
                </td>
                <td className={`${styles.td} ${styles.percentageCell}`} style={{ color: typeof percentageValue === 'number' && percentageValue > 0 ? 'green' : (typeof percentageValue === 'number' && percentageValue < 0 ? 'red' : 'black') }}>
                  {displayPercentage}
                </td>
                <td className={styles.tdTimestamp}>{timestamp}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default Top20Table;
