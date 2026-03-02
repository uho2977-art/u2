# OpenClaw Dashboard

一体化的 OpenClaw 监控面板，内置网络 Ping 探测。

## 功能

- 🟢 **状态指示灯** - 一目了然的运行状态
- 📊 **系统指标** - Agent 数量、CPU、内存、错误数
- 🌐 **网络探测** - GitHub、YouTube、Telegram、Google 延迟
- 📜 **错误日志** - 横向滚动显示
- 📱 **移动优化** - 全屏按钮、响应式布局
- ⚡ **高效轮询** - 120秒间隔，单一内存缓存

## 架构

```
┌─────────────────────────────────────┐
│         单服务 (Port 3001)           │
│  ┌─────────────┐  ┌──────────────┐  │
│  │ 后台轮询     │  │ 静态文件      │  │
│  │ (120秒)     │→ │ API /health  │  │
│  │ 单一内存缓存 │  └──────────────┘  │
│  └─────────────┘                    │
└─────────────────────────────────────┘
         │
         ▼
   OpenClaw Gateway
   (127.0.0.1:18789)
```

**优势：**
- 无论多少客户端，内存占用恒定（~60MB）
- 120秒轮询一次，不会对 Gateway 造成压力
- 所有客户端共享同一份数据

## 安装

```bash
npm install
npm run build   # 构建前端
npm start       # 启动服务
```

## 配置

代码配置（server/index.js）：

```javascript
const CONFIG = {
  port: 3001,                              // 服务端口
  gateway: {
    host: '127.0.0.1',                      // Gateway 地址
    port: 18789,                            // Gateway 端口
    token: ''                               // Gateway Token（可选）
  },
  pollInterval: 120000                      // 轮询间隔（毫秒）
}
```

环境变量覆盖：

```bash
PORT=3001 \
GATEWAY_HOST=127.0.0.1 \
GATEWAY_PORT=18789 \
GATEWAY_TOKEN=xxx \
npm start
```

## API

### `GET /health`

获取所有监控数据：

```json
{
  "gateway": {
    "connected": true,
    "uptime": 86400,
    "version": "1.0.0"
  },
  "agents": { "total": 3, "active": 2, "list": [...] },
  "system": { "cpu": 25, "memory": 50, ... },
  "network": {
    "GitHub": { "latency": 45, "status": "ok", "alive": true },
    "YouTube": { "latency": 120, "status": "slow", "alive": true },
    ...
  },
  "logs": [...],
  "errors": 2,
  "lastUpdated": "2024-03-01T10:05:00Z"
}
```

### `GET /network`

仅获取网络状态。

## 网络状态说明

| status | 说明 |
|--------|------|
| `ok` | 延迟 < 100ms |
| `warning` | 延迟 100-200ms |
| `slow` | 延迟 > 200ms |
| `timeout` | 超时无响应 |

## 作为系统服务

### macOS (launchd)

创建 `~/Library/LaunchAgents/com.openclaw.dashboard.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.dashboard</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/u2/server/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

### Linux (systemd)

创建 `/etc/systemd/system/openclaw-dashboard.service`:

```ini
[Unit]
Description=OpenClaw Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/u2
ExecStart=/usr/bin/node server/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## 许可证

MIT