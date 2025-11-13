# 前端部署配置指南

## 环境变量配置

前端使用环境变量来配置 API 和 WebSocket 服务地址，支持灵活部署到不同环境。

### 开发环境（本地）

创建 `.env.development` 文件：

```bash
# 开发环境配置
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8001
```

### 生产环境（服务器）

在服务器上创建 `.env.production` 文件：

```bash
# 生产环境配置
# 替换为你的服务器公网IP或域名
VITE_API_BASE_URL=http://your-server-ip:8000
VITE_WS_BASE_URL=ws://your-server-ip:8001
```

**重要提示：**
- 如果使用域名，确保 DNS 已正确配置
- 如果使用 HTTPS，将 `http` 改为 `https`，将 `ws` 改为 `wss`
- 确保服务器防火墙已开放 8000 和 8001 端口

## 部署步骤

### 方式 1：开发模式部署（推荐用于测试）

```bash
# 1. 在服务器上创建环境变量文件
cd ~/code/quant-trading-system/frontend
cat > .env.production << 'EOF'
VITE_API_BASE_URL=http://YOUR_SERVER_IP:8000
VITE_WS_BASE_URL=ws://YOUR_SERVER_IP:8001
EOF

# 2. 启动开发服务器（监听所有网络接口）
npm run dev
# Vite 已配置 host: '0.0.0.0'，会自动监听所有接口
```

访问地址：`http://YOUR_SERVER_IP:3000`

### 方式 2：生产构建部署

```bash
# 1. 创建生产环境变量文件（同上）

# 2. 构建生产版本
npm run build

# 3. 使用 serve 或 nginx 部署 dist 目录
# 使用 serve（简单快速）
npx serve -s dist -l 3000

# 或使用 nginx（推荐生产环境）
# 将 dist 目录内容复制到 nginx 的 web 根目录
```

## 验证配置

构建后，可以检查生成的代码是否使用了正确的地址：

```bash
# 检查打包后的配置
grep -r "VITE_API_BASE_URL" dist/assets/*.js
```

## 示例配置

### 腾讯云服务器示例

```bash
# .env.production
VITE_API_BASE_URL=http://123.45.67.89:8000
VITE_WS_BASE_URL=ws://123.45.67.89:8001
```

### 使用域名示例

```bash
# .env.production
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_WS_BASE_URL=wss://ws.yourdomain.com
```

### 使用 Nginx 反向代理示例

如果后端通过 Nginx 反向代理，可以使用相同域名：

```bash
# .env.production
VITE_API_BASE_URL=https://yourdomain.com/api
VITE_WS_BASE_URL=wss://yourdomain.com/ws
```

对应的 Nginx 配置：

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 前端静态文件
    location / {
        root /var/www/quant-trading-system/dist;
        try_files $uri $uri/ /index.html;
    }

    # REST API 代理
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 故障排查

### 1. API 请求失败

检查浏览器控制台，查看实际请求的 URL：

```javascript
// 在浏览器控制台执行
console.log(import.meta.env.VITE_API_BASE_URL)
```

### 2. WebSocket 连接失败

- 检查后端 WebSocket 服务是否启动（端口 8001）
- 检查防火墙是否开放端口
- 检查浏览器控制台的 WebSocket 错误信息

### 3. 环境变量不生效

- 确保文件名正确：`.env.production`（注意前面的点）
- 环境变量必须以 `VITE_` 开头才能被 Vite 识别
- 修改环境变量后需要重新构建：`npm run build`

## 安全建议

1. **不要在前端暴露敏感信息**：环境变量会被打包到前端代码中，任何人都可以看到
2. **使用 HTTPS**：生产环境建议配置 SSL 证书，使用 HTTPS 和 WSS
3. **配置 CORS**：确保后端正确配置 CORS，只允许可信域名访问
4. **防火墙配置**：只开放必要的端口，考虑使用 VPN 或 IP 白名单

## 快速命令参考

```bash
# 创建生产环境配置（替换 IP 地址）
echo "VITE_API_BASE_URL=http://YOUR_IP:8000" > .env.production
echo "VITE_WS_BASE_URL=ws://YOUR_IP:8001" >> .env.production

# 构建
npm run build

# 预览构建结果
npm run preview

# 使用 serve 部署
npx serve -s dist -l 3000 -o 0.0.0.0
```

