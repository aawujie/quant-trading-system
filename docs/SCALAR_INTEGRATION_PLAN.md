# Scalar API 文档平台集成方案

## 📋 项目概述

将 Scalar API 文档平台集成到量化交易系统中，提供现代化的 API 文档体验。

---

## 🎯 集成目标

1. ✅ 替换/补充 Swagger UI，提供更好的文档体验
2. ✅ 自动生成交互式 API 文档
3. ✅ 保持 OpenAPI 规范兼容性
4. ✅ 零侵入式集成（不影响现有代码）

---

## 📦 技术栈

- **后端**: FastAPI 0.104+ (已有)
- **文档**: Scalar FastAPI (新增)
- **规范**: OpenAPI 3.1.0 (自动生成)

---

## 🚀 实施步骤

### **阶段 1：基础集成 (10分钟)**

#### 1.1 安装 Scalar FastAPI 包

```bash
cd backend
uv add scalar-fastapi
```

#### 1.2 修改 `backend/app/api/rest.py`

**在文件顶部添加导入**：

```python
from scalar_fastapi import get_scalar_api_reference
```

**在 CORS 配置后添加 Scalar 路由**：

```python
# Scalar API 文档（现代化界面）
@app.get("/scalar", include_in_schema=False)
async def scalar_html():
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title=app.title,
    )
```

**完成！现在访问**: `http://localhost:8000/scalar`

---

### **阶段 2：优化配置 (15分钟)**

#### 2.1 增强 FastAPI 应用配置

