#!/bin/bash
# Exness CFD Trading Platform - Complete Startup Script

echo "🚀 Starting Exness CFD Trading Platform..."

# Step 1: Start Redis (if not running)
echo "📊 Starting Redis..."
docker run -d --name redis_exness -p 6379:6379 redis:alpine || echo "Redis already running"

# Step 2: Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
sleep 2

# Step 3: Start all services
echo "🔧 Building and starting all services..."
npm run build
npm run dev