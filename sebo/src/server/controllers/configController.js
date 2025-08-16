const ConfigE = require('../data/dataBase/modelosBD/config.model');

// Get main configuration (returns the active config or creates default if none exists)
exports.getConfig = async (req, res) => {
    try {
        let config = await ConfigE.findOne({ activo: true });
        
        // Si no existe configuración activa, crear una por defecto
        if (!config) {
            config = new ConfigE({
                descripcion: 'Configuración principal del sistema - Creada automáticamente'
            });
            await config.save();
        }
        
        res.status(200).json({
            success: true,
            data: config,
            message: 'Configuración obtenida exitosamente'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Error al obtener la configuración'
        });
    }
};

// Update main configuration
exports.updateConfig = async (req, res) => {
    try {
        let config = await ConfigE.findOne({ activo: true });
        
        if (!config) {
            // Si no existe, crear nueva configuración
            config = new ConfigE(req.body);
        } else {
            // Actualizar configuración existente
            Object.assign(config, req.body);
        }
        
        await config.save();
        
        res.status(200).json({
            success: true,
            data: config,
            message: 'Configuración actualizada exitosamente'
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err.message,
            message: 'Error al actualizar la configuración'
        });
    }
};

// Create new config
exports.createConfig = async (req, res) => {
    try {
        // Desactivar configuraciones anteriores si se especifica como activa
        if (req.body.activo) {
            await ConfigE.updateMany({}, { activo: false });
        }
        
        const config = new ConfigE(req.body);
        await config.save();
        
        res.status(201).json({
            success: true,
            data: config,
            message: 'Configuración creada exitosamente'
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err.message,
            message: 'Error al crear la configuración'
        });
    }
};

// Get all configs
exports.getConfigs = async (req, res) => {
    try {
        const configs = await ConfigE.find().sort({ fechaCreacion: -1 });
        
        res.status(200).json({
            success: true,
            data: configs,
            count: configs.length,
            message: 'Configuraciones obtenidas exitosamente'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Error al obtener las configuraciones'
        });
    }
};

// Get config by ID
exports.getConfigById = async (req, res) => {
    try {
        const config = await ConfigE.findById(req.params.id);
        
        if (!config) {
            return res.status(404).json({
                success: false,
                error: 'Configuración no encontrada',
                message: 'La configuración solicitada no existe'
            });
        }
        
        res.status(200).json({
            success: true,
            data: config,
            message: 'Configuración obtenida exitosamente'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Error al obtener la configuración'
        });
    }
};

// Update config by ID
exports.updateConfigById = async (req, res) => {
    try {
        // Si se está activando esta configuración, desactivar las demás
        if (req.body.activo) {
            await ConfigE.updateMany({ _id: { $ne: req.params.id } }, { activo: false });
        }
        
        const config = await ConfigE.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!config) {
            return res.status(404).json({
                success: false,
                error: 'Configuración no encontrada',
                message: 'La configuración solicitada no existe'
            });
        }
        
        res.status(200).json({
            success: true,
            data: config,
            message: 'Configuración actualizada exitosamente'
        });
    } catch (err) {
        res.status(400).json({
            success: false,
            error: err.message,
            message: 'Error al actualizar la configuración'
        });
    }
};

// Delete config by ID
exports.deleteConfig = async (req, res) => {
    try {
        const config = await ConfigE.findById(req.params.id);
        
        if (!config) {
            return res.status(404).json({
                success: false,
                error: 'Configuración no encontrada',
                message: 'La configuración solicitada no existe'
            });
        }
        
        // No permitir eliminar la configuración activa si es la única
        if (config.activo) {
            const totalConfigs = await ConfigE.countDocuments();
            if (totalConfigs === 1) {
                return res.status(400).json({
                    success: false,
                    error: 'No se puede eliminar la única configuración activa',
                    message: 'Debe existir al menos una configuración en el sistema'
                });
            }
        }
        
        await ConfigE.findByIdAndDelete(req.params.id);
        
        res.status(200).json({
            success: true,
            message: 'Configuración eliminada exitosamente'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Error al eliminar la configuración'
        });
    }
};

// Reset configuration to defaults
exports.resetConfig = async (req, res) => {
    try {
        // Desactivar todas las configuraciones existentes
        await ConfigE.updateMany({}, { activo: false });
        
        // Crear nueva configuración con valores por defecto
        const defaultConfig = new ConfigE({
            descripcion: 'Configuración restablecida a valores por defecto'
        });
        
        await defaultConfig.save();
        
        res.status(200).json({
            success: true,
            data: defaultConfig,
            message: 'Configuración restablecida a valores por defecto'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Error al restablecer la configuración'
        });
    }
};

// Get configuration summary for dashboard
exports.getConfigSummary = async (req, res) => {
    try {
        const config = await ConfigE.findOne({ activo: true });
        
        if (!config) {
            return res.status(404).json({
                success: false,
                error: 'No hay configuración activa',
                message: 'No se encontró configuración activa en el sistema'
            });
        }
        
        const summary = {
            inversion: {
                modo: config.modoInversion,
                porcentaje: config.porcentajeInversion,
                montoFijo: config.inversionFijaUsdt
            },
            riesgo: {
                stopLossGlobal: config.stopLossGlobal,
                stopLossOperacion: config.stopLossOperacion,
                takeProfitOperacion: config.takeProfitOperacion
            },
            rentabilidad: {
                porcentajeMinimoOperacion: config.porcentajeGananciaMinimaOperacion,
                gananciaMinimaUsdt: config.gananciaMinimaUsdt,
                balanceMinimoOperacional: config.balanceMinimoOperacionalUsdt
            },
            ia: {
                umbralConfianza: config.umbralConfianzaIA,
                modeloCargado: config.rutaModeloIA ? true : false
            },
            simulacion: {
                activa: config.modoSimulacion,
                balanceInicial: config.balanceInicialSimulacion
            },
            fechaActualizacion: config.fechaActualizacion
        };
        
        res.status(200).json({
            success: true,
            data: summary,
            message: 'Resumen de configuración obtenido exitosamente'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            message: 'Error al obtener el resumen de configuración'
        });
    }
};