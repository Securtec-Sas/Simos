const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    // Configuración de inversión
    porcentajeInversion: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 10.0
    },
    modoInversion: {
        type: String,
        enum: ['PERCENTAGE', 'FIXED'],
        default: 'PERCENTAGE'
    },
    inversionFijaUsdt: {
        type: Number,
        min: 0,
        default: 50.0
    },
    
    // Configuración de stop loss y take profit
    stopLossGlobal: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 50.0
    },
    stopLossOperacion: {
        type: Number,
        min: 0,
        max: 100,
        default: 50.0
    },
    takeProfitOperacion: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    
    // Configuración de reinversión
    reinvertirGanancias: {
        type: Boolean,
        required: true,
        default: false
    },
    porcentajeReinversion: {
        type: Number,
        required: function() { return this.reinvertirGanancias; },
        min: 0,
        max: 100,
        default: 50.0
    },
    
    // Configuración de rentabilidad mínima
    porcentajeGananciaMinimaOperacion: {
        type: Number,
        min: 0,
        max: 100,
        default: 0.6
    },
    gananciaMinimaUsdt: {
        type: Number,
        min: 0,
        default: 0.01
    },
    balanceMinimoOperacionalUsdt: {
        type: Number,
        min: 0,
        default: 10.0
    },
    
    // Configuración de IA
    umbralConfianzaIA: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.7
    },
    rutaModeloIA: {
        type: String,
        default: 'models/arbitrage_model.pkl'
    },
    rutaDatosEntrenamientoIA: {
        type: String,
        default: 'data/training_data.csv'
    },
    
    // Configuración de simulación
    modoSimulacion: {
        type: Boolean,
        default: false
    },
    delaySimulacion: {
        type: Number,
        min: 0,
        default: 0.1
    },
    
    // Configuración de simulación avanzada
    balanceInicialSimulacion: {
        type: Number,
        min: 0,
        default: 10000.0
    },
    tiempoEntreTransferenciasSegundos: {
        type: Number,
        min: 0,
        default: 30
    },
    duracionSimulacionMinutos: {
        type: Number,
        min: 0,
        default: 60
    },
    maxOperacionesConcurrentes: {
        type: Number,
        min: 1,
        default: 3
    },
    
    // Configuración de comisiones
    comisionRetiroUsdt: {
        type: Number,
        min: 0,
        default: 1.0
    },
    comisionRetiroActivoPorcentaje: {
        type: Number,
        min: 0,
        max: 100,
        default: 0.1
    },
    comisionTradingPorcentaje: {
        type: Number,
        min: 0,
        max: 100,
        default: 0.1
    },
    
    // Configuración de red y timeouts
    timeoutRequest: {
        type: Number,
        min: 1,
        default: 30
    },
    delayReconexionWebsocket: {
        type: Number,
        min: 1,
        default: 5
    },
    maxIntentosReconexion: {
        type: Number,
        min: 1,
        default: 10
    },
    
    // Configuración de logging
    nivelLog: {
        type: String,
        enum: ['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default: 'INFO'
    },
    rutaArchivoLog: {
        type: String,
        default: 'logs/v3_operations.log'
    },
    rutaLogCsv: {
        type: String,
        default: 'logs/v3_operation_logs.csv'
    },
    
    // Configuración de persistencia
    rutaEstadoTrading: {
        type: String,
        default: 'data/trading_state.json'
    },
    rutaCacheBalance: {
        type: String,
        default: 'data/balance_cache.json'
    },
    
    // Redes de transferencia preferidas
    redesPreferidas: {
        type: Map,
        of: [String],
        default: {
            'USDT': ['TRC20', 'BSC', 'POLYGON', 'ERC20'],
            'BTC': ['BTC', 'BSC', 'POLYGON'],
            'ETH': ['BSC', 'POLYGON', 'ERC20'],
            'BNB': ['BSC', 'BEP2']
        }
    },
    
    // Metadatos
    fechaCreacion: {
        type: Date,
        default: Date.now
    },
    fechaActualizacion: {
        type: Date,
        default: Date.now
    },
    activo: {
        type: Boolean,
        default: true
    },
    descripcion: {
        type: String,
        default: 'Configuración principal del sistema'
    }
}, {
    timestamps: true // Agrega automáticamente createdAt y updatedAt
});

// Middleware para actualizar fechaActualizacion antes de guardar
configSchema.pre('save', function(next) {
    this.fechaActualizacion = new Date();
    next();
});

const ConfigE = mongoose.model('Config', configSchema);

module.exports = ConfigE;