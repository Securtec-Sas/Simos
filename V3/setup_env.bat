@echo off
echo Configurando entorno virtual para V3...

REM Crear entorno virtual si no existe
if not exist "venv" (
    echo Creando entorno virtual...
    python -m venv venv
    if errorlevel 1 (
        echo Error: No se pudo crear el entorno virtual. Asegurate de tener Python instalado.
        pause
        exit /b 1
    )
)

REM Activar entorno virtual
echo Activando entorno virtual...
call ve_v3\Scripts\activate.bat

REM Actualizar pip
echo Actualizando pip...
python -m pip install --upgrade pip

REM Instalar dependencias
echo Instalando dependencias desde requirements.txt...
pip install -r requirements.txt

echo.
echo ========================================
echo Entorno virtual configurado exitosamente!
echo ========================================
echo.
echo Para activar el entorno virtual manualmente:
echo   call ve_v3\Scripts\activate.bat
echo.
echo Para desactivar el entorno virtual:
echo   deactivate
echo.
pause