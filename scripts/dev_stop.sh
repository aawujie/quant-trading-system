#!/bin/bash

echo "========================================="
echo "  Stopping Quantitative Trading System"
echo "========================================="
echo ""

cd "$(dirname "$0")/.."

# Stop all Python backend processes
echo "🛑 Stopping backend nodes..."
pkill -f "python -m app.main" && echo "✅ Backend nodes stopped" || echo "ℹ️  No running backend nodes found"

# Stop API servers (uvicorn)
echo "🛑 Stopping API servers..."
pkill -f "uvicorn app.api" && echo "✅ API servers stopped" || echo "ℹ️  No running API servers found"

# Force kill processes on specific ports (if still occupied)
echo "🧹 Cleaning up ports..."
lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "✅ Port 8000 freed" || true
lsof -ti:8001 | xargs kill -9 2>/dev/null && echo "✅ Port 8001 freed" || true

# Stop Docker containers
echo "🛑 Stopping infrastructure..."
docker-compose down && echo "✅ Infrastructure stopped" || echo "⚠️  Failed to stop infrastructure"

echo ""
echo "✅ All services stopped"
echo ""

