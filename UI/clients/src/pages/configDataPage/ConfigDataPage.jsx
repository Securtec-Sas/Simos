import React, { useEffect, useState } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import DataAI from '../../components/AIDataPage/DataAI';
const ConfigDataPage = ({ sendV3Command }) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [aiModelDetails, setAiModelDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  const handleRequest = (command, payload = {}) => {
    if (sendV3Command) {
      sendV3Command(command, payload);
      if (command === 'get_ai_model_details') setIsLoading(true);
    } else {
      console.error("sendV3Command function not provided to ConfigDataPage");
      alert("Error: Cannot send command to V3.");
    }
  };

  // TODO: Implement receiving data from socket or props to update aiModelDetails and isLoading

  return (
    <Box sx={{ width: '100%' }}>
      <Tabs value={tabIndex} onChange={handleTabChange} aria-label="Config Data Page Tabs">
        <Tab label="Data Ai" />
        <Tab label="Tab 2" />
        <Tab label="Tab 3" />
        <Tab label="Tab 4" />
      </Tabs>
      {tabIndex === 0 && (
        <Box sx={{ p: 3 }}>
          <h2>Data Model AI</h2>
          <DataAI aiModelDetails={aiModelDetails} isLoading={isLoading} handleRequest={handleRequest} />  
        </Box>
      )}
      {tabIndex === 1 && (
        <Box sx={{ p: 3 }}>
          <h2>Tab 2 Content</h2>
          <p>Contenido vacío para la pestaña 2.</p>
        </Box>
      )}
      {tabIndex === 2 && (
        <Box sx={{ p: 3 }}>
          <h2>Tab 3 Content</h2>
          <p>Contenido vacío para la pestaña 3.</p>
        </Box>
      )}
      {tabIndex === 3 && (
        <Box sx={{ p: 3 }}>
          <h2>Tab 4 Content</h2>
          <p>Contenido vacío para la pestaña 4.</p>
        </Box>
      )}
    </Box>
  );
};

export default ConfigDataPage;
