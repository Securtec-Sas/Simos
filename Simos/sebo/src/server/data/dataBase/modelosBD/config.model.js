const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    porcentajeInversion: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    stopLossGlobal: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    reinvertirGanancias: {
        type: Boolean,
        required: true
    },
    porcentajeReinversion: {
        type: Number,
        required: function() { return this.reinvertirGanancias; },
        min: 0,
        max: 100
    }
});




const ConfigE = mongoose.model('Config', configSchema);

module.exports = ConfigE;