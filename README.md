# 🗺️ AI地图导航助手

通过自然语言输入自动打开高德地图导航的智能助手。

## ✨ 特性

- 🤖 **自然语言理解**: 使用AI智能识别起点和终点
- 🎤 **语音输入**: 支持讯飞语音识别,无需打字
- 📍 **自动定位**: 支持浏览器定位,无需手动输入起点
- 🗺️ **高德地图**: 自动打开浏览器并进入导航状态
- 🎨 **友好界面**: 简洁的Web界面,实时显示定位状态

## 📋 前置要求

- Node.js 18+
- Anthropic API Key
- 高德地图 API Key（在 [高德开放平台](https://console.amap.com) 申请）
- 讯飞语音识别 API（可选，在 [讯飞开放平台](https://console.xfyun.cn) 申请）

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置API密钥

创建 `.env` 文件:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-4.5-sonnet

AMAP_MAPS_API_KEY=your_amap_api_key

# 可选：语音识别功能
XFYUN_APPID=your_xfyun_appid
XFYUN_API_KEY=your_xfyun_api_key
XFYUN_API_SECRET=your_xfyun_api_secret
```

> 💡 **配置语音识别**: 查看 [XFYUN_SETUP.md](./XFYUN_SETUP.md) 了解如何申请讯飞API密钥

### 3. 启动服务

```bash
npm start
```

### 4. 打开浏览器

访问 `http://localhost:3000`

## 💡 使用示例

### 文本输入模式
在输入框中输入导航需求:

**自动定位模式（需授权位置权限）**
- "去故宫"
- "到知春路地铁站"
- "导航到西湖"

**指定起终点模式**
- "从北京到上海"
- "从天安门到鸟巢"
- "从杭州西湖到灵隐寺"

### 🎤 语音输入模式
1. 点击麦克风按钮 🎤
2. 授权浏览器使用麦克风
3. 说出导航指令
4. 等待识别完成或再次点击按钮停止

## 🏗️ 工作原理

1. **获取位置**: 浏览器自动获取用户GPS坐标（可选）
2. **AI理解**: Claude分析输入,提取起点和终点
3. **地点搜索**: 调用高德地图API搜索地点信息
4. **坐标转换**: 将GPS坐标转换为可读地址
5. **打开导航**: 自动打开浏览器显示高德地图导航页面

## 📁 项目结构

```
map-navigator/
├── index.html          # 前端界面
├── server.js           # 后端服务
├── package.json        # 依赖配置
└── .env                # API密钥配置
```

## 🔑 核心技术

- **Claude AI**: 自然语言理解
- **讯飞语音识别**: 国内可用的语音转文字服务
- **高德地图API**: 地点搜索、地理编码、逆地理编码
- **Browser Geolocation API**: 获取用户位置
- **Web Audio API**: 浏览器端音频录制
- **Express**: Web服务器

## 📝 许可证

MIT
