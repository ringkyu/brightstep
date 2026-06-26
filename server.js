require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { searchRelevantChunks } = require('./lib/rag');
const { getSupabase } = require('./lib/supabase');

/* ── 폴백용 지식 베이스 전체 로드 ── */
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
const fullKnowledge = loadKnowledgeBase();

function buildSystemPrompt(knowledge) {
  return `당신은 브라이트스텝 컨설팅(BrightStep Consulting)의 AI 상담사 "브라이트"입니다.

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
}

/* ── OpenAI 채팅 호출 ── */
async function callOpenAI(messages, systemPrompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
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

/* ── 대화 로그 저장 (best-effort) ── */
async function logChat(question, answer) {
  try {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('chat_logs').insert({ question, answer });
  } catch { /* 실패해도 응답에 영향 없음 */ }
}

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

  /* ── POST /api/chat ── */
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        const { messages } = JSON.parse(body);
        if (!Array.isArray(messages)) throw new Error('messages 배열이 필요합니다.');

        const recent = messages.slice(-10);
        const lastUserMsg = [...recent].reverse().find(m => m.role === 'user')?.content || '';

        // RAG: 유사 청크 검색 → 없으면 전체 지식 베이스 폴백
        const ragChunks = await searchRelevantChunks(lastUserMsg, process.env.OPENAI_API_KEY);
        const knowledge = ragChunks ?? fullKnowledge;
        const systemPrompt = buildSystemPrompt(knowledge);

        const reply = await callOpenAI(recent, systemPrompt);

        // 대화 로그 비동기 저장 (응답 블로킹 없음)
        logChat(lastUserMsg, reply);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
        res.end(JSON.stringify({ reply }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  /* ── POST /api/lead ── */
  if (req.method === 'POST' && req.url === '/api/lead') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        const { name, phone, region, service } = JSON.parse(body);
        if (!name || !phone) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
          return res.end(JSON.stringify({ error: '이름과 연락처는 필수입니다.' }));
        }

        const supabase = getSupabase();
        if (supabase) {
          const { error } = await supabase.from('leads').insert({ name, phone, region, service });
          if (error) console.error('leads 저장 오류:', error.message);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  /* ── 정적 파일 ── */
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
