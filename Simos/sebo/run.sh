# Cambiar al directorio donde reside el script (sebo/)
cd "$(dirname "$0")" || exit

echo "Iniciando el servidor Node.js..."

# Verificar si nodemon está instalado globalmente o localmente
if command -v nodemon &> /dev/null
then
    npm run dev
else
    echo "Nodemon no encontrado. Intentando iniciar con 'node'. Para desarrollo, considera instalar nodemon: npm install -g nodemon"
    npm start
fi

echo "Para detener el servidor, presiona Ctrl+C."
