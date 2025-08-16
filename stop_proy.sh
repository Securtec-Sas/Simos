# Detener sebo (Node.js backend)
echo "Deteniendo sebo (Node.js - src/server/app.js)..."
ps aux | grep "node sebo/src/server/app.js" | grep -v grep | awk '{print $2}' | xargs -r kill
echo "Intento de detener sebo realizado."
echo ""

# Detener UI (React frontend)
echo "Deteniendo UI (Vite)..."
ps aux | grep "vite" | grep -v grep | awk '{print $2}' | xargs -r kill
echo "Intento de detener UI realizado."
echo ""

# Detener V2 (Python application)
echo "Deteniendo V2 (Python - main.py)..."
ps aux | grep "python main.py" | grep -v grep | awk '{print $2}' | xargs -r kill
echo "Intento de detener V2 realizado."
echo ""