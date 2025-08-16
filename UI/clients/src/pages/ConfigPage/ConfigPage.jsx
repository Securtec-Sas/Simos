import React, { useState, useEffect } from 'react';
import './ConfigPage.css';

const ConfigPage = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('inversion');

  // Cargar configuración al montar el componente
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config');
      const result = await response.json();
      
      if (result.success) {
        setConfig(result.data);
        setMessage({ type: 'success', text: 'Configuración cargada exitosamente' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Error al cargar la configuración' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al cargar la configuración' });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setConfig(result.data);
        setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Error al guardar la configuración' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al guardar la configuración' });
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    if (!window.confirm('¿Estás seguro de que deseas restablecer la configuración a los valores por defecto?')) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/config/reset', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        setConfig(result.data);
        setMessage({ type: 'success', text: 'Configuración restablecida a valores por defecto' });
      } else {
        setMessage({ type: 'error', text: result.message || 'Error al restablecer la configuración' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al restablecer la configuración' });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const tabs = [
    { id: 'inversion', label: '💰 Inversión', icon: '💰' },
    { id: 'riesgo', label: '⚠️ Riesgo', icon: '⚠️' },
    { id: 'rentabilidad', label: '📈 Rentabilidad', icon: '📈' },
    { id: 'ia', label: '🤖 Inteligencia Artificial', icon: '🤖' },
    { id: 'simulacion', label: '🎮 Simulación', icon: '🎮' },
    { id: 'sistema', label: '⚙️ Sistema', icon: '⚙️' }
  ];

  if (loading) {
    return (
      <div className="config-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="config-page">
        <div className="error-container">
          <h2>❌ Error</h2>
          <p>No se pudo cargar la configuración</p>
          <button onClick={loadConfig} className="btn btn-primary">
            🔄 Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="config-page">
      <div className="config-header">
        <h1>⚙️ Configuración del Sistema</h1>
        <p>Gestiona todos los parámetros de funcionamiento de Simos</p>
        
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}
      </div>

      <div className="config-container">
        {/* Tabs de navegación */}
        <div className="config-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Contenido de las tabs */}
        <div className="config-content">
          {activeTab === 'inversion' && (
            <InversionTab config={config} updateConfig={updateConfig} />
          )}
          {activeTab === 'riesgo' && (
            <RiesgoTab config={config} updateConfig={updateConfig} />
          )}
          {activeTab === 'rentabilidad' && (
            <RentabilidadTab config={config} updateConfig={updateConfig} />
          )}
          {activeTab === 'ia' && (
            <IATab config={config} updateConfig={updateConfig} />
          )}
          {activeTab === 'simulacion' && (
            <SimulacionTab config={config} updateConfig={updateConfig} />
          )}
          {activeTab === 'sistema' && (
            <SistemaTab config={config} updateConfig={updateConfig} />
          )}
        </div>

        {/* Botones de acción */}
        <div className="config-actions">
          <button 
            onClick={saveConfig} 
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? '💾 Guardando...' : '💾 Guardar Configuración'}
          </button>
          
          <button 
            onClick={resetConfig} 
            disabled={saving}
            className="btn btn-secondary"
          >
            🔄 Restablecer por Defecto
          </button>
          
          <button 
            onClick={loadConfig} 
            disabled={saving}
            className="btn btn-outline"
          >
            🔄 Recargar
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente para la tab de Inversión
const InversionTab = ({ config, updateConfig }) => (
  <div className="tab-content">
    <h2>💰 Configuración de Inversión</h2>
    
    <div className="form-group">
      <label>Modo de Inversión</label>
      <select 
        value={config.modoInversion} 
        onChange={(e) => updateConfig('modoInversion', e.target.value)}
      >
        <option value="PERCENTAGE">Porcentaje del Balance</option>
        <option value="FIXED">Monto Fijo</option>
      </select>
    </div>

    {config.modoInversion === 'PERCENTAGE' && (
      <div className="form-group">
        <label>Porcentaje de Inversión (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={config.porcentajeInversion}
          onChange={(e) => updateConfig('porcentajeInversion', parseFloat(e.target.value))}
        />
        <small>Porcentaje del balance total a invertir por operación</small>
      </div>
    )}

    {config.modoInversion === 'FIXED' && (
      <div className="form-group">
        <label>Monto Fijo (USDT)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={config.inversionFijaUsdt}
          onChange={(e) => updateConfig('inversionFijaUsdt', parseFloat(e.target.value))}
        />
        <small>Monto fijo en USDT a invertir por operación</small>
      </div>
    )}

    <div className="form-group">
      <label>
        <input
          type="checkbox"
          checked={config.reinvertirGanancias}
          onChange={(e) => updateConfig('reinvertirGanancias', e.target.checked)}
        />
        Reinvertir Ganancias
      </label>
    </div>

    {config.reinvertirGanancias && (
      <div className="form-group">
        <label>Porcentaje de Reinversión (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={config.porcentajeReinversion}
          onChange={(e) => updateConfig('porcentajeReinversion', parseFloat(e.target.value))}
        />
        <small>Porcentaje de las ganancias a reinvertir automáticamente</small>
      </div>
    )}
  </div>
);

// Componente para la tab de Riesgo
const RiesgoTab = ({ config, updateConfig }) => (
  <div className="tab-content">
    <h2>⚠️ Gestión de Riesgo</h2>
    
    <div className="form-group">
      <label>Stop Loss Global (%)</label>
      <input
        type="number"
        min="0"
        max="100"
        step="0.1"
        value={config.stopLossGlobal}
        onChange={(e) => updateConfig('stopLossGlobal', parseFloat(e.target.value))}
      />
      <small>Pérdida máxima permitida del balance total antes de detener el trading</small>
    </div>

    <div className="form-group">
      <label>Stop Loss por Operación (%)</label>
      <input
        type="number"
        min="0"
        max="100"
        step="0.1"
        value={config.stopLossOperacion}
        onChange={(e) => updateConfig('stopLossOperacion', parseFloat(e.target.value))}
      />
      <small>Pérdida máxima permitida por operación individual</small>
    </div>

    <div className="form-group">
      <label>Take Profit por Operación (%)</label>
      <input
        type="number"
        min="0"
        max="100"
        step="0.1"
        value={config.takeProfitOperacion || ''}
        onChange={(e) => updateConfig('takeProfitOperacion', e.target.value ? parseFloat(e.target.value) : null)}
      />
      <small>Ganancia objetivo por operación (opcional)</small>
    </div>
  </div>
);

// Componente para la tab de Rentabilidad
const RentabilidadTab = ({ config, updateConfig }) => (
  <div className="tab-content">
    <h2>📈 Parámetros de Rentabilidad</h2>
    
    <div className="form-group">
      <label>Ganancia Mínima por Operación (%)</label>
      <input
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={config.porcentajeGananciaMinimaOperacion}
        onChange={(e) => updateConfig('porcentajeGananciaMinimaOperacion', parseFloat(e.target.value))}
      />
      <small>Porcentaje mínimo de ganancia requerido para ejecutar una operación</small>
    </div>

    <div className="form-group">
      <label>Ganancia Mínima Absoluta (USDT)</label>
      <input
        type="number"
        min="0"
        step="0.001"
        value={config.gananciaMinimaUsdt}
        onChange={(e) => updateConfig('gananciaMinimaUsdt', parseFloat(e.target.value))}
      />
      <small>Ganancia mínima absoluta en USDT para ejecutar una operación</small>
    </div>

    <div className="form-group">
      <label>Balance Mínimo Operacional (USDT)</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={config.balanceMinimoOperacionalUsdt}
        onChange={(e) => updateConfig('balanceMinimoOperacionalUsdt', parseFloat(e.target.value))}
      />
      <small>Balance mínimo requerido para continuar operando</small>
    </div>
  </div>
);

// Componente para la tab de IA
const IATab = ({ config, updateConfig }) => (
  <div className="tab-content">
    <h2>🤖 Configuración de Inteligencia Artificial</h2>
    
    <div className="form-group">
      <label>Umbral de Confianza</label>
      <input
        type="number"
        min="0"
        max="1"
        step="0.01"
        value={config.umbralConfianzaIA}
        onChange={(e) => updateConfig('umbralConfianzaIA', parseFloat(e.target.value))}
      />
      <small>Nivel de confianza mínimo requerido para que la IA ejecute una operación (0-1)</small>
    </div>

    <div className="form-group">
      <label>Ruta del Modelo de IA</label>
      <input
        type="text"
        value={config.rutaModeloIA}
        onChange={(e) => updateConfig('rutaModeloIA', e.target.value)}
      />
      <small>Ruta del archivo del modelo de IA entrenado</small>
    </div>

    <div className="form-group">
      <label>Ruta de Datos de Entrenamiento</label>
      <input
        type="text"
        value={config.rutaDatosEntrenamientoIA}
        onChange={(e) => updateConfig('rutaDatosEntrenamientoIA', e.target.value)}
      />
      <small>Ruta del archivo CSV con datos de entrenamiento</small>
    </div>
  </div>
);

// Componente para la tab de Simulación
const SimulacionTab = ({ config, updateConfig }) => (
  <div className="tab-content">
    <h2>🎮 Configuración de Simulación</h2>
    
    <div className="form-group">
      <label>
        <input
          type="checkbox"
          checked={config.modoSimulacion}
          onChange={(e) => updateConfig('modoSimulacion', e.target.checked)}
        />
        Activar Modo Simulación
      </label>
      <small>Cuando está activo, no se ejecutan operaciones reales</small>
    </div>

    <div className="form-group">
      <label>Balance Inicial de Simulación (USDT)</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={config.balanceInicialSimulacion}
        onChange={(e) => updateConfig('balanceInicialSimulacion', parseFloat(e.target.value))}
      />
      <small>Balance inicial para simulaciones</small>
    </div>

    <div className="form-group">
      <label>Duración de Simulación (minutos)</label>
      <input
        type="number"
        min="1"
        value={config.duracionSimulacionMinutos}
        onChange={(e) => updateConfig('duracionSimulacionMinutos', parseInt(e.target.value))}
      />
      <small>Duración por defecto de las simulaciones</small>
    </div>

    <div className="form-group">
      <label>Máximo de Operaciones Concurrentes</label>
      <input
        type="number"
        min="1"
        max="10"
        value={config.maxOperacionesConcurrentes}
        onChange={(e) => updateConfig('maxOperacionesConcurrentes', parseInt(e.target.value))}
      />
      <small>Número máximo de operaciones simultáneas en simulación</small>
    </div>

    <div className="form-group">
      <label>Delay de Simulación (segundos)</label>
      <input
        type="number"
        min="0"
        step="0.1"
        value={config.delaySimulacion}
        onChange={(e) => updateConfig('delaySimulacion', parseFloat(e.target.value))}
      />
      <small>Retraso artificial para simular tiempo de ejecución</small>
    </div>
  </div>
);

// Componente para la tab de Sistema
const SistemaTab = ({ config, updateConfig }) => (
  <div className="tab-content">
    <h2>⚙️ Configuración del Sistema</h2>
    
    <div className="form-group">
      <label>Nivel de Log</label>
      <select 
        value={config.nivelLog} 
        onChange={(e) => updateConfig('nivelLog', e.target.value)}
      >
        <option value="DEBUG">DEBUG</option>
        <option value="INFO">INFO</option>
        <option value="WARNING">WARNING</option>
        <option value="ERROR">ERROR</option>
      </select>
      <small>Nivel de detalle de los logs del sistema</small>
    </div>

    <div className="form-group">
      <label>Timeout de Request (segundos)</label>
      <input
        type="number"
        min="1"
        max="300"
        value={config.timeoutRequest}
        onChange={(e) => updateConfig('timeoutRequest', parseInt(e.target.value))}
      />
      <small>Tiempo máximo de espera para requests HTTP</small>
    </div>

    <div className="form-group">
      <label>Delay de Reconexión WebSocket (segundos)</label>
      <input
        type="number"
        min="1"
        max="60"
        value={config.delayReconexionWebsocket}
        onChange={(e) => updateConfig('delayReconexionWebsocket', parseInt(e.target.value))}
      />
      <small>Tiempo de espera antes de intentar reconectar WebSocket</small>
    </div>

    <div className="form-group">
      <label>Máximo Intentos de Reconexión</label>
      <input
        type="number"
        min="1"
        max="50"
        value={config.maxIntentosReconexion}
        onChange={(e) => updateConfig('maxIntentosReconexion', parseInt(e.target.value))}
      />
      <small>Número máximo de intentos de reconexión antes de fallar</small>
    </div>

    <div className="form-group">
      <label>Descripción de la Configuración</label>
      <textarea
        value={config.descripcion}
        onChange={(e) => updateConfig('descripcion', e.target.value)}
        rows="3"
      />
      <small>Descripción o notas sobre esta configuración</small>
    </div>
  </div>
);

export default ConfigPage;