# OpenClaw Monitor Agent

监控 OpenClaw Gateway 和网络状态的 Node.js 服务。

## 功能

- 📊 **Gateway 健康状态** - 连接状态、运行时间、版本
- 🤖 **Agent 状态** - 总数、活跃数、列表
- 💻 **系统资源** - CPU、内存使用率
- 🌐 **网络探测** - Ping GitHub、YouTube、Telegram、Google
- 📜 **错误日志** - 最新错误日志
- 🔗 **HTTP API** - 统一的数据端点

## 安装

```bash
cd agent
npm install
```

## 运行

```bash
# 直接运行
npm start

# 开发模式（自动重载）
npm run dev

# 自定义配置
PORT=3001 GATEWAY_URL=http://localhost:18789 GATEWAY_TOKEN=xxx npm start
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3001 | HTTP 服务端口 |
| `GATEWAY_URL` | http://localhost:18789 | OpenClaw Gateway 地址 |
| `GATEWAY_TOKEN` | (空) | Gateway 认证 Token |

## API 端点

### `GET /health`

获取所有监控数据：

```json
{
  "gateway": {
    "connected": true,
    "uptime": 86400,
    "version": "1.0.0"
  },
  "agents": {
    "total": 3,
    "active": 2,
    "list": ["main", "coder", "assistant"]
  },
  "system": {
    "cpu": 25,
    "memory": 50,
    "platform": "darwin",
    "nodeVersion": "v22.0.0"
  },
  "network": {
    "GitHub": { "host": "github.com", "latency": 45, "status": "ok", "alive": true },
    "YouTube": { "host": "youtube.com", "latency": 120, "status": "slow", "alive": true },
    "Telegram": { "host": "telegram.org", "latency": 35, "status": "ok", "alive": true },
    "Google": { "host": "google.com", "latency": null, "status": "timeout", "alive": false }
  },
  "logs": [
    { "timestamp": "2024-03-01T10:00:00Z", "level": "error", "message": "请求超时" }
  ],
  "errors": 2,
  "lastUpdated": "2024-03-01T10:05:00Z"
}
```

### `GET /network`

仅获取网络状态：

```json
{
  "GitHub": { "host": "github.com", "latency": 45, "status": "ok", "alive": true },
  "YouTube": { "host": "youtube.com", "latency": 120, "status": "slow", "alive": true }
}
```

### `GET /gateway`

仅获取 Gateway 状态。

### `GET /logs?limit=10`

仅获取日志。

### `GET /config`

获取配置信息。

## 网络状态说明

| status | 说明 |
|--------|------|
| `ok` | 延迟 < 100ms |
| `warning` | 延迟 100-200ms |
| `slow` | 延迟 > 200ms |
| `timeout` | 超时无响应 |
| `error` | 其他错误 |

## 与 Dashboard 配合

在 Dashboard 中设置 Agent URL：

```
Agent URL: http://localhost:3001
```

Dashboard 会从 `/health` 端点获取所有数据，包括网络状态。

## 作为系统服务运行

### macOS (launchd)

创建 `~/Library/LaunchAgents/com.openclaw.monitor.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.monitor</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/agent/index.js</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>3001</string>
        <key>GATEWAY_URL</key>
        <string>http://localhost:18789</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

加载：

```bash
launchctl load ~/Library/LaunchAgents/com.openclaw.monitor.plist
```

### Linux (systemd)

创建 `/etc/systemd/system/openclaw-monitor.service`:

```ini
[Unit]
Description=OpenClaw Monitor Agent
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/path/to/agent
Environment=PORT=3001
Environment=GATEWAY_URL=http://localhost:18789
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl enable openclaw-monitor
sudo systemctl start openclaw-monitor
```

## 许可证

MIT