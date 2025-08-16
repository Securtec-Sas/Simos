#!/bin/bash

# Script para iniciar las aplicaciones Simo (sebo, UI, V2) en el orden correcto.

# --- Iniciar sebo (backend Node.js) ---
echo "Iniciando sebo..."
cd sebo
npm install # Instalar dependencias de Node.js
npm start > ../sebo.log 2>&1 & # Iniciar en segundo plano y redirigir salida a un log
sebo_pid=$!
cd ..
echo "sebo iniciado con PID: $sebo_pid"

# Esperar un momento para que sebo se inicialice completamente
echo "Esperando 10 segundos para que sebo se inicialice..."
sleep 10

# --- Iniciar UI (frontend React) ---
echo "Iniciando UI..."
cd UI/clients
npm install # Instalar dependencias de Node.js
npm run dev > ../../ui.log 2>&1 & # Iniciar en segundo plano y redirigir salida a un log
ui_pid=$!
cd ../..
echo "UI iniciada con PID: $ui_pid"

# Esperar un momento para que la UI se inicialice
echo "Esperando 5 segundos para que la UI se inicialice..."
sleep 5

# --- Iniciar V2 (aplicación Python) ---
echo "Iniciando V2..."
cd V1
source ./venv/Scripts/activate
echo "entorno virtual"
sleep 15
cd ..
cd V2
pip install -r requirements.txt # Asegurarse de que las dependencias de Python estén instaladas
python main.py > ../../v2.log 2>&1 & # Iniciar en segundo plano y redirigir salida a un log
v2_pid=$!
cd ../..
echo "V2 iniciada con PID: $v2_pid"

echo "Todas las aplicaciones han sido iniciadas en segundo plano."
echo "Puedes verificar los logs en sebo.log, ui.log y v2.log en el directorio raíz de Simo."
echo "Para detener las aplicaciones, usa 'kill $sebo_pid $ui_pid $v2_pid' o 'pkill -f node' y 'pkill -f python'."


