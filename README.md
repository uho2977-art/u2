# OpenClaw Dashboard

OpenClaw 监控面板，为移动设备优化，大字一目了然。

![Preview](preview.png)

## 功能

- 🚦 **状态指示灯** - 绿/黄/红三色，一眼知健康
- ⏱️ **运行时间** - Gateway 进程运行时间 + 版本号
- 🤖 **Agent 状态** - 总数/活跃数
- 💻 **系统资源** - CPU、内存使用率
- 🌐 **网络延迟** - 5 个常用服务 Ping 探测
- ❌ **错误统计** - 过去 1 小时 Gateway 错误数
- 📜 **错误日志** - 最新 5 条错误滚动显示
- 📱 **移动优化** - 全屏按钮、横竖屏适配

## 状态灯逻辑

| 颜色 | 条件 |
|------|------|
| 🟢 绿 | Gateway 连接正常 + 无网络超时 + 无错误 + 内存 < 80% + 延迟 < 200ms |
| 🟡 黄 | 有错误 OR 内存 > 80% OR 网络延迟 > 200ms |
| 🔴 红 | Gateway 断开 OR 网络超时 |

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
- 内存占用恒定 ~54MB（无论多少客户端）
- 120 秒轮询，不压垮 Gateway
- 所有客户端共享数据，实时一致

## 快速开始

```bash
# 克隆
git clone https://github.com/uho2977-art/u2.git
cd u2

# 安装依赖
npm install

# 构建 + 启动
npm run build
npm start
```

访问：`http://localhost:3001`

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3001 | 服务端口 |

### Ping 主机配置

编辑 `server/index.js`：

```javascript
const CONFIG = {
  port: process.env.PORT || 3001,
  pollInterval: 120000, // 轮询间隔（毫秒）
  pingHosts: [
    { name: 'GitHub', host: 'github.com' },
    { name: 'YouTube', host: 'youtube.com' },
    { name: 'Telegram', host: 'telegram.org' },
    { name: 'Google', host: 'google.com' },
    { name: 'Ollama', host: 'ollama.com' }
    // 添加更多...
  ]
}
```

### 轮询间隔

```javascript
pollInterval: 120000  // 120 秒（建议 60-300 秒）
```

前端刷新间隔在 `src/App.tsx`：

```javascript
setInterval(fetchData, 30000)  // 30 秒
```

### 状态灯阈值

在 `src/App.tsx` 的 `getStatus()` 函数中修改：

```javascript
// 黄灯条件
if (health.errors > 0 || health.system.memory > 80 || hasSlow) return 'yellow'
```

### 网络延迟阈值

在 `server/index.js` 的 `pingHosts()` 函数中：

```javascript
if (latency > 200) status = 'slow'      // > 200ms 慢
else if (latency > 100) status = 'warning'  // 100-200ms 警告
```

## API

### `GET /health`

获取所有监控数据：

```json
{
  "gateway": {
    "connected": true,
    "uptime": 101876,
    "version": "2026.3.1"
  },
  "agents": { "total": 3, "active": 2, "list": ["main", "coder"] },
  "system": { "cpu": 6.2, "memory": 16, "platform": "darwin" },
  "network": {
    "GitHub": { "host": "github.com", "latency": 102, "status": "warning", "alive": true },
    "Ollama": { "host": "ollama.com", "latency": 131, "status": "warning", "alive": true }
  },
  "logs": [
    { "timestamp": "2026-03-02T18:30:15.145Z", "message": "Port 18789 is already in use.", "level": "error" }
  ],
  "errors": 423,
  "lastUpdated": "2026-03-02T18:33:11.202Z"
}
```

### `GET /network`

仅获取网络状态。

## 部署

### macOS (launchd)

1. 创建 plist 文件：

```bash
cp com.openclaw.dashboard.plist ~/Library/LaunchAgents/
```

2. 编辑路径：

```xml
<key>ProgramArguments</key>
<array>
    <string>/opt/homebrew/bin/node</string>
    <string>/Users/你的用户名/.openclaw/workspace-coder/u2/server/index.js</string>
</array>
<key>EnvironmentVariables</key>
<dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
</dict>
```

3. 加载服务：

```bash
launchctl load ~/Library/LaunchAgents/com.openclaw.dashboard.plist
```

管理命令：

```bash
# 查看状态
launchctl list | grep openclaw

# 停止
launchctl unload ~/Library/LaunchAgents/com.openclaw.dashboard.plist

# 启动
launchctl load ~/Library/LaunchAgents/com.openclaw.dashboard.plist

# 查看日志
tail -f /tmp/openclaw-dashboard.log
```

### Linux (systemd)

创建 `/etc/systemd/system/openclaw-dashboard.service`：

```ini
[Unit]
Description=OpenClaw Dashboard
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/u2
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable openclaw-dashboard
sudo systemctl start openclaw-dashboard
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY dist ./dist
COPY server ./server
EXPOSE 3001
CMD ["node", "server/index.js"]
```

```bash
docker build -t openclaw-dashboard .
docker run -d -p 3001:3001 --name dashboard openclaw-dashboard
```

## 访问地址

- 本机：`http://localhost:3001`
- 局域网：`http://<你的IP>:3001`

查看本机 IP：

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I
```

## 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Node.js + Express
- **Ping**: net-ping (ICMP)
- **UI**: 纯 CSS（无框架，极简）

## 内存占用

| 组件 | 内存 |
|------|------|
| Node.js 进程 | ~54 MB |
| 单次轮询 | ~1-2 MB 临时 |
| 多客户端 | 无额外占用 |

## 常见问题

### Q: 内存显示 90%+ 但系统显示正常？

macOS 的 `os.freemem()` 不准确。本 Dashboard 使用 `memory_pressure` 命令获取真实内存压力。

### Q: 错误数很多但 Gateway 正常？

可能是 Gateway launchd 服务重复启动。检查：
```bash
launchctl list | grep openclaw
```

### Q: 网络延迟显示 0ms？

确保有 ICMP 权限。Linux 可能需要：
```bash
sudo setcap cap_net_raw=+ep /usr/bin/node
```

## 许可证

MIT

## 作者

OpenClaw Dashboard - 由 OpenClaw Agent 开发