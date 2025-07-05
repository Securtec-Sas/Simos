import React from 'react';
import { useNavigate } from 'react-router-dom';
import ExchangeList from '../ExchangeList/ExchangeList.jsx';
import SpotsMenu from '../SpotsMenu/SpotsMenu.jsx'; // Asumiendo que SpotsMenu también estaba aquí
import styles from './Sidebar.module.css';

const Sidebar = ({ allExchanges, setAllExchanges, v3Data }) => { // Añadido v3Data por si se necesita para balance
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: '🏠 Dashboard', icon: '🏠' },
    { path: '/conexion', label: '🔗 Conexiones', icon: '🔗' },
    { path: '/exchange-apis', label: '🔑 Exchange APIs', icon: '🔑' },
    { path: '/spots', label: '📊 Spots', icon: '📊' },
    { path: '/top20-detailed', label: '🎯 Top 20 Trading', icon: '🎯' },
    { path: '/data-view', label: '💾 ViewData (V2 Model)', icon: '💾' },
    { path: '/ai-data', label: '🤖 AI Data (V3)', icon: '🤖' },
  ];

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
        {navItems.map(item => (
          <button
            key={item.path}
            style={isActive(item.path) ? activeMenuButtonStyle : menuButtonStyle}
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        ))}

        {/* SpotsMenu también podría estar aquí si es parte de la navegación principal del sidebar */}
        {/* <SpotsMenu /> */}
        <button
          className={styles.menuHeader}
          style={{ fontWeight: 'bold', textAlign: 'left', width: '100%' }}
          onClick={() => navigate('/conexion')}
        >
          Conexión
        </button>
        <button
          className={styles.menuHeader} // Assuming similar styling is desired
          style={{ fontWeight: 'bold', textAlign: 'left', width: '100%' }}
          onClick={() => navigate('/top20-detailed')}
        >
          Top 20 Detallado
        </button>
        {/* <SpotsMenu /> */}
      </div>
    </div>
  );
};

export default Sidebar;
