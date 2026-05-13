// 智伴晚晴 · 语音识别后端
// 腾讯云语音识别 API 代理

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 腾讯云 API 密钥（部署到服务器时设置环境变量）
const TENCENT_SECRET_ID = process.env.TENCENT_SECRET_ID;
const TENCENT_SECRET_KEY = process.env.TENCENT_SECRET_KEY;

let AsrClient;
try {
  AsrClient = require('tencentcloud-sdk-nodejs-asr').asr.v20190614.Client;
} catch (e) {
  console.warn('\n⚠️  腾讯云语音识别 SDK 未安装，语音功能不可用');
  console.warn('   请执行: npm install tencentcloud-sdk-nodejs-asr\n');
}

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// 静态文件服务：提供前端页面
app.use(express.static(path.join(__dirname, '..')));

// 语音识别
app.post('/api/voice/recognize', async (req, res) => {
  try {
    const { audioBase64, language } = req.body;
    if (!audioBase64) return res.json({ code: -1, msg: '音频数据为空' });

    if (!AsrClient || !TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) {
      return res.json({ code: -1, msg: '语音识别服务未配置' });
    }

    const client = new AsrClient({
      credential: {
        secretId: TENCENT_SECRET_ID,
        secretKey: TENCENT_SECRET_KEY,
      },
      region: 'ap-guangzhou',
      profile: {
        httpProfile: { endpoint: 'asr.tencentcloudapi.com' },
      },
    });

    const audioBytes = Math.max(1, Math.floor(audioBase64.length * 3 / 4));
    const engSerViceType = language === 'cantonese' ? '16k_zh' : '16k_zh';

    const params = {
      EngSerViceType: engSerViceType,
      SourceType: 1,
      VoiceFormat: 'pcm',
      Data: audioBase64,
      DataLen: audioBytes,
    };

    const result = await client.SentenceRecognition(params);
    const text = (result.Result || '').trim();

    if (text) {
      res.json({ code: 0, msg: '识别成功', result: text });
    } else {
      res.json({ code: -1, msg: '识别结果为空，请重试' });
    }
  } catch (e) {
    res.json({ code: -1, msg: `识别失败：${e.message}` });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: '智伴晚晴语音识别服务运行中' });
});

// 启动前检查必要的环境变量
if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) {
  console.warn('\n⚠️  腾讯云语音识别 SecretId/SecretKey 未配置');
  console.warn('   请在环境变量中设置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY\n');
}

app.listen(PORT, () => {
  console.log(`\n✅ 智伴晚晴服务启动成功`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📄 前端页面: http://localhost:${PORT}/index.html`);
  console.log(`🔍 API: POST /api/voice/recognize\n`);
});
