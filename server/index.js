// 智伴晚晴 · 语音识别后端
// 百度语音识别 API 代理

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 百度智能云 AK/SK（优先使用环境变量，部署到 Railway 时设置）
const BAIDU_AK = process.env.BAIDU_AK;
const BAIDU_SK = process.env.BAIDU_SK;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// 静态文件服务：提供前端页面（index.html、elder/、volunteer/、admin/）
app.use(express.static(path.join(__dirname, '..')));

// 获取百度 Access Token
async function getToken() {
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_AK}&client_secret=${BAIDU_SK}`;
  const res = await axios.post(url);
  if (!res.data.access_token) throw new Error('Token 获取失败');
  return res.data.access_token;
}

// 语音识别
app.post('/api/voice/recognize', async (req, res) => {
  try {
    const { audioBase64, language } = req.body;
    if (!audioBase64) return res.json({ code: -1, msg: '音频数据为空' });

    const dev_pid = language === 'cantonese' ? 1637 : 1537;
    const token = await getToken();

    const payload = {
      format: 'pcm', rate: 16000, channel: 1,
      cuid: 'zbwq-' + Date.now(), dev_pid,
      token, speech: audioBase64,
      len: Math.max(1, Math.floor(audioBase64.length * 3 / 4))
    };

    const result = await axios.post('https://vop.baidu.com/server_api', payload, {
      headers: { 'Content-Type': 'application/json' }, timeout: 10000
    });

    const d = result.data;
    if (d.err_no === 0 && Array.isArray(d.result) && d.result.length > 0) {
      res.json({ code: 0, msg: '识别成功', result: d.result[0].trim() });
    } else {
      res.json({ code: -1, msg: `识别失败：${d.err_msg || '未知错误'}` });
    }
  } catch (e) {
    res.json({ code: -1, msg: `服务异常：${e.message}` });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: '智伴晚晴语音识别服务运行中' });
});

// 启动前检查必要的环境变量
if (!BAIDU_AK || !BAIDU_SK) {
  console.warn('\n⚠️  百度语音识别 AK/SK 未配置，语音功能不可用');
  console.warn('   请在 Railway 中设置 BAIDU_AK 和 BAIDU_SK 环境变量\n');
}

app.listen(PORT, () => {
  console.log(`\n✅ 智伴晚晴服务启动成功`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📄 前端页面: http://localhost:${PORT}/index.html`);
  console.log(`🔍 API: POST /api/voice/recognize\n`);
});
