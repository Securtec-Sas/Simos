import React from 'react';
import { useNavigate } from 'react-router-dom';
import ExchangeList from '../ExchangeList/ExchangeList.jsx';
import SpotsMenu from '../SpotsMenu/SpotsMenu.jsx';
import styles from './Sidebar.module.css';

const Sidebar = ({ allExchanges, setAllExchanges }) => {
  const navigate = useNavigate();

  return (
    <div className="sidebar">
      <button id="toggleSidebarButton" title="Toggle Menu">
        <span className="button-main-title-group">
          <span className="menu-main-icon">☰</span> SEBO
        </span>
        <span id="mainMenuStatus" className="main-menu-status-indicator">no ok</span>
      </button>
      <div className="sidebar-content">
        <ExchangeList
          allExchanges={allExchanges}
          setAllExchanges={setAllExchanges}
        />
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
        <button
          className={styles.menuHeader} // Assuming similar styling is desired
          style={{ fontWeight: 'bold', textAlign: 'left', width: '100%' }}
          onClick={() => navigate('/data-view')}
        >
          Data View & Model
        </button>
                <button
          className={styles.menuHeader} // Assuming similar styling is desired
          style={{ fontWeight: 'bold', textAlign: 'left', width: '100%' }}
          onClick={() => navigate('/exchanges/apis')}
        >
          Apis
        </button>
        <SpotsMenu />
      </div>
    </div>
  );
};

export default Sidebar;