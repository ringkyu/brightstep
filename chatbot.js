(function () {
  const ACCENT = '#E8A020';
  const ACCENT_DARK = '#c98a10';
  const BG = '#0E1A2D';
  const BG_LIGHT = '#13243C';
  const TEXT = '#E2E8F0';
  const TEXT_MUTED = '#9AA3B0';
  const MAX_HISTORY = 10;

  let history = [];
  let isOpen = false;
  let isLoading = false;

  /* ── 스타일 ── */
  const style = document.createElement('style');
  style.textContent = `
    #bs-chat-btn {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: ${ACCENT}; border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(232,160,32,.45);
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s, background .2s;
    }
    #bs-chat-btn:hover { transform: scale(1.08); background: ${ACCENT_DARK}; }
    #bs-chat-btn svg { width: 26px; height: 26px; }

    #bs-chat-win {
      position: fixed; bottom: 96px; right: 28px; z-index: 9998;
      width: 380px; max-width: calc(100vw - 40px);
      height: 520px; max-height: calc(100vh - 120px);
      background: ${BG}; border: 1px solid rgba(255,255,255,.1);
      border-radius: 16px; display: flex; flex-direction: column;
      overflow: hidden; box-shadow: 0 12px 48px rgba(0,0,0,.55);
      transform: translateY(20px) scale(.96); opacity: 0;
      pointer-events: none;
      transition: transform .25s cubic-bezier(.22,1,.36,1), opacity .25s;
      font-family: Pretendard, 'Apple SD Gothic Neo', sans-serif;
    }
    #bs-chat-win.open {
      transform: translateY(0) scale(1); opacity: 1; pointer-events: all;
    }

    #bs-chat-header {
      background: ${BG_LIGHT}; padding: 16px 20px;
      display: flex; align-items: center; gap: 12px;
      border-bottom: 1px solid rgba(255,255,255,.08); flex-shrink: 0;
    }
    .bs-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: ${ACCENT}; display: flex; align-items: center; justify-content: center;
      font: 700 15px/1 Pretendard, sans-serif; color: #0E1726; flex-shrink: 0;
    }
    #bs-chat-header-text { flex: 1 }
    #bs-chat-header-name { font: 700 15px/1 Pretendard, sans-serif; color: #fff }
    #bs-chat-header-sub { font: 400 12px/1 Pretendard, sans-serif; color: ${TEXT_MUTED}; margin-top: 4px }
    #bs-chat-close {
      background: none; border: none; cursor: pointer; padding: 4px;
      color: ${TEXT_MUTED}; display: flex; align-items: center;
      transition: color .2s;
    }
    #bs-chat-close:hover { color: #fff; }

    #bs-chat-messages {
      flex: 1; overflow-y: auto; padding: 20px 16px; display: flex;
      flex-direction: column; gap: 12px; scroll-behavior: smooth;
    }
    #bs-chat-messages::-webkit-scrollbar { width: 4px }
    #bs-chat-messages::-webkit-scrollbar-track { background: transparent }
    #bs-chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 2px }

    .bs-msg { display: flex; gap: 8px; align-items: flex-end; max-width: 100% }
    .bs-msg.user { flex-direction: row-reverse }
    .bs-bubble {
      max-width: 78%; padding: 10px 14px; border-radius: 14px;
      font: 400 14px/1.6 Pretendard, sans-serif; word-break: break-word;
    }
    .bs-msg.bot .bs-bubble {
      background: ${BG_LIGHT}; color: ${TEXT}; border-bottom-left-radius: 4px;
    }
    .bs-msg.user .bs-bubble {
      background: ${ACCENT}; color: #0E1726; font-weight: 600;
      border-bottom-right-radius: 4px;
    }
    .bs-msg-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: ${ACCENT}; display: flex; align-items: center;
      justify-content: center; font: 700 11px/1 Pretendard, sans-serif;
      color: #0E1726; flex-shrink: 0;
    }

    .bs-dots { display: flex; gap: 5px; padding: 4px 2px; align-items: center }
    .bs-dots span {
      width: 7px; height: 7px; border-radius: 50%; background: ${TEXT_MUTED};
      animation: bs-bounce .9s infinite;
    }
    .bs-dots span:nth-child(2) { animation-delay: .15s }
    .bs-dots span:nth-child(3) { animation-delay: .3s }
    @keyframes bs-bounce {
      0%, 60%, 100% { transform: translateY(0) }
      30% { transform: translateY(-6px) }
    }

    #bs-chat-input-area {
      padding: 14px 16px; border-top: 1px solid rgba(255,255,255,.08);
      display: flex; gap: 10px; align-items: flex-end; flex-shrink: 0;
    }
    #bs-chat-input {
      flex: 1; background: ${BG_LIGHT}; border: 1px solid rgba(255,255,255,.1);
      border-radius: 10px; padding: 10px 14px; color: ${TEXT};
      font: 400 14px/1.5 Pretendard, sans-serif; resize: none;
      outline: none; max-height: 100px; min-height: 42px; overflow-y: auto;
      transition: border-color .2s;
    }
    #bs-chat-input::placeholder { color: ${TEXT_MUTED} }
    #bs-chat-input:focus { border-color: rgba(232,160,32,.5) }
    #bs-chat-send {
      width: 40px; height: 40px; border-radius: 10px; border: none;
      background: ${ACCENT}; cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: background .2s, transform .15s;
    }
    #bs-chat-send:hover:not(:disabled) { background: ${ACCENT_DARK}; transform: scale(1.05) }
    #bs-chat-send:disabled { opacity: .45; cursor: not-allowed }
    #bs-chat-send svg { width: 18px; height: 18px }

    .bs-error { color: #f87171; font: 400 13px/1.5 Pretendard, sans-serif; text-align: center; padding: 4px 8px }
  `;
  document.head.appendChild(style);

  /* ── HTML 구조 ── */
  const btn = document.createElement('button');
  btn.id = 'bs-chat-btn';
  btn.setAttribute('aria-label', '채팅 상담 열기');
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#0E1726" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>`;

  const win = document.createElement('div');
  win.id = 'bs-chat-win';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', '브라이트스텝 상담 챗봇');
  win.innerHTML = `
    <div id="bs-chat-header">
      <div class="bs-avatar">B</div>
      <div id="bs-chat-header-text">
        <div id="bs-chat-header-name">브라이트 AI 상담사</div>
        <div id="bs-chat-header-sub">브라이트스텝 컨설팅</div>
      </div>
      <button id="bs-chat-close" aria-label="닫기">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div id="bs-chat-messages"></div>
    <div id="bs-chat-input-area">
      <textarea id="bs-chat-input" placeholder="궁금한 점을 입력하세요…" rows="1"></textarea>
      <button id="bs-chat-send" aria-label="전송">
        <svg viewBox="0 0 24 24" fill="none" stroke="#0E1726" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(win);

  const msgContainer = win.querySelector('#bs-chat-messages');
  const input = win.querySelector('#bs-chat-input');
  const sendBtn = win.querySelector('#bs-chat-send');

  /* ── 메시지 렌더 ── */
  function addMessage(role, text) {
    const wrap = document.createElement('div');
    wrap.className = `bs-msg ${role}`;
    if (role === 'bot') {
      wrap.innerHTML = `<div class="bs-msg-avatar">B</div><div class="bs-bubble">${escapeHtml(text)}</div>`;
    } else {
      wrap.innerHTML = `<div class="bs-bubble">${escapeHtml(text)}</div>`;
    }
    msgContainer.appendChild(wrap);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return wrap;
  }

  function addLoading() {
    const wrap = document.createElement('div');
    wrap.className = 'bs-msg bot';
    wrap.innerHTML = `<div class="bs-msg-avatar">B</div><div class="bs-bubble"><div class="bs-dots"><span></span><span></span><span></span></div></div>`;
    msgContainer.appendChild(wrap);
    msgContainer.scrollTop = msgContainer.scrollHeight;
    return wrap;
  }

  function addError(text) {
    const el = document.createElement('div');
    el.className = 'bs-error';
    el.textContent = text;
    msgContainer.appendChild(el);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  }

  /* ── 전송 ── */
  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = '';
    input.style.height = '';
    addMessage('user', text);
    sendBtn.disabled = true;
    isLoading = true;

    history.push({ role: 'user', content: text });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

    const loadingEl = addLoading();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });

      loadingEl.remove();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addError(err.error || '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        history.pop();
        return;
      }

      const data = await res.json();
      const reply = data.reply || '';
      addMessage('bot', reply);
      history.push({ role: 'assistant', content: reply });
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    } catch {
      loadingEl.remove();
      addError('네트워크 오류가 발생했습니다. 연결을 확인해주세요.');
      history.pop();
    } finally {
      sendBtn.disabled = false;
      isLoading = false;
      input.focus();
    }
  }

  /* ── 이벤트 ── */
  btn.addEventListener('click', () => toggleChat(true));
  win.querySelector('#bs-chat-close').addEventListener('click', () => toggleChat(false));

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = '';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });

  function toggleChat(open) {
    isOpen = open;
    win.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
    if (open) setTimeout(() => input.focus(), 300);
  }

  /* ── 환영 메시지 (1초 후) ── */
  setTimeout(() => {
    addMessage('bot', '안녕하세요! 브라이트스텝 컨설팅 AI 상담사입니다 😊\n서비스, 요금, 컨설팅 프로세스 등 궁금하신 점을 편하게 물어보세요.');
  }, 1000);
})();
