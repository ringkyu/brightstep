const { getSupabase } = require('./supabase');

// 텍스트 → 임베딩 벡터
async function embed(text, openaiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) throw new Error(`Embedding API ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

// 질문 → 관련 청크 top-N 반환
// Supabase 미설정 또는 결과 없으면 null 반환 → 호출자가 폴백 처리
async function searchRelevantChunks(question, openaiKey, topK = 5) {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const queryEmbedding = await embed(question, openaiKey);
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: topK,
      match_threshold: 0.4,
    });
    if (error || !data || data.length === 0) return null;
    return data.map(row => `## [${row.source}]\n${row.content}`).join('\n\n---\n\n');
  } catch {
    return null;
  }
}

module.exports = { searchRelevantChunks };
