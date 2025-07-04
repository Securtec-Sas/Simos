import React from 'react';
import { useNavigate } from 'react-router-dom';
import ExchangeList from '../ExchangeList/ExchangeList.jsx';
import SpotsMenu from '../SpotsMenu/SpotsMenu.jsx';
import styles from './Sidebar.module.css';

const Sidebar = ({ allExchanges, setAllExchanges }) => {
  const navigate = useNavigate();

  const navItems = [
    { path: '/conexion', label: 'Conexión' },
    { path: '/top20-detailed', label: 'Top 20 Detallado' },
    { path: '/data-view', label: 'Data View & Model' },
    { path: '/exchanges/apis', label: 'Apis' },
  ];

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
        {navItems.map((item) => (
          <button
            key={item.path}
            className={styles.menuHeader}
            style={{ fontWeight: 'bold', textAlign: 'left', width: '100%' }}
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        ))}
        <SpotsMenu />
      </div>
    </div>
  );
};

export default Sidebar;