/* ============================================
   CampusConnect — Notifications Panel
   ============================================ */

window.CC_NOTIFICATIONS = (function() {

  function render() {
    const panel = document.getElementById('cc-notif-panel');
    const notifs = CC_DATA.notifications;

    panel.innerHTML = `
      <div class="notif-panel-header">
        <span class="notif-panel-title">🔔 Notifications</span>
        <button class="btn btn-sm btn-ghost" onclick="CC_NOTIFICATIONS.markAllRead()" style="font-size:12px">Mark all read</button>
      </div>
      <div class="notif-panel-body">
        ${notifs.length === 0 ? `
          <div class="empty-state" style="padding:32px">
            <div class="empty-icon">🔔</div>
            <p>No notifications yet</p>
          </div>
        ` : notifs.map(n => `
          <div class="notif-item ${n.unread ? 'unread' : ''}" data-id="${n.id}">
            <div class="notif-item-icon">${n.emoji}</div>
            <div class="notif-item-content">
              <div class="notif-item-text">${n.text}</div>
              <div class="notif-item-time">${n.time}</div>
            </div>
            ${n.unread ? '<div class="status-dot free" style="margin-top:2px"></div>' : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function toggle() {
    const panel = document.getElementById('cc-notif-panel');
    if (panel.classList.contains('hidden')) {
      render();
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  }

  function markAllRead() {
    CC_DATA.notifications.forEach(n => n.unread = false);
    render();
    CC_HEADER.render();
    CC_AUTH.showToast('All notifications marked as read');
  }

  return { render, toggle, markAllRead };
})();
