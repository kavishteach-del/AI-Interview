/* ============================================
   CampusConnect — Activities Page
   Activities, Open Spots, Open Tables,
   Group Finder, Campus Moments, Challenges
   ============================================ */

window.CC_ACTIVITIES = (function() {

  let activeTab = 'activities';

  function render(container) {
    container.innerHTML = `
    <div class="activities-page animate-fade-in">

      <!-- Header -->
      <div class="section-header mb-4">
        <div>
          <h1 style="font-size:22px;font-weight:800">🎯 Campus Activities</h1>
          <p class="text-secondary text-sm">What's happening on campus right now.</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="CC_MODALS.openCreateActivity()">
          ➕ Create
        </button>
      </div>

      <!-- Tabs -->
      <div class="tabs-underline">
        <button class="tab-btn-underline ${activeTab==='activities'?'active':''}" onclick="CC_ACTIVITIES.switchTab('activities')">🎯 Activities</button>
        <button class="tab-btn-underline ${activeTab==='spots'?'active':''}" onclick="CC_ACTIVITIES.switchTab('spots')">📍 Open Spots</button>
        <button class="tab-btn-underline ${activeTab==='tables'?'active':''}" onclick="CC_ACTIVITIES.switchTab('tables')">☕ Open Tables</button>
        <button class="tab-btn-underline ${activeTab==='moments'?'active':''}" onclick="CC_ACTIVITIES.switchTab('moments')">📸 Moments</button>
        <button class="tab-btn-underline ${activeTab==='challenges'?'active':''}" onclick="CC_ACTIVITIES.switchTab('challenges')">🏆 Challenges</button>
      </div>

      <!-- Tab Content -->
      <div id="activities-tab-content">
        ${renderTabContent(activeTab)}
      </div>
    </div>
    `;
  }

  function renderTabContent(tab) {
    switch (tab) {
      case 'activities':  return renderActivitiesTab();
      case 'spots':       return renderSpotsTab();
      case 'tables':      return renderTablesTab();
      case 'moments':     return renderMomentsTab();
      case 'challenges':  return renderChallengesTab();
      default:            return '';
    }
  }

  function renderActivitiesTab() {
    const activeActs   = CC_DATA.getActiveActivities();
    const upcomingActs = CC_DATA.getUpcomingActivities();

    return `
      <!-- Category Filter -->
      <div class="flex flex-wrap gap-2 mb-4">
        ${['All', '🏸 Sports', '📚 Study', '☕ Social', '💻 Project', '🎮 Gaming', '🎥 Content'].map((cat, i) => `
          <button class="chip ${i===0?'chip-primary':'chip-default'} chip-selectable"
                  onclick="CC_ACTIVITIES.filterActivities('${cat}', this)">${cat}</button>
        `).join('')}
      </div>

      <!-- Now -->
      <div class="section-header mb-3">
        <span class="section-title">🔴 Happening Now</span>
        <span class="chip chip-success chip-sm">${activeActs.length} open</span>
      </div>
      <div class="activities-grid mb-5" id="activities-grid">
        ${activeActs.map(a => renderActivityCard(a)).join('')}
      </div>

      <!-- Upcoming -->
      <div class="section-header mb-3">
        <span class="section-title">🕐 Upcoming</span>
      </div>
      <div class="activities-grid">
        ${upcomingActs.map(a => renderActivityCard(a)).join('')}
      </div>
    `;
  }

  function renderActivityCard(activity) {
    const isJoined = CC_AUTH.isJoined(activity.id);
    const pct      = Math.round((activity.joined / activity.max) * 100);
    const spotsLeft = activity.max - activity.joined;

    return `
      <div class="activity-card" onclick="CC_MODALS.openActivityDetail(CC_DATA.getActivity('${activity.id}'))">
        <div class="activity-card-icon">${activity.emoji}</div>
        <div class="activity-card-title">${activity.name}</div>
        <div class="activity-card-meta">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          ${activity.location}
        </div>
        <div class="activity-card-meta">🕐 ${activity.time} &nbsp;•&nbsp; 📅 ${activity.date}</div>
        <p class="text-secondary" style="font-size:12.5px;margin:6px 0 10px">${activity.description.slice(0,80)}${activity.description.length>80?'…':''}</p>

        <!-- Capacity -->
        <div class="capacity-bar mb-3">
          <span style="font-size:12px;color:var(--text-muted)">👥 ${activity.joined}/${activity.max}</span>
          <div class="capacity-track flex-1"><div class="capacity-fill" style="width:${pct}%"></div></div>
          <span style="font-size:12px;${spotsLeft<=1?'color:var(--danger)':'color:var(--text-muted)'}">${spotsLeft} left</span>
        </div>

        <div class="activity-card-footer">
          <span class="badge ${activity.status==='open'?'badge-success':'badge-gray'}">
            ${activity.status==='open'?'🔴 Now':'⏳ Soon'}
          </span>
          <button class="btn btn-sm ${isJoined?'btn-danger':'btn-primary'}"
                  onclick="event.stopPropagation();CC_ACTIVITIES.toggleJoin('${activity.id}','${activity.name}',this)">
            ${isJoined ? '🚪 Leave' : '✅ Join'}
          </button>
        </div>
      </div>
    `;
  }

  function renderSpotsTab() {
    return `
      <div class="section-header mb-3">
        <span class="section-title">📍 Open Spots</span>
        <button class="btn btn-sm btn-primary" onclick="CC_ACTIVITIES.createSpot()">➕ Create Spot</button>
      </div>
      <p class="text-secondary text-sm mb-4">Join someone's open invitation — no awkward cold approaches needed.</p>

      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">
        ${CC_DATA.openSpots.map(spot => renderSpotCard(spot)).join('')}

        <!-- Create new spot card -->
        <div class="open-spot-card" style="border:2px dashed var(--border);background:var(--bg-secondary);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:200px;cursor:pointer"
             onclick="CC_ACTIVITIES.createSpot()">
          <div style="font-size:36px;margin-bottom:10px">📍</div>
          <div style="font-size:14px;font-weight:700;margin-bottom:4px">Create Open Spot</div>
          <div style="font-size:12px;color:var(--text-secondary)">Let others join you at a specific campus location.</div>
        </div>
      </div>
    `;
  }

  function renderSpotCard(spot) {
    const isJoined    = CC_AUTH.isJoined(spot.id);
    const seatsLeft   = spot.max - spot.joined;
    const creator     = CC_DATA.getStudent(spot.createdBy);
    const pct         = Math.round((spot.joined / spot.max) * 100);

    return `
      <div class="open-spot-card">
        <div class="open-spot-header">
          <span class="open-spot-icon">${spot.emoji}</span>
          <div style="flex:1">
            <div style="font-size:15px;font-weight:700">${spot.title}</div>
            <div class="open-spot-meta">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/></svg>
              ${spot.location}
            </div>
            <div class="open-spot-meta">🕐 ${spot.timeFrom} – ${spot.timeTo}</div>
          </div>
        </div>

        <p class="open-spot-desc">"${spot.desc}"</p>

        <!-- Capacity -->
        <div class="capacity-bar mb-3">
          <span style="font-size:12px;color:var(--text-muted)">👥 ${spot.joined}/${spot.max}</span>
          <div class="capacity-track flex-1"><div class="capacity-fill" style="width:${pct}%"></div></div>
          <span style="font-size:12px;${seatsLeft<=1?'color:var(--danger)':'color:var(--text-muted)'}">${seatsLeft} ${seatsLeft===1?'seat':'seats'} left</span>
        </div>

        ${creator ? `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <div class="avatar avatar-xs avatar-gradient-${creator.avatarGradient}">${creator.initials}</div>
            <span style="font-size:12px;color:var(--text-muted)">by ${creator.name.split(' ')[0]}</span>
          </div>
        ` : ''}

        <div class="open-spot-footer">
          <button class="btn btn-sm ${isJoined?'btn-danger':'btn-success'} flex-1"
                  onclick="CC_ACTIVITIES.toggleJoin('${spot.id}','${spot.title}',this)">
            ${isJoined ? '🚪 Leave' : '🪑 Join Spot'}
          </button>
        </div>
      </div>
    `;
  }

  function renderTablesTab() {
    return `
      <div class="section-header mb-3">
        <span class="section-title">☕ Open Tables</span>
        <button class="btn btn-sm btn-primary" onclick="CC_ACTIVITIES.createTable()">➕ Open Table</button>
      </div>
      <p class="text-secondary text-sm mb-4">Sitting alone in the cafeteria? Open your table for others to join!</p>

      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
        ${CC_DATA.openTables.map(table => renderTableCard(table)).join('')}

        <!-- Create new table -->
        <div class="open-table-card" style="border:2px dashed rgba(245,158,11,0.3);background:rgba(245,158,11,0.03);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:180px;cursor:pointer"
             onclick="CC_ACTIVITIES.createTable()">
          <div style="font-size:36px;margin-bottom:10px">🪑</div>
          <div style="font-size:14px;font-weight:700;margin-bottom:4px">Open a Table</div>
          <div style="font-size:12px;color:var(--text-secondary)">Invite others to join you at your cafeteria table.</div>
        </div>
      </div>
    `;
  }

  function renderTableCard(table) {
    const isJoined  = CC_AUTH.isJoined(table.id);
    const seatsLeft = table.seatsTotal - table.seatsOccupied;
    const creator   = CC_DATA.getStudent(table.createdBy);

    return `
      <div class="open-table-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div>
            <div style="font-size:16px;font-weight:800">${table.emoji} ${table.title}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${table.location} • ${table.tableNum}</div>
          </div>
          <div style="font-size:11px;font-weight:700;color:var(--warning);background:rgba(245,158,11,0.1);padding:4px 10px;border-radius:var(--radius-full)">
            ${table.time}
          </div>
        </div>

        <p style="font-size:13.5px;color:var(--text-secondary);font-style:italic;margin-bottom:12px">"${table.desc}"</p>

        <!-- Seat visualizer -->
        <div style="display:flex;gap:6px;margin-bottom:12px;align-items:center">
          ${Array(table.seatsTotal).fill(0).map((_, i) => `
            <div style="width:32px;height:32px;border-radius:50%;font-size:16px;display:flex;align-items:center;justify-content:center;
                        background:${i < table.seatsOccupied ? 'var(--primary)' : 'var(--bg-tertiary)'}">
              ${i < table.seatsOccupied ? '🪑' : '⬜'}
            </div>
          `).join('')}
          <span style="font-size:12px;color:var(--text-muted);margin-left:4px">${seatsLeft} free</span>
        </div>

        ${creator ? `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <div class="avatar avatar-xs avatar-gradient-${creator.avatarGradient}">${creator.initials}</div>
            <span style="font-size:12px;color:var(--text-muted)">by ${creator.name.split(' ')[0]}</span>
          </div>
        ` : ''}

        <button class="btn btn-sm ${isJoined?'btn-danger':'btn-primary'} w-full"
                onclick="CC_ACTIVITIES.toggleJoin('${table.id}','${table.title}',this)">
          ${isJoined ? '🚪 Leave Table' : '🪑 Join Table'}
        </button>
      </div>
    `;
  }

  function renderMomentsTab() {
    return `
      <div class="section-header mb-3">
        <span class="section-title">📸 Campus Moments</span>
        <button class="btn btn-sm btn-primary" onclick="CC_ACTIVITIES.shareNewMoment()">📸 Share</button>
      </div>
      <p class="text-secondary text-sm mb-4">Share campus life — sunsets, events, activities, random vibes.</p>
      <div class="moments-grid">
        ${CC_DATA.moments.map(m => renderMomentCard(m)).join('')}
      </div>
    `;
  }

  function renderMomentCard(moment) {
    const student   = CC_DATA.getStudent(moment.studentId);
    const avatarCls = student ? `avatar-gradient-${student.avatarGradient}` : 'avatar-gradient-0';
    const isLiked   = CC_AUTH.isLiked(moment.id);

    return `
      <div class="moment-card">
        <div class="${moment.imgClass} moment-img-placeholder">${moment.imgEmoji}</div>
        <div class="moment-card-body">
          <div class="moment-card-user">
            <div class="avatar avatar-sm ${avatarCls}">${student?.initials||'U'}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">${student?.name||'Student'}</div>
              <div style="font-size:11px;color:var(--text-muted)">${moment.time}</div>
            </div>
            <button class="btn btn-icon-sm btn-ghost" onclick="CC_MODALS.openReportModal('post','this moment')" title="Report">⋯</button>
          </div>
          <p class="moment-card-text">${moment.caption}</p>
          <div class="moment-card-footer">
            <div class="moment-action ${isLiked?'liked':''}" onclick="toggleMomentLike('${moment.id}',this)">
              ${isLiked?'❤️':'🤍'} ${moment.likes + (isLiked?1:0)}
            </div>
            <div class="moment-action">💬 ${moment.comments}</div>
            <div class="moment-action" onclick="CC_AUTH.showToast('📤 Share link copied!')">📤</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderChallengesTab() {
    return `
      <div class="section-header mb-3">
        <span class="section-title">🏆 Together Challenges</span>
      </div>
      <p class="text-secondary text-sm mb-4">Complete challenges to earn badges and explore campus.</p>

      <!-- Badges earned -->
      <div class="section-header mb-2">
        <span style="font-size:14px;font-weight:700">Your Badges</span>
      </div>
      <div class="badges-grid mb-5">
        ${Object.entries(CC_DATA.badges).map(([key, badge]) => `
          <div class="achievement-badge">
            <div class="achievement-icon">${badge.emoji}</div>
            <div>
              <div class="achievement-name">${badge.name}</div>
              <div class="achievement-desc">${badge.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="section-header mb-2">
        <span style="font-size:14px;font-weight:700">Active Challenges</span>
      </div>
      <div class="challenges-grid">
        ${CC_DATA.challenges.map(c => renderChallengeCard(c)).join('')}
      </div>
    `;
  }

  function renderChallengeCard(challenge) {
    const isDone = challenge.total === 1 && challenge.progress === 1;
    const pct    = Math.round((challenge.progress / challenge.total) * 100);
    return `
      <div class="challenge-card ${isDone?'':''}">
        <div class="challenge-icon">${challenge.emoji}</div>
        <div class="challenge-title">${challenge.title}</div>
        <p class="challenge-desc">${challenge.desc}</p>
        ${challenge.total > 1 ? `
          <div class="challenge-progress-label">
            <span>Progress</span>
            <span>${challenge.progress}/${challenge.total}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        ` : `
          <div class="flex items-center gap-2 mt-1">
            <div class="progress-bar flex-1"><div class="progress-fill" style="width:${isDone?100:0}%"></div></div>
            <span style="font-size:12px;color:${isDone?'var(--success)':'var(--text-muted)'}">${isDone?'✅ Done':'Not started'}</span>
          </div>
        `}
        ${!isDone ? `
          <button class="btn btn-sm btn-primary w-full mt-3" onclick="CC_AUTH.showToast('✅ Challenge marked as in progress!')">Start Challenge</button>
        ` : `
          <div style="text-align:center;margin-top:10px;font-size:13px;color:var(--success);font-weight:700">✅ Completed!</div>
        `}
      </div>
    `;
  }

  // ---- Actions ----
  function switchTab(tab) {
    activeTab = tab;
    const content = document.getElementById('activities-tab-content');
    if (content) content.innerHTML = renderTabContent(tab);
    document.querySelectorAll('.tab-btn-underline').forEach(b => {
      b.classList.toggle('active', b.textContent.toLowerCase().includes(tab.slice(0,6).toLowerCase()));
    });
  }

  function toggleJoin(id, name, btn) {
    const joined = CC_AUTH.toggleJoined(id);
    btn.textContent = joined ? (id.startsWith('table') ? '🚪 Leave Table' : id.startsWith('spot') ? '🚪 Leave' : '🚪 Leave') : (id.startsWith('table') ? '🪑 Join Table' : id.startsWith('spot') ? '🪑 Join Spot' : '✅ Join');
    btn.className   = `btn btn-sm ${joined ? 'btn-danger' : 'btn-success'} ${btn.className.includes('w-full')?'w-full':'flex-1'}`;
    CC_AUTH.showToast(joined ? `✅ You joined "${name}"!` : `Left "${name}".`);
  }

  function filterActivities(cat, btn) {
    document.querySelectorAll('.chip-selectable').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    CC_AUTH.showToast(`Showing: ${cat}`);
  }

  function createSpot() {
    CC_MODALS.open(`
      <div class="modal-title">📍 Create Open Spot</div>
      <div class="modal-subtitle">Invite others to join you at a campus location.</div>
      <div class="form-group">
        <label class="form-label">Spot Type</label>
        <div class="activity-select-grid">
          ${CC_DATA.activityTypes.map(a=>`<button class="activity-select-btn" onclick="this.classList.toggle('selected')">${a.emoji} ${a.name}</button>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Location</label>
        <select class="form-control form-select">
          ${CC_DATA.campusAreas.map(a=>`<option>${a.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">From</label>
          <input type="time" class="form-control">
        </div>
        <div class="form-group">
          <label class="form-label">To</label>
          <input type="time" class="form-control">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Max People</label>
        <input type="number" class="form-control" min="2" max="10" value="4">
      </div>
      <div class="form-group">
        <label class="form-label">Description (optional)</label>
        <input type="text" class="form-control" placeholder="e.g. Just chilling, anyone welcome!">
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary flex-1" onclick="CC_MODALS.close()">Cancel</button>
        <button class="btn btn-primary flex-1" onclick="CC_AUTH.showToast('📍 Open Spot created!');CC_MODALS.close()">Create Spot</button>
      </div>
    `);
  }

  function createTable() {
    CC_MODALS.open(`
      <div class="modal-title">☕ Open a Table</div>
      <div class="modal-subtitle">Let others join you at your cafeteria table.</div>
      <div class="form-group">
        <label class="form-label">Table Number / Location</label>
        <input type="text" class="form-control" placeholder="e.g. Table 7, Window Side">
      </div>
      <div class="form-group">
        <label class="form-label">Area</label>
        <select class="form-control form-select">
          <option>Cafeteria — Centre</option>
          <option>Cafeteria — Window Side</option>
          <option>Cafeteria — Corner</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Total Seats at Your Table</label>
        <input type="number" class="form-control" min="2" max="8" value="4">
      </div>
      <div class="form-group">
        <label class="form-label">Message (optional)</label>
        <input type="text" class="form-control" placeholder="e.g. Having chai, anyone can join!">
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary flex-1" onclick="CC_MODALS.close()">Cancel</button>
        <button class="btn btn-primary flex-1" onclick="CC_AUTH.showToast('☕ Open Table created!');CC_MODALS.close()">Open Table</button>
      </div>
    `);
  }

  function shareNewMoment() {
    CC_MODALS.open(`
      <div class="modal-title">📸 Share a Campus Moment</div>
      <div class="modal-subtitle">Share something from campus life.</div>
      <div class="photo-upload-area" onclick="CC_AUTH.showToast('📷 Camera/gallery — coming soon!')">
        <div style="font-size:48px">📷</div>
        <div class="photo-upload-label">Tap to add photo</div>
        <div class="photo-upload-hint">Share a campus photo, event, or creative work</div>
      </div>
      <div class="form-group">
        <label class="form-label">Caption</label>
        <textarea class="form-control" id="moment-caption" placeholder="What's this about?" rows="3"></textarea>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-secondary flex-1" onclick="CC_MODALS.close()">Cancel</button>
        <button class="btn btn-primary flex-1" onclick="CC_AUTH.showToast('📸 Moment shared!');CC_MODALS.close()">Share</button>
      </div>
    `);
  }

  return { render, switchTab, toggleJoin, filterActivities, createSpot, createTable, shareNewMoment };
})();
