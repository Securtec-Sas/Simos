import React, { useState, useEffect } from 'react';
import './SimulationPage.css';

const SimulationPage = ({ socket }) => {
    const [simulationStatus, setSimulationStatus] = useState({
        is_running: false,
        mode: null,
        current_balance: 0,
        total_operations: 0,
        successful_operations: 0,
        total_profit_usdt: 0,
        active_transactions: 0
    });

    const [activeTransactions, setActiveTransactions] = useState([]);
    const [simulationConfig, setSimulationConfig] = useState({
        mode: 'local',
        initial_balance: 1000,
        time_between_transfers: 2,
        simulation_duration: 3600,
        max_concurrent_operations: 3
    });

    const [simulationHistory, setSimulationHistory] = useState([]);

    useEffect(() => {
        if (!socket) return;

        // Escuchar eventos de simulación
        socket.on('simulation_started', handleSimulationStarted);
        socket.on('simulation_stopped', handleSimulationStopped);
        socket.on('simulation_status', handleSimulationStatus);
        socket.on('transaction_update', handleTransactionUpdate);
        socket.on('simulation_start_result', handleSimulationStartResult);
        socket.on('simulation_stop_result', handleSimulationStopResult);

        // Solicitar estado inicial
        requestSimulationStatus();

        return () => {
            socket.off('simulation_started', handleSimulationStarted);
            socket.off('simulation_stopped', handleSimulationStopped);
            socket.off('simulation_status', handleSimulationStatus);
            socket.off('transaction_update', handleTransactionUpdate);
            socket.off('simulation_start_result', handleSimulationStartResult);
            socket.off('simulation_stop_result', handleSimulationStopResult);
        };
    }, [socket]);

    const handleSimulationStarted = (data) => {
        console.log('Simulación iniciada:', data);
        setSimulationStatus(prev => ({
            ...prev,
            is_running: true,
            mode: data.mode,
            current_balance: data.initial_balance
        }));
    };

    const handleSimulationStopped = (data) => {
        console.log('Simulación detenida:', data);
        setSimulationStatus(prev => ({
            ...prev,
            is_running: false
        }));
    };

    const handleSimulationStatus = (data) => {
        setSimulationStatus(data);
        if (data.active_transactions_details) {
            setActiveTransactions(data.active_transactions_details);
        }
    };

    const handleTransactionUpdate = (data) => {
        console.log('Actualización de transacción:', data);
        
        // Actualizar transacciones activas
        setActiveTransactions(prev => {
            const updated = prev.filter(tx => tx.transaction_id !== data.transaction_id);
            if (data.step !== 'completed' && data.step !== 'failed') {
                updated.push(data);
            }
            return updated;
        });

        // Si la transacción está completada, agregarla al historial
        if (data.step === 'completed' || data.step === 'failed') {
            setSimulationHistory(prev => [data, ...prev.slice(0, 49)]); // Mantener últimas 50
        }

        // Actualizar estadísticas si están disponibles
        if (data.final_stats) {
            setSimulationStatus(prev => ({
                ...prev,
                ...data.final_stats
            }));
        }
    };

    const handleSimulationStartResult = (result) => {
        if (result.success) {
            console.log('Simulación iniciada exitosamente');
        } else {
            console.error('Error iniciando simulación:', result.message);
            alert(`Error iniciando simulación: ${result.message}`);
        }
    };

    const handleSimulationStopResult = (result) => {
        if (result.success) {
            console.log('Simulación detenida exitosamente');
        } else {
            console.error('Error deteniendo simulación:', result.message);
        }
    };

    const requestSimulationStatus = () => {
        if (socket) {
            socket.emit('message', {
                type: 'get_simulation_status',
                payload: {}
            });
        }
    };

    const startSimulation = () => {
        if (!socket) return;

        const config = {
            initial_balance: parseFloat(simulationConfig.initial_balance),
            time_between_transfers: parseFloat(simulationConfig.time_between_transfers),
            simulation_duration: parseInt(simulationConfig.simulation_duration),
            max_concurrent_operations: parseInt(simulationConfig.max_concurrent_operations)
        };

        socket.emit('message', {
            type: 'start_simulation',
            payload: {
                mode: simulationConfig.mode,
                config: config
            }
        });
    };

    const stopSimulation = () => {
        if (!socket) return;

        socket.emit('message', {
            type: 'stop_simulation',
            payload: {}
        });
    };

    const getStepIcon = (step) => {
        const icons = {
            'pending': '⏳',
            'withdrawing_usdt': '💸',
            'buying_asset': '🛒',
            'transferring_asset': '🔄',
            'selling_asset': '💰',
            'completed': '✅',
            'failed': '❌'
        };
        return icons[step] || '❓';
    };

    const getStepColor = (step) => {
        const colors = {
            'pending': '#ffa500',
            'withdrawing_usdt': '#2196f3',
            'buying_asset': '#4caf50',
            'transferring_asset': '#ff9800',
            'selling_asset': '#9c27b0',
            'completed': '#4caf50',
            'failed': '#f44336'
        };
        return colors[step] || '#757575';
    };

    return (
        <div className="simulation-page">
            <div className="simulation-header">
                <h2>🎮 Simulación de Arbitraje V3</h2>
                <div className="simulation-status">
                    <span className={`status-indicator ${simulationStatus.is_running ? 'running' : 'stopped'}`}>
                        {simulationStatus.is_running ? '🟢 Ejecutándose' : '🔴 Detenida'}
                    </span>
                    {simulationStatus.mode && (
                        <span className="mode-indicator">
                            Modo: {simulationStatus.mode === 'local' ? '🏠 Local' : '🌐 Sandbox'}
                        </span>
                    )}
                </div>
            </div>

            <div className="simulation-content">
                {/* Panel de configuración */}
                <div className="config-panel">
                    <h3>⚙️ Configuración</h3>
                    <div className="config-grid">
                        <div className="config-item">
                            <label>Modo de Simulación:</label>
                            <select 
                                value={simulationConfig.mode}
                                onChange={(e) => setSimulationConfig(prev => ({...prev, mode: e.target.value}))}
                                disabled={simulationStatus.is_running}
                            >
                                <option value="local">🏠 Local (Socket)</option>
                                <option value="sebo_sandbox">🌐 Sandbox (API Sebo)</option>
                            </select>
                        </div>
                        <div className="config-item">
                            <label>Balance Inicial (USDT):</label>
                            <input 
                                type="number" 
                                value={simulationConfig.initial_balance}
                                onChange={(e) => setSimulationConfig(prev => ({...prev, initial_balance: e.target.value}))}
                                disabled={simulationStatus.is_running}
                                min="100"
                                max="10000"
                            />
                        </div>
                        <div className="config-item">
                            <label>Tiempo entre Transferencias (seg):</label>
                            <input 
                                type="number" 
                                value={simulationConfig.time_between_transfers}
                                onChange={(e) => setSimulationConfig(prev => ({...prev, time_between_transfers: e.target.value}))}
                                disabled={simulationStatus.is_running}
                                min="0.5"
                                max="10"
                                step="0.5"
                            />
                        </div>
                        <div className="config-item">
                            <label>Duración (segundos):</label>
                            <input 
                                type="number" 
                                value={simulationConfig.simulation_duration}
                                onChange={(e) => setSimulationConfig(prev => ({...prev, simulation_duration: e.target.value}))}
                                disabled={simulationStatus.is_running}
                                min="300"
                                max="86400"
                            />
                        </div>
                        <div className="config-item">
                            <label>Operaciones Concurrentes:</label>
                            <input 
                                type="number" 
                                value={simulationConfig.max_concurrent_operations}
                                onChange={(e) => setSimulationConfig(prev => ({...prev, max_concurrent_operations: e.target.value}))}
                                disabled={simulationStatus.is_running}
                                min="1"
                                max="10"
                            />
                        </div>
                    </div>
                    <div className="config-actions">
                        {!simulationStatus.is_running ? (
                            <button className="start-btn" onClick={startSimulation}>
                                ▶️ Iniciar Simulación
                            </button>
                        ) : (
                            <button className="stop-btn" onClick={stopSimulation}>
                                ⏹️ Detener Simulación
                            </button>
                        )}
                        <button className="refresh-btn" onClick={requestSimulationStatus}>
                            🔄 Actualizar Estado
                        </button>
                    </div>
                </div>

                {/* Panel de estadísticas */}
                <div className="stats-panel">
                    <h3>📊 Estadísticas</h3>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <span className="stat-label">Balance Actual:</span>
                            <span className="stat-value balance">
                                {simulationStatus.current_balance?.toFixed(2) || '0.00'} USDT
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Operaciones Totales:</span>
                            <span className="stat-value">{simulationStatus.total_operations || 0}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Operaciones Exitosas:</span>
                            <span className="stat-value success">
                                {simulationStatus.successful_operations || 0}
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Ganancia Total:</span>
                            <span className={`stat-value ${(simulationStatus.total_profit_usdt || 0) >= 0 ? 'profit' : 'loss'}`}>
                                {(simulationStatus.total_profit_usdt || 0).toFixed(4)} USDT
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Transacciones Activas:</span>
                            <span className="stat-value">{simulationStatus.active_transactions || 0}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Tasa de Éxito:</span>
                            <span className="stat-value">
                                {simulationStatus.total_operations > 0 
                                    ? ((simulationStatus.successful_operations / simulationStatus.total_operations) * 100).toFixed(1)
                                    : '0.0'
                                }%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Panel de transacciones activas */}
                {activeTransactions.length > 0 && (
                    <div className="transactions-panel">
                        <h3>🔄 Transacciones en Curso</h3>
                        <div className="transactions-list">
                            {activeTransactions.map((tx) => (
                                <div key={tx.transaction_id} className="transaction-item">
                                    <div className="transaction-header">
                                        <span className="transaction-symbol">{tx.symbol}</span>
                                        <span className="transaction-id">{tx.transaction_id}</span>
                                    </div>
                                    <div className="transaction-step">
                                        <span 
                                            className="step-indicator"
                                            style={{ color: getStepColor(tx.step) }}
                                        >
                                            {getStepIcon(tx.step)} {tx.step_description || tx.step}
                                        </span>
                                        {tx.ai_confidence && (
                                            <span className="confidence">
                                                Confianza IA: {(tx.ai_confidence * 100).toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                    {tx.profit_loss !== undefined && tx.profit_loss !== 0 && (
                                        <div className={`transaction-result ${tx.profit_loss >= 0 ? 'profit' : 'loss'}`}>
                                            {tx.profit_loss >= 0 ? '💰' : '📉'} {tx.profit_loss.toFixed(4)} USDT
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Panel de historial */}
                {simulationHistory.length > 0 && (
                    <div className="history-panel">
                        <h3>📋 Historial de Transacciones</h3>
                        <div className="history-list">
                            {simulationHistory.slice(0, 10).map((tx, index) => (
                                <div key={`${tx.transaction_id}-${index}`} className="history-item">
                                    <div className="history-header">
                                        <span className="history-symbol">{tx.symbol}</span>
                                        <span className={`history-result ${tx.success ? 'success' : 'failed'}`}>
                                            {tx.success ? '✅' : '❌'}
                                        </span>
                                    </div>
                                    <div className="history-details">
                                        <span className={`history-profit ${tx.profit_loss >= 0 ? 'profit' : 'loss'}`}>
                                            {tx.profit_loss >= 0 ? '+' : ''}{tx.profit_loss?.toFixed(4)} USDT
                                        </span>
                                        <span className="history-time">
                                            {new Date(tx.start_time).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SimulationPage;