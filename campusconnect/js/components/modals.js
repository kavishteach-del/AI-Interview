/* ============================================
   CampusConnect — Modal System
   ============================================ */

window.CC_MODALS = (function() {

  function open(content, options = {}) {
    const overlay = document.getElementById('cc-modal-overlay');
    const modal   = document.getElementById('cc-modal');

    modal.innerHTML = `
      <div class="modal-handle"></div>
      <button class="modal-close" onclick="CC_MODALS.close()">×</button>
      ${content}
    `;

    if (options.wide) modal.style.maxWidth = '680px';
    else modal.style.maxWidth = '540px';

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
  }

  function close() {
    const overlay = document.getElementById('cc-modal-overlay');
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ---- Specific Modals ----

  function openIceBreaker(studentName) {
    const icebreakers = CC_DATA.icebreakers;
    const items = icebreakers.map(q => `
      <div class="icebreaker-item" onclick="CC_AUTH.showToast('💬 Great question to ask ${studentName}!')">
        💬 "${q}"
      </div>
    `).join('');

    open(`
      <div class="modal-title">🧊 Ice Breakers</div>
      <div class="modal-subtitle">Start a conversation with <strong>${studentName}</strong></div>
      <div class="icebreaker-list">${items}</div>
      <p class="text-muted text-sm mt-4">Tap any question to use it in your conversation.</p>
    `);
  }

  function openConnectModal(student) {
    const initials = student.initials;
    const avatarClass = `avatar-gradient-${student.avatarGradient}`;
    const commonInterests = student.commonInterests || [];
    const matched = CC_DATA.getMatchingStudents('stu-001').find(s => s.id === student.id);
    const reasons = matched ? [
      ...matched.commonInterests.map(i => `✅ ${i} — common interest`),
      matched.sameBranch ? `🎓 Same branch: ${student.branch}` : null,
      matched.sameYear ? `📅 Same year: ${student.year}rd year` : null,
    ].filter(Boolean) : [];

    open(`
      <div style="text-align:center;margin-bottom:20px">
        <div class="avatar avatar-xl ${avatarClass} mx-auto mb-3">${initials}</div>
        <div class="modal-title">${student.name}</div>
        <div class="text-secondary" style="font-size:14px">${student.course} ${student.branch} • ${student.year}${student.year===1?'st':student.year===2?'nd':student.year===3?'rd':'th'} Year</div>
      </div>
      ${student.bio ? `<p class="text-secondary text-sm mb-4" style="text-align:center;font-style:italic">"${student.bio}"</p>` : ''}
      ${reasons.length > 0 ? `
        <div style="background:var(--bg-secondary);border-radius:var(--radius);padding:14px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">Why we suggest ${student.name.split(' ')[0]}</div>
          ${reasons.map(r => `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:6px">${r}</div>`).join('')}
        </div>
      ` : ''}
      <div class="interest-grid mb-4">
        ${student.interests.slice(0,5).map(i => `<span class="chip chip-primary chip-sm">${i}</span>`).join('')}
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary flex-1" onclick="CC_MODALS.close()">Close</button>
        <button class="btn btn-primary flex-1" onclick="CC_MODALS.sendConnection('${student.id}', '${student.name}')">
          🤝 Connect
        </button>
      </div>
      <button class="btn btn-ghost w-full mt-2" onclick="CC_MODALS.openIceBreaker('${student.name.split(' ')[0]}')">
        🧊 Ice Breakers
      </button>
    `);
  }

  function sendConnection(studentId, name) {
    const wasConnected = CC_AUTH.isConnected(studentId);
    const nowConnected = CC_AUTH.toggleConnected(studentId);
    if (nowConnected) {
      CC_AUTH.showToast(`✅ Connection request sent to ${name}!`);
    } else {
      CC_AUTH.showToast(`Connection with ${name} removed.`);
    }
    close();
  }

  function openActivityDetail(activity) {
    const creator = CC_DATA.getStudent(activity.createdBy);
    const isJoined = CC_AUTH.isJoined(activity.id);
    const pct = Math.round((activity.joined / activity.max) * 100);

    open(`
      <div style="font-size:48px;text-align:center;margin-bottom:12px">${activity.emoji}</div>
      <div class="modal-title" style="text-align:center">${activity.name}</div>
      <div class="modal-subtitle" style="text-align:center">${activity.category} • ${activity.date}</div>
      
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
        <div class="activity-card-meta">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          ${activity.location}
        </div>
        <div class="activity-card-meta">🕐 ${activity.time}</div>
        <div class="activity-card-meta">👥 ${activity.joined}/${activity.max} joined</div>
      </div>

      <div class="capacity-bar mb-4">
        <div class="capacity-track flex-1"><div class="capacity-fill" style="width:${pct}%"></div></div>
        <span>${activity.max - activity.joined} spots left</span>
      </div>

      <p class="text-secondary" style="font-size:14px;margin-bottom:16px">${activity.description}</p>

      ${creator ? `
        <div style="display:flex;align-items:center;gap:10px;background:var(--bg-secondary);border-radius:var(--radius);padding:10px;margin-bottom:16px">
          <div class="avatar avatar-sm avatar-gradient-${creator.avatarGradient}">${creator.initials}</div>
          <div>
            <div style="font-size:13px;font-weight:600">${creator.name}</div>
            <div style="font-size:12px;color:var(--text-muted)">Activity organiser</div>
          </div>
        </div>
      ` : ''}

      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary flex-1" onclick="CC_MODALS.close()">Close</button>
        <button class="btn ${isJoined ? 'btn-danger' : 'btn-success'} flex-1" 
                onclick="CC_MODALS.toggleJoinActivity('${activity.id}', '${activity.name}', this)">
          ${isJoined ? '🚪 Leave' : '✅ Join'}
        </button>
      </div>
    `);
  }

  function toggleJoinActivity(actId, name, btn) {
    const joined = CC_AUTH.toggleJoined(actId);
    if (joined) {
      btn.textContent = '🚪 Leave';
      btn.className = 'btn btn-danger flex-1';
      CC_AUTH.showToast(`✅ You joined "${name}"!`);
    } else {
      btn.textContent = '✅ Join';
      btn.className = 'btn btn-success flex-1';
      CC_AUTH.showToast(`Left "${name}".`);
    }
  }

  function openEventDetail(event) {
    const isInterested = CC_AUTH.isInterested(event.id);

    open(`
      <div style="font-size:56px;text-align:center;margin-bottom:16px">${event.emoji}</div>
      <span class="badge badge-primary mb-2">${event.category}</span>
      <div class="modal-title">${event.title}</div>
      <div class="modal-subtitle">${event.date} • ${event.time}</div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
        <div class="activity-card-meta">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          ${event.location}
        </div>
        <div class="activity-card-meta">👥 ${event.interested} interested • ${event.registered} registered</div>
      </div>

      <div class="interest-grid mb-4">
        ${event.tags.map(t => `<span class="chip chip-default chip-sm">${t}</span>`).join('')}
      </div>

      <p class="text-secondary" style="font-size:14px;margin-bottom:20px">${event.desc}</p>

      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary flex-1" onclick="CC_MODALS.close()">Close</button>
        <button class="btn ${isInterested ? 'btn-outline' : 'btn-primary'} flex-1" 
                onclick="CC_MODALS.toggleEventInterest('${event.id}', this)">
          ${isInterested ? '✓ Interested' : '⭐ I\'m Interested'}
        </button>
      </div>
    `);
  }

  function toggleEventInterest(evtId, btn) {
    const interested = CC_AUTH.toggleInterested(evtId);
    btn.className = `btn ${interested ? 'btn-outline' : 'btn-primary'} flex-1`;
    btn.textContent = interested ? '✓ Interested' : '⭐ I\'m Interested';
    CC_AUTH.showToast(interested ? '⭐ Marked as interested!' : 'Removed interest.');
  }

  function openProfileModal(studentId) {
    const student = CC_DATA.getStudent(studentId);
    if (!student) return;
    openConnectModal(student);
  }

  function openCreateActivity() {
    open(`
      <div class="modal-title">➕ Create Activity</div>
      <div class="modal-subtitle">Invite others to join you on campus</div>

      <div class="form-group">
        <label class="form-label">Activity Type</label>
        <div class="activity-select-grid" style="margin-bottom:0">
          ${CC_DATA.activityTypes.map(a => `
            <button class="activity-select-btn" onclick="this.classList.toggle('selected')">
              ${a.emoji} ${a.name}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Title</label>
        <input type="text" class="form-control" id="new-act-title" placeholder="e.g. DBMS Study Group">
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Campus Area</label>
          <select class="form-control form-select" id="new-act-location">
            ${CC_DATA.campusAreas.map(a => `<option>${a.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Max People</label>
          <input type="number" class="form-control" id="new-act-max" min="2" max="20" value="4">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="new-act-date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Time</label>
          <input type="time" class="form-control" id="new-act-time">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea class="form-control" id="new-act-desc" placeholder="What will you be doing? Anyone welcome?"></textarea>
      </div>

      <div style="display:flex;gap:10px;margin-top:4px">
        <button class="btn btn-secondary flex-1" onclick="CC_MODALS.close()">Cancel</button>
        <button class="btn btn-primary flex-1" onclick="CC_MODALS.submitActivity()">🚀 Create Activity</button>
      </div>
    `, { wide: true });
  }

  function submitActivity() {
    const title = document.getElementById('new-act-title')?.value?.trim();
    if (!title) { CC_AUTH.showToast('⚠️ Please add a title.'); return; }
    CC_AUTH.showToast(`🎉 Activity "${title}" created! Others can now see and join it.`);
    close();
  }

  function openReportModal(type, targetName) {
    open(`
      <div class="modal-title">🚩 Report</div>
      <div class="modal-subtitle">Report ${type}: <strong>${targetName}</strong></div>
      
      <div class="form-group">
        <label class="form-label">Reason</label>
        <select class="form-control form-select" id="report-reason">
          <option>Harassment or bullying</option>
          <option>Spam or fake content</option>
          <option>Inappropriate content</option>
          <option>Fake or impersonator account</option>
          <option>Other</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Additional details (optional)</label>
        <textarea class="form-control" id="report-desc" placeholder="Describe the issue..."></textarea>
      </div>

      <div class="email-note" style="text-align:left;color:var(--text-secondary)">
        🔒 Your report is confidential. Our admin team will review it within 24 hours.
      </div>

      <div style="display:flex;gap:10px;margin-top:4px">
        <button class="btn btn-secondary flex-1" onclick="CC_MODALS.close()">Cancel</button>
        <button class="btn btn-danger flex-1" onclick="CC_MODALS.submitReport()">Submit Report</button>
      </div>
    `);
  }

  function submitReport() {
    CC_AUTH.showToast('✅ Report submitted. Admin team will review it.');
    close();
  }

  return {
    open, close,
    openIceBreaker,
    openConnectModal,
    sendConnection,
    openActivityDetail,
    toggleJoinActivity,
    openEventDetail,
    toggleEventInterest,
    openProfileModal,
    openCreateActivity,
    submitActivity,
    openReportModal,
    submitReport,
  };
})();
