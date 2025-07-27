import React from 'react';

const Training = ({
  trainDataSource,
  setTrainDataSource,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  numSymbols,
  setNumSymbols,
  numOperations,
  setNumOperations,
  trainingFile,
  setTrainingFile,
  trainingFileError,
  handleFileChange,
  handleTrainClick,
  trainingStatus,
  buttonStyle,
  inputStyle,
  selectStyle,
  controlGroupStyle,
  sectionStyle,
  chartPlaceholderStyle,
  preStyle,
  statusBoxStyle,
}) => {
  return (
    <div style={sectionStyle}>
      <h2>Entrenamiento del Modelo</h2>
      <div style={controlGroupStyle}>
        <label>Fuente:
          <select value={trainDataSource} onChange={e => setTrainDataSource(e.target.value)} style={selectStyle}>
            <option value="sebo_api">Sebo API (Histórico)</option>
            <option value="csv_upload">Subir CSV</option>
          </select>
        </label>
        {trainDataSource === 'sebo_api' && (
          <>
            <label>Fecha Inicial: <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} /></label>
            <label>Fecha Final: <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} /></label>
            <label>Cant. Símbolos: <input type="number" value={numSymbols} onChange={e => setNumSymbols(parseInt(e.target.value))} style={inputStyle} /></label>
            <label>Cant. Operaciones: <input type="number" value={numOperations} onChange={e => setNumOperations(parseInt(e.target.value))} style={inputStyle} /></label>
          </>
        )}
        {trainDataSource === 'csv_upload' && (
          <div>
            <input type="file" accept=".csv" onChange={handleFileChange} style={{ ...inputStyle, width: 'auto' }} />
            {trainingFile && <p style={{marginTop: '5px', fontSize: '12px'}}>Archivo seleccionado: {trainingFile.name}</p>}
            {trainingFileError && <p style={{ color: 'red', marginTop: '5px', fontSize: '12px' }}>{trainingFileError}</p>}
          </div>
        )}
      </div>

      {trainDataSource === 'sebo_api' && (
        <div style={{ ...sectionStyle, marginTop: '20px' }}>
          <h3>Crear CSV para Entrenamiento</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const response = await fetch('/api/trading/create-training-csv', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    fecha_inicio: startDate,
                    intervalo: '1h',
                    cantidad_operaciones: numOperations,
                    cantidad_simbolos: numSymbols,
                    lista_simbolos: [],
                  }),
                });
                if (!response.ok) {
                  throw new Error('Error al crear CSV');
                }
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'training_data.csv';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
              } catch (error) {
                alert('Error al crear CSV: ' + error.message);
              }
            }}
          >
            <button type="submit" style={{ ...buttonStyle, backgroundColor: '#007bff' }}>
              Descargar CSV de Entrenamiento
            </button>
          </form>
        </div>
      )}

      <div style={controlGroupStyle}>
        <button
          onClick={handleTrainClick}
          style={{...buttonStyle, backgroundColor: '#28a745'}}
          disabled={trainingStatus.status === 'REQUESTED' || trainingStatus.status === 'STARTED' || trainingStatus.status === 'GENERATING_SIM_DATA' || trainingStatus.status === 'FETCHING_DATA_SEBO' || trainingStatus.status === 'TRAINING_IN_PROGRESS'}
        >
          Entrenar Modelo
        </button>
      </div>
      {trainingStatus.status !== 'IDLE' && (
        <div style={statusBoxStyle(trainingStatus.status)}>
          <p>Estado de Entrenamiento: <strong>{trainingStatus.status}</strong></p>
          {trainingStatus.progress !== null && typeof trainingStatus.progress === 'number' && <p>Progreso: {(trainingStatus.progress * 100).toFixed(1)}%</p>}
          {trainingStatus.details && Object.keys(trainingStatus.details).length > 0 && (
            <pre style={{...preStyle, maxHeight: '150px'}}>{JSON.stringify(trainingStatus.details, null, 2)}</pre>
          )}
          {trainingStatus.status === 'TRAINING_IN_PROGRESS' && trainingStatus.progress > 0 && (
            <div style={chartPlaceholderStyle}>
              Gráfica de Progreso de Entrenamiento (ej: Loss vs Epochs) iría aquí.
              <br />
              Progreso actual: {(trainingStatus.progress * 100).toFixed(1)}%
            </div>
          )}
          {trainingStatus.status === 'COMPLETED' && trainingStatus.details && (
            <div style={chartPlaceholderStyle}>
              Gráfica de Resultados de Entrenamiento (ej: Métricas finales) iría aquí.
              <br/>
              Datos disponibles en "trainingStatus.details".
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Training;
