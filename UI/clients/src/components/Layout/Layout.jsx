// UI/clients/src/components/Layout/Layout.jsx

import React from 'react';
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

    let displayBalances = [];
    // Intentar encontrar un total_usdt global si existe
    if (typeof sourceToUse.total_usdt === 'number') {
        displayBalances.push(`Total: ${sourceToUse.total_usdt.toFixed(2)} USDT`);
    } else {
        // Iterar sobre los exchanges en sourceToUse
        for (const exchangeId in sourceToUse) {
            const exchangeBalances = sourceToUse[exchangeId];
            if (exchangeBalances && typeof exchangeBalances === 'object' && exchangeBalances.USDT) {
                const usdtBalance = exchangeBalances.USDT;
                // Mostrar 'total' si está disponible, sino 'free'. Si ninguno, 0.
                const totalToShow = usdtBalance.total !== undefined ? usdtBalance.total : (usdtBalance.free !== undefined ? usdtBalance.free : 0);
                const totalFormatted = parseFloat(totalToShow || 0).toFixed(2);
                displayBalances.push(`${exchangeId.toUpperCase()}: ${totalFormatted} USDT`);
            }
        }
    }

    if (displayBalances.length === 0) {
      // Fallback si la estructura no es la esperada o no hay USDT
      displayBalances.push("Datos de balance no disponibles en formato esperado");
    }

    return (
      <div style={{fontSize: '12px', fontWeight: 'normal', marginRight: '20px', display: 'flex', gap: '10px', alignItems: 'center'}}>
        <strong>Balance {sourceLabel}:</strong> {displayBalances.join(' | ')}
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

