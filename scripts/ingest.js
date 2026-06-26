#!/usr/bin/env node
// docs/*.md 를 청크로 분할 → 임베딩 → Supabase documents 테이블 적재
// 실행: node scripts/ingest.js
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { getSupabase } = require('../lib/supabase');

const DOCS_DIR = path.join(__dirname, '..', 'uploads');
const CHUNK_SIZE = 800;   // 문자 기준
const CHUNK_OVERLAP = 100;

function chunkText(text, size, overlap) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks;
}

async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Embedding API ${res.status}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

async function main() {
  const supabase = getSupabase();
  if (!supabase) {
    console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경 변수를 설정해 주세요.');
    process.exit(1);
  }

  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
  console.log(`📂 ${files.length}개 파일 처리 시작`);

  for (const file of files) {
    const text = fs.readFileSync(path.join(DOCS_DIR, file), 'utf8');
    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
    console.log(`  📄 ${file} → ${chunks.length}개 청크`);

    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i].trim();
      if (!content) continue;
      const embedding = await embed(content);

      const { error } = await supabase
        .from('documents')
        .upsert({ source: file, chunk_index: i, content, embedding },
                 { onConflict: 'source,chunk_index' });

      if (error) {
        console.error(`  ❌ [${file}#${i}] 저장 실패:`, error.message);
      } else {
        process.stdout.write('.');
      }
      // API 속도 제한 방지
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(` ✅ ${file} 완료`);
  }
  console.log('\n🎉 전체 문서 적재 완료!');
}

main().catch(e => { console.error(e); process.exit(1); });
