/* ============================
   智伴晚晴 · 共享工具库 v2
   ============================ */

// ---- Toast ----
function showToast(msg, type = '') {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'toast ' + type;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove('show'), 3000);
}

// ---- Modal ----
function openModal(html) {
  let m = document.getElementById('appModal');
  if (!m) { m = document.createElement('div'); m.id = 'appModal'; m.className = 'modal-overlay'; document.body.appendChild(m); }
  m.innerHTML = `<div class="modal-box">${html}</div>`;
  m.classList.add('show');
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
  return m;
}
function closeModal() { const m = document.getElementById('appModal'); if (m) m.classList.remove('show'); }

// ---- Navigation ----
function goBack() { window.history.back(); }
function goTo(url) { window.location.href = url; }
function goToNewTab(url) { window.open(url, '_blank'); }

// ---- Theme ----
function initTheme() {
  const s = localStorage.getItem('zbwq-theme') || 'light';
  document.body.setAttribute('data-theme', s);
}
function toggleTheme() {
  const cur = document.body.getAttribute('data-theme');
  const next = cur === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('zbwq-theme', next);
  speak(`已切换为${next === 'light' ? '浅色' : '深色'}模式`);
}

// ---- Clock ----
function updateClock(id = 'currentTime') {
  const el = document.getElementById(id); if (!el) return;
  const n = new Date(); const p = n => String(n).padStart(2,'0');
  el.textContent = `${n.getFullYear()}/${p(n.getMonth()+1)}/${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
}
function startClock(id) { updateClock(id); setInterval(() => updateClock(id), 1000); }

// ---- Greeting ----
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好';
}

// ---- TTS ----
function speak(text) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 0.9; u.volume = 1; u.pitch = 1.1;
    speechSynthesis.speak(u);
  }
}

// ---- Captcha ----
let captchaStore = {};
function generateCaptcha() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function getStoredCaptcha(key) {
  const d = captchaStore[key];
  if (!d) return null;
  if (Date.now() > d.expire) { delete captchaStore[key]; return null; }
  return d.code;
}
function setCaptcha(key) {
  const code = generateCaptcha();
  captchaStore[key] = { code, expire: Date.now() + 5 * 60 * 1000 };
  return code;
}
function startCountdown(btn) {
  let c = 60; btn.disabled = true; btn.textContent = `${c}秒后重获`;
  const t = setInterval(() => {
    c--; btn.textContent = `${c}秒后重获`;
    if (c <= 0) { clearInterval(t); btn.disabled = false; btn.textContent = '获取验证码'; }
  }, 1000);
}

// ---- Audio Recording ----
function uint8ToBase64(u8) {
  let bin = ''; const cs = 1024;
  for (let i = 0; i < u8.length; i += cs) { const c = u8.subarray(i, i+cs); bin += String.fromCharCode.apply(null, c); }
  return btoa(bin);
}
async function captureAudio() {
  if (!navigator.mediaDevices || !MediaRecorder) throw new Error('设备不支持录音');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 16000, sampleSize: 16 }
  });
  let mt = 'audio/webm;codecs=opus';
  if (!MediaRecorder.isTypeSupported(mt)) { mt = 'audio/mp4;codecs=mp4a.40.2'; if (!MediaRecorder.isTypeSupported(mt)) mt = 'audio/wav'; }
  const mr = new MediaRecorder(stream, { mimeType: mt });
  const ch = []; mr.ondataavailable = e => { if (e.data.size > 0) ch.push(e.data); };
  mr.start(500);
  const stop = () => new Promise((res, rej) => {
    mr.onstop = async () => {
      try {
        stream.getTracks().forEach(t => t.stop());
        if (!ch.length) { rej(new Error('未采集到音频')); return; }
        const blob = new Blob(ch, { type: mt });
        const actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const ab = await blob.arrayBuffer(); const buf = await actx.decodeAudioData(ab);
        const cd = buf.getChannelData(0); const i16 = new Int16Array(cd.length);
        for (let i = 0; i < cd.length; i++) { const s = Math.max(-1, Math.min(1, cd[i])); i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
        res(uint8ToBase64(new Uint8Array(i16.buffer)));
      } catch(e) { rej(new Error('音频转换失败')); }
    };
    mr.stop();
  });
  return { stop };
}

// ---- Voice Recognition ----
const BACKEND_URL = '/api/voice/recognize';
async function recognizeWithBaidu(audioBase64, lang = 'mandarin') {
  const r = await fetch(BACKEND_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, language: lang })
  });
  if (!r.ok) throw new Error('语音识别服务暂不可用，请稍后再试');
  const d = await r.json();
  if (d.code === 0) return d.result;
  throw new Error(d.msg || '识别失败，请重试');
}

// ---- Phone extraction ----
function extractDigits(text) {
  return text.replace(/零/g,'0').replace(/幺|一/g,'1').replace(/二/g,'2').replace(/三/g,'3')
    .replace(/四/g,'4').replace(/五/g,'5').replace(/六/g,'6').replace(/七/g,'7')
    .replace(/八/g,'8').replace(/九/g,'9').replace(/\D/g,'').substring(0,11);
}

// ---- Storage helpers ----
function saveData(key, val) { try { localStorage.setItem('zbwq_' + key, JSON.stringify(val)); } catch(e) {} }
function loadData(key, def = null) { try { const v = localStorage.getItem('zbwq_' + key); return v ? JSON.parse(v) : def; } catch(e) { return def; } }

// ---- Animate on scroll ----
function observeAnimate() {
  const els = document.querySelectorAll('.animate-on-view');
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('animate-fade'); io.unobserve(e.target); } });
  }, { threshold: 0.1 });
  els.forEach(el => io.observe(el));
}
document.addEventListener('DOMContentLoaded', observeAnimate);
