import React, { useState, useEffect } from 'react';

const Test = ({ 
  sendV3Command, 
  v3Data, 
  buttonStyle, 
  inputStyle, 
  controlGroupStyle, 
  preStyle, 
  statusBoxStyle 
}) => {
  const [testFile, setTestFile] = useState(null);
  const [testResults, setTestResults] = useState(null);

  const handleRunTests = async (testCsvFile) => {
    try {
      const formData = new FormData();
      formData.append('testCsv', testCsvFile);

      const response = await fetch('/api/v3/run-tests', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.status === 'success') {
        setTestResults(result.data);
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error ejecutando pruebas:', error);
      alert('Error ejecutando pruebas');
    }
  };

  // Escuchar resultados de pruebas vía WebSocket
  useEffect(() => {
    if (v3Data && v3Data.type === 'test_results') {
      setTestResults(v3Data.payload.results);
    }
  }, [v3Data]);

  return (
    <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>Prueba del Modelo</h2>
      
      <div style={controlGroupStyle}>
        <div>
          <label htmlFor="testCsv" style={{ display: 'block', marginBottom: '5px' }}>Cargar CSV de pruebas (diferente al de entrenamiento):</label>
          <input
            type="file"
            id="testCsv"
            accept=".csv"
            onChange={(e) => {
              if (e.target.files[0]) {
                setTestFile(e.target.files[0]);
                handleRunTests(e.target.files[0]);
              }
            }}
            style={{ ...inputStyle, width: 'auto' }}
          />
          <small>El archivo debe tener el mismo formato que el CSV de entrenamiento</small>
        </div>
      </div>

      {testResults && (
        <div style={{...statusBoxStyle('COMPLETED'), marginTop: '20px'}}>
          <h3>Resultados de las Pruebas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '10px' }}>
            <div>
              <label>Precisión:</label>
              <span style={{ marginLeft: '5px' }}>{testResults.accuracy ? (testResults.accuracy * 100).toFixed(2) + '%' : 'N/A'}</span>
            </div>
            <div>
              <label>Recall:</label>
              <span style={{ marginLeft: '5px' }}>{testResults.recall ? (testResults.recall * 100).toFixed(2) + '%' : 'N/A'}</span>
            </div>
            <div>
              <label>F1-Score:</label>
              <span style={{ marginLeft: '5px' }}>{testResults.f1Score ? (testResults.f1Score * 100).toFixed(2) + '%' : 'N/A'}</span>
            </div>
            <div>
              <label>Operaciones exitosas:</label>
              <span style={{ marginLeft: '5px' }}>{testResults.successfulOperations || 0}/{testResults.totalOperations || 0}</span>
            </div>
          </div>
          
          <div style={{width: '100%', height: '200px', backgroundColor: '#e0e0e0', border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#666', fontSize: '16px', marginTop: '15px', borderRadius: '4px'}}>
            Gráfica de Resultados de Prueba (ej: Accuracy, Precision, Recall, Curva ROC) iría aquí.
            <br />
            Datos disponibles en "testResults".
          </div>
        </div>
      )}
    </div>
  );
};

export default Test;
