// UI/clients/src/components/ExchangeAPIsPage/ExchangeAPIsPage.jsx

import React, { useState, useEffect } from 'react';

const ExchangeAPIsPage = () => {
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingExchange, setEditingExchange] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    apiKey: '',
    secret: '',
    passphrase: '',
    sandbox: false,
    isActive: false
  });

  // Cargar exchanges configurados
  useEffect(() => {
    fetchExchanges();
  }, []);

  const fetchExchanges = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/configured-exchanges');
      if (!response.ok) {
        throw new Error('Error al cargar exchanges');
      }
      const data = await response.json();
      setExchanges(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (exchange) => {
    setEditingExchange(exchange.id);
    setFormData({
      name: exchange.name,
      apiKey: exchange.apiKey || '',
      secret: exchange.secret || '',
      passphrase: exchange.passphrase || '',
      sandbox: exchange.sandbox || false,
      isActive: exchange.isActive || false
    });
  };

  const handleSave = async (exchangeId) => {
    try {
      const response = await fetch(`/api/exchanges/${exchangeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar exchange');
      }

      await fetchExchanges();
      setEditingExchange(null);
      setFormData({
        name: '',
        apiKey: '',
        secret: '',
        passphrase: '',
        sandbox: false,
        isActive: false
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = () => {
    setEditingExchange(null);
    setFormData({
      name: '',
      apiKey: '',
      secret: '',
      passphrase: '',
      sandbox: false,
      isActive: false
    });
  };

  const handleToggleActive = async (exchangeId, currentStatus) => {
    try {
      const response = await fetch(`/api/exchanges/${exchangeId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error('Error al cambiar estado del exchange');
      }

      await fetchExchanges();
    } catch (err) {
      setError(err.message);
    }
  };

  const testConnection = async (exchangeId) => {
    try {
      const response = await fetch(`/api/exchanges/${exchangeId}/test`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al probar conexión');
      }

      const result = await response.json();
      alert(result.success ? 'Conexión exitosa' : `Error: ${result.error}`);
    } catch (err) {
      alert(`Error al probar conexión: ${err.message}`);
    }
  };

  const addNewExchange = () => {
    setEditingExchange('new');
    setFormData({
      name: '',
      apiKey: '',
      secret: '',
      passphrase: '',
      sandbox: false,
      isActive: false
    });
  };

  const handleCreateNew = async () => {
    try {
      const response = await fetch('/api/exchanges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Error al crear exchange');
      }

      await fetchExchanges();
      setEditingExchange(null);
      setFormData({
        name: '',
        apiKey: '',
        secret: '',
        passphrase: '',
        sandbox: false,
        isActive: false
      });
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Cargando exchanges...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  const tableStyle = { 
    width: '100%', 
    borderCollapse: 'collapse', 
    marginTop: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };
  
  const headerStyle = { 
    border: '1px solid #ddd', 
    padding: '12px', 
    textAlign: 'left', 
    backgroundColor: '#f8f9fa', 
    fontWeight: 'bold',
    color: '#495057'
  };
  
  const cellStyle = { 
    border: '1px solid #ddd', 
    padding: '12px', 
    textAlign: 'left' 
  };

  const buttonStyle = {
    padding: '6px 12px',
    margin: '2px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#007bff',
    color: 'white'
  };

  const successButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#28a745',
    color: 'white'
  };

  const warningButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ffc107',
    color: '#212529'
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#dc3545',
    color: 'white'
  };

  const inputStyle = {
    width: '100%',
    padding: '6px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Gestión de APIs de Exchanges</h1>
        <button 
          style={primaryButtonStyle}
          onClick={addNewExchange}
        >
          + Agregar Exchange
        </button>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Exchange</th>
            <th style={headerStyle}>Estado</th>
            <th style={headerStyle}>API Key</th>
            <th style={headerStyle}>Sandbox</th>
            <th style={headerStyle}>Última Actualización</th>
            <th style={headerStyle}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {editingExchange === 'new' && (
            <tr style={{ backgroundColor: '#e8f4fd' }}>
              <td style={cellStyle}>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="Nombre del exchange"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </td>
              <td style={cellStyle}>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Activo
                </label>
              </td>
              <td style={cellStyle}>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="API Key"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                />
                <input
                  style={{ ...inputStyle, marginTop: '5px' }}
                  type="password"
                  placeholder="Secret"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                />
                <input
                  style={{ ...inputStyle, marginTop: '5px' }}
                  type="text"
                  placeholder="Passphrase (opcional)"
                  value={formData.passphrase}
                  onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                />
              </td>
              <td style={cellStyle}>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.sandbox}
                    onChange={(e) => setFormData({ ...formData, sandbox: e.target.checked })}
                  />
                  Sandbox
                </label>
              </td>
              <td style={cellStyle}>Nuevo</td>
              <td style={cellStyle}>
                <button style={successButtonStyle} onClick={handleCreateNew}>
                  Crear
                </button>
                <button style={dangerButtonStyle} onClick={handleCancel}>
                  Cancelar
                </button>
              </td>
            </tr>
          )}
          
          {exchanges.map((exchange) => (
            <tr key={exchange.id} style={{ backgroundColor: exchange.isActive ? '#d4edda' : '#f8f9fa' }}>
              <td style={cellStyle}>
                {editingExchange === exchange.id ? (
                  <input
                    style={inputStyle}
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                ) : (
                  <strong>{exchange.name}</strong>
                )}
              </td>
              
              <td style={cellStyle}>
                {editingExchange === exchange.id ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Activo
                  </label>
                ) : (
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    backgroundColor: exchange.isActive ? '#28a745' : '#6c757d',
                    color: 'white',
                    fontSize: '12px'
                  }}>
                    {exchange.isActive ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                )}
              </td>
              
              <td style={cellStyle}>
                {editingExchange === exchange.id ? (
                  <div>
                    <input
                      style={inputStyle}
                      type="text"
                      placeholder="API Key"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    />
                    <input
                      style={{ ...inputStyle, marginTop: '5px' }}
                      type="password"
                      placeholder="Secret"
                      value={formData.secret}
                      onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                    />
                    <input
                      style={{ ...inputStyle, marginTop: '5px' }}
                      type="text"
                      placeholder="Passphrase (opcional)"
                      value={formData.passphrase}
                      onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                    />
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>
                      {exchange.apiKey ? `${exchange.apiKey.substring(0, 8)}...` : 'No configurado'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>
                      Secret: {exchange.secret ? '***configurado***' : 'No configurado'}
                    </div>
                  </div>
                )}
              </td>
              
              <td style={cellStyle}>
                {editingExchange === exchange.id ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.sandbox}
                      onChange={(e) => setFormData({ ...formData, sandbox: e.target.checked })}
                    />
                    Sandbox
                  </label>
                ) : (
                  exchange.sandbox ? 'Sí' : 'No'
                )}
              </td>
              
              <td style={cellStyle}>
                {exchange.lastUpdated ? new Date(exchange.lastUpdated).toLocaleString() : 'Nunca'}
              </td>
              
              <td style={cellStyle}>
                {editingExchange === exchange.id ? (
                  <div>
                    <button style={successButtonStyle} onClick={() => handleSave(exchange.id)}>
                      Guardar
                    </button>
                    <button style={dangerButtonStyle} onClick={handleCancel}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div>
                    <button style={primaryButtonStyle} onClick={() => handleEdit(exchange)}>
                      Editar
                    </button>
                    <button 
                      style={exchange.isActive ? warningButtonStyle : successButtonStyle}
                      onClick={() => handleToggleActive(exchange.id, exchange.isActive)}
                    >
                      {exchange.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button style={primaryButtonStyle} onClick={() => testConnection(exchange.id)}>
                      Probar
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {exchanges.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#6c757d',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginTop: '20px'
        }}>
          <h3>No hay exchanges configurados</h3>
          <p>Haz clic en "Agregar Exchange" para comenzar</p>
        </div>
      )}
    </div>
  );
};


export default ExchangeAPIsPage;

