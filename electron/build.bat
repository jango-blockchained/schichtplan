@echo off
REM Build script for Windows

echo Building Schichtplan Desktop Application for Windows...

REM Check if we're in the right directory
if not exist "package.json" (
    echo [ERROR] This script must be run from the electron directory
    exit /b 1
)

REM Check prerequisites
echo [INFO] Checking prerequisites...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed
    exit /b 1
)

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed
    exit /b 1
)

REM Install dependencies
echo [INFO] Installing Node.js dependencies...
npm install

REM Build frontend
echo [INFO] Building frontend...
cd ..\src\frontend
npm install --legacy-peer-deps
npm run build
cd ..\..\electron

REM Copy frontend build to resources
echo [INFO] Copying frontend build...
if not exist "resources\frontend" mkdir resources\frontend
xcopy /E /I /Y ..\src\frontend\dist resources\frontend

REM Build backend with PyInstaller
echo [INFO] Building backend with PyInstaller...
pip install pyinstaller
cd ..\src\backend

REM Install backend dependencies
echo [INFO] Installing backend dependencies...
pip install -r requirements.txt

REM Build backend executable
echo [INFO] Creating backend executable...
pyinstaller --onefile ^
    --name schichtplan-backend.exe ^
    --distpath ..\..\electron\resources\backend ^
    --workpath ..\..\electron\build\backend ^
    --specpath ..\..\electron\build\backend ^
    --add-data ".;backend" ^
    --add-data "..\..\electron\src\desktop_server.py;." ^
    --hidden-import flask ^
    --hidden-import flask_sqlalchemy ^
    --hidden-import flask_migrate ^
    --hidden-import flask_cors ^
    --hidden-import sqlalchemy ^
    --hidden-import alembic ^
    --hidden-import reportlab ^
    --hidden-import pillow ^
    --hidden-import click ^
    --hidden-import email_validator ^
    --hidden-import python_dateutil ^
    --hidden-import pydantic ^
    --hidden-import fastmcp ^
    --hidden-import uvicorn ^
    --collect-all flask ^
    --collect-all flask_sqlalchemy ^
    --collect-all sqlalchemy ^
    --collect-all alembic ^
    ..\..\electron\src\desktop_server.py

cd ..\..\electron

REM Build Electron app
echo [INFO] Building Electron application...
npm run build

echo [INFO] Build completed successfully!
echo [INFO] Built applications can be found in the dist\ directory

REM Show build artifacts
if exist "dist" (
    echo [INFO] Build artifacts:
    dir dist
)
