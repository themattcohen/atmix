@echo off
REM ============================================
REM Blue Bucket Development Server Startup Script
REM ============================================

echo.
echo ========================================
echo   Blue Bucket Dev Server Startup
echo ========================================
echo.

REM Navigate to server directory
cd /d "%~dp0server"
if errorlevel 1 (
    echo [ERROR] Failed to navigate to server directory
    echo         Expected: %~dp0server
    pause
    exit /b 1
)

echo [INFO] Working directory: %cd%
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo         Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Display Node version
for /f "tokens=*" %%i in ('node --version') do echo [INFO] Node.js version: %%i
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Running npm install...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo.
    echo [SUCCESS] Dependencies installed successfully
    echo.
)

REM Check environment variables
if exist "scripts\check-env.js" (
    echo [INFO] Checking environment configuration...
    node scripts\check-env.js
    if errorlevel 1 (
        echo.
        echo [WARNING] Environment check failed. Server may not work correctly.
        echo          Please check your .env file configuration.
        echo.
        choice /C YN /M "Continue anyway"
        if errorlevel 2 (
            exit /b 1
        )
    )
    echo.
)

REM Start the development server
echo [INFO] Starting development server...
echo [INFO] Press Ctrl+C to stop the server
echo.
echo ----------------------------------------
echo.

call npm run dev
if errorlevel 1 (
    echo.
    echo [ERROR] Server exited with an error
    pause
    exit /b 1
)

pause
