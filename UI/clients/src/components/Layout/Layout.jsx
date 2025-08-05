// UI/clients/src/components/Layout/Layout.jsx

import React, { useState } from 'react'; // Importar useState
import { Outlet, Link, useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar.jsx'; // Importar Sidebar

const Layout = ({ allExchanges, setAllExchanges, connectionStatus, balances }) => { // Recibir balances
  const location = useLocation();
  const [showBalanceDetails, setShowBalanceDetails] = useState(false); // Estado para detalles del balance

  // Estilos del Navbar (existentes)
  const navStyle = {
    backgroundColor: '#343a40',
    padding: '1rem',
    marginBottom: '2rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const navListStyle = {
    listStyle: 'none',
    display: 'flex',
    gap: '2rem',
    margin: 0,
    padding: 0,
    alignItems: 'center'
  };

  const navLinkStyle = {
    color: '#ffffff',
    textDecoration: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    transition: 'background-color 0.3s',
    fontSize: '14px',
    fontWeight: '500'
  };

  const activeLinkStyle = {
    ...navLinkStyle,
    backgroundColor: '#007bff',
    color: '#ffffff'
  };

  const statusContainerStyle = {
    marginLeft: 'auto',
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  };

  const statusBadgeStyle = (status) => ({
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: 
      status === 'connected' ? '#28a745' :
      status === 'error' ? '#dc3545' : '#6c757d'
  });

  const containerStyle = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 1rem'
  };

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Nuevos estilos para el layout con Sidebar
  const mainLayoutStyle = {
    display: 'flex',
    minHeight: 'calc(100vh - 70px)', // Ajustar según la altura del navbar
  };

  const sidebarContainerStyle = {
    flex: '0 0 25%', // Sidebar ocupa 15%
    backgroundColor: '#343a40', // Color de fondo igual al Navbar
    color: '#ffffff', // Color de texto general para el Sidebar
    padding: '1rem',
    boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
    overflowY: 'auto', // Para scroll si el contenido del sidebar es largo
  };

  const contentContainerStyle = {
    flex: '1', // Contenido principal ocupa el resto
    padding: '1rem',
    overflowY: 'auto', // Para scroll del contenido principal
  };


  return (
    <div>
      <nav style={navStyle}>
        <div style={containerStyle}> {/* Manteniendo el containerStyle para el contenido del navbar */}
          <ul style={navListStyle}>
            <li>
              <Link 
                to="/" 
                style={isActive('/') && location.pathname === '/' ? activeLinkStyle : navLinkStyle}
              >
                🏠 Dashboard
              </Link>
            </li>
            <li>
              <Link 
                to="/conexion" 
                style={isActive('/conexion') ? activeLinkStyle : navLinkStyle}
              >
                🔗 Conexiones
              </Link>
            </li>
            <li>
              <Link 
                to="/exchange-apis" 
                style={isActive('/exchange-apis') ? activeLinkStyle : navLinkStyle}
              >
                🔑 APIs Exchanges
              </Link>
            </li>
            <li>
              <Link 
                to="/spots" 
                style={isActive('/spots') ? activeLinkStyle : navLinkStyle}
              >
                📊 Spots
              </Link>
            </li>
            <li>
              <Link 
                to="/top20" 
                style={isActive('/top20') ? activeLinkStyle : navLinkStyle}
              >
                🎯 Top 20 Trading
              </Link>
            </li>
            <li>
              <Link 
                to="/ai-data" 
                style={isActive('/ai-data') ? activeLinkStyle : navLinkStyle}
              >
                🧠 Datos IA
              </Link>
            </li>
            <li>
              <Link 
                to="/config-data" 
                style={isActive('/config-data') ? activeLinkStyle : navLinkStyle}
              >
                ⚙️ Config
              </Link>
            </li>
            
            {/* Estado de conexiones */}
            {connectionStatus && (
              <div style={statusContainerStyle}>
                <div style={statusBadgeStyle(connectionStatus.v3)}>
                  V3
                </div>
                <div style={statusBadgeStyle(connectionStatus.sebo)}>
                  Sebo
                </div>
              </div>
            )}

            {/* Sección de Balance */}
            <div
              style={{ marginLeft: 'auto', cursor: 'pointer', color: '#ffffff', display: 'flex', alignItems: 'center', position: 'relative' }}
              onClick={() => setShowBalanceDetails(!showBalanceDetails)}
            >
              <span style={{ marginRight: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                USDT: {balances?.balance_usdt?.toFixed(2) || '0.00'}
              </span>
              {/* Indicador de dropdown (opcional) */}
              <span style={{ fontSize: '10px' }}>▼</span>

              {showBalanceDetails && balances && (
                <div style={{
                  position: 'absolute',
                  top: '100%', // Debajo del texto del balance
                  right: 0,
                  backgroundColor: '#495057', // Un poco más claro que el navbar
                  color: '#ffffff',
                  border: '1px solid #343a40',
                  borderRadius: '4px',
                  padding: '15px',
                  zIndex: 100,
                  minWidth: '250px',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                }}>
                  <h5 style={{ marginTop: 0, marginBottom: '10px', borderBottom: '1px solid #5a6268', paddingBottom: '5px' }}>Detalles del Balance</h5>
                  {/* Adaptado para la nueva estructura de datos de balance */}
                  {balances && balances.balance_usdt !== undefined ? (
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Exchange:</strong>
                        <span style={{ float: 'right' }}>{balances.exchange_name || 'N/A'}</span>
                      </div>
                      <div>
                        <strong>Balance USDT:</strong>
                        <span style={{ float: 'right' }}>{balances.balance_usdt?.toFixed(4) || 'N/A'}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px' }}>No hay datos de balance disponibles.</div>
                  )}
                </div>
              )}
            </div>
          </ul>
        </div>
      </nav>
      
      {/* Contenedor principal para Sidebar y Outlet */}
      <div style={mainLayoutStyle}>
        <div style={sidebarContainerStyle}>
          <Sidebar allExchanges={allExchanges} setAllExchanges={setAllExchanges} />
        </div>
        <div style={contentContainerStyle}>
          {/* El containerStyle original se aplica aquí dentro para el contenido del Outlet */}
          <div style={{ ...containerStyle, margin: 0, maxWidth: '100%'}}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
