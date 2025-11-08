#!/bin/bash

echo "========================================="
echo "  Data Integrity Repair Tool"
echo "========================================="
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL status..."
if ! docker ps | grep -q quant-postgres; then
    echo "⚠️  PostgreSQL is not running, starting it..."
    docker-compose up -d postgres
    
    # Wait for PostgreSQL to be ready
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
    
    # Verify it's running
    if docker ps | grep -q quant-postgres; then
        echo "✅ PostgreSQL started successfully"
    else
        echo "❌ Failed to start PostgreSQL"
        exit 1
    fi
else
    echo "✅ PostgreSQL is already running"
fi

echo ""

cd backend

# 解析参数（使用默认值）
SYMBOLS="${1:-BTCUSDT,ETHUSDT}"
TIMEFRAMES="${2:-3m,5m,15m,30m,1h,4h,1d}"

echo "📊 Repair Configuration:"
echo "   Symbols:     $SYMBOLS"
echo "   Timeframes:  $TIMEFRAMES"
echo "   Days back:   7 (configured in config.py)"
echo ""

# 运行修复节点
uv run python -m app.main --node repair \
    --symbols "$SYMBOLS" \
    --timeframes "$TIMEFRAMES"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Repair completed successfully!"
else
    echo "❌ Repair failed with exit code $EXIT_CODE"
fi
echo ""

