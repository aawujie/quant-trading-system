#!/bin/bash

echo "========================================="
echo "  Quantitative Trading System"
echo "  Development Environment Startup"
echo "========================================="
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# 0. Clean up old processes first
echo "🧹 Cleaning up old processes..."
pkill -f "python -m app.main" 2>/dev/null && echo "✅ Stopped old backend nodes" || true
pkill -f "uvicorn app.api" 2>/dev/null && echo "✅ Stopped old API servers" || true
lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "✅ Port 8000 freed" || true
lsof -ti:8001 | xargs kill -9 2>/dev/null && echo "✅ Port 8001 freed" || true
echo ""

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

# 4. Start API servers first (they need to be ready for frontend)
echo "🚀 Starting API servers..."

# REST API server
uv run uvicorn app.api.rest:app --host 0.0.0.0 --port 8000 > ../logs/rest_api.log 2>&1 &
REST_PID=$!
echo "✅ REST API server started (PID: $REST_PID)"

# WebSocket server
uv run uvicorn app.api.websocket:ws_app --host 0.0.0.0 --port 8001 > ../logs/websocket.log 2>&1 &
WS_PID=$!
echo "✅ WebSocket server started (PID: $WS_PID)"

# Wait for API servers to be ready
sleep 2
echo ""

# 5. Start backend nodes (multi-process mode)
echo "🚀 Starting backend nodes..."

# K-line node - fetch multiple timeframes (使用2秒间隔)
# 支持的时间级别: 3m, 5m, 15m, 30m, 1h, 4h, 1d
uv run python -m app.main --node kline --symbols BTCUSDT,ETHUSDT --timeframes 3m,5m,15m,30m,1h,4h,1d --fetch-interval 2 > ../logs/kline_node.log 2>&1 &
KLINE_PID=$!
echo "✅ K-line node started (PID: $KLINE_PID, 数据更新间隔: 2秒)"
echo "   时间级别: 3m, 5m, 15m, 30m, 1h, 4h, 1d"

# Indicator node - calculate for multiple timeframes
uv run python -m app.main --node indicator --symbols BTCUSDT,ETHUSDT --timeframes 3m,5m,15m,30m,1h,4h,1d > ../logs/indicator_node.log 2>&1 &
INDICATOR_PID=$!
echo "✅ Indicator node started (PID: $INDICATOR_PID)"

# Strategy node - default to 1h
uv run python -m app.main --node strategy --symbols BTCUSDT,ETHUSDT --timeframe 1h > ../logs/strategy_node.log 2>&1 &
STRATEGY_PID=$!
echo "✅ Strategy node started (PID: $STRATEGY_PID)"

echo ""
echo "========================================="
echo "  All services started successfully! 🎉"
echo "========================================="
echo ""
echo "📊 Service PIDs:"
echo "   REST API:  $REST_PID"
echo "   WebSocket: $WS_PID"
echo "   K-line:    $KLINE_PID"
echo "   Indicator: $INDICATOR_PID"
echo "   Strategy:  $STRATEGY_PID"
echo ""
echo "📝 Logs:"
echo "   REST API:  logs/rest_api.log"
echo "   WebSocket: logs/websocket.log"
echo "   K-line:    logs/kline_node.log"
echo "   Indicator: logs/indicator_node.log"
echo "   Strategy:  logs/strategy_node.log"
echo ""
echo "🌐 Services:"
echo "   REST API:   http://localhost:8000"
echo "   WebSocket:  ws://localhost:8001/ws"
echo "   Redis:      localhost:6379"
echo "   PostgreSQL: localhost:5432"
echo ""
echo "💡 To stop all services:"
echo "   ./scripts/dev_stop.sh"
echo ""
echo "💡 To start the frontend:"
echo "   cd frontend && npm run dev"
echo ""
echo "💡 To check logs:"
echo "   tail -f logs/kline_node.log"
echo "   tail -f logs/websocket.log"
echo ""

