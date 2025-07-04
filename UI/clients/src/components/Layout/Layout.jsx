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

  // Placeholder para el componente de BalanceDisplay
  const BalanceDisplay = () => {
    // Aquí iría la lógica para obtener y mostrar el balance, probablemente de v3Data
    const balanceToShow = v3Data?.balance_update?.total_usdt || v3Data?.system_status?.total_balance_usdt || 'N/A';
    return (
      <div style={{fontSize: '16px', fontWeight: 'bold'}}>
        Balance: {typeof balanceToShow === 'number' ? balanceToShow.toFixed(2) : balanceToShow} USDT
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

