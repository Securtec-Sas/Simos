const swaggerJsdoc = require('swagger-jsdoc');
const { PORT } = require('../utils/config'); // Asegúrate que la ruta a config sea correcta

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'SEBO API',
            version: '1.0.0',
            description: 'API para el Sistema de Especulación Basado en Oportunidades (SEBO)',
            contact: {
                name: "Tu Nombre/Equipo",
                url: "http://tuwebsite.com",
                email: "tuemail@example.com"
            },
            license: {
                name: "MIT",
                url: "https://opensource.org/licenses/MIT"
            }
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Servidor de Desarrollo Local',
            },
            // Puedes añadir más servidores (staging, producción) aquí
        ],
        components: {
            schemas: {
                ExchangeConfig: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            description: 'ID único del exchange.',
                            example: 'binance',
                        },
                        name: {
                            type: 'string',
                            description: 'Nombre legible del exchange.',
                            example: 'Binance',
                        },
                        isActive: {
                            type: 'boolean',
                            description: 'Indica si el exchange está marcado como activo en la configuración.',
                            example: true,
                        },
                        isCoreExchange: {
                            type: 'boolean',
                            description: 'Indica si es un exchange principal.',
                            example: true,
                        },
                        connectionType: {
                            type: 'string',
                            nullable: true,
                            description: 'Tipo de conexión (ej. "ccxt", null).',
                            example: 'ccxt',
                        },
                        ccxtSupported: {
                            type: 'boolean',
                            description: 'Indica si el exchange (si es ccxt) es soportado por la librería CCXT instalada.',
                            example: true
                        }
                    },
                },
                ExchangeStatus: {
                    type: 'object',
                    properties: {
                        exchangeId: {
                            type: 'string',
                            example: 'binance',
                        },
                        name: {
                           type: 'string',
                           example: 'Binance'
                        },
                        connected: {
                            type: 'boolean',
                            example: true,
                        },
                        status: {
                            type: 'string',
                            example: 'Online'
                        },
                        error: {
                            type: 'string',
                            nullable: true,
                            example: null,
                        },
                    },
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string'
                        },
                        error: {
                            type: 'string',
                            nullable: true
                        }
                    }
                }
            }
        },
        tags: [
            {
                name: "Exchanges",
                description: "Operaciones relacionadas con la configuración y estado de los exchanges"
            },
            {
                name: "Spot",
                description: "Operaciones relacionadas con el análisis de mercado Spot"
            }
        ]
    },
    // Rutas a los archivos que contienen las definiciones OpenAPI (tus controladores/rutas)
    apis: ['./src/server/app.js', './src/server/controllers/*.js'], // Ajusta según la ubicación de tus rutas
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = swaggerSpec;
