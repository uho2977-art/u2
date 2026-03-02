# OpenClaw Dashboard

一个轻量级的 OpenClaw Gateway 监控面板，专为移动端设计。

## 功能

- 🟢 **状态指示灯** - 大尺寸指示灯，一目了然
  - 绿灯：运行正常
  - 黄灯：有警告
  - 红灯：停止运行
- 📊 **关键指标** - Agent 数量、CPU、内存、错误数
- 📜 **错误日志** - 横向跑马灯，慢速滚动
- 📱 **响应式设计** - 自动适配横屏/竖屏

## 截图

### 竖屏
![Portrait](./docs/portrait.png)

### 横屏
![Landscape](./docs/landscape.png)

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build
```

## OpenClaw 集成

### 方式 1：静态文件托管（推荐）

1. 构建 Dashboard：
```bash
npm run build
```

2. 将 `dist/` 目录内容复制到 OpenClaw 静态文件目录。

3. 在 OpenClaw 配置中添加路由（示例）：

```json5
// openclaw.config.js 或 ~/.openclaw/config.js
{
  gateway: {
    // ... 其他配置
    
    // 添加静态文件服务（需要 OpenClaw 支持）
    http: {
      static: {
        "/dashboard": "./path/to/dashboard/dist"
      }
    }
  }
}
```

4. 访问 `http://gateway:18789/dashboard/`

### 方式 2：独立部署

Dashboard 可以部署在任何静态文件服务器上：

```bash
# 使用 serve
npx serve dist -l 3000

# 使用 nginx
# 将 dist/ 目录配置为 nginx 的静态文件目录
```

然后在浏览器中访问，首次会提示输入 Gateway URL 和 Token。

### 方式 3：使用 HTTP Server 模块

如果你想将 Dashboard 嵌入到自己的服务中：

```javascript
const express = require('express')
const path = require('path')

const app = express()

// Dashboard 静态文件
app.use('/dashboard', express.static(path.join(__dirname, 'dist')))

// 代理到 OpenClaw Gateway（可选，解决 CORS）
app.use('/rpc', (req, res) => {
  // 转发请求到 Gateway
})

app.listen(3000)
```

## Dashboard 配置

Dashboard 首次访问时会提示配置：

| 字段 | 说明 |
|------|------|
| Gateway URL | OpenClaw Gateway 地址，如 `http://192.168.1.100:18789` |
| Token | Gateway 认证 Token（可选，如果 Gateway 配置了 Token） |

配置保存在浏览器 `localStorage` 中。

## API 要求

Dashboard 需要以下 Gateway RPC 方法：

| 方法 | 用途 |
|------|------|
| `health` | 获取健康状态、运行时间、系统资源 |
| `logs` | 获取日志（带 `limit` 参数） |
| `agents.list` | 获取 Agent 列表（可选） |
| `sessions.list` | 获取会话列表（可选） |

### Health 返回示例

```json
{
  "ok": true,
  "payload": {
    "uptime": 86400,
    "version": "1.0.0",
    "cpu": 25,
    "memory": 50,
    "agents": {
      "total": 3,
      "active": 2
    }
  }
}
```

### Logs 返回示例

```json
{
  "ok": true,
  "payload": [
    { "timestamp": "2024-03-01T10:00:00Z", "level": "error", "message": "请求超时" },
    { "timestamp": "2024-03-01T09:55:00Z", "level": "warn", "message": "内存使用率高" }
  ]
}
```

## 模拟模式

如果 Gateway 不可用，Dashboard 会自动使用模拟数据，方便开发和测试。

## 自定义

### 修改刷新频率

编辑 `src/App.tsx`：

```typescript
const interval = setInterval(fetchData, 15000) // 15秒，可改为其他值
```

### 修改日志滚动速度

编辑 `src/App.css`：

```css
.logs-ticker-inner {
  animation: scroll-h 25s linear infinite; /* 25秒一轮，数字越大越慢 */
}
```

### 修改颜色

编辑 `src/App.css` 中的 CSS 变量：

```css
:root {
  --green: #00ff88;  /* 正常状态 */
  --yellow: #ffcc00; /* 警告状态 */
  --red: #ff3333;    /* 错误状态 */
}
```

## 技术栈

- React 18
- TypeScript
- Vite
- 纯 CSS（无 UI 框架）

## 许可证

MIT