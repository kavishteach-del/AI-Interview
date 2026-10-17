/* ============================================
   CampusConnect — Dashboard Page
   ============================================ */

window.CC_DASHBOARD = (function() {

  function render(container) {
    const profile    = CC_AUTH.getProfile();
    const freeStatus = CC_AUTH.getFreeStatus();
    const greeting   = CC_DATA.greetingText();
    const freeStudents = CC_DATA.getFreeStudents();
    const suggestions = CC_DATA.getMatchingStudents('stu-001', 5);
    const activeActs  = CC_DATA.getActiveActivities().slice(0, 3);
    const currentUser = CC_DATA.getCurrentUser();

    container.innerHTML = `
    <div class="dashboard-page animate-fade-in">

      <!-- Greeting -->
      <div class="greeting-section">
        <div class="greeting-wave">👋</div>
        <h1 class="greeting-title">${greeting}, ${profile.name?.split(' ')[0] || 'Nikhil'}!</h1>
        <p class="greeting-subtitle">What do you want to do today?</p>
      </div>

      <!-- I'm Free Now Card -->
      ${renderFreeNowCard(freeStatus)}

      <!-- Campus Now Bar -->
      <div class="campus-now-bar">
        <div class="campus-now-stat">
          <div class="campus-now-dot"></div>
          <span class="campus-now-num">312</span> students active
        </div>
        <div class="campus-now-divider"></div>
        <div class="campus-now-stat">☕ <span class="campus-now-num">18</span> at Cafeteria</div>
        <div class="campus-now-divider"></div>
        <div class="campus-now-stat">🏸 <span class="campus-now-num">14</span> Sports Ground</div>
        <div class="campus-now-divider"></div>
        <div class="campus-now-stat">📚 <span class="campus-now-num">8</span> Library</div>
        <div class="campus-now-divider"></div>
        <div class="campus-now-stat">💻 <span class="campus-now-num">11</span> Labs</div>
        <div class="campus-now-divider"></div>
        <div class="campus-now-stat">🌿 <span class="campus-now-num">5</span> Plaza</div>
      </div>

      <!-- Quick Actions -->
      <div class="dashboard-section">
        <div class="section-header">
          <span class="section-title">Quick Actions</span>
        </div>
        <div class="quick-actions">
          <button class="quick-action" onclick="CC_APP.navigate('/free')">
            <span class="quick-action-icon">🟢</span>
            <span class="quick-action-label">I'm Free</span>
          </button>
          <button class="quick-action" onclick="CC_APP.navigate('/activities')">
            <span class="quick-action-icon">📚</span>
            <span class="quick-action-label">Study</span>
          </button>
          <button class="quick-action" onclick="CC_APP.navigate('/activities')">
            <span class="quick-action-icon">🏸</span>
            <span class="quick-action-label">Sports</span>
          </button>
          <button class="quick-action" onclick="CC_APP.navigate('/activities')">
            <span class="quick-action-icon">🎮</span>
            <span class="quick-action-label">Gaming</span>
          </button>
          <button class="quick-action" onclick="CC_APP.navigate('/campus')">
            <span class="quick-action-icon">☕</span>
            <span class="quick-action-label">Chai</span>
          </button>
          <button class="quick-action" onclick="CC_APP.navigate('/activities')">
            <span class="quick-action-icon">💬</span>
            <span class="quick-action-label">Talk</span>
          </button>
          <button class="quick-action" onclick="CC_APP.navigate('/discover')">
            <span class="quick-action-icon">💻</span>
            <span class="quick-action-label">Project</span>
          </button>
          <button class="quick-action" onclick="CC_APP.navigate('/activities')">
            <span class="quick-action-icon">🎥</span>
            <span class="quick-action-label">Create</span>
          </button>
        </div>
      </div>

      <!-- People Free Now -->
      <div class="dashboard-section">
        <div class="section-header">
          <span class="section-title">🟢 People Free Now</span>
          <span class="section-link" onclick="CC_APP.navigate('/discover')">See all</span>
        </div>
        <div class="people-free-grid">
          ${freeStudents.slice(0, 4).map(s => renderPersonFreeCard(s)).join('')}
        </div>
      </div>

      <!-- Find My People -->
      <div class="dashboard-section">
        <div class="section-header">
          <span class="section-title">👥 People You Might Connect With</span>
          <span class="section-link" onclick="CC_APP.navigate('/discover')">See all</span>
        </div>
        <div class="suggest-cards">
          ${suggestions.map(s => renderSuggestCard(s)).join('')}
        </div>
      </div>

      <!-- Activities Happening Now -->
      <div class="dashboard-section">
        <div class="section-header">
          <span class="section-title">🎯 Happening Now</span>
          <span class="section-link" onclick="CC_APP.navigate('/activities')">See all</span>
        </div>
        <div class="upcoming-list">
          ${activeActs.map(a => renderUpcomingItem(a)).join('')}
        </div>
      </div>

      <!-- Campus Moments -->
      <div class="dashboard-section">
        <div class="section-header">
          <span class="section-title">📸 Campus Moments</span>
          <span class="section-link" onclick="CC_APP.navigate('/activities')">View all</span>
        </div>
        <div class="suggest-cards">
          ${CC_DATA.moments.slice(0, 4).map(m => renderMomentCardHorizontal(m)).join('')}
        </div>
      </div>

    </div>
    `;
  }

  function renderFreeNowCard(freeStatus) {
    if (freeStatus.active) {
      return `
        <div class="free-now-card active-now" onclick="CC_APP.navigate('/free')">
          <div class="free-now-badge">🟢 ACTIVE</div>
          <div class="free-now-icon">✅</div>
          <div class="free-now-title">You're Free Now!</div>
          <div class="free-now-desc">
            ${freeStatus.duration} • ${(freeStatus.activities || []).join(', ')} • ${freeStatus.location || 'Campus'}
          </div>
        </div>
      `;
    }
    return `
      <div class="free-now-card" onclick="CC_APP.navigate('/free')">
        <div class="free-now-icon">🟢</div>
        <div class="free-now-title">I'm Free Now</div>
        <div class="free-now-desc">Got some free time? Let others know you're available and what you want to do.</div>
      </div>
    `;
  }

  function renderPersonFreeCard(student) {
    const avatarClass = `avatar-gradient-${student.avatarGradient}`;
    return `
      <div class="person-card animate-fade-in">
        <div class="person-card-header">
          <div class="avatar avatar-md ${avatarClass}" style="cursor:pointer" onclick="CC_MODALS.openConnectModal(${JSON.stringify(student).replace(/"/g, '&quot;')})">
            ${student.initials}
          </div>
          <div class="person-card-info">
            <div class="person-card-name">${student.name}</div>
            <div class="person-card-meta">${student.branch} • ${student.year}${student.year===1?'st':student.year===2?'nd':student.year===3?'rd':'th'} Year</div>
            <div class="person-card-status mt-1">
              <div class="free-pill">Free for ${student.freeFor}</div>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1">
          ${(student.freeActivity || []).map(a => `<span class="chip chip-success chip-sm">${a}</span>`).join('')}
          <span class="chip chip-default chip-sm">📍 ${student.campusArea}</span>
        </div>
        <div class="person-card-actions mt-1">
          <button class="btn btn-sm btn-secondary flex-1" onclick="CC_MODALS.openIceBreaker('${student.name.split(' ')[0]}')">🧊 Ice Break</button>
          <button class="btn btn-sm btn-primary flex-1" onclick="handleConnect('${student.id}', '${student.name}', this)">
            ${CC_AUTH.isConnected(student.id) ? '✓ Connected' : '🤝 Connect'}
          </button>
        </div>
      </div>
    `;
  }

  function renderSuggestCard(student) {
    const avatarClass = `avatar-gradient-${student.avatarGradient}`;
    const commonCount = student.commonInterests ? student.commonInterests.length : 0;
    return `
      <div class="suggest-card">
        <div class="suggest-card-avatar">
          <div class="avatar avatar-md ${avatarClass}" style="cursor:pointer" onclick="CC_MODALS.openConnectModal(${JSON.stringify(student).replace(/"/g, '&quot;')})">
            ${student.initials}
          </div>
        </div>
        <div class="suggest-card-name">${student.name}</div>
        <div class="suggest-card-meta">${student.branch} • ${student.year}${student.year===1?'st':student.year===2?'nd':student.year===3?'rd':'th'} Year</div>
        <div class="suggest-card-interests">
          ${student.interests.slice(0,3).map(i => `<span class="chip chip-primary chip-sm">${i}</span>`).join('')}
        </div>
        ${commonCount > 0 ? `<div class="suggest-common">✨ ${commonCount} interest${commonCount>1?'s':''} in common</div>` : ''}
        <button class="btn btn-sm btn-primary w-full" onclick="handleConnect('${student.id}', '${student.name}', this)">
          ${CC_AUTH.isConnected(student.id) ? '✓ Connected' : '🤝 Connect'}
        </button>
      </div>
    `;
  }

  function renderUpcomingItem(act) {
    const isJoined = CC_AUTH.isJoined(act.id);
    return `
      <div class="upcoming-item" onclick="CC_MODALS.openActivityDetail(CC_DATA.getActivity('${act.id}'))">
        <div class="upcoming-emoji">${act.emoji}</div>
        <div class="upcoming-info">
          <div class="upcoming-name">${act.name}</div>
          <div class="upcoming-meta">📍 ${act.location} • 👥 ${act.joined}/${act.max} joined</div>
        </div>
        <div class="upcoming-time">${act.time}</div>
      </div>
    `;
  }

  function renderMomentCardHorizontal(moment) {
    const student = CC_DATA.getStudent(moment.studentId);
    const avatarClass = student ? `avatar-gradient-${student.avatarGradient}` : 'avatar-gradient-0';
    const isLiked = CC_AUTH.isLiked(moment.id);
    return `
      <div class="suggest-card" style="min-width:220px">
        <div class="${moment.imgClass} moment-img-placeholder" style="margin:-16px -16px 12px;border-radius:12px 12px 0 0;font-size:36px">
          ${moment.imgEmoji}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div class="avatar avatar-xs ${avatarClass}">${student?.initials || 'U'}</div>
          <span style="font-size:12px;font-weight:600">${student?.name?.split(' ')[0] || 'Student'}</span>
          <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${moment.time}</span>
        </div>
        <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:8px">${moment.caption}</p>
        <div class="flex gap-3">
          <span class="moment-action ${isLiked ? 'liked' : ''}" onclick="toggleMomentLike('${moment.id}', this)">
            ${isLiked ? '❤️' : '🤍'} ${moment.likes + (isLiked ? 1 : 0)}
          </span>
          <span class="moment-action">💬 ${moment.comments}</span>
        </div>
      </div>
    `;
  }

  return { render };
})();

// ---- Global dashboard helpers ----
function handleConnect(studentId, name, btn) {
  const connected = CC_AUTH.toggleConnected(studentId);
  btn.textContent = connected ? '✓ Connected' : '🤝 Connect';
  CC_AUTH.showToast(connected ? `✅ Connected with ${name}!` : `Removed connection with ${name}.`);
}

function toggleMomentLike(momentId, el) {
  const liked = CC_AUTH.toggleLiked(momentId);
  const moment = CC_DATA.moments.find(m => m.id === momentId);
  if (moment) {
    el.className = `moment-action ${liked ? 'liked' : ''}`;
    el.innerHTML = `${liked ? '❤️' : '🤍'} ${moment.likes + (liked ? 1 : 0)}`;
  }
}
