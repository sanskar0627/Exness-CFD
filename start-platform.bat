@echo off
REM Exness CFD Trading Platform - Complete Startup Script for Windows

echo 🚀 Starting Exness CFD Trading Platform...

REM Step 1: Start Redis (if not running)
echo 📊 Starting Redis...
docker run -d --name redis_exness -p 6379:6379 redis:alpine 2>nul || echo Redis already running

REM Step 2: Wait for Redis to be ready
echo ⏳ Waiting for Redis to be ready...
timeout /t 3 /nobreak > nul

REM Step 3: Start all services
echo 🔧 Building and starting all services...
npm run build
npm run dev