#!/bin/bash

echo "========================================="
echo "  Stopping Quantitative Trading System"
echo "========================================="
echo ""

cd "$(dirname "$0")/.."

# Stop Python processes
echo "🛑 Stopping backend nodes..."
pkill -f "python -m app.main" && echo "✅ Backend nodes stopped" || echo "ℹ️  No running backend nodes found"

# Stop Docker containers
echo "🛑 Stopping infrastructure..."
docker-compose down && echo "✅ Infrastructure stopped" || echo "⚠️  Failed to stop infrastructure"

echo ""
echo "✅ All services stopped"
echo ""

