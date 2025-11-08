#!/bin/bash

echo "========================================="
echo "  Data Integrity Repair Tool"
echo "========================================="
echo ""

cd "$(dirname "$0")/../backend"

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

