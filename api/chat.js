const fs = require('fs');
const path = require('path');
const { searchRelevantChunks } = require('../lib/rag');
const { getSupabase } = require('../lib/supabase');

function loadKnowledgeBase() {
  const dir = path.join(process.cwd(), 'uploads');
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

async function logChat(question, answer) {
  try {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('chat_logs').insert({ question, answer });
  } catch { /* best-effort */ }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages 배열이 필요합니다.' });

    const recent = messages.slice(-10);
    const lastUserMsg = [...recent].reverse().find(m => m.role === 'user')?.content || '';

    const ragChunks = await searchRelevantChunks(lastUserMsg, process.env.OPENAI_API_KEY);
    const knowledge = ragChunks ?? fullKnowledge;
    const systemPrompt = buildSystemPrompt(knowledge);

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...recent],
        max_completion_tokens: 600,
        temperature: 0.4,
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message || 'OpenAI 오류' });
    }

    const data = await openaiRes.json();
    const reply = data.choices[0].message.content.trim();

    logChat(lastUserMsg, reply);

    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
