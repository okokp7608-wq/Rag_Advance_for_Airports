document.addEventListener('DOMContentLoaded', () => {
  // --- Constant Private Credentials ---
  const supabaseUrl = 'https://aotstvrkblsfdatycsuc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdHN0dnJrYmxzZmRhdHljc3VjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjg1MzkyMCwiZXhwIjoyMDk4NDI5OTIwfQ.YKM9iHXlJ-ZAuAoW1GhlhYsjaT8ZWB8-pJHlPzTTICM';
  const openaiKey = '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';

  // --- State Variables ---
  let cohereKey = '';
  let openrouterKey = '';
  let selectedModel = 'google/gemini-2.5-flash';

  // --- DOM Elements ---
  const inpCohereKey = document.getElementById('cohere-key');
  const inpOpenrouterKey = document.getElementById('openrouter-key');
  const selModel = document.getElementById('chat-model');
  const chkSaveKeys = document.getElementById('save-keys');

  const btnCheckStatus = document.getElementById('btn-check-status');
  const statusSupabase = document.getElementById('status-supabase');
  const statusCohere = document.getElementById('status-cohere');
  const statusOpenrouter = document.getElementById('status-openrouter');

  const queryForm = document.getElementById('query-form');
  const queryInput = document.getElementById('query-input');
  const btnSubmit = document.getElementById('btn-submit');
  const quickBtns = document.querySelectorAll('.quick-btn');

  // Naive RAG DOM
  const panelNaive = document.getElementById('panel-naive');
  const phNaive = panelNaive.querySelector('.placeholder-state');
  const ldNaive = panelNaive.querySelector('.loading-state');
  const ctNaive = panelNaive.querySelector('.content-state');
  const mNaiveTimeRet = document.getElementById('naive-time-retrieval');
  const mNaiveTimeGen = document.getElementById('naive-time-generation');
  const mNaiveTimeTotal = document.getElementById('naive-time-total');
  const naiveAnswer = document.getElementById('naive-answer');
  const naiveChunksList = document.getElementById('naive-chunks-list');

  // Advanced RAG DOM
  const panelAdvanced = document.getElementById('panel-advanced');
  const phAdvanced = panelAdvanced.querySelector('.placeholder-state');
  const ldAdvanced = panelAdvanced.querySelector('.loading-state');
  const ctAdvanced = panelAdvanced.querySelector('.content-state');
  const mAdvTimeRet = document.getElementById('adv-time-retrieval');
  const mAdvTimeRerank = document.getElementById('adv-time-rerank');
  const mAdvTimeGen = document.getElementById('adv-time-generation');
  const mAdvTimeTotal = document.getElementById('adv-time-total');
  const advAnswer = document.getElementById('adv-answer');
  const advChunksList = document.getElementById('adv-chunks-list');

  // Comparison Metrics Dashboard
  const dashboardNaiveSearch = document.getElementById('db-naive-search');
  const dashboardNaiveRerank = document.getElementById('db-naive-rerank');
  const dashboardNaiveGen = document.getElementById('db-naive-gen');
  const dashboardNaiveTotal = document.getElementById('db-naive-total');

  const dashboardAdvSearch = document.getElementById('db-adv-search');
  const dashboardAdvRerank = document.getElementById('db-adv-rerank');
  const dashboardAdvGen = document.getElementById('db-adv-gen');
  const dashboardAdvTotal = document.getElementById('db-adv-total');

  const comparisonSummary = document.getElementById('comparison-summary-text');

  // --- Load Saved Credentials ---
  function loadCredentials() {
    inpCohereKey.value = localStorage.getItem('gimpo_cohere_key') || '';
    inpOpenrouterKey.value = localStorage.getItem('gimpo_openrouter_key') || '';
    
    const savedSaveKeys = localStorage.getItem('gimpo_save_keys');
    chkSaveKeys.checked = savedSaveKeys === 'true';

    updateLocalKeys();
  }

  function updateLocalKeys() {
    cohereKey = inpCohereKey.value.trim();
    openrouterKey = inpOpenrouterKey.value.trim();
    selectedModel = selModel.value;

    if (chkSaveKeys.checked) {
      localStorage.setItem('gimpo_cohere_key', cohereKey);
      localStorage.setItem('gimpo_openrouter_key', openrouterKey);
      localStorage.setItem('gimpo_save_keys', 'true');
    } else {
      localStorage.removeItem('gimpo_cohere_key');
      localStorage.removeItem('gimpo_openrouter_key');
      localStorage.setItem('gimpo_save_keys', 'false');
    }
  }

  // --- Event Listeners for Credential Input Changes ---
  [inpCohereKey, inpOpenrouterKey, selModel].forEach(elem => {
    elem.addEventListener('input', updateLocalKeys);
  });
  chkSaveKeys.addEventListener('change', updateLocalKeys);

  // --- Initial Execution ---
  loadCredentials();
  checkSystemStatus();

  // --- Test / Check API Statuses ---
  btnCheckStatus.addEventListener('click', () => {
    updateLocalKeys();
    checkSystemStatus();
  });

  async function checkSystemStatus() {
    // 1. Check Supabase
    if (!supabaseUrl || !supabaseKey) {
      updateStatusLabel(statusSupabase, 'danger', 'Keys missing');
    } else {
      updateStatusLabel(statusSupabase, 'warning', 'Checking...');
      try {
        // Fetch document count using PostgREST Prefer: count=exact header
        const res = await fetch(`${supabaseUrl}/rest/v1/ai_rag_documents?select=id`, {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'count=exact',
            'Range': '0-0'
          }
        });
        
        if (res.ok) {
          const contentRange = res.headers.get('content-range');
          let countVal = 0;
          if (contentRange && contentRange.includes('/')) {
            countVal = parseInt(contentRange.split('/')[1]);
          }
          updateStatusLabel(statusSupabase, 'success', `Connected (${countVal} chunks)`);
        } else {
          updateStatusLabel(statusSupabase, 'danger', `Error (${res.status})`);
        }
      } catch (err) {
        updateStatusLabel(statusSupabase, 'danger', 'Connection failed');
      }
    }

    // 2. Check Cohere Rerank
    if (!cohereKey) {
      updateStatusLabel(statusCohere, 'danger', 'Key missing');
    } else {
      updateStatusLabel(statusCohere, 'warning', 'Checking...');
      try {
        const res = await fetch('https://api.cohere.com/v1/rerank', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'Authorization': `Bearer ${cohereKey}`
          },
          body: JSON.stringify({
            model: 'rerank-multilingual-v3.0',
            query: 'test',
            documents: ['test document'],
            top_n: 1
          })
        });
        if (res.ok) {
          updateStatusLabel(statusCohere, 'success', 'Ready');
        } else {
          updateStatusLabel(statusCohere, 'danger', 'Error/Key Invalid');
        }
      } catch (err) {
        updateStatusLabel(statusCohere, 'danger', 'Connection failed');
      }
    }

    // 4. Check OpenRouter
    if (!openrouterKey) {
      updateStatusLabel(statusOpenrouter, 'danger', 'Key missing');
    } else {
      updateStatusLabel(statusOpenrouter, 'warning', 'Checking...');
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterKey}`
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5
          })
        });
        if (res.ok) {
          updateStatusLabel(statusOpenrouter, 'success', 'Ready');
        } else {
          updateStatusLabel(statusOpenrouter, 'danger', 'Error/Key Invalid');
        }
      } catch (err) {
        updateStatusLabel(statusOpenrouter, 'danger', 'Connection failed');
      }
    }
  }

  function updateStatusLabel(element, type, text) {
    const dot = element.querySelector('.status-dot');
    const label = element.querySelector('.status-label');
    
    dot.className = 'status-dot';
    dot.classList.add(type);
    label.textContent = text;
  }

  // --- Quick Question Auto Submit ---
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      queryInput.value = btn.textContent;
      triggerSearch();
    });
  });

  queryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    triggerSearch();
  });

  // --- Core RAG Execution Pipeline ---
  async function triggerSearch() {
    const query = queryInput.value.trim();
    if (!query) return;

    updateLocalKeys();

    if (!supabaseUrl || !supabaseKey || !openaiKey || !openrouterKey) {
      alert('Supabase URL/Key, OpenAI Key, OpenRouter Key는 필수 항목입니다. 설정 패널에 입력해 주세요.');
      return;
    }

    if (!cohereKey) {
      alert('Cohere Rerank API Key가 없습니다. Advanced RAG 비교를 원활히 하기 위해 Cohere Key도 입력하는 것을 권장합니다.');
    }

    // UI state: Loading
    setLoadingState(true);
    resetPipelineSteps();

    // Start execution timing
    const t0 = performance.now();

    try {
      // 1. Generate query embedding (OpenAI)
      updateStepStatus(1, 'active');
      const queryEmbedding = await generateQueryEmbedding(query);
      updateStepStatus(1, 'completed');

      // Execute Naive and Advanced RAG pipelines in parallel
      const naivePromise = runNaiveRAG(query, queryEmbedding);
      const advancedPromise = runAdvancedRAG(query, queryEmbedding);

      const [naiveResult, advancedResult] = await Promise.all([naivePromise, advancedPromise]);

      // Render the results
      renderNaiveResults(naiveResult);
      renderAdvancedResults(advancedResult);

      // Render the comparison table
      updateComparisonDashboard(naiveResult, advancedResult);

    } catch (error) {
      console.error('RAG Pipeline failed:', error);
      alert(`RAG 파이프라인 수행 중 오류 발생: ${error.message}`);
    } finally {
      setLoadingState(false);
    }
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'RAG 실행 중...';
      
      [phNaive, phAdvanced, ctNaive, ctAdvanced].forEach(el => el.classList.add('hidden'));
      [ldNaive, ldAdvanced].forEach(el => el.classList.remove('hidden'));
    } else {
      btnSubmit.disabled = false;
      btnSubmit.textContent = '질문하기';
      
      [ldNaive, ldAdvanced].forEach(el => el.classList.add('hidden'));
    }
  }

  // --- Step Visualizers ---
  function resetPipelineSteps() {
    document.querySelectorAll('.flow-step').forEach(step => {
      step.className = 'flow-step';
    });
  }

  function updateStepStatus(stepNum, status) {
    const step = document.getElementById(`step-${stepNum}`);
    if (!step) return;
    
    if (status === 'active') {
      step.classList.add('active');
    } else if (status === 'active-adv') {
      step.classList.add('active-adv');
    } else if (status === 'completed') {
      step.classList.remove('active');
      step.classList.remove('active-adv');
      step.style.color = '#10b981'; // Green color for finished steps
      const dot = step.querySelector('.step-num');
      dot.style.background = '#10b981';
      dot.style.borderColor = '#10b981';
    }
  }

  // --- API Wrapper Functions ---

  // Generate embeddings via OpenAI
  async function generateQueryEmbedding(text) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-small'
      })
    });
    
    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`OpenAI Embedding API failed: ${response.statusText} (${errorMsg})`);
    }
    
    const json = await response.json();
    return json.data[0].embedding;
  }

  // Call Supabase search rpc
  async function querySupabaseRPC(embedding, limit) {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/ai_rag_match_documents`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query_embedding: embedding,
        match_count: limit,
        filter: {}
      })
    });
    
    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`Supabase Match Documents RPC failed: ${response.statusText} (${errorMsg})`);
    }
    
    return await response.json();
  }

  // Cohere Rerank call
  async function cohereRerank(query, documents, topN) {
    if (!cohereKey) {
      // Fallback: if no Cohere key, just slice the top N items directly (no-op rerank)
      console.warn('Cohere Key missing, returning top candidates directly without reranking.');
      return documents.slice(0, topN).map((doc, idx) => ({
        index: idx,
        relevance_score: doc.similarity
      }));
    }

    const response = await fetch('https://api.cohere.com/v1/rerank', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': `Bearer ${cohereKey}`
      },
      body: JSON.stringify({
        model: 'rerank-multilingual-v3.0',
        query: query,
        documents: documents.map(d => d.content),
        top_n: topN
      })
    });

    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`Cohere Rerank API failed: ${response.statusText} (${errorMsg})`);
    }

    const json = await response.json();
    return json.results; // Returns list of { index: int, relevance_score: float }
  }

  // Generate Chat Answer via OpenRouter
  async function generateLLMAnswer(query, contexts) {
    const prompt = `당신은 김포국제공항 소음대책 전문가입니다. 제공된 참고자료(Context)에 근거하여 사용자의 질문에 정확하고 상세히 답변해 주세요. 
참고자료(Context)에 근거하여 정확하게 답변하고, 참고자료에 없는 내용은 모른다고 확실하게 말해야 합니다. 지어내지 마세요. 
답변은 신뢰할 수 있게 작성하고, 가능한 한 상세하고 읽기 편한 구조화된 형식(마크다운 표, 단락 구분, 글머리 기호 등)을 적극적으로 사용하십시오.

참고자료 (Context):
${contexts}

사용자 질문:
${query}

전문적인 답변:`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterKey}`,
        'HTTP-Referer': 'https://github.com/',
        'X-Title': 'Gimpo Noise RAG'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1 // Keep generation deterministic and grounded
      })
    });

    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`OpenRouter Chat Completions failed: ${response.statusText} (${errorMsg})`);
    }

    const json = await response.json();
    return json.choices[0].message.content;
  }

  // --- Naive RAG Flow ---
  async function runNaiveRAG(query, queryEmbedding) {
    const t0 = performance.now();
    
    // Step 2: Vector retrieval (fetch Top 5)
    updateStepStatus(2, 'active');
    const dbResults = await querySupabaseRPC(queryEmbedding, 5);
    const retrievalTime = performance.now() - t0;
    
    // Step 4: Generate LLM Answer
    updateStepStatus(4, 'active');
    const contextText = dbResults.map((d, i) => `[참고문서 ${i+1}] ${d.content}`).join('\n\n');
    
    const tGen0 = performance.now();
    const answer = await generateLLMAnswer(query, contextText);
    const generationTime = performance.now() - tGen0;
    
    return {
      searchTime: retrievalTime,
      rerankTime: 0,
      generationTime: generationTime,
      totalTime: retrievalTime + generationTime,
      chunks: dbResults,
      answer: answer
    };
  }

  // --- Advanced RAG Flow ---
  async function runAdvancedRAG(query, queryEmbedding) {
    const t0 = performance.now();
    
    // Step 2: Vector retrieval (fetch Top 20 candidates)
    updateStepStatus(2, 'active');
    const candidates = await querySupabaseRPC(queryEmbedding, 20);
    const retrievalTime = performance.now() - t0;
    
    // Step 3: Reranking using Cohere
    updateStepStatus(3, 'active-adv');
    const tRerank0 = performance.now();
    const rerankedList = await cohereRerank(query, candidates, 5);
    const rerankTime = performance.now() - tRerank0;
    updateStepStatus(3, 'completed');
    
    // Select top 5 reranked candidates
    const selectedChunks = rerankedList.map(item => {
      const orig = candidates[item.index];
      return {
        ...orig,
        rerank_score: item.relevance_score
      };
    });
    
    // Step 4: Generate LLM Answer
    updateStepStatus(4, 'active-adv');
    const contextText = selectedChunks.map((d, i) => `[참고문서 ${i+1}] ${d.content}`).join('\n\n');
    
    const tGen0 = performance.now();
    const answer = await generateLLMAnswer(query, contextText);
    const generationTime = performance.now() - tGen0;
    updateStepStatus(4, 'completed');
    updateStepStatus(2, 'completed'); // Close final status loops

    return {
      searchTime: retrievalTime,
      rerankTime: rerankTime,
      generationTime: generationTime,
      totalTime: retrievalTime + rerankTime + generationTime,
      chunks: selectedChunks,
      originalCandidates: candidates,
      answer: answer
    };
  }

  // --- Render Functions ---

  function renderNaiveResults(data) {
    ctNaive.classList.remove('hidden');
    
    mNaiveTimeRet.textContent = `${data.searchTime.toFixed(0)}ms`;
    mNaiveTimeGen.textContent = `${data.generationTime.toFixed(0)}ms`;
    mNaiveTimeTotal.textContent = `${data.totalTime.toFixed(0)}ms`;

    naiveAnswer.innerHTML = formatMarkdown(data.answer);
    
    // Render search chunks
    naiveChunksList.innerHTML = '';
    data.chunks.forEach((chunk, index) => {
      const card = document.createElement('div');
      card.className = 'chunk-card';
      
      const meta = chunk.metadata || {};
      const contextStr = meta.context || 'Unknown';
      const simPercent = (chunk.similarity * 100).toFixed(1);
      
      card.innerHTML = `
        <div class="chunk-header">
          <span class="chunk-meta">#${index+1} - ${contextStr} (ID: ${meta.chunk_id})</span>
          <div class="chunk-scores">
            <span class="score-badge score-similarity">Sim: ${simPercent}%</span>
          </div>
        </div>
        <div class="chunk-text">${formatTextSnippet(chunk.content)}</div>
      `;
      naiveChunksList.appendChild(card);
    });
  }

  function renderAdvancedResults(data) {
    ctAdvanced.classList.remove('hidden');
    
    mAdvTimeRet.textContent = `${data.searchTime.toFixed(0)}ms`;
    mAdvTimeRerank.textContent = `${data.rerankTime.toFixed(0)}ms`;
    mAdvTimeGen.textContent = `${data.generationTime.toFixed(0)}ms`;
    mAdvTimeTotal.textContent = `${data.totalTime.toFixed(0)}ms`;

    advAnswer.innerHTML = formatMarkdown(data.answer);
    
    // Render reranked chunks
    advChunksList.innerHTML = '';
    data.chunks.forEach((chunk, index) => {
      const card = document.createElement('div');
      card.className = 'chunk-card';
      
      const meta = chunk.metadata || {};
      const contextStr = meta.context || 'Unknown';
      const simPercent = (chunk.similarity * 100).toFixed(1);
      const rerankScore = chunk.rerank_score !== undefined ? (chunk.rerank_score * 100).toFixed(1) : 'N/A';
      
      card.innerHTML = `
        <div class="chunk-header">
          <span class="chunk-meta">#${index+1} - ${contextStr} (ID: ${meta.chunk_id})</span>
          <div class="chunk-scores">
            <span class="score-badge score-similarity">Sim: ${simPercent}%</span>
            <span class="score-badge score-rerank">Rerank: ${rerankScore}%</span>
          </div>
        </div>
        <div class="chunk-text">${formatTextSnippet(chunk.content)}</div>
      `;
      advChunksList.appendChild(card);
    });
  }

  function updateComparisonDashboard(naive, adv) {
    dashboardNaiveSearch.textContent = `${naive.searchTime.toFixed(0)}ms`;
    dashboardNaiveRerank.textContent = '-';
    dashboardNaiveGen.textContent = `${naive.generationTime.toFixed(0)}ms`;
    dashboardNaiveTotal.textContent = `${naive.totalTime.toFixed(0)}ms`;

    dashboardAdvSearch.textContent = `${adv.searchTime.toFixed(0)}ms`;
    dashboardAdvRerank.textContent = `${adv.rerankTime.toFixed(0)}ms`;
    dashboardAdvGen.textContent = `${adv.generationTime.toFixed(0)}ms`;
    dashboardAdvTotal.textContent = `${adv.totalTime.toFixed(0)}ms`;

    // Write analysis summary text
    let summary = '';
    if (cohereKey) {
      const naiveFirstChunk = naive.chunks[0]?.metadata?.chunk_id;
      const advFirstChunk = adv.chunks[0]?.metadata?.chunk_id;
      
      summary = `<strong>성능 및 품질 비교 요약:</strong><br>`;
      summary += `- <strong>응답 속도:</strong> Naive RAG(${naive.totalTime.toFixed(0)}ms)가 Rerank 과정이 없어 Advanced RAG(${adv.totalTime.toFixed(0)}ms)보다 빠른 검색 속도를 보여줍니다. (Rerank 소요 시간: ${adv.rerankTime.toFixed(0)}ms)<br>`;
      
      if (naiveFirstChunk === advFirstChunk) {
        summary += `- <strong>검색 일치도:</strong> 두 모델 모두 최상단에 동일한 청크(Chunk ID: ${advFirstChunk})를 선택했습니다. 단답형 질문에 대해서는 Naive RAG도 충분히 높은 정확도를 제공합니다.<br>`;
      } else {
        summary += `- <strong>검색 정교함:</strong> Cohere Rerank가 동작하여 최상단 매칭 문서가 변경되었습니다. Naive RAG의 최상단 청크는 ID ${naiveFirstChunk}이나, Reranking 과정을 통해 더 적합하다고 판단된 ID ${advFirstChunk} 청크가 Advanced RAG에서 최상단으로 선택되었습니다.<br>`;
      }
      
      summary += `- <strong>이점:</strong> Advanced RAG는 Supabase에서 20개의 1차 후보(Top 20)를 대량 검색한 뒤 다국어 특화 재정렬 모델(Cohere Rerank)을 거치므로, 단순 키워드 유사성에 왜곡되는 일반 벡터 검색의 단점을 보완하여 더 정확한 근거 중심 답변을 보장합니다.`;
    } else {
      summary = `Cohere API Key가 입력되지 않아 Advanced RAG 파이프라인에서 Rerank 모델 호출을 우회(Pass-through)했습니다. Rerank API Key를 입력하시면 정확한 다차원 정렬 점수를 비교할 수 있습니다.`;
    }

    comparisonSummary.innerHTML = summary;
  }

  // --- Utility Functions ---

  // Markdown Formatter (Converts markdown symbols into clean HTML structures)
  function formatMarkdown(text) {
    if (!text) return '';
    
    let html = text;
    
    // Escape HTML tags to prevent XSS
    html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Bold text (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Bullet lists (- item)
    // Wrap consecutive lines starting with - into a <ul> block
    const lines = html.split('\n');
    let inList = false;
    let listType = ''; // 'ul' or 'ol'
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Match markdown tables
      if (line.startsWith('|')) {
        // Table parsing
        let tableHtml = '<table>';
        let rowCount = 0;
        
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const cells = lines[i].split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
          
          if (lines[i].includes('---')) {
            // Divider row, skip
            i++;
            continue;
          }
          
          tableHtml += '<tr>';
          cells.forEach(cell => {
            // Check if bold inside cells
            cell = cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            if (rowCount === 0) {
              tableHtml += `<th>${cell}</th>`;
            } else {
              tableHtml += `<td>${cell}</td>`;
            }
          });
          tableHtml += '</tr>';
          
          rowCount++;
          i++;
        }
        tableHtml += '</table>';
        lines[i - rowCount] = tableHtml;
        // clear the rest of the table lines
        for (let r = 1; r < rowCount; r++) {
          lines[i - rowCount + r] = '';
        }
        i--;
        continue;
      }
      
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const itemText = line.substring(2);
        if (!inList) {
          lines[i] = '<ul><li>' + itemText + '</li>';
          inList = true;
          listType = 'ul';
        } else {
          lines[i] = '<li>' + itemText + '</li>';
        }
      } else if (inList) {
        lines[i-1] = lines[i-1] + `</${listType}>`;
        inList = false;
      }
    }
    
    if (inList) {
      lines[lines.length-1] = lines[lines.length-1] + `</${listType}>`;
    }
    
    html = lines.filter(l => l !== '').join('\n');
    
    // Paragraph double linebreaks
    html = html.replace(/\n\n/g, '<p></p>');
    // Single linebreaks to <br> if not in tags
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }

  // Slice text snippet and escape highlights
  function formatTextSnippet(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
  }
});
