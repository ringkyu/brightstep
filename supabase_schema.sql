-- =========================================================
-- BrightStep Supabase Schema
-- Supabase Dashboard > SQL Editor 에서 실행하세요.
-- =========================================================

-- pgvector 확장 활성화 (이미 활성화된 경우 무시됩니다)
create extension if not exists vector;

-- ── documents (RAG 청크 저장) ────────────────────────────
create table if not exists documents (
  id          bigserial primary key,
  source      text not null,          -- 파일명 (예: company_profile.md)
  chunk_index integer not null,       -- 파일 내 청크 번호
  content     text not null,          -- 청크 텍스트
  embedding   vector(1536),           -- text-embedding-3-small 차원
  created_at  timestamptz default now(),
  unique (source, chunk_index)
);

-- 유사도 검색 인덱스 (IVFFlat, 100개 이하 문서는 생략 가능)
create index if not exists documents_embedding_idx
  on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- ── leads (상담 신청 리드) ───────────────────────────────
create table if not exists leads (
  id         bigserial primary key,
  name       text not null,
  phone      text not null,
  region     text,
  service    text,
  created_at timestamptz default now()
);

-- ── chat_logs (대화 로그) ────────────────────────────────
create table if not exists chat_logs (
  id         bigserial primary key,
  question   text not null,
  answer     text not null,
  created_at timestamptz default now()
);

-- ── 유사도 검색 RPC 함수 ─────────────────────────────────
create or replace function match_documents(
  query_embedding vector(1536),
  match_count     integer default 5,
  match_threshold float   default 0.5
)
returns table (
  id      bigint,
  source  text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    id,
    source,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
