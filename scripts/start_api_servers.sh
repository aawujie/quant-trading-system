#!/bin/bash

echo "========================================="
echo "  Starting API Servers"
echo "========================================="
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# Start REST API server
echo "🚀 Starting REST API server on port 8000..."
cd backend
uv run uvicorn app.api.rest:app --host 0.0.0.0 --port 8000 > ../logs/rest_api.log 2>&1 &
REST_PID=$!
echo "✅ REST API started (PID: $REST_PID)"

# Start WebSocket server
echo "🚀 Starting WebSocket server on port 8001..."
uv run uvicorn app.api.websocket:ws_app --host 0.0.0.0 --port 8001 > ../logs/websocket.log 2>&1 &
WS_PID=$!
echo "✅ WebSocket server started (PID: $WS_PID)"

echo ""
echo "========================================="
echo "  API Servers started! 🎉"
echo "========================================="
echo ""
echo "📊 Server PIDs:"
echo "   REST API:  $REST_PID"
echo "   WebSocket: $WS_PID"
echo ""
echo "📝 Logs:"
echo "   REST API:  logs/rest_api.log"
echo "   WebSocket: logs/websocket.log"
echo ""
echo "🌐 Endpoints:"
echo "   REST API:  http://localhost:8000"
echo "   WebSocket: ws://localhost:8001/ws"
echo ""
echo "💡 To stop servers:"
echo "   kill $REST_PID $WS_PID"
echo ""

