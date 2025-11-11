import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { initConsoleOverride } from './utils/consoleOverride'

// 初始化console拦截器（根据环境变量控制日志输出）
initConsoleOverride()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

