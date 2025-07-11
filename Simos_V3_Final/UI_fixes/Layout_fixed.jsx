// UI/clients/src/components/Layout/Layout.jsx - VERSIÓN CORREGIDA

import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

const Layout = ({ allExchanges, setAllExchanges, connectionStatus }) => {
  const location = useLocation();

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

  return (
    <div>
      <nav style={navStyle}>
        <div style={containerStyle}>
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
                to="/top20-detailed" 
                style={isActive('/top20-detailed') ? activeLinkStyle : navLinkStyle}
              >
                🎯 Top 20 Trading
              </Link>
            </li>
            
            {/* Estado de conexiones */}
            {connectionStatus && (
              <div style={statusContainerStyle}>
                <div style={statusBadgeStyle(connectionStatus.v2)}>
                  V2
                </div>
                <div style={statusBadgeStyle(connectionStatus.v3)}>
                  V3
                </div>
                <div style={statusBadgeStyle(connectionStatus.sebo)}>
                  Sebo
                </div>
              </div>
            )}
          </ul>
        </div>
      </nav>
      
      <div style={containerStyle}>
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;

