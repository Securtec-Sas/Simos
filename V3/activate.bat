@echo off
echo Activando entorno virtual V3...

REM Verificar si existe el entorno virtual
if not exist "venv\Scripts\activate.bat" (
    echo Error: Entorno virtual no encontrado.
    echo Ejecuta setup_env.bat primero para crear el entorno virtual.
    pause
    exit /b 1
)

REM Activar entorno virtual
call ve_v3\Scripts\activate.bat

echo Entorno virtual V3 activado.
echo Para desactivar: deactivate
echo.

REM Mantener la ventana abierta
cmd /k