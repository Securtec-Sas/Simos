import React, { useState } from 'react';
import TopSpotData from '../TopSpotData/TopSpotData.jsx'; // Importar el nuevo componente

const SpotsMenu = () => {
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [showTopSpotData, setShowTopSpotData] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleReanalyze = async () => {
    setAnalysisStatus('Analyzing...');
    try {
      await fetch('/api/spot/spotanalyzer', { method: 'POST' });
      setAnalysisStatus('Done');
    } catch (error) {
      console.error('Error sending spot analysis request:', error);
      setAnalysisStatus('Error');
    } finally {
      // Reset status after a delay
      setTimeout(() => setAnalysisStatus(''), 2000);
    }
  };

  const handleToggleTopSpotData = () => {
    setShowTopSpotData(prev => !prev);
  };

  return (
    <div className="menu-section">
      <h2 className="menu-header" onClick={toggleCollapse}>
        <span className="menu-title-text">Spot</span>
        {analysisStatus && <span className="spot-analysis-display">{analysisStatus}</span>}
        <span className="arrow-indicator">{isCollapsed ? '►' : '▼'}</span>
      </h2>
      <div id="spotsContentContainer" className={`menu-list ${isCollapsed ? 'collapsed-list' : ''}`}>
        <ul id="spotsOptionsList" className="submenu-list">
          <li>
            <button onClick={handleReanalyze} className="submenu-button">
              Analizar
            </button>
          </li>
          <li>
            <button onClick={handleToggleTopSpotData} className="submenu-button">
              {showTopSpotData ? 'Ocultar Top Data' : 'Ver Top Data'}
            </button>
          </li>
        </ul>
        {showTopSpotData && (
          <TopSpotData />
        )}
      </div>
    </div>
  );
};

export default SpotsMenu;