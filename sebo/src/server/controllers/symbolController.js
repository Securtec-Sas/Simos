/** crea todo el crud para symbol */
const Symbol = require('../data/dataBase/modelosBD/symbol.model'); // Asegúrate de tener el modelo Symbolº
const exchangeController = require('./exchangeController'); // Asegúrate de tener el controlador de exchange
const ccxt = require('ccxt'); // Asegúrate de tener ccxt instalado*
const spotController = require('./spotController'); // Asegúrate de tener el controlador de spot
const { Exchange } = require('../data/dataBase/connectio');
// Obtener todos los símbolos
exports.getSymbols = async (req, res) => {
  try {
    const symbols = await Symbol.find();
    res.json(symbols);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Obtener un símbolo por ID
exports.getSymbolById = async (req, res) => {
  try {
    const symbol = await Symbol.findById(req.params.id);
    if (symbol == null) {
      return res.status(404).json({ message: 'No se encontró el símbolo' });
    }
    res.json(symbol);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/*
// exports.addSymbolsForExchange = async (req, res) => {
//   try {
//     console.log(`Agregando símbolos para el exchange...`);
//     const exchanges = ccxt.exchanges; // Obtiene la configuración de los exchanges activos
//     for (const ex of exchanges) {
//       // Itera sobre cada exchange
//       // ERROR: ex es un string, ex.id_ex no existe. Debería ser ex.
//       // ERROR: La variable 'exchange' no está definida para exchange.symbols
//       // ERROR: Symbol.findById(symbol.id_sy) espera ObjectId, no string.
//       // ERROR: Campos de symbolAdd incorrectos para el mercado CCXT (symbol.symbol, symbol.base)
//       // ERROR: No hay respuesta al cliente en caso de éxito dentro del try, ni en el catch.
//       if(exc = await Exchange.findOne({ id_ex: ex })) { // Corregido ex.id_ex a ex
//         if(exc.isActive) {
//           console.log(`Exchange ${ex} está activo. Intentando obtener símbolos...`);
//           // Aquí necesitarías instanciar el exchange con CCXT y cargar mercados
//           // const ccxtInstance = new ccxt[ex]();
//           // await ccxtInstance.loadMarkets();
//           // const markets = ccxtInstance.markets;
//           // for (const marketId in markets) {
//           //   const market = markets[marketId];
//           //   if (await Symbol.findOne({ id_sy: market.symbol }) ) continue;
//           //   if(!market.spot || !market.active || !market.symbol.endsWith('/USDT')) continue;
//           //   const symbolAdd = new Symbol({
//           //     id_sy: market.symbol,
//           //     name: market.base,
//           //   });
//           //   await symbolAdd.save();
//           // }
//         }
//       }
//   }
//     console.log(`Símbolos agregados para el exchange`);
//     // Este res.status(200) está fuera del try y no se alcanzará si hay error antes.
//     res.status(200).json({ message: `Símbolos agregados para los exchanges` });
//   } catch (err) {
//     console.error(`Error al agregar símbolos para el exchange:`, err);
//     // Debería haber un res.status(500).json(...) aquí
//   }
// };
*/

// Crear un nuevo símbolo
exports.createSymbol = async (req, res) => {
  // Asumimos que el cuerpo de la solicitud contendrá id_sy y name
  const { id_sy, name } = req.body;

  if (!id_sy || !name) {
    return res.status(400).json({ message: 'Los campos id_sy y name son requeridos.' });
  }

  try {
    // Verificar si el símbolo ya existe por id_sy para evitar duplicados
    let existingSymbol = await Symbol.findOne({ id_sy: id_sy });
    if (existingSymbol) {
      return res.status(409).json({ message: `El símbolo con id_sy '${id_sy}' ya existe.`, symbol: existingSymbol });
    }

    const symbol = new Symbol({
      id_sy: id_sy,
      name: name,
    });
    const newSymbol = await symbol.save();
    res.status(201).json(newSymbol);
  } catch (err) {
    // Manejar errores de validación de Mongoose u otros
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Error de validación.', errors: err.errors });
    }
    res.status(500).json({ message: err.message });
  }
};

// Actualizar un símbolo (identificado por su _id de MongoDB)
exports.updateSymbol = async (req, res) => {
  try {
    // Los campos actualizables serían 'name' o quizás 'id_sy' (aunque cambiar id_sy podría ser problemático)
    // Por ahora, permitimos actualizar 'name'. Si se actualiza 'id_sy', se debe asegurar unicidad.
    const { name, id_sy } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (id_sy) {
        // Si se intenta cambiar id_sy, verificar que no exista ya uno con el nuevo id_sy
        // a menos que sea el mismo documento.
        const existingSymbolWithNewIdSy = await Symbol.findOne({ id_sy: id_sy, _id: { $ne: req.params.id } });
        if (existingSymbolWithNewIdSy) {
            return res.status(409).json({ message: `Otro símbolo ya existe con id_sy '${id_sy}'.`});
        }
        updateData.id_sy = id_sy;
    }


    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No se proporcionaron datos para actualizar." });
    }

    const updatedSymbol = await Symbol.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

    if (!updatedSymbol) {
      return res.status(404).json({ message: 'No se encontró el símbolo para actualizar.' });
    }
    res.json(updatedSymbol);
  } catch (err) {
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: 'Error de validación al actualizar.', errors: err.errors });
    }
    res.status(500).json({ message: err.message });
  }
};

// Eliminar un símbolo por su _id de MongoDB
exports.deleteSymbol = async (req, res) => {
  try {
    const deletedSymbol = await Symbol.findByIdAndDelete(req.params.id);
    if (!deletedSymbol) {
      return res.status(404).json({ message: 'No se encontró el símbolo para eliminar.' });
    }
    // Considerar si se deben eliminar también las entradas relacionadas en ExchangeSymbol
    // await ExchangeSymbol.deleteMany({ symbolId: req.params.id });
    res.json({ message: 'Símbolo eliminado exitosamente.', deletedSymbol });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
