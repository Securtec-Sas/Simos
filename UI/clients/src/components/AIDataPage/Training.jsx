import React, { useState, useEffect } from 'react';

const Training = ({ 
  sendV3Command, 
  v3Data, 
  buttonStyle, 
  inputStyle, 
  controlGroupStyle, 
  preStyle, 
  statusBoxStyle, 
  chartPlaceholderStyle 
}) => {
  const [csvFiles, setCsvFiles] = useState([]);
  const [selectedCsv, setSelectedCsv] = useState('');
  const [trainingStatus, setTrainingStatus] = useState('idle'); // idle, training, completed
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingResults, setTrainingResults] = useState(null); // Nuevo estado para los resultados

  // 1. Cargar la lista de archivos CSV disponibles al montar el componente
  useEffect(() => {
    const fetchCsvFiles = async () => {
      try {
        const response = await fetch('/api/spot/training-files');
        if (response.ok) {
          const files = await response.json();
          setCsvFiles(files);
          if (files.length > 0) {
            setSelectedCsv(files[0]); // Seleccionar el primer archivo por defecto
          }
        } else {
          console.error('Error al obtener la lista de archivos CSV');
        }
      } catch (error) {
        console.error('Error de red al obtener archivos CSV:', error);
      }
    };
    fetchCsvFiles();
  }, []);

  // 2. Iniciar el entrenamiento con el archivo CSV seleccionado
  const handleStartTraining = () => {
    if (!selectedCsv) {
      alert('Por favor, seleccione un archivo CSV para el entrenamiento.');
      return;
    }

    if (sendV3Command) {
      console.log(`Iniciando entrenamiento con el archivo: ${selectedCsv}`);
      setTrainingStatus('training');
      setTrainingProgress(0);
      
      // Enviar el comando a V3 con el nombre del archivo
      sendV3Command('start_training', {
        use_existing_data: true,
        csv_filename: selectedCsv
      });
    } else {
      console.error("No se pudo enviar el comando a V3.");
      alert("Error: No se puede enviar el comando a V3.");
    }
  };

  // 3. Escuchar actualizaciones de entrenamiento vía WebSocket
  useEffect(() => {
    if (v3Data && v3Data.type === 'ai_training_update') {
      const { progress, status, results } = v3Data.payload;
      setTrainingProgress(progress || 0);

      if (status === 'COMPLETED') {
        setTrainingStatus('completed');
        setTrainingResults(results); // Guardar los resultados
      } else if (status === 'IN_PROGRESS') {
        setTrainingStatus('training');
      } else if (status === 'FAILED') {
        setTrainingStatus('idle'); // O un estado de 'error'
        alert('El entrenamiento ha fallado. Revise los logs del servidor.');
      }
    }
  }, [v3Data]);

  const renderTrainingResults = () => {
    if (!trainingResults) {
      return <p>No hay resultados de entrenamiento para mostrar.</p>;
    }

    return (
      <div style={{ marginTop: '20px' }}>
        <h4>Resultados del Entrenamiento:</h4>
        <pre style={preStyle}>
          {JSON.stringify(trainingResults, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="training-page">
      <h2>Entrenamiento del Modelo</h2>
      
      <div className="training-section">
        <h3>Seleccionar Datos y Entrenar</h3>

        <div style={controlGroupStyle}>
          <label htmlFor="csv-select" style={{ marginRight: '10px' }}>Datos de Entrenamiento:</label>
          <select
            id="csv-select"
            value={selectedCsv}
            onChange={(e) => setSelectedCsv(e.target.value)}
            style={{ ...inputStyle, minWidth: '300px' }}
            disabled={csvFiles.length === 0 || trainingStatus === 'training'}
          >
            {csvFiles.length > 0 ? (
              csvFiles.map(file => (
                <option key={file} value={file}>{file}</option>
              ))
            ) : (
              <option value="">No hay archivos CSV disponibles</option>
            )}
          </select>

          <button 
            onClick={handleStartTraining}
            disabled={!selectedCsv || trainingStatus === 'training'}
            style={{...buttonStyle, backgroundColor: '#28a745'}}
          >
            {trainingStatus === 'training' ? `Entrenando... (${trainingProgress.toFixed(0)}%)` : 'Iniciar Entrenamiento'}
          </button>
        </div>

        {trainingStatus === 'training' && (
          <div className="training-progress" style={{ marginTop: '20px' }}>
            <p>Progreso: {trainingProgress.toFixed(2)}%</p>
            <div style={{
              width: '100%',
              backgroundColor: '#e0e0e0',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div
                style={{
                  width: `${trainingProgress}%`,
                  height: '20px',
                  backgroundColor: '#4caf50',
                  transition: 'width 0.3s ease-in-out'
                }}
              ></div>
            </div>
          </div>
        )}

        {trainingStatus === 'training' && trainingProgress > 0 && (
          <div style={chartPlaceholderStyle}>
            Gráfica de Progreso de Entrenamiento (ej: Loss vs Epochs) iría aquí.
            <br />
            Progreso actual: {trainingProgress.toFixed(2)}%
          </div>
        )}

        {trainingStatus === 'completed' && (
          <div style={statusBoxStyle('COMPLETED')}>
            <p>✅ Entrenamiento completado exitosamente.</p>
            {renderTrainingResults()}
          </div>
        )}
      </div>
    </div>
  );
};

export default Training;
