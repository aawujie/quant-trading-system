#!/bin/bash

echo "========================================="
echo "  Quantitative Trading System"
echo "  Development Environment Startup"
echo "========================================="
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# 1. Start infrastructure (Docker)
echo "📦 Starting infrastructure (Redis + PostgreSQL)..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ Failed to start infrastructure services"
    exit 1
fi

echo "✅ Infrastructure services started"
echo ""

# 2. Install Python dependencies (if needed)
echo "🐍 Checking Python dependencies..."
cd backend

if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment with uv..."
    uv sync
else
    echo "✓ Virtual environment already exists"
fi

# 3. Initialize database
echo "🗄️  Initializing database..."
uv run alembic upgrade head 2>/dev/null || echo "Note: Alembic migration may not be configured yet"
echo ""

# 4. Start backend nodes (multi-process mode)
echo "🚀 Starting backend nodes..."

# K-line node
uv run python -m app.main --node kline --symbols BTCUSDT,ETHUSDT --timeframes 1h --fetch-interval 60 > ../logs/kline_node.log 2>&1 &
KLINE_PID=$!
echo "✅ K-line node started (PID: $KLINE_PID)"

# Indicator node
uv run python -m app.main --node indicator --symbols BTCUSDT,ETHUSDT --timeframes 1h > ../logs/indicator_node.log 2>&1 &
INDICATOR_PID=$!
echo "✅ Indicator node started (PID: $INDICATOR_PID)"

# Strategy node
uv run python -m app.main --node strategy --symbols BTCUSDT,ETHUSDT --timeframe 1h > ../logs/strategy_node.log 2>&1 &
STRATEGY_PID=$!
echo "✅ Strategy node started (PID: $INDICATOR_PID)"

echo ""
echo "========================================="
echo "  All nodes started successfully! 🎉"
echo "========================================="
echo ""
echo "📊 Node PIDs:"
echo "   K-line:    $KLINE_PID"
echo "   Indicator: $INDICATOR_PID"
echo "   Strategy:  $STRATEGY_PID"
echo ""
echo "📝 Logs:"
echo "   K-line:    logs/kline_node.log"
echo "   Indicator: logs/indicator_node.log"
echo "   Strategy:  logs/strategy_node.log"
echo ""
echo "🌐 Services:"
echo "   Redis:      localhost:6379"
echo "   PostgreSQL: localhost:5432"
echo ""
echo "💡 To stop all nodes:"
echo "   ./scripts/dev_stop.sh"
echo ""
echo "💡 To start the frontend:"
echo "   cd frontend && npm run dev"
echo ""

