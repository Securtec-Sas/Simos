#!/bin/bash

# filepath: ./separar_componentes.sh
# Ejecutar desde la raíz del proyecto (donde está src/)

cd ./src/components || exit 1

for file in *.jsx; do
  # Obtén el nombre base del componente (sin extensión)
  base=$(basename "$file" .jsx)
  # Crea carpeta para el componente
  mkdir -p "$base"
  # Mueve el archivo jsx a la carpeta
  mv "$file" "$base/$base.jsx"
  # Crea archivo de estilos si no existe
  touch "$base/$base.module.css"
  # Opcional: crea archivo de vista separado (descomenta si lo necesitas)
  # touch "$base/$base.view.jsx"
  echo "Componente $base organizado en carpeta $base/"
done

echo "¡Componentes organizados! Ahora puedes separar lógica, vistas y estilos en cada carpeta."