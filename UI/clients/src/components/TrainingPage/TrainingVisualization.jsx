import React, { useEffect, useRef, useState } from 'react';
import './TrainingVisualization.css';

const TrainingVisualization = ({ trainingStatus, trainingProgress, trainingData }) => {
  const canvasRef = useRef(null);
  const [chartData, setChartData] = useState({
    accuracy: [],
    loss: [],
    epochs: []
  });

  useEffect(() => {
    if (trainingData && trainingData.type === 'training_progress') {
      const payload = trainingData.payload;
      
      setChartData(prev => ({
        accuracy: [...prev.accuracy, payload.accuracy || 0],
        loss: [...prev.loss, payload.loss || 0],
        epochs: [...prev.epochs, payload.epoch || prev.epochs.length]
      }));
    }
  }, [trainingData]);

  useEffect(() => {
    drawChart();
  }, [chartData, trainingStatus, trainingProgress]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);

    // Configuración del gráfico
    const padding = 60;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Dibujar fondo
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);

    // Dibujar área del gráfico
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(padding, padding, chartWidth, chartHeight);

    // Dibujar bordes
    ctx.strokeStyle = '#dee2e6';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, padding, chartWidth, chartHeight);

    if (trainingStatus === 'idle') {
      // Mostrar mensaje de espera
      ctx.fillStyle = '#6c757d';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Inicie el entrenamiento para ver la visualización', width / 2, height / 2);
      return;
    }

    if (trainingStatus === 'training') {
      // Mostrar progreso de entrenamiento
      drawTrainingProgress(ctx, width, height, padding, chartWidth, chartHeight);
    }

    if (chartData.accuracy.length > 0) {
      // Dibujar gráficos de precisión y pérdida
      drawAccuracyChart(ctx, padding, chartWidth, chartHeight);
      drawLossChart(ctx, padding, chartWidth, chartHeight);
    }

    // Dibujar ejes y etiquetas
    drawAxes(ctx, padding, chartWidth, chartHeight);
  };

  const drawTrainingProgress = (ctx, width, height, padding, chartWidth, chartHeight) => {
    // Barra de progreso
    const progressBarHeight = 20;
    const progressBarY = height - padding - 30;
    
    ctx.fillStyle = '#e9ecef';
    ctx.fillRect(padding, progressBarY, chartWidth, progressBarHeight);
    
    ctx.fillStyle = '#007bff';
    const progressWidth = (trainingProgress / 100) * chartWidth;
    ctx.fillRect(padding, progressBarY, progressWidth, progressBarHeight);
    
    // Texto de progreso
    ctx.fillStyle = '#495057';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Progreso: ${trainingProgress}%`, width / 2, progressBarY - 10);

    // Simular datos de entrenamiento en tiempo real
    if (chartData.accuracy.length === 0) {
      // Generar datos simulados para la visualización
      const epochs = Math.floor(trainingProgress / 10);
      for (let i = 0; i <= epochs; i++) {
        chartData.accuracy.push(0.5 + (i * 0.05) + Math.random() * 0.1);
        chartData.loss.push(1.0 - (i * 0.08) + Math.random() * 0.1);
        chartData.epochs.push(i);
      }
    }
  };

  const drawAccuracyChart = (ctx, padding, chartWidth, chartHeight) => {
    if (chartData.accuracy.length < 2) return;

    const maxAccuracy = Math.max(...chartData.accuracy, 1);
    const minAccuracy = Math.min(...chartData.accuracy, 0);

    ctx.strokeStyle = '#28a745';
    ctx.lineWidth = 2;
    ctx.beginPath();

    chartData.accuracy.forEach((accuracy, index) => {
      const x = padding + (index / (chartData.accuracy.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((accuracy - minAccuracy) / (maxAccuracy - minAccuracy)) * (chartHeight / 2);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Etiqueta
    ctx.fillStyle = '#28a745';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Precisión', padding + 10, padding + 20);
  };

  const drawLossChart = (ctx, padding, chartWidth, chartHeight) => {
    if (chartData.loss.length < 2) return;

    const maxLoss = Math.max(...chartData.loss, 1);
    const minLoss = Math.min(...chartData.loss, 0);

    ctx.strokeStyle = '#dc3545';
    ctx.lineWidth = 2;
    ctx.beginPath();

    chartData.loss.forEach((loss, index) => {
      const x = padding + (index / (chartData.loss.length - 1)) * chartWidth;
      const y = padding + (chartHeight / 2) + ((loss - minLoss) / (maxLoss - minLoss)) * (chartHeight / 2);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Etiqueta
    ctx.fillStyle = '#dc3545';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Pérdida', padding + 10, padding + chartHeight / 2 + 20);
  };

  const drawAxes = (ctx, padding, chartWidth, chartHeight) => {
    ctx.strokeStyle = '#495057';
    ctx.lineWidth = 1;

    // Eje X
    ctx.beginPath();
    ctx.moveTo(padding, padding + chartHeight);
    ctx.lineTo(padding + chartWidth, padding + chartHeight);
    ctx.stroke();

    // Eje Y
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + chartHeight);
    ctx.stroke();

    // Etiquetas de ejes
    ctx.fillStyle = '#495057';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Épocas', padding + chartWidth / 2, padding + chartHeight + 40);

    ctx.save();
    ctx.translate(20, padding + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Precisión / Pérdida', 0, 0);
    ctx.restore();
  };

  return (
    <div className="training-visualization">
      <div className="visualization-header">
        <h3>Visualización del Entrenamiento en Tiempo Real</h3>
        <div className="status-indicators">
          <div className={`status-indicator ${trainingStatus}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {trainingStatus === 'idle' && 'Esperando'}
              {trainingStatus === 'training' && 'Entrenando'}
              {trainingStatus === 'completed' && 'Completado'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="chart-container">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="training-chart"
        />
      </div>

      <div className="training-metrics">
        <div className="metrics-grid">
          <div className="metric-item">
            <label>Precisión Actual:</label>
            <span className="metric-value accuracy">
              {chartData.accuracy.length > 0 ? 
                (chartData.accuracy[chartData.accuracy.length - 1] * 100).toFixed(2) + '%' : 
                '0%'
              }
            </span>
          </div>
          <div className="metric-item">
            <label>Pérdida Actual:</label>
            <span className="metric-value loss">
              {chartData.loss.length > 0 ? 
                chartData.loss[chartData.loss.length - 1].toFixed(4) : 
                '0.0000'
              }
            </span>
          </div>
          <div className="metric-item">
            <label>Época Actual:</label>
            <span className="metric-value epoch">
              {chartData.epochs.length > 0 ? 
                chartData.epochs[chartData.epochs.length - 1] : 
                '0'
              }
            </span>
          </div>
          <div className="metric-item">
            <label>Progreso:</label>
            <span className="metric-value progress">
              {trainingProgress}%
            </span>
          </div>
        </div>
      </div>

      {trainingStatus === 'completed' && (
        <div className="completion-message">
          <h4>🎉 Entrenamiento Completado</h4>
          <p>El modelo ha sido entrenado exitosamente. El gráfico final muestra el rendimiento del modelo.</p>
        </div>
      )}
    </div>
  );
};

export default TrainingVisualization;

