/* ============================================
   CampusConnect — Admin Dashboard Page
   University admin panel with analytics,
   user management, reports, and moderation
   ============================================ */

window.CC_ADMIN = (function() {

  let activeTab = 'overview';

  function render(container) {
    // Access control: only allow admin
    const session = CC_AUTH.getSession();
    if (!session) { CC_APP.navigate('/login', true); return; }

    container.innerHTML = `
    <div class="admin-page animate-fade-in">

      <!-- Admin Header -->
      <div class="admin-header">
        <div>
          <h1 style="font-size:24px;font-weight:800">Admin Dashboard</h1>
          <p class="text-secondary text-sm">CampusConnect · JECRC University</p>
        </div>
        <span class="admin-badge">🔐 Admin</span>
      </div>

      <!-- Tabs -->
      <div class="tabs-underline mb-5">
        <button class="tab-btn-underline ${activeTab==='overview'?'active':''}"   onclick="CC_ADMIN.switchTab('overview')">📊 Overview</button>
        <button class="tab-btn-underline ${activeTab==='students'?'active':''}"   onclick="CC_ADMIN.switchTab('students')">👥 Students</button>
        <button class="tab-btn-underline ${activeTab==='activities'?'active':''}" onclick="CC_ADMIN.switchTab('activities')">🎯 Activities</button>
        <button class="tab-btn-underline ${activeTab==='reports'?'active':''}"    onclick="CC_ADMIN.switchTab('reports')">🚩 Reports</button>
        <button class="tab-btn-underline ${activeTab==='areas'?'active':''}"      onclick="CC_ADMIN.switchTab('areas')">📍 Campus Areas</button>
      </div>

      <!-- Tab Content -->
      <div id="admin-tab-content">
        ${renderTabContent(activeTab)}
      </div>

    </div>
    `;
  }

  function renderTabContent(tab) {
    switch (tab) {
      case 'overview':    return renderOverviewTab();
      case 'students':    return renderStudentsTab();
      case 'activities':  return renderActivitiesTab();
      case 'reports':     return renderReportsTab();
      case 'areas':       return renderAreasTab();
      default:            return '';
    }
  }

  // ---- OVERVIEW ----
  function renderOverviewTab() {
    const stats = CC_DATA.adminStats;
    const statsCards = [
      { emoji: '👥', label: 'Total Students',    value: stats.totalStudents,    trend: '+12 this week',   color: 'var(--primary)'  },
      { emoji: '🟢', label: 'Active Today',      value: stats.activeToday,      trend: '+47 vs yesterday', color: 'var(--success)'  },
      { emoji: '🎯', label: 'Activities Created', value: stats.activitiesCreated, trend: '+84 this week',  color: 'var(--accent)'   },
      { emoji: '🤝', label: 'Connections Today',  value: stats.connectionsToday,  trend: 'Today',          color: 'var(--secondary)'},
      { emoji: '📍', label: 'Open Spots',         value: stats.openSpots,         trend: 'Right now',      color: 'var(--warning)'  },
      { emoji: '🚩', label: 'Pending Reports',    value: stats.pendingReports,    trend: 'Need review',    color: 'var(--danger)'   },
    ];

    return `
      <!-- Stats Grid -->
      <div class="admin-stats-grid">
        ${statsCards.map(s => `
          <div class="admin-stat-card">
            <div class="admin-stat-icon">${s.emoji}</div>
            <div class="admin-stat-num" style="color:${s.color}">${s.value.toLocaleString()}</div>
            <div class="admin-stat-label">${s.label}</div>
            <div class="admin-stat-trend">${s.trend}</div>
          </div>
        `).join('')}
      </div>

      <!-- Charts Row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;margin-bottom:28px">

        <!-- Most Active Areas -->
        <div class="card">
          <div class="card-body">
            <div class="section-title mb-4">📍 Most Active Areas</div>
            ${CC_DATA.campusAreas.slice().sort((a,b) => b.activeCount - a.activeCount).slice(0,5).map(area => `
              <div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">
                  <span>${area.emoji} ${area.name}</span>
                  <span style="font-weight:700;color:var(--primary)">${area.activeCount}</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${Math.round((area.activeCount/30)*100)}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Activity Breakdown -->
        <div class="card">
          <div class="card-body">
            <div class="section-title mb-4">🎯 Activity Breakdown</div>
            ${[
              { label: 'Chai/Coffee', count: 24, color: 'var(--warning)' },
              { label: 'Study Groups', count: 18, color: 'var(--accent)'  },
              { label: 'Sports',       count: 16, color: 'var(--success)' },
              { label: 'Gaming',       count: 11, color: 'var(--secondary)'},
              { label: 'Project Work', count: 9,  color: 'var(--primary)' },
              { label: 'Content',      count: 6,  color: 'var(--orange)'  },
            ].map(item => `
              <div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">
                  <span>${item.label}</span>
                  <span style="font-weight:700;color:${item.color}">${item.count}</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width:${Math.round((item.count/24)*100)}%;background:${item.color}"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card">
          <div class="card-body">
            <div class="section-title mb-4">⚡ Quick Actions</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <button class="btn btn-secondary btn-sm" onclick="CC_AUTH.showToast('📧 Broadcast sent to all 847 students!')">
                📢 Send Campus Announcement
              </button>
              <button class="btn btn-secondary btn-sm" onclick="CC_ADMIN.switchTab('reports')">
                🚩 Review ${CC_DATA.adminReports.length} Pending Reports
              </button>
              <button class="btn btn-secondary btn-sm" onclick="CC_AUTH.showToast('📋 Export ready — check your email.')">
                📥 Export User Data (CSV)
              </button>
              <button class="btn btn-secondary btn-sm" onclick="CC_AUTH.showToast('🏫 Campus areas config updated.')">
                📍 Manage Campus Areas
              </button>
              <button class="btn btn-danger btn-sm" onclick="CC_AUTH.showToast('⚠️ Maintenance mode — all students notified.')">
                🔧 Enable Maintenance Mode
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Today's Live Feed -->
      <div class="section-header mb-3">
        <span class="section-title">🟢 Campus Now — Live Feed</span>
        <span class="chip chip-success chip-sm">Live</span>
      </div>
      <div class="card">
        <div class="card-body" style="display:flex;flex-wrap:wrap;gap:20px">
          ${[
            { emoji:'☕', label:'at Cafeteria',  count:18 },
            { emoji:'🏸', label:'at Sports Ground', count:14 },
            { emoji:'📚', label:'in Library',    count:8  },
            { emoji:'💻', label:'in Labs',       count:11 },
            { emoji:'🌿', label:'at Plaza',      count:5  },
            { emoji:'🎤', label:'at Auditorium', count:22 },
            { emoji:'🟢', label:'Free Now',      count:CC_DATA.getFreeStudents().length },
            { emoji:'📍', label:'Open Spots',    count:CC_DATA.openSpots.length },
            { emoji:'☕', label:'Open Tables',   count:CC_DATA.openTables.length },
          ].map(s => `
            <div style="text-align:center;min-width:80px">
              <div style="font-size:24px;margin-bottom:4px">${s.emoji}</div>
              <div style="font-size:20px;font-weight:800;color:var(--primary)">${s.count}</div>
              <div style="font-size:11px;color:var(--text-muted)">${s.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ---- STUDENTS ----
  function renderStudentsTab() {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div class="input-group" style="max-width:300px">
          <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" class="form-control" placeholder="Search students..." style="padding-left:36px;font-size:13px">
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm">Filter ↓</button>
          <button class="btn btn-primary btn-sm" onclick="CC_AUTH.showToast('📥 Student list exported!')">Export CSV</button>
        </div>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Branch</th>
              <th>Year</th>
              <th>Status</th>
              <th>Connections</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${CC_DATA.students.map(s => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="avatar avatar-sm avatar-gradient-${s.avatarGradient}">${s.initials}</div>
                    <div>
                      <div style="font-weight:600;font-size:13.5px">${s.name} ${s.isCurrentUser ? '<span class="badge badge-primary" style="font-size:10px;vertical-align:middle">You</span>' : ''}</div>
                      <div style="font-size:11.5px;color:var(--text-muted)">${s.email}</div>
                    </div>
                  </div>
                </td>
                <td style="font-size:13px">${s.branch}</td>
                <td style="font-size:13px">${s.year}${s.year===1?'st':s.year===2?'nd':s.year===3?'rd':'th'} Year</td>
                <td>
                  ${s.isFree
                    ? '<span class="badge badge-success">Free Now</span>'
                    : '<span class="badge badge-gray">Offline</span>'}
                </td>
                <td style="font-size:13px;text-align:center">${s.connections}</td>
                <td style="font-size:12px;color:var(--text-muted)">${s.joinedAt}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-sm btn-ghost" onclick="CC_AUTH.showToast('Viewing ${s.name}\'s profile.')" title="View">👁</button>
                    <button class="btn btn-sm btn-ghost" onclick="CC_AUTH.showToast('Warning sent to ${s.name}.')" title="Warn">⚠️</button>
                    <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onclick="CC_AUTH.showToast('${s.name} suspended.')" title="Suspend">🚫</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;flex-wrap:wrap;gap:8px">
        <span style="font-size:13px;color:var(--text-muted)">Showing ${CC_DATA.students.length} of ${CC_DATA.adminStats.totalStudents} students (demo)</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" disabled>← Prev</button>
          <button class="btn btn-primary btn-sm">1</button>
          <button class="btn btn-secondary btn-sm">2</button>
          <button class="btn btn-secondary btn-sm">Next →</button>
        </div>
      </div>
    `;
  }

  // ---- ACTIVITIES ----
  function renderActivitiesTab() {
    const allActs = CC_DATA.activities;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <span class="section-title">All Activities (${allActs.length})</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm">Filter ↓</button>
          <button class="btn btn-primary btn-sm" onclick="CC_MODALS.openCreateActivity()">➕ Create</button>
        </div>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Category</th>
              <th>Location</th>
              <th>Time</th>
              <th>Participants</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${allActs.map(a => {
              const creator = CC_DATA.getStudent(a.createdBy);
              return `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="font-size:20px">${a.emoji}</span>
                      <div>
                        <div style="font-weight:600;font-size:13.5px">${a.name}</div>
                        <div style="font-size:11.5px;color:var(--text-muted)">by ${creator?.name || 'Unknown'}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="chip chip-default chip-sm">${a.category}</span></td>
                  <td style="font-size:13px">${a.location}</td>
                  <td style="font-size:13px">${a.date} • ${a.time}</td>
                  <td style="font-size:13px;text-align:center">
                    <div style="display:flex;align-items:center;gap:6px;justify-content:center">
                      ${a.joined}/${a.max}
                      <div class="capacity-track" style="width:48px"><div class="capacity-fill" style="width:${Math.round((a.joined/a.max)*100)}%"></div></div>
                    </div>
                  </td>
                  <td>
                    <span class="badge ${a.status==='open'?'badge-success':'badge-gray'}">
                      ${a.status==='open'?'Open':'Upcoming'}
                    </span>
                  </td>
                  <td>
                    <div style="display:flex;gap:6px">
                      <button class="btn btn-sm btn-ghost" onclick="CC_MODALS.openActivityDetail(CC_DATA.getActivity('${a.id}'))" title="View">👁</button>
                      <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onclick="CC_AUTH.showToast('Activity \"${a.name}\" removed.')" title="Remove">🗑</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ---- REPORTS ----
  function renderReportsTab() {
    return `
      <div class="section-header mb-4">
        <span class="section-title">🚩 Pending Reports (${CC_DATA.adminReports.length})</span>
        <span class="chip chip-danger chip-sm">${CC_DATA.adminReports.length} unreviewed</span>
      </div>

      <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius);padding:12px 16px;margin-bottom:20px;font-size:13px;color:var(--text-secondary)">
        ⚠️ Reports are anonymous and confidential. Handle with care and follow university conduct policies.
      </div>

      <div class="card mb-5">
        ${CC_DATA.adminReports.map(rep => `
          <div class="report-item">
            <div class="report-icon">🚩</div>
            <div class="report-info">
              <div class="report-title">${rep.type}</div>
              <div class="report-desc">${rep.desc}</div>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px">
                Reported: ${rep.reportedUser} • ${rep.time}
              </div>
            </div>
            <div class="report-actions">
              <button class="btn btn-sm btn-secondary" onclick="CC_AUTH.showToast('Report dismissed.')">Dismiss</button>
              <button class="btn btn-sm btn-danger" onclick="CC_AUTH.showToast('⚠️ Action taken on report.')">Take Action</button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Resolved Reports -->
      <div class="section-header mb-3">
        <span class="section-title">✅ Recently Resolved</span>
      </div>
      <div class="card">
        ${[
          { type: 'Spam Activity', desc: 'User repeatedly creating duplicate activities.', resolvedAt: '2 days ago', action: 'Account warned' },
          { type: 'Harassment', desc: 'Unwanted messages sent to multiple users.', resolvedAt: '3 days ago', action: 'Account suspended 7 days' },
        ].map(r => `
          <div class="report-item">
            <div class="report-icon">✅</div>
            <div class="report-info">
              <div class="report-title" style="color:var(--text-secondary)">${r.type}</div>
              <div class="report-desc">${r.desc}</div>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px">
                Resolved ${r.resolvedAt} • Action: ${r.action}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ---- AREAS ----
  function renderAreasTab() {
    return `
      <div class="section-header mb-4">
        <span class="section-title">📍 Campus Areas Management</span>
        <button class="btn btn-primary btn-sm" onclick="CC_AUTH.showToast('➕ Add campus area — coming soon!')">➕ Add Area</button>
      </div>

      <div class="admin-table-wrap mb-5">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Area</th>
              <th>Description</th>
              <th>Active Now</th>
              <th>Activities</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${CC_DATA.campusAreas.map(area => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:20px">${area.emoji}</span>
                    <span style="font-weight:600;font-size:13.5px">${area.name}</span>
                  </div>
                </td>
                <td style="font-size:12.5px;color:var(--text-secondary);max-width:200px">${area.description}</td>
                <td>
                  <span style="font-weight:700;color:var(--success)">${area.activeCount}</span>
                </td>
                <td style="font-size:12.5px">${area.activities.length}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-sm btn-ghost" onclick="CC_AUTH.showToast('📝 Edit ${area.name}')">✏️</button>
                    <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onclick="CC_AUTH.showToast('Area removed from map.')">🗑</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Interest Categories -->
      <div class="section-header mb-3">
        <span class="section-title">🏷️ Interest Categories</span>
        <button class="btn btn-secondary btn-sm" onclick="CC_AUTH.showToast('Manage interest categories.')">Manage</button>
      </div>
      <div class="flex flex-wrap gap-2">
        ${CC_DATA.interestsList.map(i => `
          <div class="chip chip-default" style="cursor:default">
            ${i.emoji} ${i.name}
            <button style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;margin-left:4px;line-height:1"
                    onclick="CC_AUTH.showToast('Removed ${i.name} category.')">×</button>
          </div>
        `).join('')}
        <button class="chip chip-primary" onclick="CC_AUTH.showToast('➕ Add interest category.')">+ Add</button>
      </div>
    `;
  }

  function switchTab(tab) {
    activeTab = tab;
    const content = document.getElementById('admin-tab-content');
    if (content) content.innerHTML = renderTabContent(tab);
    document.querySelectorAll('.tab-btn-underline').forEach(b => {
      b.classList.toggle('active', b.textContent.toLowerCase().includes(tab.slice(0,5).toLowerCase()));
    });
  }

  return { render, switchTab };
})();
