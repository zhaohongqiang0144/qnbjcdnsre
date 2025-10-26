# 🗺️ AI地图导航助手

通过自然语言或语音输入，智能识别起点和终点，自动打开地图导航的AI助手。支持高德地图和百度地图。

## ✨ 核心特性

- 🤖 **AI智能理解**: 使用 Claude AI 自动识别用户输入中的起点和终点
- 🗺️ **双地图支持**: 支持高德地图和百度地图，用户可自由选择
- 🎤 **语音识别**: 集成讯飞语音识别，支持语音输入导航需求
- 📍 **智能定位**: 浏览器自动定位，支持"去XX"快捷导航
- 🚀 **一键导航**: 自动打开浏览器进入导航页面，无需手动操作
- 🎨 **美观界面**: 响应式设计，实时状态反馈

## 📋 前置要求

- **Node.js** 18+
- **Anthropic API Key** - 用于 Claude AI 自然语言理解
- **高德地图 API Key** - 在 [高德开放平台](https://console.amap.com) 申请
- **百度地图 API Key** - 在 [百度地图开放平台](https://lbsyun.baidu.com) 申请
- **讯飞语音 API**（可选）- 在 [讯飞开放平台](https://console.xfyun.cn) 申请

## 🚀 快速开始

### 1. 克隆项目并安装依赖

```bash
npm install 
```

### 2. 配置 API 密钥

创建 `.env` 文件并填入以下配置：

```env
# Anthropic AI 配置
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-4.5-sonnet

# 高德地图 API Key
AMAP_MAPS_API_KEY=your_amap_api_key

# 百度地图 API Key
BAIDU_MAPS_API_KEY=your_baidu_api_key

# 讯飞语音识别（可选）
XFYUN_APPID=your_xfyun_appid
XFYUN_API_KEY=your_xfyun_api_key
XFYUN_API_SECRET=your_xfyun_api_secret
```

> 💡 **语音识别配置**: 查看 [XFYUN_SETUP.md](./XFYUN_SETUP.md) 了解详细的讯飞 API 申请流程

### 3. 启动服务

```bash
nohup npm start > server.log 2>&1 & 
```

### 4. 打开浏览器

访问 `http://localhost:3000`，开始使用！

## 💡 使用示例

### 📝 文本输入模式

#### 自动定位模式（需授权浏览器位置权限）
- "去故宫"
- "到知春路地铁站"
- "导航到西湖"

#### 指定起终点模式
- "从北京到上海"
- "从天安门到鸟巢"
- "从杭州西湖到灵隐寺"

### 🎤 语音输入模式

1. 点击右侧麦克风按钮 🎤
2. 授权浏览器使用麦克风
3. 清晰说出导航指令
4. 自动识别或点击按钮停止录音
5. 确认识别结果后点击"开始导航"

### 🗺️ 地图选择

在界面底部选择您偏好的地图服务：
- **高德地图**: 国内常用，POI数据丰富
- **百度地图**: 坐标系统为 BD-09，部分地区数据更准确

## 🏗️ 系统架构

### 整体流程

```
用户输入（文本/语音）
    ↓
Claude AI 解析起终点
    ↓
调用地图 API 搜索地点
    ↓
坐标转换与 URL 生成
    ↓
打开浏览器导航
```

### 技术栈

#### 前端
- **HTML5 + CSS3**: 响应式界面设计
- **原生 JavaScript**: 无框架依赖
- **Web Geolocation API**: 获取用户位置
- **Web Audio API**: 浏览器端音频录制
- **MediaRecorder API**: 音频流处理

#### 后端
- **Node.js + Express**: Web 服务器
- **Anthropic SDK**: Claude AI 集成
- **讯飞 WebSocket API**: 语音识别
- **高德/百度地图 REST API**: 地理编码服务

## 📖 核心功能详解

### 1. 自然语言理解 (NLP)

**技术实现**: 使用 Claude AI 的 `messages` API

**处理流程**:
```javascript
用户输入: "从北京到上海"
    ↓
Claude AI 解析
    ↓
输出 JSON: {"from": "北京", "to": "上海"}
```

**边缘情况处理**:
- 未指定起点（如"去故宫"）→ `from` 设为 `null`，使用当前定位
- 模糊地点（如"西湖"）→ 调用地图 API 搜索最佳匹配

### 2. 地图 API 集成

#### 高德地图 API

**使用的接口**:
- `place/text` - POI 搜索
- `geocode/geo` - 地理编码
- `geocode/regeo` - 逆地理编码（坐标→地址）

**示例请求**:
```javascript
// 搜索地点
https://restapi.amap.com/v3/place/text?key=KEY&keywords=故宫

// 逆地理编码
https://restapi.amap.com/v3/geocode/regeo?key=KEY&location=116.404,39.915
```

#### 百度地图 API

**使用的接口**:
- `place/v2/search` - 地点搜索
- `geocoding/v3` - 地理编码
- `reverse_geocoding/v3` - 逆地理编码

**坐标系统**:
- 百度地图使用 **BD-09 坐标系**
- 自动进行 **WGS-84 → BD-09** 坐标转换
- 导航 URL 使用**墨卡托投影坐标**

**坐标转换逻辑**:
```javascript
// BD-09 → 墨卡托坐标（用于百度地图 URL）
function bd09ToMercator(lng, lat) {
    const mcLng = lng * 20037508.34 / 180.0;
    let mcLat = Math.log(Math.tan((90.0 + lat) * Math.PI / 360.0)) / (Math.PI / 180.0);
    mcLat = mcLat * 20037508.34 / 180.0;
    return [mcLng, mcLat];
}
```

### 3. 语音识别

**技术方案**: 讯飞语音识别 WebSocket API

**工作流程**:
1. 前端通过 `getUserMedia` 录制音频
2. 转换为 16kHz 采样率的 PCM 格式
3. 通过 WebSocket 实时传输到讯飞服务器
4. 接收识别结果并显示

**音频处理**:
```javascript
// 采样率转换（浏览器采样率 → 16kHz）
const ratio = sampleRate / 16000;
const resampledData = new Float32Array(newLength);
for (let i = 0; i < newLength; i++) {
    resampledData[i] = floatData[Math.floor(i * ratio)];
}

// Float32 → Int16（PCM 格式）
const pcmData = new Int16Array(resampledData.length);
for (let i = 0; i < resampledData.length; i++) {
    pcmData[i] = Math.max(-32768, Math.min(32767,
        Math.floor(resampledData[i] * 32768)));
}
```

### 4. 导航 URL 生成

#### 高德地图 URL 格式
```
https://www.amap.com/dir?
  from[lnglat]=116.404,39.915&
  from[name]=起点名称&
  to[lnglat]=121.473,31.230&
  to[name]=终点名称&
  policy=1&type=car
```

#### 百度地图 URL 格式
```
https://map.baidu.com/dir/起点/终点/
  @中心墨卡托X,中心墨卡托Y,10z?
  querytype=bt&
  sn=1$$$$起点墨卡托X,起点墨卡托Y$$起点名称$$0$$$$&
  en=1$$$$终点墨卡托X,终点墨卡托Y$$终点名称$$0$$$$
```

**注意**: 百度地图 URL 中的 `$$` 是特殊分隔符，需要特别处理避免被 shell 解释为进程 ID。

### 5. 浏览器打开机制

**跨平台支持**:
```javascript
// macOS
open 'URL'

// Windows
start "" "URL"

// Linux
xdg-open 'URL'
```

**关键技术点 - Shell 特殊字符处理**:

问题: 百度地图 URL 中的 `$$` 在 bash 中表示进程 ID，会被错误替换

解决方案:
```javascript
// ❌ 错误做法 - 使用模板字符串
command = `open "${url}"`;  // $$ 会被解释为进程 ID

// ✅ 正确做法 - 使用单引号 + 字符串连接
const escapedUrl = url.replace(/'/g, "'\\''");  // 处理 URL 中的单引号
command = "open '" + escapedUrl + "'";  // 单引号保护所有特殊字符
```

## 📁 项目结构

```
qnbjcdnsre/
├── index.html          # 前端界面（HTML + CSS + JavaScript）
├── server.js           # 后端服务（Express + API 集成）
├── package.json        # 依赖配置
├── .env                # API 密钥配置（不提交到 Git）
├── README.md           # 项目文档
└── XFYUN_SETUP.md      # 讯飞语音配置指南
```

## 🔑 API 密钥申请指南

### Anthropic API Key
1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册/登录账号
3. 创建 API Key
4. 复制密钥到 `.env` 文件

### 高德地图 API Key
1. 访问 [高德开放平台](https://console.amap.com/)
2. 注册开发者账号
3. 创建应用，选择 **Web服务** 类型
4. 开启以下服务：
   - 地点搜索
   - 地理/逆地理编码
5. 复制 Key 到 `.env` 文件

### 百度地图 API Key
1. 访问 [百度地图开放平台](https://lbsyun.baidu.com/)
2. 注册开发者账号
3. 创建应用，选择 **服务端** 类型
4. 开启以下服务：
   - 地点搜索（Place API）
   - 地理编码（Geocoding API）
5. 复制 AK 到 `.env` 文件

### 讯飞语音 API（可选）
详见 [XFYUN_SETUP.md](./XFYUN_SETUP.md)

## 🐛 常见问题

### 1. 浏览器无法获取位置权限
**解决方案**:
- 确保使用 HTTPS 或 `localhost`
- 检查浏览器设置，允许位置访问
- 手动输入起点，如"从北京到上海"

### 2. 语音识别失败
**可能原因**:
- 未配置讯飞 API 密钥
- 麦克风权限未授权
- 网络连接问题

**解决方案**:
- 检查 `.env` 中讯飞配置
- 在浏览器设置中允许麦克风访问
- 使用文本输入作为替代方案

### 3. 地图无法打开
**可能原因**:
- API Key 配置错误或过期
- 网络连接问题
- 搜索的地点不存在

**解决方案**:
- 验证 API Key 是否有效
- 检查控制台日志查看详细错误
- 使用更具体的地点描述

### 4. 百度地图 URL 中的 `$$` 被替换成数字
**原因**: Shell 中 `$$` 表示进程 ID

**已解决**: 代码已使用单引号保护 URL 特殊字符

## 🛠️ 开发指南

### 运行开发模式
```bash
npm run dev  # 使用 nodemon 自动重启
```

### 调试技巧
1. 查看服务器日志：
   ```bash
   npm start
   # 日志会显示：
   # - 收到的请求参数
   # - AI 解析结果
   # - 地图 API 响应
   # - 生成的导航 URL
   ```

2. 浏览器控制台：
   - 查看前端请求和响应
   - 检查定位状态
   - 调试语音识别

### 扩展开发

#### 添加新的地图服务
1. 在 `server.js` 中添加搜索和逆地理编码函数
2. 在 `/api/navigate` 路由中添加 URL 生成逻辑
3. 在 `index.html` 中添加地图选项

#### 支持更多语音识别服务
修改 `/api/speech-to-text` 接口，集成其他 ASR 服务

## 📊 性能优化

- **响应速度**: Claude API 调用 ~1-2秒
- **地图 API**: 高德/百度 API 响应 ~100-300ms
- **语音识别**: 讯飞实时识别，延迟 <500ms
- **总体导航时间**: 约 2-5 秒（取决于网络状况）

## 🔒 安全性

- **API Key 保护**: 所有密钥存储在 `.env` 文件，不提交到版本控制
- **输入验证**: 服务端验证所有用户输入
- **错误处理**: 完善的异常捕获和错误提示

## 📝 更新日志

### v1.1.0 (当前版本)
- ✅ 新增百度地图支持
- ✅ 修复百度地图 URL 中 `$$` 被替换的问题
- ✅ 优化 Shell 命令转义逻辑
- ✅ 完善文档和使用说明

### v1.0.0
- ✅ 基础导航功能（高德地图）
- ✅ 自然语言理解
- ✅ 语音识别
- ✅ 浏览器定位

## 🤝 贡献
zhangaibing (后端架构 + 高德地图)：
  - 负责整体服务器架构设计
  - AI服务集成和自然语言理解
  - 高德地图API兼容和优化
  - 语音识别服务管理

  niuyihang (百度地图功能)：
  - 百度地图API集成和配置
  - 百度地图地点搜索和路线规划
  - 坐标转换算法实现
  - 百度地图错误处理优化

  zhaohongqiang (前端页面)：
  - 用户界面设计和交互优化
  - 位置获取和权限管理
  - 语音录制和音频处理
  - 响应式布局和移动端适配
## demo_url
https://b23.tv/4Z1l1Nd

## 📄 许可证

MIT License

---

**Powered by 七牛云 AI | 1024 程序员节特别项目**
