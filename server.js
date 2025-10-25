require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const path = require('path');
const { exec } = require('child_process');
const WebSocket = require('ws');
const CryptoJS = require('crypto-js');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

let anthropic = null;
let mcpClient = null;

async function initializeMCP() {
    const transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@amap/amap-maps-mcp-server'],
        env: {
            ...process.env,
            AMAP_MAPS_API_KEY: process.env.AMAP_MAPS_API_KEY
        }
    });

    mcpClient = new Client({
        name: 'map-navigator-client',
        version: '1.0.0'
    }, {
        capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('✅ MCP Client connected to AMap MCP Server');

    const tools = await mcpClient.listTools();
    console.log('Available AMap MCP tools:', tools.tools.map(t => t.name).join(', '));
}

function initializeAnthropic() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    const config = { apiKey };
    if (process.env.ANTHROPIC_BASE_URL) {
        config.baseURL = process.env.ANTHROPIC_BASE_URL;
    }
    anthropic = new Anthropic(config);
    console.log('✅ Anthropic client initialized');
}

function openBrowserURL(url) {
    const platform = process.platform;
    let command;

    // 使用单引号包裹URL可以避免shell解释特殊字符（如$$）
    // 注意：不能使用模板字符串，因为模板字符串会被Node.js处理
    // 必须使用字符串连接，这样单引号中的内容会原封不动地传给shell
    if (platform === 'darwin') {
        // 在macOS上，使用单引号可以避免$被解释
        // 如果URL中包含单引号，需要转义为 '\''
        const escapedUrl = url.replace(/'/g, "'\\''");
        command = "open '" + escapedUrl + "'";
    } else if (platform === 'win32') {
        // Windows的start命令处理方式不同
        const escapedUrl = url.replace(/"/g, '""');
        command = 'start "" "' + escapedUrl + '"';
    } else {
        // Linux系统使用xdg-open，用单引号包裹
        const escapedUrl = url.replace(/'/g, "'\\''");
        command = "xdg-open '" + escapedUrl + "'";
    }

    return new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

async function reverseGeocode(lng, lat) {
    try {
        const apiKey = process.env.AMAP_MAPS_API_KEY;
        if (!apiKey) {
            throw new Error('AMAP_MAPS_API_KEY not configured');
        }

        const url = `https://restapi.amap.com/v3/geocode/regeo?key=${apiKey}&location=${lng},${lat}&output=json`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === '1' && data.regeocode) {
            const regeocode = data.regeocode;
            return {
                name: regeocode.formatted_address,
                location: `${lng},${lat}`,
                adcode: regeocode.addressComponent.adcode,
                address: regeocode.formatted_address
            };
        }

        return null;
    } catch (error) {
        console.error('逆地理编码失败:', error);
        return null;
    }
}

// ============= 百度地图API函数 =============

async function baiduSearchLocation(keyword) {
    try {
        const apiKey = process.env.BAIDU_MAPS_API_KEY;
        if (!apiKey) {
            throw new Error('BAIDU_MAPS_API_KEY not configured');
        }

        // 使用百度地图地点搜索API
        const url = `https://api.map.baidu.com/place/v2/search?query=${encodeURIComponent(keyword)}&region=全国&output=json&ak=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 0 && data.results && data.results.length > 0) {
            const poi = data.results[0];
            return {
                name: poi.name,
                location: `${poi.location.lng},${poi.location.lat}`,
                address: poi.address || poi.name
            };
        }

        // 如果搜索失败，尝试地理编码
        const geocodeUrl = `https://api.map.baidu.com/geocoding/v3/?address=${encodeURIComponent(keyword)}&output=json&ak=${apiKey}`;
        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();

        if (geocodeData.status === 0 && geocodeData.result) {
            return {
                name: keyword,
                location: `${geocodeData.result.location.lng},${geocodeData.result.location.lat}`,
                address: keyword
            };
        }

        return null;
    } catch (error) {
        console.error('百度地图搜索失败:', error);
        return null;
    }
}

async function baiduReverseGeocode(lng, lat) {
    try {
        const apiKey = process.env.BAIDU_MAPS_API_KEY;
        if (!apiKey) {
            throw new Error('BAIDU_MAPS_API_KEY not configured');
        }

        // 百度地图逆地理编码API
        const url = `https://api.map.baidu.com/reverse_geocoding/v3/?ak=${apiKey}&output=json&coordtype=wgs84ll&location=${lat},${lng}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 0 && data.result) {
            return {
                name: data.result.formatted_address,
                location: `${data.result.location.lng},${data.result.location.lat}`,
                address: data.result.formatted_address
            };
        }

        return null;
    } catch (error) {
        console.error('百度逆地理编码失败:', error);
        return null;
    }
}

async function searchLocation(keyword) {
    try {
        const apiKey = process.env.AMAP_MAPS_API_KEY;
        if (!apiKey) {
            throw new Error('AMAP_MAPS_API_KEY not configured');
        }

        const url = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(keyword)}&output=json`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === '1' && data.pois && data.pois.length > 0) {
            const poi = data.pois[0];
            return {
                name: poi.name,
                location: poi.location,
                adcode: poi.adcode,
                address: poi.address || poi.pname + poi.cityname + poi.adname
            };
        }

        const geocodeUrl = `https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${encodeURIComponent(keyword)}&output=json`;
        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();

        if (geocodeData.status === '1' && geocodeData.geocodes && geocodeData.geocodes.length > 0) {
            const geocode = geocodeData.geocodes[0];
            return {
                name: geocode.formatted_address || keyword,
                location: geocode.location,
                adcode: geocode.adcode,
                address: geocode.formatted_address || keyword
            };
        }

        return null;
    } catch (error) {
        console.error('搜索地点失败:', error);
        return null;
    }
}

app.post('/api/navigate', async (req, res) => {
    const { input, userLocation, mapProvider = 'amap' } = req.body;

    console.log('收到请求参数:', { input, mapProvider, hasLocation: !!userLocation });

    if (!input) {
        return res.status(400).json({ success: false, error: '请输入导航需求' });
    }

    const mapName = mapProvider === 'baidu' ? '百度地图' : '高德地图';
    console.log(`使用地图类型: mapProvider="${mapProvider}", mapName="${mapName}"`);

    try {
        const prompt = `从以下用户输入中提取起点和终点信息，以JSON格式返回：{"from": "起点", "to": "终点"}

用户输入：${input}

如果用户没有明确指定起点（例如只说"去xxx"、"到xxx"），请将from字段设置为null。
请只返回JSON，不要有其他说明文字。`;

        const response = await anthropic.messages.create({
            model: process.env.ANTHROPIC_MODEL || 'claude-4.5-sonnet',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
        });

        const textContent = response.content.find(block => block.type === 'text');
        const jsonMatch = textContent.text.match(/\{[^}]+\}/);

        if (!jsonMatch) {
            throw new Error('无法解析地点信息');
        }

        const locations = JSON.parse(jsonMatch[0]);
        console.log('提取的地点:', locations);

        // 根据地图类型选择对应的API
        const searchFunc = mapProvider === 'baidu' ? baiduSearchLocation : searchLocation;
        const reverseFunc = mapProvider === 'baidu' ? baiduReverseGeocode : reverseGeocode;

        let fromInfo = null;

        if (locations.from && locations.from !== 'null') {
            console.log(`正在使用${mapName}API搜索起点信息...`);
            fromInfo = await searchFunc(locations.from);
        } else if (userLocation) {
            console.log(`使用用户当前位置作为起点: ${userLocation.lng}, ${userLocation.lat}`);
            fromInfo = await reverseFunc(userLocation.lng, userLocation.lat);
        } else {
            throw new Error('未获取到您的位置信息,请明确指定起点(例如:从xx到yy)或允许浏览器获取位置权限');
        }

        console.log(`正在使用${mapName}API搜索终点信息...`);
        const toInfo = await searchFunc(locations.to);

        if (!toInfo) {
            throw new Error('无法找到终点信息，请使用更具体的地址');
        }

        if (!fromInfo) {
            throw new Error('无法找到起点信息，请使用更具体的地址');
        }

        console.log('起点信息:', fromInfo);
        console.log('终点信息:', toInfo);

        let navigationURL;

        console.log(`\n=== 开始生成导航URL ===`);
        console.log(`mapProvider值: "${mapProvider}"`);
        console.log(`mapProvider === 'baidu': ${mapProvider === 'baidu'}`);

        if (mapProvider === 'baidu') {
            console.log('✅ 进入百度地图分支');

            // 百度地图API返回的就是BD-09坐标，直接使用
            const [fromLng, fromLat] = fromInfo.location.split(',').map(Number);
            const [toLng, toLat] = toInfo.location.split(',').map(Number);

            // BD-09转墨卡托坐标（百度地图网页版使用墨卡托坐标）
            function bd09ToMercator(lng, lat) {
                const mcLng = lng * 20037508.34 / 180.0;
                let mcLat = Math.log(Math.tan((90.0 + lat) * Math.PI / 360.0)) / (Math.PI / 180.0);
                mcLat = mcLat * 20037508.34 / 180.0;
                return [mcLng, mcLat];
            }

            const [fromMcLng, fromMcLat] = bd09ToMercator(fromLng, fromLat);
            const [toMcLng, toMcLat] = bd09ToMercator(toLng, toLat);

            // 计算中心点
            const centerMcLng = (fromMcLng + toMcLng) / 2;
            const centerMcLat = (fromMcLat + toMcLat) / 2;

            // URL编码地名
            const fromName = encodeURIComponent(fromInfo.name);
            const toName = encodeURIComponent(toInfo.name);

            // 生成百度地图URL
            navigationURL = `https://map.baidu.com/dir/${fromName}/${toName}/` +
                `@${centerMcLng.toFixed(2)},${centerMcLat.toFixed(2)},10z` +
                `?querytype=bt` +
                `&c=289` +
                `&sn=1$$$$${fromMcLng.toFixed(0)},${fromMcLat.toFixed(0)}$$${fromName}$$0$$$$` +
                `&en=1$$$$${toMcLng.toFixed(0)},${toMcLat.toFixed(0)}$$${toName}$$0$$$$` +
                `&sc=289&ec=289` +
                `&pn=0&rn=5` +
                `&version=5` +
                `&da_src=shareurl`;

            console.log('百度地图导航信息:');
            console.log('  起点:', `${fromInfo.name} - BD-09(${fromLng}, ${fromLat}) - 墨卡托(${fromMcLng.toFixed(0)}, ${fromMcLat.toFixed(0)})`);
            console.log('  终点:', `${toInfo.name} - BD-09(${toLng}, ${toLat}) - 墨卡托(${toMcLng.toFixed(0)}, ${toMcLat.toFixed(0)})`);
        } else {
            console.log('⚠️ 进入高德地图分支');
            // 高德地图导航URL
            const fromLngLat = fromInfo.location;
            const toLngLat = toInfo.location;

            navigationURL = `https://www.amap.com/dir?dateTime=now` +
                `&from[adcode]=${fromInfo.adcode}` +
                `&from[id]=` +
                `&from[lnglat]=${fromLngLat}` +
                `&from[modxy]=${fromLngLat}` +
                `&from[name]=${fromInfo.name}` +
                `&from[poitype]=` +
                `&to[adcode]=${toInfo.adcode}` +
                `&to[id]=` +
                `&to[lnglat]=${toLngLat}` +
                `&to[modxy]=${toLngLat}` +
                `&to[name]=${toInfo.name}` +
                `&to[poitype]=` +
                `&policy=1&type=car`;
        }

        console.log(`生成的${mapName}URL:`, navigationURL);
        console.log(`=== 结束生成导航URL ===\n`);
        await openBrowserURL(navigationURL);

        res.json({
            success: true,
            message: `${mapName}导航已启动！正在规划路线：${fromInfo.name} → ${toInfo.name}`,
            from: fromInfo.name,
            to: toInfo.name,
            map: mapName
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || '处理请求时出错'
        });
    }
});

function getXfyunAuthUrl() {
    const APPID = process.env.XFYUN_APPID;
    const API_KEY = process.env.XFYUN_API_KEY;
    const API_SECRET = process.env.XFYUN_API_SECRET;

    const host = 'iat-api.xfyun.cn';
    const date = new Date().toUTCString();
    const algorithm = 'hmac-sha256';
    const headers = 'host date request-line';
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;

    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, API_SECRET);
    const signature = CryptoJS.enc.Base64.stringify(signatureSha);

    const authorizationOrigin = `api_key="${API_KEY}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');

    return `wss://${host}/v2/iat?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`;
}

