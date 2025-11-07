@echo off
setlocal

echo == Build Windows App (local) ==
REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
  echo Python no encontrado. Instale Python 3.10+ y agregue al PATH.
  pause
  exit /b 1
)


REM Crear carpeta build y entorno virtual dentro de build
set "BUILD_DIR=build"
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"
set "VENV_DIR=%BUILD_DIR%\venv"
if not exist "%VENV_DIR%" (
  echo Creando entorno virtual en %VENV_DIR%...
  python -m venv "%VENV_DIR%"
)
call "%VENV_DIR%\Scripts\activate.bat"

REM Actualizar pip e instalar dependencias
echo Instalando dependencias...
python -m pip install --upgrade pip
pip install pywebview pyarmor Flask requests pyinstaller


REM Variables
set "SRC=main_windows.py"
set "OBF_DIR=%BUILD_DIR%\obf"
set "OBF_TARGET=%OBF_DIR%\%SRC%"

REM Lint (compilacion) -- intenta ruta windows\main_windows.py primero
echo Lint: compilando %SRC%...
if exist "%SRC%" (
  python -m py_compile "%SRC%" || goto :err
) else (
  echo No se encontro %SRC%.
  goto :err
)

REM Obfuscar con PyArmor (intenta pyarmor-7, luego pyarmor; si todo falla copia original a obf)

echo Obfuscando con PyArmor v9...
if exist "%OBF_DIR%" rmdir /s /q "%OBF_DIR%"
mkdir "%OBF_DIR%"

REM Usar pyarmor gen para ofuscar el script principal
REM Usar pyarmor gen con --advanced 2 para compatibilidad con PyInstaller
pyarmor gen --advanced 2 -O "%OBF_DIR%" "%SRC%" >nul 2>&1
if errorlevel 1 (
  echo Obfuscacion por pyarmor fallo.
  echo Copiando archivo original a %OBF_DIR% para que PyInstaller pueda continuar.
  copy /Y "%SRC%" "%OBF_TARGET%" >nul 2>&1
)

REM Asegurarse de que exista un objetivo para PyInstaller
if not exist "%OBF_TARGET%" (
  if exist "%SRC%" (
    echo Obfuscado no generado; copiando "%SRC%" a "%OBF_TARGET%".
    copy /Y "%SRC%" "%OBF_TARGET%" >nul 2>&1
  )
)


REM Empaquetar con PyInstaller, usando obf\main_windows.py si existe

echo Empaquetando con PyInstaller...
if exist "%BUILD_DIR%\dist" rmdir /s /q "%BUILD_DIR%\dist" >nul 2>&1
if exist "%BUILD_DIR%\build" rmdir /s /q "%BUILD_DIR%\build" >nul 2>&1

REM Empaquetar todos los archivos generados por PyArmor en obf/
set "TARGET=%OBF_DIR%\main_windows.py"
set "PROJECT_DIR=%CD%"
set "ADD_DATA=%PROJECT_DIR%\src;src"
set "ADD_OBF=%PROJECT_DIR%\build\obf;obf"
pyinstaller --noconfirm --onefile --distpath "%BUILD_DIR%\dist" --workpath "%BUILD_DIR%\build" --specpath "%BUILD_DIR%" --add-data "%ADD_DATA%" --add-data "%ADD_OBF%" "%TARGET%" || goto :err

echo.
if exist "%BUILD_DIR%\dist\main_windows.exe" (
  echo Construccion completada: %BUILD_DIR%\dist\main_windows.exe
) else (
  echo Construccion finalizada, verifique la carpeta %BUILD_DIR%\dist.
)



REM Los archivos de src/ están incluidos en el ejecutable. Para acceder a ellos en Python usa:
REM import sys, os
REM if hasattr(sys, '_MEIPASS'):
REM     base_path = os.path.join(sys._MEIPASS, 'src')
REM else:
REM     base_path = os.path.join(os.path.dirname(__file__), 'src')

echo Done.
pause
exit /b 0

:err
echo ERROR durante el proceso.
pause
exit /b 1