const ConfigE = require('../data/dataBase/modelosBD/config.model');

// Create new config
exports.createConfig = async (req, res) => {
    try {
        const config = new ConfigE(req.body);
        await config.save();
        res.status(201).json(config);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Get all configs
exports.getConfigs = async (req, res) => {
    try {
        const configs = await Config.find();
        res.status(200).json(configs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get config by ID
exports.getConfigById = async (req, res) => {
    try {
        const config = await ConfigE.findById(req.params.id);
        if (!config) return res.status(404).json({ error: 'Config not found' });
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update config by ID
exports.updateConfig = async (req, res) => {
    try {
        const config = await ConfigE.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!config) return res.status(404).json({ error: 'Config not found' });
        res.json(config);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// Delete config by ID
exports.deleteConfig = async (req, res) => {
    try {
        const config = await ConfigE.findByIdAndDelete(req.params.id);
        if (!config) return res.status(404).json({ error: 'Config not found' });
        res.json({ message: 'Config deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};