app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: '未接收到音频文件' });
        }

        const audioBuffer = req.file.buffer;
        const wsUrl = getXfyunAuthUrl();
        const ws = new WebSocket(wsUrl);

        let result = '';
        let hasError = false;

        ws.on('open', () => {
            const params = {
                common: {
                    app_id: process.env.XFYUN_APPID
                },
                business: {
                    language: 'zh_cn',
                    domain: 'iat',
                    accent: 'mandarin',
                    vad_eos: 5000,
                    dwa: 'wpgs'
                },
                data: {
                    status: 2,
                    format: 'audio/L16;rate=16000',
                    encoding: 'raw',
                    audio: audioBuffer.toString('base64')
                }
            };

            ws.send(JSON.stringify(params));
        });

        ws.on('message', (message) => {
            const data = JSON.parse(message);

            if (data.code !== 0) {
                console.error('讯飞识别错误:', data.message);
                hasError = true;
                ws.close();
                return;
            }

            if (data.data && data.data.result) {
                const texts = data.data.result.ws.map(word =>
                    word.cw.map(c => c.w).join('')
                ).join('');
                result += texts;
            }

            if (data.data && data.data.status === 2) {
                ws.close();
            }
        });

        ws.on('close', () => {
            if (hasError) {
                res.status(500).json({ success: false, error: '语音识别失败' });
            } else {
                res.json({ success: true, text: result || '' });
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket错误:', error);
            res.status(500).json({ success: false, error: '连接语音服务失败' });
        });

    } catch (error) {
        console.error('语音识别错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

async function startServer() {
    try {
        initializeAnthropic();
        await initializeMCP();

        app.listen(PORT, () => {
            console.log(`\n🚀 Server running at http://localhost:${PORT}`);
            console.log(`📍 Open this URL in your browser to start navigating!\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});

startServer();
