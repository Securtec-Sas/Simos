# Guía de Instalación - Simos V3

## Ubicación de Archivos

Este ZIP contiene los siguientes directorios:

```
Simos_V3_Final/
├── V3/                     # Nuevo sistema V3 completo
├── UI_fixes/               # Archivos corregidos para la UI
├── docs/                   # Documentación y análisis
└── INSTALACION.md         # Esta guía
```

## Pasos de Instalación

### 1. Preparar V3

```bash
# Copiar V3 al proyecto original
cp -r V3/* /ruta/a/Simos/V3/

# O crear nuevo directorio
mkdir -p /ruta/a/Simos/V3
cp -r V3/* /ruta/a/Simos/V3/
```

### 2. Actualizar UI

```bash
# Navegar al directorio de la UI original
cd /ruta/a/Simos/UI/clients/src

# Reemplazar archivos con versiones corregidas
cp /ruta/a/UI_fixes/App_fixed.jsx App.jsx
cp /ruta/a/UI_fixes/Layout_fixed.jsx components/Layout/Layout.jsx
cp /ruta/a/UI_fixes/Top20DetailedPage_fixed.jsx components/Top20DetailedPage/Top20DetailedPage.jsx

# Crear nueva página de APIs
mkdir -p components/ExchangeAPIsPage
cp /ruta/a/UI_fixes/ExchangeAPIsPage.jsx components/ExchangeAPIsPage/ExchangeAPIsPage.jsx
```

### 3. Configurar V3

```bash
cd /ruta/a/Simos/V3

# Verificar instalación
python check_installation.py

# Crear configuración
cp config_example.py config_v3.py
nano config_v3.py  # Editar según necesidades

# Instalar dependencias
pip install -r requirements.txt
```

### 4. Primer Uso

```bash
# Entrenar modelo
python train_model.py --samples 1000

# Iniciar V3 en simulación
python start_v3.py --simulation

# En otra terminal, iniciar UI
cd ../UI/clients
npm install
npm start
```

## Verificación

1. V3 debe ejecutarse en puerto 3002
2. UI debe conectarse a V3 y mostrar estado "connected"
3. Página "Top 20 Trading" debe mostrar datos en tiempo real
4. Página "APIs Exchanges" debe permitir gestionar credenciales

## Estructura Final Esperada

```
Simos/
├── V2/                     # Sistema original (sin cambios)
├── V3/                     # Nuevo sistema con IA
├── UI/clients/src/         # UI con archivos corregidos
├── Sebo/                   # Sistema original (sin cambios)
└── ...
```

## Notas Importantes

- V3 funciona independientemente de V2
- Ambos pueden ejecutarse simultáneamente en puertos diferentes
- V3 usa puerto 3002, V2 usa puerto 3001
- La UI se conecta a ambos sistemas automáticamente
- Usar modo simulación para pruebas iniciales