```python
app = FastAPI(
    title="量化交易系统 API",
    description="""
    # 量化交易系统 REST API
    
    ## 功能模块
    
    - 📊 **市场数据**: K线、指标、实时行情
    - 🎯 **交易信号**: 策略信号查询和订阅
    - 🔄 **回测管理**: 历史回测查询和分析
    - 📈 **绘图工具**: 图表绘制数据管理
    - ⚙️ **系统管理**: 数据修复、状态监控
    
    ## 认证方式
    
    目前为开发模式，暂无认证要求
    
    ## 技术支持
    
    - WebSocket 实时推送: `ws://localhost:8001/ws`
    - 数据格式: JSON
    - 时间戳: Unix 秒级时间戳
    """,
    version="1.0.0",
    contact={
        "name": "量化交易团队",
        "email": "support@example.com",
    },
    license_info={
        "name": "MIT",
    },
    servers=[
        {
            "url": "http://localhost:8000",
            "description": "开发环境"
        },
        {
            "url": "https://api.example.com",
            "description": "生产环境（待部署）"
        }
    ],
    # OpenAPI 标签分组
    openapi_tags=[
        {
            "name": "市场数据",
            "description": "K线、指标、行情数据查询",
        },
        {
            "name": "交易信号",
            "description": "策略信号查询和管理",
        },
        {
            "name": "回测",
            "description": "回测执行、历史查询、结果分析",
        },
        {
            "name": "绘图",
            "description": "图表绘制工具数据管理",
        },
        {
            "name": "系统",
            "description": "系统状态、数据修复、健康检查",
        },
    ]
)
```

#### 2.2 为 API 端点添加标签

```python
@app.get("/api/klines/{symbol}/{timeframe}", tags=["市场数据"])
async def get_klines(...):
    ...

@app.get("/api/signals/{strategy_name}", tags=["交易信号"])
async def get_signals(...):
    ...

@app.post("/api/backtest/run", tags=["回测"])
async def run_backtest(...):
    ...

@app.get("/api/drawings/{symbol}", tags=["绘图"])
async def get_drawings(...):
    ...

@app.get("/health", tags=["系统"])
async def health_check():
    ...
```

---

### **阶段 3：高级定制 (20分钟)**

#### 3.1 自定义 Scalar 主题和配置

```python
@app.get("/scalar", include_in_schema=False)
async def scalar_html():
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title=f"{app.title} - 文档",
        # Scalar 配置选项
        scalar_config={
            # 主题配置
            "theme": "purple",  # purple, blue, green, orange
            "darkMode": True,
            
            # 布局配置
            "layout": "modern",  # modern, classic
            "showSidebar": True,
            
            # 搜索配置
            "searchHotKey": "k",
            
            # 自定义样式
            "customCss": """
                .scalar-app {
                    --scalar-color-1: #0a0a0f;
                    --scalar-color-2: #1a1a2e;
                    --scalar-color-accent: #26a69a;
                }
            """,
            
            # 认证配置
            "authentication": {
                "preferredSecurityScheme": "apiKey",
            },
            
            # 其他选项
            "hiddenClients": [],  # 隐藏特定的客户端示例
            "defaultHttpClient": {
                "targetKey": "python",
                "clientKey": "requests"
            }
        }
    )
```

#### 3.2 添加请求示例

```python
@app.post(
    "/api/backtest/run",
    tags=["回测"],
    response_model=BacktestResult,
    responses={
        200: {
            "description": "回测成功",
            "content": {
                "application/json": {
                    "example": {
                        "run_id": "dual_ma_BTCUSDT_1h_20241112",
                        "total_return": 0.15,
                        "sharpe_ratio": 1.2,
                        "signals": []
                    }
                }
            }
        },
        422: {
            "description": "参数验证失败"
        }
    }
)
async def run_backtest(request: BacktestRequest):
    ...
```

---

### **阶段 4：前端集成 (可选，15分钟)**

#### 4.1 在前端添加 API 文档入口

**方案 A：添加顶部导航链接**

```jsx
// frontend/src/App.jsx
<nav>
  <a href="http://localhost:8000/scalar" target="_blank">
    📖 API 文档
  </a>
</nav>
```

**方案 B：使用 iframe 嵌入**

```jsx
// frontend/src/pages/ApiDocs.jsx
export default function ApiDocs() {
  return (
    <div className="h-screen">
      <iframe 
        src="http://localhost:8000/scalar"
        className="w-full h-full border-0"
        title="API Documentation"
      />
    </div>
  );
}
```

---

## 📊 对比：Swagger UI vs Scalar

| 特性 | Swagger UI | Scalar |
|------|-----------|--------|
| 界面美观度 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 加载速度 | 慢 | 极快 |
| 搜索功能 | 基础 | 强大 |
| 暗色模式 | 需配置 | 原生支持 |
| 代码示例 | 有限 | 丰富（多语言） |
| 响应式设计 | 一般 | 优秀 |
| 自定义主题 | 困难 | 简单 |

---

## 🎨 访问方式

集成后，你将拥有三种文档访问方式：

1. **Scalar (推荐)**: `http://localhost:8000/scalar`
   - 现代化界面
   - 快速响应
   - 优秀的用户体验

2. **Swagger UI (保留)**: `http://localhost:8000/docs`
   - 传统界面
   - 开发者熟悉
   - 备用选项

3. **ReDoc (可选)**: `http://localhost:8000/redoc`
   - 文档式布局
   - 适合阅读

---

## ✅ 验证清单

- [ ] Scalar 包已安装
- [ ] `/scalar` 路由已添加
- [ ] 访问 `http://localhost:8000/scalar` 正常
- [ ] API 端点显示完整
- [ ] 可以进行交互式测试
- [ ] 代码示例生成正确
- [ ] 中文描述显示正常
- [ ] 主题和样式符合预期

---

## 🔧 故障排除

### 问题1：Scalar 页面空白

**解决**：检查 OpenAPI JSON 是否正确生成
```bash
curl http://localhost:8000/openapi.json
```

### 问题2：中文显示乱码

**解决**：确保文件编码为 UTF-8
```python
# rest.py 文件头部添加
# -*- coding: utf-8 -*-
```

### 问题3：样式不生效

**解决**：清除浏览器缓存或使用无痕模式

---

## 📚 参考资源

- [Scalar 官方文档](https://github.com/scalar/scalar)
- [FastAPI + Scalar 集成指南](https://github.com/scalar/scalar/tree/main/packages/scalar-fastapi)
- [OpenAPI 3.1 规范](https://spec.openapis.org/oas/v3.1.0)

---

## 🚀 下一步优化

1. **添加认证示例**: Bearer Token, API Key
2. **完善错误响应**: 所有端点添加错误示例
3. **添加 Webhooks 文档**: 如果有 WebSocket 或 Webhook
4. **性能监控**: 集成 API 性能追踪
5. **版本管理**: 支持多版本 API 文档

---

## 💡 最佳实践

1. **描述要详细**: 每个端点都应有清晰的功能说明
2. **示例要真实**: 使用实际的数据示例
3. **响应要完整**: 包含成功和错误情况
4. **标签要合理**: 按功能模块分组
5. **定期更新**: 代码变更后及时更新文档

---

**估计总耗时**: 30-60 分钟
**难度**: ⭐⭐ (简单)
**收益**: ⭐⭐⭐⭐⭐ (极高)

