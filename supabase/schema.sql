-- ============================================================
-- RAG Vector Database for Supabase
-- Namespace : ai_rag
-- Embedding Model : OpenAI text-embedding-3-small (1536)
-- ============================================================

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

---------------------------------------------------------------
-- Documents Table
---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_rag_documents (
    id BIGSERIAL PRIMARY KEY,

    -- Original document text
    content TEXT NOT NULL,

    -- Optional metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Embedding Vector
    embedding VECTOR(1536),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

---------------------------------------------------------------
-- HNSW Index (Fast Similarity Search)
---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ai_rag_documents_embedding_hnsw_idx
ON ai_rag_documents
USING hnsw (embedding vector_cosine_ops);

---------------------------------------------------------------
-- Similarity Search Function
---------------------------------------------------------------
CREATE OR REPLACE FUNCTION ai_rag_match_documents(
    query_embedding VECTOR(1536),
    match_count INT DEFAULT 5,
    filter JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id BIGINT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
#variable_conflict use_column
BEGIN

    RETURN QUERY
    SELECT
        d.id,
        d.content,
        d.metadata,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM ai_rag_documents d
    WHERE d.metadata @> filter
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;

END;
$$;

---------------------------------------------------------------
-- Comment
---------------------------------------------------------------
COMMENT ON TABLE ai_rag_documents IS
'RAG Vector Database Documents';

COMMENT ON FUNCTION ai_rag_match_documents IS
'Cosine similarity search function for AI RAG';