import React from 'react';

const Test = ({
  testFile,
  testFileError,
  handleTestFileChange,
  handleRequest,
  aiModelDetails,
  testResults,
  buttonStyle,
  inputStyle,
  controlGroupStyle,
  preStyle,
  statusBoxStyle,
}) => {
  return (
    <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>Prueba del Modelo</h2>
      <div style={controlGroupStyle}>
        <div>
          <label htmlFor="testFileUpload" style={{ display: 'block', marginBottom: '5px' }}>Archivo CSV para Prueba:</label>
          <input id="testFileUpload" type="file" accept=".csv" onChange={handleTestFileChange} style={{ ...inputStyle, width: 'auto' }} />
          {testFile && <p style={{marginTop: '5px', fontSize: '12px'}}>Archivo seleccionado: {testFile.name}</p>}
          {testFileError && <p style={{ color: 'red', marginTop: '5px', fontSize: '12px' }}>{testFileError}</p>}
        </div>
      </div>
      <div style={controlGroupStyle}>
        <button
          onClick={() => {
            if (!testFile) {
              alert('Por favor, selecciona un archivo CSV para probar.');
              return;
            }
            handleRequest('test_ai_model', { file_name: testFile.name });
          }}
          style={{...buttonStyle, backgroundColor: '#ffc107', color: 'black'}}
          disabled={!aiModelDetails || !aiModelDetails.is_trained || testResults?.status === "REQUESTED" || !testFile}
        >
          Probar Modelo con CSV
        </button>
      </div>
      {testResults && (
        <div style={statusBoxStyle(testResults.error ? 'FAILED' : 'COMPLETED')}>
          <h3>Resultados de Prueba:</h3>
          <pre style={preStyle}>{JSON.stringify(testResults, null, 2)}</pre>
          {!testResults.error && Object.keys(testResults).length > 0 && (
            <div style={{width: '100%', height: '200px', backgroundColor: '#e0e0e0', border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#666', fontSize: '16px', marginTop: '15px', borderRadius: '4px'}}>
              Gráfica de Resultados de Prueba (ej: Accuracy, Precision, Recall, Curva ROC) iría aquí.
              <br />
              Datos disponibles en "testResults".
            </div>
          )}
        </div>
      )}
      {aiModelDetails && !aiModelDetails.is_trained && <p style={{color: 'orange', marginTop:'5px'}}>El modelo necesita ser entrenado antes de poder probarlo.</p>}
    </div>
  );
};

export default Test;
