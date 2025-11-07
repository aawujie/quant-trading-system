#!/bin/bash

# 启动 Adminer 数据库管理界面（最简单、零配置）
# 访问地址: http://localhost:8080

set -e

echo "🎨 启动 Adminer 数据库管理界面..."

# 检查是否已在运行
if docker ps | grep -q adminer; then
    echo "⚠️  Adminer 已在运行"
    echo "   访问地址: http://localhost:8080"
    exit 0
fi

# 检查 PostgreSQL 是否运行
if ! docker ps | grep -q postgres; then
    echo "❌ 错误: PostgreSQL 容器未运行"
    echo "   请先运行: docker-compose up -d"
    exit 1
fi

# 启动 Adminer
echo "🚀 正在启动 Adminer..."
docker run -d \
    --name adminer \
    --network quant-trading-system_default \
    -p 8080:8080 \
    --restart unless-stopped \
    adminer

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 3

# 检查服务状态
if docker ps | grep -q adminer; then
    echo ""
    echo "✅ Adminer 启动成功！"
    echo ""
    echo "📊 访问地址: http://localhost:8080"
    echo ""
    echo "🎯 使用步骤:"
    echo "   1. 打开 http://localhost:8080"
    echo "   2. 填写以下信息直接登录:"
    echo ""
    echo "🔑 登录信息:"
    echo "   系统:       PostgreSQL"
    echo "   服务器:     postgres"
    echo "   用户名:     quant_user"
    echo "   密码:       quant_pass"
    echo "   数据库:     quant"
    echo ""
    echo "⚡ 快捷命令:"
    echo "   停止服务:   docker stop adminer"
    echo "   重启服务:   docker restart adminer"
    echo "   删除服务:   docker rm -f adminer"
    echo ""
    
    # 自动打开浏览器（Mac）
    if command -v open &> /dev/null; then
        echo "🌐 正在打开浏览器..."
        sleep 1
        open http://localhost:8080
    fi
else
    echo "❌ 启动失败"
    exit 1
fi

