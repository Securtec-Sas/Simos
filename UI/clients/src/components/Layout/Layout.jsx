// UI/clients/src/components/Layout/Layout.jsx

import React from 'react';
<<<<<<< HEAD
import { Outlet } from 'react-router-dom'; // Link y useLocation ya no son necesarios aquí si el nav se va al Sidebar
import Sidebar from '../Sidebar/Sidebar.jsx';

// El prop v3Data se añade para pasarlo al Sidebar, que lo usa para el estado de Sebo.
const Layout = ({ allExchanges, setAllExchanges, connectionStatus, v3Data }) => {

  // Estilos para el contenedor principal que incluye Sidebar y Contenido
  const layoutWrapperStyle = {
    display: 'flex',
    minHeight: '100vh', // Ocupa al menos toda la altura de la vista
  };

  // Estilos para el contenedor del contenido principal (donde se renderiza el Outlet)
  const mainContentWrapperStyle = {
    flexGrow: 1, // Permite que esta área crezca y ocupe el espacio restante
    padding: '20px', // Un poco de espacio alrededor del contenido
    // backgroundColor: '#fff', // Opcional: un color de fondo para el área de contenido
    // overflowY: 'auto' // Si el contenido puede ser más largo que la pantalla
  };

  // Estilos para la barra superior fija (si se decide mantener algo arriba, como el balance o estados)
  const topBarStyle = {
    position: 'fixed', // Fijo en la parte superior
    top: 0,
    left: 250, // Debe ser igual al ancho del Sidebar para no superponerse
    right: 0,
    height: '60px', // Altura de la barra superior
    backgroundColor: '#343a40', // Color oscuro como la nav anterior
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    zIndex: 1000, // Para que esté por encima de otros contenidos
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const statusContainerStyle = {
    marginLeft: 'auto', // Empuja los estados a la derecha
    display: 'flex',
    gap: '15px',
    alignItems: 'center'
  };

  const statusBadgeStyle = (status) => ({
    padding: '5px 10px',
    borderRadius: '15px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: 
      status === 'connected' ? '#28a745' : // verde
      status === 'error' ? '#dc3545' : // rojo
      '#6c757d' // gris para desconectado u otros estados
  });

  // Componente de BalanceDisplay mejorado
  const BalanceDisplay = () => {
    const balanceData = v3Data?.balance_update;
    const initialBalances = v3Data?.initial_state?.balance_update;

    // Log para depuración
    // console.log("BalanceDisplay - v3Data.balance_update:", balanceData);
    // console.log("BalanceDisplay - v3Data.initial_state.balance_update:", initialBalances);

    const sourceToUse = (balanceData && Object.keys(balanceData).length > 0) ? balanceData : initialBalances;
    const sourceLabel = (balanceData && Object.keys(balanceData).length > 0) ? "" : "(Init) ";

    if (!sourceToUse || Object.keys(sourceToUse).length === 0) {
      return <div style={{fontSize: '14px', fontWeight: 'normal', color: '#aaa', marginRight: '20px'}}>Balance: N/A</div>;
    }

    // Si sourceToUse existe, intentamos mostrarlo.
    // Asumimos que balanceData es un objeto como:
    // { "binance": { "USDT": { "free": 100, "total": 120 }, "BTC": { ... } }, "kucoin": { ... } }
    // O podría ser un formato más simple si Sebo lo pre-procesa, ej: { "total_usdt_all_exchanges": 1500 }
    // Por ahora, buscaremos un total_usdt o un resumen simple.

    let displayContent = "N/A";

    if (sourceToUse && typeof sourceToUse.total_usdt_all_exchanges === 'number') {
      displayContent = `Total Consolidado: ${sourceToUse.total_usdt_all_exchanges.toFixed(2)} USDT`;

      // Opcionalmente, añadir desglose si se desea y si hay más datos que solo el total
      let individualBalances = [];
      for (const exchangeId in sourceToUse) {
        if (exchangeId === 'total_usdt_all_exchanges') continue; // Saltar la clave del total

        const exchangeData = sourceToUse[exchangeId];
        if (exchangeData && typeof exchangeData === 'object' && exchangeData.USDT && typeof exchangeData.USDT.total === 'number') {
          individualBalances.push(`${exchangeId.toUpperCase()}: ${exchangeData.USDT.total.toFixed(2)}`);
        }
      }
      if (individualBalances.length > 0) {
        // Podríamos decidir mostrar el total y luego el desglose, o solo uno de ellos.
        // Por ahora, si hay total_usdt_all_exchanges, lo priorizamos.
        // Si se quiere mostrar desglose también:
        // displayContent += ` (${individualBalances.join(', ')})`;
      }
    } else if (sourceToUse && Object.keys(sourceToUse).length > 0) {
        // Si no hay 'total_usdt_all_exchanges', intentar mostrar desgloses individuales
        let individualBalances = [];
        for (const exchangeId in sourceToUse) {
            const exchangeData = sourceToUse[exchangeId];
            if (exchangeData && typeof exchangeData === 'object' && exchangeData.USDT && typeof exchangeData.USDT.total === 'number') {
                individualBalances.push(`${exchangeId.toUpperCase()}: ${exchangeData.USDT.total.toFixed(2)} USDT`);
            }
        }
        if (individualBalances.length > 0) {
            displayContent = individualBalances.join(' | ');
        } else {
            displayContent = "Balance (formato desconocido)";
        }
    }


    return (
      <div style={{fontSize: '12px', fontWeight: 'normal', marginRight: '20px', display: 'flex', gap: '10px', alignItems: 'center', color: displayContent === "N/A" ? '#aaa' : 'white'}}>
        <strong>Balance {sourceLabel}:</strong> {displayContent}
      </div>
    );
  };

  return (
    <div style={layoutWrapperStyle}>
      <Sidebar
        allExchanges={allExchanges}
        setAllExchanges={setAllExchanges}
        v3Data={v3Data} // Pasar v3Data al Sidebar
      />
      <div style={{ marginLeft: '250px', width: 'calc(100% - 250px)', position: 'relative' /* Para el posicionamiento de la topBar */ }}>
        <div style={topBarStyle}> {/* Barra superior fija */}
            <BalanceDisplay /> {/* Componente de Balance aquí */}
            {/* Estado de conexiones */}
            {connectionStatus && (
            <div style={statusContainerStyle}>
                <div style={statusBadgeStyle(connectionStatus.v2)}>V2</div>
                <div style={statusBadgeStyle(connectionStatus.v3)}>V3</div>
                <div style={statusBadgeStyle(connectionStatus.sebo)}>Sebo</div>
            </div>
            )}
        </div>
        <main style={{ ...mainContentWrapperStyle, paddingTop: '80px' /* Ajuste para dejar espacio a la topBar */ }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

=======
// import Sidebar from '../Sidebar/Sidebar.jsx'; // Reemplazado por Navigation
import Navigation from '../../../Navigation.jsx'; // Importar Navigation
import { Outlet } from 'react-router-dom';
import styles from '../../App.module.css'; // Considerar si estos estilos aún son necesarios o si Navigation maneja el layout

const Layout = ({ allExchanges, setAllExchanges }) => (
  // La clase styles.layout podría necesitar ajustes si Navigation.jsx tiene su propia estructura
  // Por ahora, la mantenemos para la estructura general de main content
  <div>
    <Navigation /> {/* Usar Navigation en lugar de Sidebar */}
    {/* El prop allExchanges y setAllExchanges no parece ser usado por Navigation, así que lo quitamos de aquí */}
    {/* Si Navigation necesitara esos props, habría que pasarlos */}
    <main className={styles.main}> {/* Asegurar que esta clase no entre en conflicto con Navigation */}
      <Outlet />
    </main>
  </div>
);

export default Layout;
>>>>>>> jules/multi-fixes-optimizations
