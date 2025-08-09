import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar.jsx';

const Layout = ({ allExchanges, setAllExchanges, connectionStatus, balances }) => {
  const location = useLocation();
  const [showBalanceDetails, setShowBalanceDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Simular carga inicial
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Estilos del Navbar
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
    gap: '15px',
    alignItems: 'center'
  };

  const statusIndicatorStyle = (status) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: getStatusColor(status).bg,
    color: getStatusColor(status).text,
    border: `1px solid ${getStatusColor(status).border}`
  });

  const statusDotStyle = (status) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: getStatusColor(status).dot,
    animation: status === 'connected' ? 'pulse 2s infinite' : 'none'
  });

  const balanceContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '4px 12px',
    backgroundColor: '#495057',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  };

  const loadingSpinnerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    fontSize: '18px',
    color: '#6c757d'
  };

  function getStatusColor(status) {
    switch (status) {
      case 'connected':
        return {
          bg: '#d4edda',
          text: '#155724',
          border: '#c3e6cb',
          dot: '#28a745'
        };
      case 'reconnecting':
        return {
          bg: '#fff3cd',
          text: '#856404',
          border: '#ffeaa7',
          dot: '#ffc107'
        };
      case 'disconnected':
        return {
          bg: '#f8d7da',
          text: '#721c24',
          border: '#f5c6cb',
          dot: '#dc3545'
        };
      case 'error':
      case 'failed':
        return {
          bg: '#f8d7da',
          text: '#721c24',
          border: '#f5c6cb',
          dot: '#dc3545'
        };
      default:
        return {
          bg: '#e2e3e5',
          text: '#383d41',
          border: '#d6d8db',
          dot: '#6c757d'
        };
    }
  }

  function getStatusText(status) {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'reconnecting':
        return 'Reconectando...';
      case 'disconnected':
        return 'Desconectado';
      case 'error':
        return 'Error';
      case 'failed':
        return 'Falló';
      default:
        return 'Desconocido';
    }
  }

  function formatBalance(balances) {
    if (!balances) return 'N/A';
    
    if (typeof balances === 'object') {
      const total = balances.total_usdt || balances.total || 0;
      return `$${total.toFixed(2)}`;
    }
    
    return 'N/A';
  }

  if (isLoading) {
    return (
      <div style={loadingSpinnerStyle}>
        <div>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '10px'
          }}></div>
          <div>Cargando Simos UI...</div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        .balance-container:hover {
          background-color: #6c757d !important;
        }
        
        .nav-link:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
        }
        
        .nav-link.active:hover {
          background-color: #0056b3 !important;
        }
      `}</style>
      
      <nav style={navStyle}>
        <ul style={navListStyle}>
          <li>
            <Link 
              to="/conexion" 
              style={location.pathname === '/conexion' ? activeLinkStyle : navLinkStyle}
              className="nav-link"
            >
              Conexión
            </Link>
          </li>
          <li>
            <Link 
              to="/spots" 
              style={location.pathname === '/spots' ? activeLinkStyle : navLinkStyle}
              className="nav-link"
            >
              Spots
            </Link>
          </li>
          <li>
            <Link 
              to="/top20" 
              style={location.pathname === '/top20' ? activeLinkStyle : navLinkStyle}
              className="nav-link"
            >
              Top 20
            </Link>
          </li>
          <li>
            <Link 
              to="/training" 
              style={location.pathname === '/training' ? activeLinkStyle : navLinkStyle}
              className="nav-link"
            >
              Entrenamiento
            </Link>
          </li>
          <li>
            <Link 
              to="/exchanges-apis" 
              style={location.pathname === '/exchanges-apis' ? activeLinkStyle : navLinkStyle}
              className="nav-link"
            >
              APIs Exchanges
            </Link>
          </li>
          <li>
            <Link 
              to="/data-view" 
              style={location.pathname === '/data-view' ? activeLinkStyle : navLinkStyle}
              className="nav-link"
            >
              Vista de Datos
            </Link>
          </li>
          <li>
            <Link 
              to="/ai-data" 
              style={location.pathname === '/ai-data' ? activeLinkStyle : navLinkStyle}
              className="nav-link"
            >
              Datos IA
            </Link>
          </li>
          <li>
            <Link 
              to="/config-data" 
              style={location.pathname === '/config-data' ? activeLinkStyle : navLinkStyle}
              className="nav-link"
            >
              Config Datos
            </Link>
          </li>

          <div style={statusContainerStyle}>
            {/* Estado de conexión V3 */}
            <div style={statusIndicatorStyle(connectionStatus?.v3 || 'disconnected')}>
              <div style={statusDotStyle(connectionStatus?.v3 || 'disconnected')}></div>
              <span>V3: {getStatusText(connectionStatus?.v3 || 'disconnected')}</span>
            </div>

            {/* Estado de conexión Sebo */}
            <div style={statusIndicatorStyle(connectionStatus?.sebo || 'disconnected')}>
              <div style={statusDotStyle(connectionStatus?.sebo || 'disconnected')}></div>
              <span>Sebo: {getStatusText(connectionStatus?.sebo || 'disconnected')}</span>
            </div>

            {/* Balance */}
            <div 
              style={balanceContainerStyle}
              className="balance-container"
              onClick={() => setShowBalanceDetails(!showBalanceDetails)}
              title="Click para ver detalles del balance"
            >
              <span style={{ color: '#ffffff', fontSize: '12px', fontWeight: '600' }}>
                💰 Balance: {formatBalance(balances)}
              </span>
            </div>
          </div>
        </ul>
      </nav>

      {/* Detalles del balance (expandible) */}
      {showBalanceDetails && balances && (
        <div style={{
          backgroundColor: '#ffffff',
          margin: '0 1rem 1rem 1rem',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #dee2e6'
        }}>
          <h6 style={{ margin: '0 0 10px 0', color: '#495057' }}>Detalles del Balance</h6>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {typeof balances === 'object' && Object.entries(balances).map(([key, value]) => (
              <div key={key} style={{ 
                padding: '8px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                <strong>{key}:</strong> {typeof value === 'number' ? value.toFixed(4) : value}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div style={{ padding: '0 1rem' }}>
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;

