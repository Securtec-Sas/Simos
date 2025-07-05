#!/bin/bash

# 1. Asegúrate de estar en la rama que recibirá todas las fusiones
# git switch <tu-rama-destino>

# 2. Obtener el nombre de la rama actual
CURRENT_BRANCH=$(git branch --show-current)
echo "Rama destino: $CURRENT_BRANCH"

# 3. Obtener la lista de todas las demás ramas locales
OTHER_BRANCHES=$(git branch | sed 's/..//' | grep -v -e "^\s*${CURRENT_BRANCH}$")

# 4. Iterar y fusionar cada rama
for branch in $OTHER_BRANCHES; do
    echo "-----------------------------------------------------"
    echo "🔄 Fusionando '$branch' en '$CURRENT_BRANCH'..."
    git merge "$branch" --no-edit
    
    # Comprobar si la fusión falló por conflictos
    if [ $? -ne 0 ]; then
        echo "❌ ERROR: Conflicto al fusionar la rama '$branch'. Por favor, resuelve los conflictos y ejecuta 'git commit'."
        echo "Después de resolver, puedes re-ejecutar este script para continuar con las demás ramas."
        exit 1
    fi
    echo "✅ Rama '$branch' fusionada."
done

echo "🎉 Proceso de fusión completado."
