import React from 'react';
import { useNavigate } from 'react-router-dom';
import ExchangeList from '../ExchangeList/ExchangeList.jsx';
import SpotsMenu from '../SpotsMenu/SpotsMenu.jsx'; // Asumiendo que SpotsMenu también estaba aquí
import styles from './Sidebar.module.css';
import Balance from  '../BalanceDisplay/BalanceDisplay.jsx';
const Sidebar = ({ allExchanges, setAllExchanges, v3Data }) => { // Añadido v3Data por si se necesita para balance
  const navigate = useNavigate();

  // Estilos para los botones del menú (similares a los que estaban antes)
  const menuButtonStyle = {
    fontWeight: 'bold',
    textAlign: 'left',
    width: '100%',
    padding: '10px 15px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#333', // Ajustar color según el tema
    cursor: 'pointer',
    display: 'block', // Para que ocupen todo el ancho
    fontSize: '14px',
  };

  const activeMenuButtonStyle = {
    ...menuButtonStyle,
    backgroundColor: '#e0e0e0', // Un color para el elemento activo
    color: '#007bff',
  };

  // Dummy para la función isActive, ya que location no está disponible directamente aquí
  // En una implementación más robusta, esto podría venir de un hook o prop.
  const isActive = (path) => {
    // Esta es una simplificación. En Layout, se usa useLocation().
    // Aquí, podríamos necesitar pasar 'location' o 'pathname' como prop si se requiere estilo activo.
    return window.location.pathname === path || (path !== '/' && window.location.pathname.startsWith(path));
  };


  return (
    <div className={styles.sidebar}> {/* Usar clase del módulo CSS */}
      {/* El botón SEBO y el ExchangeList se mantienen como estaban */}
      <button id="toggleSidebarButton" title="Toggle Menu" className={styles.seboButton}>
        <span className={styles.buttonMainTitleGroup}>
          <span className={styles.menuMainIcon}>☰</span> SEBO
        </span>
        <span id="mainMenuStatus" className={styles.mainMenuStatusIndicator}>
           {/* Podríamos usar v3Data.system_status.sebo_connected o similar aquí */}
           {v3Data?.system_status?.sebo_connected ? 'OK' : 'No OK'}
        </span>
      </button>

      <div className={styles.sidebarContent}>
        <ExchangeList
          allExchanges={allExchanges}
          setAllExchanges={setAllExchanges}
        />

        {/* Enlaces de navegación que estaban antes en la barra superior, ahora aquí */}
        <button style={isActive('/') ? activeMenuButtonStyle : menuButtonStyle} onClick={() => navigate('/')}>
          🏠 Dashboard
        </button>
        <button style={isActive('/conexion') ? activeMenuButtonStyle : menuButtonStyle} onClick={() => navigate('/conexion')}>
          🔗 Conexiones
        </button>
        <button style={isActive('/exchange-apis') ? activeMenuButtonStyle : menuButtonStyle} onClick={() => navigate('/exchange-apis')}>
          🔑 Exchange APIs
        </button>
        <button style={isActive('/spots') ? activeMenuButtonStyle : menuButtonStyle} onClick={() => navigate('/spots')}>
          📊 Spots
        </button>
        <button style={isActive('/top20-detailed') ? activeMenuButtonStyle : menuButtonStyle} onClick={() => navigate('/top20-detailed')}>
          🎯 Top 20 Trading
        </button>
        <button style={isActive('/data-view') ? activeMenuButtonStyle : menuButtonStyle} onClick={() => navigate('/data-view')}>
          💾 ViewData (V2 Model)
        </button>
        <button style={isActive('/ai-data') ? activeMenuButtonStyle : menuButtonStyle} onClick={() => navigate('/ai-data')}>
          🤖 AI Data (V3)
        </button>
        <Balance v3Data={v3Data}/>
        {/* SpotsMenu también podría estar aquí si es parte de la navegación principal del sidebar */}
        {/* <SpotsMenu /> */}
      </div>
    </div>
  );
};

export default Sidebar;
