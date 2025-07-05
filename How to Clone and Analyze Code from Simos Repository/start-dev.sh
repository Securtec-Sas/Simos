#!/bin/bash

# Script de inicio para desarrollo de Simos Trading Dashboard

echo "=== Iniciando Simos Trading Dashboard ==="

# Función para manejar la limpieza al salir
cleanup() {
    echo "Deteniendo servicios..."
    kill $FLASK_PID $V2_PID 2>/dev/null
    exit 0
}

# Configurar trap para limpieza
trap cleanup SIGINT SIGTERM

# Iniciar Backend Flask
echo "Iniciando Backend Flask (puerto 5000)..."
cd trading-backend
source venv/bin/activate
python src/main.py &
FLASK_PID=$!
cd ..

# Esperar a que Flask inicie
sleep 3

# Iniciar V2 (si existe)
if [ -d "Simos/V2" ]; then
    echo "Iniciando V2 API de análisis..."
    cd Simos/V2
    python main.py &
    V2_PID=$!
    cd ../..
    sleep 2
fi

# Iniciar Frontend React
echo "Iniciando Frontend React (puerto 5173)..."
cd trading-ui
pnpm run dev --host &
REACT_PID=$!
cd ..

echo ""
echo "=== Servicios iniciados ==="
echo "Backend Flask: http://localhost:5000"
echo "Frontend React: http://localhost:5173"
echo "API Trading: http://localhost:5000/api/trading/"
if [ -d "Simos/V2" ]; then
    echo "V2 WebSocket: ws://localhost:3031"
fi
echo ""
echo "Presiona Ctrl+C para detener todos los servicios"

# Esperar indefinidamente
wait

