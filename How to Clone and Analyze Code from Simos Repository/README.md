
# Simos Trading Dashboard

## Descripción

Simos Trading Dashboard es una aplicación web avanzada para arbitraje de criptomonedas que utiliza inteligencia artificial para maximizar oportunidades de trading en tiempo real.

## Arquitectura del Sistema

El sistema Simo se divide en 3 componentes principales:

1. **Sebo** - API de procesamiento (puerto 3001)
   - Procesa datos de mercado de múltiples exchanges
   - Identifica oportunidades de arbitraje
   - Envía datos a V2 via WebSocket

2. **V2** - API de análisis (recibe de Sebo, transmite a UI en puerto 3031)
   - Analiza oportunidades recibidas de Sebo
   - Ejecuta lógica de trading automatizado
   - Retransmite datos procesados a la UI

3. **UI** - Interfaz de usuario React
   - Dashboard interactivo para monitoreo
   - Gestión de modelos de IA
   - Visualización de datos en tiempo real

## Funcionalidades Principales

### Página Top20
- **Tabla de Oportunidades**: Muestra las mejores oportunidades de arbitraje con:
  - Símbolo de la criptomoneda
  - Precio de compra mínimo con exchange
  - Precio de venta máximo con exchange
  - Porcentaje de ganancia
  - Comisiones maker y taker
- **Panel de Balance**: Muestra el balance actual y el exchange donde se encuentra
- **Control de Trading**: Botón para iniciar/pausar el trading automatizado
- **Conexión en Tiempo Real**: WebSocket para actualizaciones instantáneas

### Página Datos
- **Estado del Modelo**: Información sobre el modelo de IA (entrenado/no entrenado)
- **Métricas del Modelo**: Precisión, pérdida, épocas entrenadas
- **Entrenamiento**: 
  - Configuración de número de épocas
  - Progreso en tiempo real
  - Visualización de métricas durante entrenamiento
- **Gráficas**: Historial de precisión y pérdida
- **Pruebas del Modelo**: Ejecución de tests con métricas de rendimiento
- **Información del Sistema**: Estado y timestamps

## Instalación y Configuración

### Prerrequisitos
- Python 3.11+
- Node.js 20+
- pnpm

### Backend (Flask)
```bash
cd trading-backend
source venv/bin/activate
pip install -r requirements.txt
python src/main.py
```

### Frontend (React)
```bash
cd trading-ui
pnpm install
pnpm run dev --host
```

### V2 (Análisis)
```bash
cd Simos/V2
pip install -r requirements.txt
python main.py
```

## Configuración de Puertos

- **Sebo**: Puerto 3001 (API de procesamiento)
- **V2**: 
  - Recibe de Sebo: Puerto 3001
  - Transmite a UI: Puerto 3031
- **Backend Flask**: Puerto 5000 (API del modelo)
- **Frontend React**: Puerto 5173 (desarrollo) / Puerto 5000 (producción)

## API Endpoints

### Backend Flask (/api/trading/)

#### Modelo
- `GET /model/status` - Estado del modelo
- `POST /model/train` - Iniciar entrenamiento
- `GET /model/training-status` - Estado del entrenamiento
- `POST /model/test` - Iniciar pruebas
- `GET /model/test-status` - Estado de las pruebas

## WebSocket Endpoints

### V2 → UI (Puerto 3031)
- Datos de oportunidades de arbitraje
- Actualizaciones de balance
- Estados del sistema

## Estructura de Datos

### Oportunidad de Arbitraje
```json
{
  "symbol": "BTC/USDT",
  "minBuy": {
    "price": 43250.50,
    "exchange": "Binance"
  },
  "maxSell": {
    "price": 43380.25,
    "exchange": "OKX"
  },
  "percentage": 0.30,
  "maker": 0.1,
  "taker": 0.1
}
```

### Estado del Modelo
```json
{
  "exists": true,
  "accuracy": 0.95,
  "loss": 0.1,
  "epochs_trained": 100,
  "last_updated": "2025-06-26T05:07:15Z",
  "training_history": [...]
}
```

## Despliegue

### Producción
1. Construir frontend: `pnpm run build`
2. Copiar archivos al directorio static de Flask
3. Ejecutar Flask en modo producción
4. Configurar proxy reverso (nginx recomendado)

### Variables de Entorno
- `FLASK_ENV`: production/development
- `SECRET_KEY`: Clave secreta de Flask
- `DATABASE_URL`: URL de base de datos (opcional)

## Monitoreo y Logs

- Logs de Flask: `trading-backend/flask.log`
- Logs de React: `trading-ui/react.log`
- Logs de V2: Consola de Python

## Solución de Problemas

### WebSocket no conecta
- Verificar que V2 esté ejecutándose
- Comprobar configuración de puertos
- Revisar firewall/proxy

### Modelo no entrena
- Verificar conexión a API Flask
- Comprobar logs del backend
- Validar datos de entrada

### Datos no se actualizan
- Verificar conexión Sebo → V2
- Comprobar WebSocket V2 → UI
- Revisar logs de red

## Desarrollo

### Estructura del Proyecto
```
/
├── Simos/V2/           # API de análisis
├── trading-backend/    # Backend Flask
├── trading-ui/         # Frontend React
└── docs/              # Documentación
```

### Comandos Útiles
```bash
# Desarrollo completo
./start-dev.sh

# Solo backend
cd trading-backend && python src/main.py

# Solo frontend
cd trading-ui && pnpm run dev

# Construir para producción
cd trading-ui && pnpm run build
```

## Contribución

1. Fork del repositorio
2. Crear rama de feature
3. Commit de cambios
4. Push a la rama
5. Crear Pull Request

## Licencia

Ver archivo LICENCIA en el repositorio principal.

## Soporte

Para soporte técnico, contactar al equipo de desarrollo de Simos.

