require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

/* ── 지식 베이스: uploads/*.md 전체 주입 ── */
function loadKnowledgeBase() {
  const dir = path.join(__dirname, 'uploads');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      return `## [${f}]\n${content}`;
    })
    .join('\n\n---\n\n');
}

const knowledge = loadKnowledgeBase();

const SYSTEM_PROMPT = `당신은 브라이트스텝 컨설팅(BrightStep Consulting)의 AI 상담사 "브라이트"입니다.

아래는 회사에 대한 공식 정보입니다. 반드시 이 내용만을 근거로 답변하세요.

===== 지식 베이스 시작 =====
${knowledge}
===== 지식 베이스 끝 =====

[답변 규칙]
1. 자기소개·대화형 질문("이름이 뭐야", "뭘 도와줘" 등):
   - "브라이트"라는 이름과 브라이트스텝 컨설팅 AI 상담사 역할을 자연스럽게 소개하세요.
2. 서비스·정책·요금·프로세스 등 회사 관련 질문:
   - 지식 베이스 내용만 사용하세요. 없으면 "정확한 안내를 위해 무료 상담(02-1234-5678)을 이용해주세요"로 안내하세요.
3. 서비스와 무관한 질문(날씨, 정치, 일반 상식 등):
   - "저는 브라이트스텝 컨설팅 서비스 관련 질문만 답할 수 있어요. 다른 궁금한 점이 있으시면 무료 상담을 이용해주세요."
4. 지식 베이스에 없는 정보는 절대 창작하거나 추측하지 마세요.
5. 답변은 친근하고 간결하게, 반말 금지, '-요'/'-습니다' 체를 사용하세요.
6. 필요 시 무료 초기 상담(30분, 02-1234-5678)을 자연스럽게 안내하세요.`;

/* ── MIME 타입 ── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.md':   'text/plain; charset=utf-8',
};

/* ── OpenAI 호출 ── */
async function callOpenAI(messages) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_completion_tokens: 600,
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

/* ── HTTP 서버 ── */
const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  /* /api/chat */
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        const { messages } = JSON.parse(body);
        if (!Array.isArray(messages)) throw new Error('messages 배열이 필요합니다.');
        const reply = await callOpenAI(messages.slice(-10));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
        res.end(JSON.stringify({ reply }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  /* 정적 파일 */
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not Found');
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`✅ BrightStep 서버 실행 중: http://localhost:${PORT}`));
