/* ============================================
   CampusConnect — Messages Page
   Chat interface with conversation list
   ============================================ */

window.CC_MESSAGES = (function() {

  let activeConversationId = null;

  function render(container) {
    const conversations = CC_DATA.conversations;

    container.innerHTML = `
    <div class="messages-page animate-fade-in">

      <!-- Conversations Sidebar -->
      <div class="messages-sidebar" id="messages-sidebar">
        <div class="messages-sidebar-header">
          <div class="messages-sidebar-title">💬 Messages</div>
          <div class="input-group">
            <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" class="form-control" placeholder="Search messages..." style="padding:8px 14px 8px 36px;font-size:13px">
          </div>
        </div>
        <div class="conversations-list">
          ${conversations.map(conv => renderConversationItem(conv)).join('')}

          <!-- Connection Requests Section -->
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);background:var(--bg-secondary)">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">MESSAGE REQUESTS</div>
          </div>
          <div class="conversation-item" onclick="CC_MESSAGES.openRequest()">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,var(--primary),var(--secondary));border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px">🤝</div>
            <div class="conversation-info">
              <div class="conversation-name">Connection Requests</div>
              <div class="conversation-preview">3 pending requests</div>
            </div>
            <div class="conversation-meta">
              <div style="background:var(--primary);color:#fff;width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center">3</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Area -->
      <div class="chat-area" id="chat-area">
        ${activeConversationId
          ? renderChatView(CC_DATA.getConversation(activeConversationId))
          : renderChatEmpty()
        }
      </div>

    </div>
    `;

    // Auto-open first conversation on desktop
    if (!activeConversationId && window.innerWidth > 640) {
      openConversation(conversations[0].id);
    }
  }

  function renderConversationItem(conv) {
    const student = CC_DATA.getStudent(conv.with);
    if (!student) return '';
    const avatarClass  = `avatar-gradient-${student.avatarGradient}`;
    const isActive     = activeConversationId === conv.id;

    return `
      <div class="conversation-item ${isActive?'active':''} ${conv.unread?'unread':''}"
           onclick="CC_MESSAGES.openConversation('${conv.id}')">
        <div style="position:relative">
          <div class="avatar avatar-md ${avatarClass}">${student.initials}</div>
          ${student.isFree ? `<div class="status-dot free" style="position:absolute;bottom:0;right:0"></div>` : ''}
        </div>
        <div class="conversation-info">
          <div class="conversation-name">${student.name}</div>
          <div class="conversation-preview">${conv.lastMsg}</div>
        </div>
        <div class="conversation-meta">
          <div class="conversation-time">${conv.time}</div>
          ${conv.unread ? '<div class="unread-dot"></div>' : ''}
        </div>
      </div>
    `;
  }

  function renderChatEmpty() {
    return `
      <div class="chat-empty">
        <div class="chat-empty-icon">💬</div>
        <div class="chat-empty-text">Select a conversation</div>
        <div class="chat-empty-sub text-muted">or connect with a new student to start chatting</div>
        <button class="btn btn-primary mt-4" onclick="CC_APP.navigate('/discover')">👥 Find People</button>
      </div>
    `;
  }

  function renderChatView(conv) {
    if (!conv) return renderChatEmpty();
    const student = CC_DATA.getStudent(conv.with);
    if (!student) return renderChatEmpty();
    const avatarClass = `avatar-gradient-${student.avatarGradient}`;

    return `
      <!-- Chat Header -->
      <div class="chat-header">
        <button class="btn btn-ghost btn-icon hide-desktop" onclick="CC_MESSAGES.backToList()" style="margin-left:-8px">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="avatar avatar-sm ${avatarClass}" style="cursor:pointer" onclick="CC_MODALS.openConnectModal(${JSON.stringify(student).replace(/"/g,'&quot;')})">
          ${student.initials}
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${student.name}</div>
          <div class="chat-header-status">${student.isFree ? '🟢 Free now' : '⚪ Last seen recently'}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-icon btn-ghost" onclick="CC_MODALS.openIceBreaker('${student.name.split(' ')[0]}')" title="Ice Breakers">🧊</button>
          <button class="btn btn-icon btn-ghost" onclick="CC_MODALS.openReportModal('user','${student.name}')" title="Report">⋯</button>
        </div>
      </div>

      <!-- Ice Breaker suggestion for new chats -->
      ${conv.messages.length <= 3 ? `
        <div style="padding:12px 16px;background:rgba(99,102,241,0.05);border-bottom:1px solid var(--border);font-size:13px">
          <span style="color:var(--primary);font-weight:600">🧊 Ice Breaker suggestion: </span>
          <span style="color:var(--text-secondary);cursor:pointer" onclick="CC_MESSAGES.useIceBreaker('${conv.id}')">
            "${CC_DATA.icebreakers[Math.floor(Math.random() * CC_DATA.icebreakers.length)]}"
          </span>
          <span style="color:var(--primary);cursor:pointer;margin-left:8px;font-weight:600" onclick="CC_MESSAGES.useIceBreaker('${conv.id}')">Use this →</span>
        </div>
      ` : ''}

      <!-- Messages -->
      <div class="chat-messages" id="chat-messages">
        ${conv.messages.map((msg, i) => renderChatMessage(msg, i === 0)).join('')}
      </div>

      <!-- Input Area -->
      <div class="chat-input-area">
        <button class="btn btn-icon btn-ghost" onclick="CC_AUTH.showToast('📷 Photo sharing — coming soon!')">📎</button>
        <textarea class="chat-input" id="chat-input-field" placeholder="Type a message..." rows="1"
                  onkeydown="CC_MESSAGES.handleKey(event,'${conv.id}')"></textarea>
        <button class="btn btn-primary btn-icon" onclick="CC_MESSAGES.sendMessage('${conv.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    `;
  }

  function renderChatMessage(msg, showDate) {
    const isMe = msg.from === 'stu-001';

    return `
      ${showDate ? `<div style="text-align:center;font-size:11px;color:var(--text-muted);margin:4px 0">Today</div>` : ''}
      <div class="chat-message ${isMe?'sent':'received'}">
        <div style="display:flex;flex-direction:column;${isMe?'align-items:flex-end':''}">
          <div class="chat-bubble ${isMe?'sent':'received'}">${msg.text}</div>
          <div class="chat-time">${msg.time} ${isMe?'✓✓':''}</div>
        </div>
      </div>
    `;
  }

  function openConversation(convId) {
    activeConversationId = convId;

    // Mark as read
    const conv = CC_DATA.getConversation(convId);
    if (conv) conv.unread = false;

    const chatArea = document.getElementById('chat-area');
    if (chatArea) chatArea.innerHTML = renderChatView(CC_DATA.getConversation(convId));

    // Update sidebar active state
    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    const convEl = document.querySelector(`.conversation-item[onclick*="${convId}"]`);
    if (convEl) convEl.classList.add('active');

    // Mobile: show chat
    if (window.innerWidth <= 640) {
      document.getElementById('messages-sidebar')?.classList.remove('open');
      chatArea?.classList.add('open');
    }

    // Scroll to bottom
    setTimeout(() => {
      const msgs = document.getElementById('chat-messages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 100);
  }

  function openRequest() {
    CC_MODALS.open(`
      <div class="modal-title">🤝 Connection Requests</div>
      <div class="modal-subtitle">Students who want to connect with you.</div>
      ${CC_DATA.getStudentsExceptCurrent().slice(0,3).map(s => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
          <div class="avatar avatar-md avatar-gradient-${s.avatarGradient}">${s.initials}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700">${s.name}</div>
            <div style="font-size:12px;color:var(--text-secondary)">${s.branch} • ${s.year}${s.year===1?'st':s.year===2?'nd':s.year===3?'rd':'th'} Year</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-secondary" onclick="CC_AUTH.showToast('Request declined.')">✕</button>
            <button class="btn btn-sm btn-primary" onclick="handleConnect('${s.id}','${s.name}',this)">
              ${CC_AUTH.isConnected(s.id)?'✓':'Accept'}
            </button>
          </div>
        </div>
      `).join('')}
    `);
  }

  function sendMessage(convId) {
    const input = document.getElementById('chat-input-field');
    const text  = input?.value?.trim();
    if (!text) return;

    const conv = CC_DATA.getConversation(convId);
    if (conv) {
      conv.messages.push({ from: 'stu-001', text, time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) });
      conv.lastMsg = text;
    }

    input.value = '';

    // Re-render chat area
    const chatArea = document.getElementById('chat-area');
    if (chatArea) chatArea.innerHTML = renderChatView(CC_DATA.getConversation(convId));

    // Scroll to bottom
    setTimeout(() => {
      const msgs = document.getElementById('chat-messages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 50);

    // Simulate reply after 2s
    setTimeout(() => {
      const replies = [
        'Sure! Sounds good 👍',
        'Let me know what time works.',
        'Yeah, I\'ll be there!',
        'Nice, see you there ☕',
        'That works for me!',
        '👌 Cool',
      ];
      const conv2 = CC_DATA.getConversation(convId);
      if (conv2) {
        const reply = replies[Math.floor(Math.random() * replies.length)];
        conv2.messages.push({ from: conv2.with, text: reply, time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) });
        conv2.lastMsg = reply;
        const chatArea2 = document.getElementById('chat-area');
        if (chatArea2 && activeConversationId === convId) {
          chatArea2.innerHTML = renderChatView(CC_DATA.getConversation(convId));
          const msgs2 = document.getElementById('chat-messages');
          if (msgs2) msgs2.scrollTop = msgs2.scrollHeight;
        }
      }
    }, 1800);
  }

  function handleKey(e, convId) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(convId);
    }
  }

  function useIceBreaker(convId) {
    const input = document.getElementById('chat-input-field');
    if (input) {
      input.value = CC_DATA.icebreakers[Math.floor(Math.random() * CC_DATA.icebreakers.length)];
      input.focus();
    }
  }

  function backToList() {
    activeConversationId = null;
    document.getElementById('messages-sidebar')?.classList.add('open');
    document.getElementById('chat-area')?.classList.remove('open');
  }

  return { render, openConversation, openRequest, sendMessage, handleKey, useIceBreaker, backToList };
})();
