// API Configuration for microservices using Vite proxy
export const API_CONFIG = {
  // Sebo microservice endpoints (via proxy /api/sebo)
  sebo: {
    baseURL: '/api/sebo',
    endpoints: {
      health: '/health',
      data: '/api/data',
      analysis: '/api/analysis',
      balance: '/api/balance',
      symbols: '/symbols',
      spot: {
        trainingFiles: '/spot/training-files',
        arb: '/spot/arb'
      }
    }
  },
  
  // V3 microservice endpoints (via proxy /api/v3)
  v3: {
    baseURL: '/api/v3',
    endpoints: {
      health: '/health',
      predictions: '/api/predictions',
      training: '/api/training',
      models: '/api/models',
      createTrainingCsv: '/create-training-csv',
      createTestCsv: '/create-test-csv'
    }
  },
  
  // Additional service endpoints (via proxy /api/service3)
  service3: {
    baseURL: '/api/service3',
    endpoints: {
      health: '/health',
      data: '/api/data',
    }
  },
};

// Helper function to build full API URLs using proxy routes
export const buildApiUrl = (service, endpoint) => {
  const config = API_CONFIG[service];
  if (!config) {
    throw new Error(`Unknown service: ${service}`);
  }
  
  // Handle nested endpoints (like sebo.spot.trainingFiles)
  if (typeof endpoint === 'string' && endpoint.includes('.')) {
    const parts = endpoint.split('.');
    let current = config.endpoints;
    for (const part of parts) {
      current = current[part];
      if (!current) {
        throw new Error(`Unknown endpoint path: ${endpoint} for service: ${service}`);
      }
    }
    return `${config.baseURL}${current}`;
  }
  
  return `${config.baseURL}${config.endpoints[endpoint] || endpoint}`;
};

// Convenience functions for common API calls
export const API_URLS = {
  // SEBO service URLs
  sebo: {
    symbols: buildApiUrl('sebo', 'symbols'),
    trainingFiles: buildApiUrl('sebo', 'spot.trainingFiles'),
    health: buildApiUrl('sebo', 'health'),
    balance: buildApiUrl('sebo', 'balance')
  },
  
  // V3 service URLs
  v3: {
    createTrainingCsv: buildApiUrl('v3', 'createTrainingCsv'),
    createTestCsv: buildApiUrl('v3', 'createTestCsv'),
    health: buildApiUrl('v3', 'health'),
    models: buildApiUrl('v3', 'models')
  },
  
  // Service3 URLs
  service3: {
    health: buildApiUrl('service3', 'health'),
    data: buildApiUrl('service3', 'data')
  }
};

// Export proxy configuration for vite
export const proxyConfig = {
  '/api/sebo': {
    target: 'http://localhost:3031',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api\/sebo/, ''),
  },
  '/api/v3': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api\/v3/, ''),
  },
  '/api/service3': {
    target: 'http://localhost:3002',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api\/service3/, ''),
  },
};
