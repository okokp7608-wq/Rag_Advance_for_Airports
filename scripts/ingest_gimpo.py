import os
import re
import json
import time
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client

# 1. Load environment variables
# Check current directory first, then parent directory where .env is located
if os.path.exists('.env'):
    load_dotenv('.env')
elif os.path.exists('../.env'):
    load_dotenv('../.env')
else:
    load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not OPENAI_API_KEY or not SUPABASE_URL or not SUPABASE_KEY:
    print("[Error] Missing API keys in environment variables (.env).")
    print(f"OPENAI_API_KEY: {'Found' if OPENAI_API_KEY else 'Missing'}")
    print(f"SUPABASE_URL: {'Found' if SUPABASE_URL else 'Missing'}")
    print(f"SUPABASE_KEY: {'Found' if SUPABASE_KEY else 'Missing'}")
    exit(1)

# Initialize OpenAI & Supabase clients
openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)

EMBED_MODEL = "text-embedding-3-small"  # 1536-dimensional embedding
TABLE_NAME = "ai_rag_documents"
SOURCE_NAME = "김포공항_소음대책_요약"

def chunk_markdown(filepath):
    print(f"Reading markdown file: {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by headings (## or ###)
    pattern = r'(?m)^(##{1,3}\s+.*)$'
    parts = re.split(pattern, content)
    
    chunks = []
    preamble = parts[0].strip()
    
    current_h2 = ""
    current_h3 = ""
    
    i = 1
    chunk_idx = 0
    while i < len(parts):
        header = parts[i].strip()
        body = parts[i+1].strip() if i+1 < len(parts) else ""
        i += 2
        
        # Determine header level
        if header.startswith('## '):
            current_h2 = header
            current_h3 = ""
        elif header.startswith('### '):
            current_h3 = header
            
        # Build context path
        context_path = f"{current_h2}"
        if current_h3:
            context_path += f" > {current_h3}"
            
        # Create chunk text
        # Prepend the preamble to the first chunk if it exists
        chunk_text = ""
        if preamble and chunk_idx == 0:
            chunk_text += preamble + "\n\n"
            
        chunk_text += f"{header}\n\n{body}"
        
        # Metadata dictionary
        metadata = {
            "source": SOURCE_NAME,
            "chunk_id": chunk_idx,
            "h2": current_h2.replace('## ', '').strip(),
            "h3": current_h3.replace('### ', '').strip() if current_h3 else "",
            "context": context_path,
            "char_count": len(chunk_text)
        }
        
        chunks.append({
            "content": chunk_text,
            "metadata": metadata
        })
        chunk_idx += 1
        
    return chunks

def get_embeddings(texts, model=EMBED_MODEL, batch_size=50):
    print(f"Generating embeddings using {model}...")
    embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        for attempt in range(5):
            try:
                response = openai_client.embeddings.create(model=model, input=batch)
                batch_embeddings = [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
                embeddings.extend(batch_embeddings)
                break
            except Exception as e:
                wait_time = 2 ** attempt
                print(f"OpenAI API Error on batch {i}: {e}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
        else:
            raise RuntimeError(f"Failed to get embeddings for batch {i} after 5 attempts.")
            
    return embeddings

def main():
    filepath = "김포공항_소음대책_요약.md"
    if not os.path.exists(filepath):
        # Try parent directory
        filepath = os.path.join("..", "githup", "김포공항_소음대책_요약.md")
        if not os.path.exists(filepath):
            filepath = "c:/Users/KAC/Documents/행안부_고급인증과정/7주차과제/githup/김포공항_소음대책_요약.md"
            
    if not os.path.exists(filepath):
        print(f"[Error] File not found: {filepath}")
        return

    # 1. Chunk document
    chunks = chunk_markdown(filepath)
    print(f"Created {len(chunks)} chunks.")

    # 2. Generate embeddings
    texts = [c["content"] for c in chunks]
    embeddings = get_embeddings(texts)
    
    # 3. Format records
    records = []
    for chunk, emb in zip(chunks, embeddings):
        records.append({
            "content": chunk["content"],
            "metadata": chunk["metadata"],
            "embedding": emb
        })

    # 4. Clear existing data with same source to prevent duplicates
    print(f"Deleting existing entries from table '{TABLE_NAME}' with source '{SOURCE_NAME}'...")
    try:
        supabase_client.table(TABLE_NAME).delete().eq("metadata->>source", SOURCE_NAME).execute()
        print("Deletion successful.")
    except Exception as e:
        print(f"Error during deletion (table might not exist yet, or permission issue): {e}")

    # 5. Insert records into Supabase
    print(f"Inserting {len(records)} records into table '{TABLE_NAME}' in Supabase...")
    inserted_count = 0
    batch_size = 50
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        try:
            res = supabase_client.table(TABLE_NAME).insert(batch).execute()
            inserted_count += len(res.data) if res.data else 0
            print(f"  Inserted {inserted_count}/{len(records)} records...")
        except Exception as e:
            print(f"Error inserting batch starting at {i}: {e}")
            print("Please make sure you have run the Supabase DDL SQL statement to create the 'ai_rag_documents' table and function first.")
            return

    print(f"Successfully ingested {inserted_count} records into Supabase!")

if __name__ == "__main__":
    main()
