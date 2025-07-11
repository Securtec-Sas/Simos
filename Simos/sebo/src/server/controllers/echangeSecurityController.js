const Exchange = require('../data/dataBase/modelosBD/exchange.model');
const ExchangeSecurity = require('../data/dataBase/modelosBD/exchangeSecurity.model');


const getExchangeSecurity= async (req, res) => {
        try {
            const { id_exchange } = req.params;
            const exchange = await Exchange.findById(id_exchange);
            if (!exchange) {
                return res.status(404).json({ message: "Exchange not found" });
            }
            const exchangeSecurity = await ExchangeSecurity.findOne({ exchange_name: exchange.name });
            if (!exchangeSecurity) {
                return res.status(404).json({ message: "Exchange security not found" });
            }
            res.status(200).json({
                exchange: exchange,
                exchangeSecurity: exchangeSecurity
            });
        } catch (error) {
            res.status(500).json({ message: "Error retrieving exchange security", error: error.message });
        }
    };

const createExchangeSecurity = async (req, res) => {
        try {
            const data = req.body;
            const exchangeSecurity = new ExchangeSecurity(data);
            await exchangeSecurity.save();
            res.status(201).json(exchangeSecurity);
        } catch (error) {
            res.status(400).json({ message: "Error creating exchange security", error: error.message });
        }
    };

const updateExchangeSecurity = async (req, res) => {
        try {
            const { id } = req.params;
            const data = req.body;
            const updatedExchangeSecurity = await ExchangeSecurity.findByIdAndUpdate(id, data, { new: true });
            if (!updatedExchangeSecurity) {
                return res.status(404).json({ message: "Exchange security not found" });
            }
            res.status(200).json(updatedExchangeSecurity);
        } catch (error) {
            res.status(400).json({ message: "Error updating exchange security", error: error.message });
        }
    };

const deleteExchangeSecurity = async (req, res) => {
        try {
            const { id } = req.params;
            const deletedExchangeSecurity = await ExchangeSecurity.findByIdAndRemove(id);
            if (!deletedExchangeSecurity) {
                return res.status(404).json({ message: "Exchange security not found" });
            }
            res.status(200).json({ message: "Exchange security deleted successfully" });
        } catch (error) {
            res.status(500).json({ message: "Error deleting exchange security", error: error.message });
        }
    }

const getAllExchangeSecurity = async (req, res) => {
        try {
            // 1. Obtener todos los exchanges de la base de datos
            const allExchanges = await Exchange.find().lean();
            // 2. Obtener todos los registros de seguridad
            const allSecurity = await ExchangeSecurity.find().select('exchange_name').lean();
            // 3. Crear un Set con los nombres de los exchanges que tienen seguridad para una búsqueda rápida
            const exchangesWithSecurity = new Set(allSecurity.map(sec => sec.exchange_name));

            // 4. Mapear todos los exchanges y añadir el campo 'apiConfigured' que el frontend espera
            const result = allExchanges.map(ex => ({
                _id: ex._id, // ID de la base de datos del exchange, útil para la edición
                id: ex.id_ex, // ID de CCXT del exchange
                name: ex.name,
                apiConfigured: exchangesWithSecurity.has(ex.name)
            }));

            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ message: "Error retrieving exchange security", error: error.message });
        }
};

const getConfiguredExchanges = async (req, res) => {
  try {
    const exchanges = await Exchange.find().lean();
    const exchangeSecurities = await ExchangeSecurity.find().select('exchange_name').lean();
    const exchangesWithSecurity = exchanges.map((exchange) => {
      const security = exchangeSecurities.find((sec) => sec.exchange_name === exchange.name);
      return {
        _id: exchange._id,
        name: exchange.name,
        apiConfigured: security ? true : false,
      };
    });
    res.json(exchangesWithSecurity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error obteniendo exchanges configurados' });
  }
};

module.exports = {
    getExchangeSecurity,
    createExchangeSecurity,
    updateExchangeSecurity,
    deleteExchangeSecurity,
    getAllExchangeSecurity,
    getConfiguredExchanges
};
