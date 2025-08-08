import React, { useState, useEffect, useCallback } from 'react';
import styles from './DataViewPage.module.css';

// Assuming App.jsx will manage the WebSocket connection and pass it down or provide methods to send messages.
// For now, this component will manage its own WebSocket interactions for simplicity in this step.
// Later, this could be refactored to use a context or props for WebSocket.

const V2_WEBSOCKET_URL = 'ws://localhost:3001'; // V2's WebSocket for UI

const DataViewPage = () => {
  const [socket, setSocket] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);
  const [trainingStatus, setTrainingStatus] = useState('');
  const [trainingResults, setTrainingResults] = useState(null);
  const [evaluationStatus, setEvaluationStatus] = useState('');
  const [evaluationMetrics, setEvaluationMetrics] = useState(null);
  const [connected, setConnected] = useState(false);

  // For train parameters
  const [trainEpochs, setTrainEpochs] = useState(1); // Default, though LR doesn't use it
  const [numSimulatedSamples, setNumSimulatedSamples] = useState(100);


  const connectWebSocket = useCallback(() => {
    console.log('Attempting to connect to V2 WebSocket...');
    const ws = new WebSocket(V2_WEBSOCKET_URL);

    ws.onopen = () => {
      console.log('DataViewPage: Connected to V2 WebSocket.');
      setConnected(true);
      setSocket(ws);
      // Request initial model status on connect
      ws.send(JSON.stringify({ type: 'get_model_status' }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('DataViewPage: Message from V2:', message);

        switch (message.type) {
          case 'model_status_update':
            setModelStatus(message.payload);
            break;
          case 'model_training_update':
            setTrainingStatus(message.payload.message || message.payload.status);
            if (message.payload.status === 'success' || message.payload.status === 'failed') {
              setTrainingResults(message.payload.results || { error: message.payload.error });
            }
            // Could also handle intermediate progress updates here
            break;
          case 'model_evaluation_update':
            setEvaluationStatus(message.payload.message || message.payload.status);
            if (message.payload.status === 'success' || message.payload.status === 'failed') {
              setEvaluationMetrics(message.payload.metrics || { error: message.payload.error });
            }
            break;
          case 'error':
            // Handle generic errors from V2
            console.error("Error message from V2:", message.message);
            // Potentially display this in the UI
            break;
          default:
            // console.log('Unhandled message type:', message.type);
            break;
        }
      } catch (error) {
        console.error('DataViewPage: Error parsing message from V2 or unexpected format:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('DataViewPage: V2 WebSocket error:', error);
      setTrainingStatus('WebSocket error.');
      setEvaluationStatus('WebSocket error.');
    };

    ws.onclose = (event) => {
      console.log('DataViewPage: Disconnected from V2 WebSocket:', event.reason, `Code: ${event.code}`);
      setConnected(false);
      setSocket(null);
      // Optionally, try to reconnect
    };

    // setSocket(ws); // Moved to onopen to ensure socket is ready
    return ws; // Return ws instance for cleanup
  }, []);


  useEffect(() => {
    const wsInstance = connectWebSocket();
    // Cleanup function to close the WebSocket when the component unmounts
    return () => {
      if (wsInstance && (wsInstance.readyState === WebSocket.OPEN || wsInstance.readyState === WebSocket.CONNECTING)) {
        console.log("DataViewPage: Closing V2 WebSocket connection on unmount.");
        wsInstance.close();
      }
    };
  }, [connectWebSocket]);

  const handleGetModelStatus = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'get_model_status' }));
    } else {
      alert('WebSocket not connected. Please try again.');
    }
  };

  const handleTrainModel = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      setTrainingStatus('Initiating training...');
      setTrainingResults(null);
      const payload = {
        epochs: parseInt(trainEpochs, 10),
        num_simulated_samples: parseInt(numSimulatedSamples, 10)
        // Add other parameters if needed, e.g., data_source_info
      };
      socket.send(JSON.stringify({ type: 'train_model', payload }));
    } else {
      alert('WebSocket not connected. Please try again.');
    }
  };

  const handleTestModel = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      setEvaluationStatus('Initiating evaluation...');
      setEvaluationMetrics(null);
      const payload = {
        num_simulated_samples: parseInt(numSimulatedSamples, 10)
        // Add other parameters if needed, e.g., data_source_info for specific test set
      };
      socket.send(JSON.stringify({ type: 'test_model', payload }));
    } else {
      alert('WebSocket not connected. Please try again.');
    }
  };

  const handleSimulateTrading = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("DataViewPage: Sending simulate_arbitrage_scenario to V2.");
      // V2's trigger_arbitrage_simulation can use defaults or pick from Top 20
      // if opportunity_data is not provided.
      // It can also use simulated_balance_usdt and simulated_investment_usdt from payload.
      const payload = {
        // opportunity_data: null, // Explicitly null or omit if V2 should pick from Top 20
        simulated_balance_usdt: parseFloat(modelStatus?.summary?.simulated_balance_usdt || 1000), // Example: reuse a value or make it configurable
        simulated_investment_usdt: parseFloat(modelStatus?.summary?.simulated_investment_usdt || 100) // Example
      };
      // The numSimulatedSamples state could also be relevant if the simulation involves multiple runs,
      // but current V2 simulation is for one scenario.
      socket.send(JSON.stringify({ type: 'simulate_arbitrage_scenario', payload }));
      alert("Arbitrage simulation request sent to V2. Check V2 console and UI for updates (if any wired up for 'simulation_update').");
    } else {
      alert('WebSocket not connected. Please try again.');
    }
  };

  return (
    <div className={styles.dataViewContainer}>
      <h1>Model Interaction & Data View</h1>
      <p>WebSocket Status: {connected ? <span className={styles.connected}>Connected</span> : <span className={styles.disconnected}>Disconnected</span>}</p>

      {!connected && (
        <button onClick={connectWebSocket} className={styles.button}>Reconnect WebSocket</button>
      )}

      <div className={styles.section}>
        <h2>Model Status</h2>
        <button onClick={handleGetModelStatus} disabled={!socket || socket.readyState !== WebSocket.OPEN} className={styles.button}>Refresh Status</button>
        {modelStatus ? (
          <pre className={styles.preformatted}>{JSON.stringify(modelStatus, null, 2)}</pre>
        ) : (
          <p>Loading model status...</p>
        )}
      </div>

      <div className={styles.section}>
        <h2>Train Model</h2>
        <div className={styles.paramGroup}>
          <label htmlFor="trainEpochs">Epochs (for future models): </label>
          <input
            type="number"
            id="trainEpochs"
            value={trainEpochs}
            onChange={(e) => setTrainEpochs(e.target.value)}
            className={styles.inputField}
          />
        </div>
        <div className={styles.paramGroup}>
          <label htmlFor="numSimulatedSamples">Number of Simulated Samples (Train/Test): </label>
          <input
            type="number"
            id="numSimulatedSamples"
            value={numSimulatedSamples}
            onChange={(e) => setNumSimulatedSamples(e.target.value)}
            className={styles.inputField}
          />
        </div>
        <button onClick={handleTrainModel} disabled={!socket || socket.readyState !== WebSocket.OPEN} className={styles.button}>Train Model</button>
        {trainingStatus && <p>Status: {trainingStatus}</p>}
        {trainingResults && (
          <div>
            <h3>Training Results:</h3>
            <pre className={styles.preformatted}>{JSON.stringify(trainingResults, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2>Test Model</h2>
        <button onClick={handleTestModel} disabled={!socket || socket.readyState !== WebSocket.OPEN} className={styles.button}>Test Model</button>
        {evaluationStatus && <p>Status: {evaluationStatus}</p>}
        {evaluationMetrics && (
          <div>
            <h3>Evaluation Metrics:</h3>
            <pre className={styles.preformatted}>{JSON.stringify(evaluationMetrics, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2>Simulate Trading</h2>
        <button onClick={handleSimulateTrading} className={styles.button}>Simulate Trading Process</button>
        {/* Simulation results could be displayed here later */}
      </div>
    </div>
  );
};

export default DataViewPage;
