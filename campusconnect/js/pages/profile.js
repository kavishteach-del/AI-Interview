/* ============================================
   CampusConnect — Profile Page
   Student profile, stats, interests,
   skills, badges, privacy settings
   ============================================ */

window.CC_PROFILE = (function() {

  let activeTab = 'overview';
  let editMode  = false;

  function render(container) {
    const profile = CC_AUTH.getProfile();
    const user    = CC_DATA.getCurrentUser();
    const prefs   = CC_AUTH.getPrefs();

    // Merge stored profile with mock user
    const p = { ...user, ...profile };

    container.innerHTML = `
    <div class="profile-page animate-fade-in">

      <!-- Cover Photo -->
      <div class="profile-cover">
        <button class="profile-cover-edit" onclick="CC_AUTH.showToast('📷 Cover photo — coming soon!')">
          ✏️ Edit Cover
        </button>
      </div>

      <!-- Profile Info -->
      <div class="profile-info-section">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div class="profile-avatar-wrap">
            <div class="avatar avatar-2xl avatar-gradient-${p.avatarGradient || 0}">${p.initials || 'NR'}</div>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:4px;flex-wrap:wrap">
            ${p.isFree ? `<span class="free-pill">🟢 Free Now</span>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="CC_PROFILE.toggleEdit()">
              ${editMode ? '✓ Done' : '✏️ Edit Profile'}
            </button>
            <button class="btn btn-primary btn-sm" onclick="CC_APP.navigate('/free')">🟢 Go Free Now</button>
          </div>
        </div>

        <div class="profile-name mt-1">${p.name || 'Nikhil Rathore'}</div>
        <div class="profile-course">${p.course || 'B.Tech'} ${p.branch || 'CSE AI & DS'} • ${p.year || 3}${(p.year||3)===1?'st':(p.year||3)===2?'nd':'rd'} Year • Section ${p.section || 'A'}</div>
        <p class="profile-bio">${p.bio || 'AI enthusiast, gamer, and chai lover. Always up for late-night coding sessions or a quick badminton match.'}</p>

        <!-- Stats Row -->
        <div class="profile-stats">
          <div class="profile-stat">
            <div class="profile-stat-num">${CC_AUTH.getConnected().length + (p.connections || 24)}</div>
            <div class="profile-stat-label">Connections</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-num">${p.activitiesCreated || 5}</div>
            <div class="profile-stat-label">Activities</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-num">${p.groupsJoined || 3}</div>
            <div class="profile-stat-label">Groups</div>
          </div>
          <div class="profile-stat">
            <div class="profile-stat-num">${(p.badges || []).length}</div>
            <div class="profile-stat-label">Badges</div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div style="border-bottom:1px solid var(--border);padding:0 16px">
        <div class="tabs-underline" style="margin-bottom:0;max-width:760px;margin:0 auto">
          <button class="tab-btn-underline ${activeTab==='overview'?'active':''}" onclick="CC_PROFILE.switchTab('overview')">Overview</button>
          <button class="tab-btn-underline ${activeTab==='interests'?'active':''}" onclick="CC_PROFILE.switchTab('interests')">Interests & Skills</button>
          <button class="tab-btn-underline ${activeTab==='badges'?'active':''}" onclick="CC_PROFILE.switchTab('badges')">Badges</button>
          <button class="tab-btn-underline ${activeTab==='privacy'?'active':''}" onclick="CC_PROFILE.switchTab('privacy')">Privacy</button>
          <button class="tab-btn-underline" onclick="CC_PROFILE.logout()" style="color:var(--danger)">Log Out</button>
        </div>
      </div>

      <!-- Tab Content -->
      <div id="profile-tab-content">
        ${renderTabContent(activeTab, p, prefs)}
      </div>

    </div>
    `;
  }

  function renderTabContent(tab, p, prefs) {
    switch (tab) {
      case 'overview':   return renderOverviewTab(p);
      case 'interests':  return renderInterestsTab(p);
      case 'badges':     return renderBadgesTab(p);
      case 'privacy':    return renderPrivacyTab(prefs);
      default:           return '';
    }
  }

  function renderOverviewTab(p) {
    return `
      <!-- Edit Form or View -->
      <div class="profile-section">
        <div class="profile-section-title">About</div>
        ${editMode ? `
          <div class="form-group">
            <label class="form-label">Bio</label>
            <textarea class="form-control" id="edit-bio" rows="3">${p.bio || ''}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Course</label>
              <input type="text" class="form-control" id="edit-course" value="${p.course || 'B.Tech'}">
            </div>
            <div class="form-group">
              <label class="form-label">Branch</label>
              <input type="text" class="form-control" id="edit-branch" value="${p.branch || 'CSE AI & DS'}">
            </div>
          </div>
          <button class="btn btn-primary" onclick="CC_PROFILE.saveProfile()">💾 Save Changes</button>
        ` : `
          <p class="text-secondary" style="font-size:14px;line-height:1.65">${p.bio || 'No bio yet. Add one in Edit Profile!'}</p>
        `}
      </div>

      <!-- Availability -->
      <div class="profile-section">
        <div class="profile-section-title">Availability</div>
        <div class="flex flex-wrap gap-2">
          ${(p.availability || ['Evening', 'After 5 PM']).map(a => `<span class="chip chip-primary chip-sm">${a}</span>`).join('')}
        </div>
      </div>

      <!-- Activity Preferences -->
      <div class="profile-section">
        <div class="profile-section-title">Preferred Campus Activities</div>
        <div class="flex flex-wrap gap-2">
          ${(p.activities || ['Study', 'Gaming', 'Sports', 'Project Work']).map(a => {
            const act = CC_DATA.activityTypes.find(t => t.name === a);
            return `<span class="chip chip-default">${act?.emoji || '🎯'} ${a}</span>`;
          }).join('')}
        </div>
      </div>

      <!-- Email (private) -->
      <div class="profile-section">
        <div class="profile-section-title">Account Info</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;align-items:center;gap:10px;font-size:14px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
            <span style="color:var(--text-secondary)">${p.email || 'nikhil.rathore@jecrcuniversity.edu.in'}</span>
            <span class="chip chip-success chip-sm">✓ Verified</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:14px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span style="color:var(--text-secondary)">JECRC University Student</span>
            <span class="chip chip-primary chip-sm">✓ JECRC</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderInterestsTab(p) {
    return `
      <!-- Interests -->
      <div class="profile-section">
        <div class="profile-section-title">Interests</div>
        <div class="interest-grid">
          ${(p.interests || ['Coding', 'AI/ML', 'Gaming', 'Cricket', 'Movies']).map(i => {
            const item = CC_DATA.interestsList.find(il => il.name === i);
            return `<span class="chip chip-primary">${item?.emoji || '✨'} ${i}</span>`;
          }).join('')}
          ${editMode ? `<button class="chip chip-default" onclick="CC_PROFILE.editInterests()">+ Edit</button>` : ''}
        </div>
      </div>

      <!-- Skills -->
      <div class="profile-section">
        <div class="profile-section-title">Skills</div>
        <div class="flex flex-wrap gap-2">
          ${(p.skills || ['Python', 'React', 'Machine Learning', 'Data Analysis']).map(s =>
            `<span class="chip chip-success">${s}</span>`
          ).join('')}
          ${editMode ? `<button class="chip chip-default" onclick="CC_AUTH.showToast('Edit skills in profile settings.')">+ Add</button>` : ''}
        </div>
      </div>

      <!-- Hobbies -->
      <div class="profile-section">
        <div class="profile-section-title">Hobbies</div>
        <div class="flex flex-wrap gap-2">
          ${(p.hobbies || ['Gaming', 'Photography', 'Badminton']).map(h =>
            `<span class="chip chip-orange">${h}</span>`
          ).join('')}
        </div>
      </div>

      <!-- Skill Exchange -->
      <div class="profile-section">
        <div class="profile-section-title">Skill Exchange</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:var(--radius);padding:14px">
            <div class="skill-section-label skill-can mb-2">✅ I Can Teach</div>
            <div class="flex flex-wrap gap-1">
              ${['Python', 'React', 'Machine Learning'].map(s => `<span class="chip chip-success chip-sm">${s}</span>`).join('')}
            </div>
          </div>
          <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:var(--radius);padding:14px">
            <div class="skill-section-label skill-want mb-2">🎯 Want to Learn</div>
            <div class="flex flex-wrap gap-1">
              ${['Figma', 'Video Editing'].map(s => `<span class="chip chip-primary chip-sm">${s}</span>`).join('')}
            </div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm mt-3" onclick="CC_APP.navigate('/discover')">⚡ View Skill Exchange →</button>
      </div>
    `;
  }

  function renderBadgesTab(p) {
    const earned = p.badges || ['campus-explorer', 'community-builder', 'activity-creator'];

    return `
      <!-- Earned Badges -->
      <div class="profile-section">
        <div class="profile-section-title">Earned Badges (${earned.length})</div>
        <div class="badges-grid">
          ${earned.map(key => {
            const badge = CC_DATA.badges[key];
            return badge ? `
              <div class="achievement-badge">
                <div class="achievement-icon">${badge.emoji}</div>
                <div>
                  <div class="achievement-name">${badge.name}</div>
                  <div class="achievement-desc">${badge.desc}</div>
                </div>
              </div>
            ` : '';
          }).join('')}
        </div>
      </div>

      <!-- Locked Badges -->
      <div class="profile-section">
        <div class="profile-section-title">Badges to Unlock</div>
        <div class="badges-grid">
          ${Object.entries(CC_DATA.badges).filter(([k]) => !earned.includes(k)).map(([key, badge]) => `
            <div class="achievement-badge" style="opacity:0.5;filter:grayscale(1)">
              <div class="achievement-icon">${badge.emoji}</div>
              <div>
                <div class="achievement-name">${badge.name}</div>
                <div class="achievement-desc">${badge.desc}</div>
              </div>
            </div>
          `).join('')}
          ${Object.keys(CC_DATA.badges).every(k => earned.includes(k)) ? `
            <div class="empty-state" style="padding:24px"><p>🎉 All badges earned! You're a campus champion.</p></div>
          ` : ''}
        </div>
      </div>

      <!-- Challenges quick link -->
      <div class="profile-section">
        <button class="btn btn-primary btn-block" onclick="CC_APP.navigate('/activities')">
          🏆 View Together Challenges →
        </button>
      </div>
    `;
  }

  function renderPrivacyTab(prefs) {
    const settings = [
      { key: 'showInFreeNow',       label: 'Show in "People Free Now"',      desc: 'Others can see you when you activate free status',   default: true  },
      { key: 'showInSuggestions',   label: 'Appear in suggestions',           desc: 'Let others discover you via interest matching',       default: true  },
      { key: 'showActivityHistory', label: 'Show my activity history',        desc: 'Others can see activities you\'ve joined',            default: true  },
    ];

    return `
      <div class="profile-section">
        <div class="profile-section-title">Privacy Controls</div>
        <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:var(--radius);padding:12px;margin-bottom:20px;font-size:13px;color:var(--text-secondary)">
          🔒 Your phone number and exact location are never shared. Only general campus areas are shown.
        </div>

        ${settings.map(s => `
          <div class="privacy-item">
            <div>
              <div class="privacy-label">${s.label}</div>
              <div class="privacy-desc">${s.desc}</div>
            </div>
            <label class="toggle-label">
              <input type="checkbox" class="toggle-input" ${prefs[s.key] !== false ? 'checked' : ''}
                     onchange="CC_PROFILE.updatePref('${s.key}', this.checked)">
              <div class="toggle-track"></div>
            </label>
          </div>
        `).join('')}

        <div class="privacy-item">
          <div>
            <div class="privacy-label">Who can message me</div>
            <div class="privacy-desc">Control who can send you direct messages</div>
          </div>
          <select class="form-control" style="width:140px;padding:6px 10px;font-size:13px"
                  onchange="CC_AUTH.updatePrefs({allowMessages:this.value})">
            <option value="all" ${prefs.allowMessages==='all'?'selected':''}>Everyone</option>
            <option value="connections" ${prefs.allowMessages==='connections'?'selected':''}>Connections only</option>
            <option value="none" ${prefs.allowMessages==='none'?'selected':''}>No one</option>
          </select>
        </div>

        <div class="privacy-item">
          <div>
            <div class="privacy-label">Dark Mode</div>
            <div class="privacy-desc">Switch between light and dark theme</div>
          </div>
          <label class="toggle-label">
            <input type="checkbox" class="toggle-input" ${prefs.theme==='dark'?'checked':''}
                   onchange="CC_AUTH.applyTheme(this.checked?'dark':'light')">
            <div class="toggle-track"></div>
          </label>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title" style="color:var(--danger)">Danger Zone</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-secondary btn-sm" onclick="CC_AUTH.showToast('📋 Account deactivation — contact admin.')">
            Deactivate Account
          </button>
          <button class="btn btn-danger btn-sm" onclick="CC_AUTH.showToast('⚠️ This action is irreversible. Contact admin.')">
            Delete Account
          </button>
        </div>
      </div>
    `;
  }

  function switchTab(tab) {
    activeTab = tab;
    const profile = CC_AUTH.getProfile();
    const user    = CC_DATA.getCurrentUser();
    const prefs   = CC_AUTH.getPrefs();
    const p       = { ...user, ...profile };
    const content = document.getElementById('profile-tab-content');
    if (content) content.innerHTML = renderTabContent(tab, p, prefs);

    document.querySelectorAll('.tab-btn-underline').forEach(b => {
      b.classList.toggle('active', !b.getAttribute('onclick')?.includes('logout') && b.textContent.toLowerCase().includes(tab.split(' ')[0].toLowerCase()));
    });
  }

  function toggleEdit() {
    editMode = !editMode;
    render(document.getElementById('cc-main'));
  }

  function saveProfile() {
    const bio    = document.getElementById('edit-bio')?.value;
    const course = document.getElementById('edit-course')?.value;
    const branch = document.getElementById('edit-branch')?.value;
    CC_AUTH.updateProfile({ bio, course, branch });
    editMode = false;
    CC_AUTH.showToast('✅ Profile updated!');
    render(document.getElementById('cc-main'));
  }

  function editInterests() {
    CC_AUTH.showToast('✨ Interest editing — use onboarding flow to update.');
  }

  function updatePref(key, value) {
    CC_AUTH.updatePrefs({ [key]: value });
    CC_AUTH.showToast(`✅ ${key} updated.`);
  }

  function logout() {
    CC_MODALS.open(`
      <div style="text-align:center;padding:8px 0">
        <div style="font-size:48px;margin-bottom:16px">👋</div>
        <div class="modal-title">Log Out?</div>
        <div class="modal-subtitle">You'll need to log back in with your JECRC University email.</div>
        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="btn btn-secondary flex-1" onclick="CC_MODALS.close()">Cancel</button>
          <button class="btn btn-danger flex-1" onclick="CC_PROFILE.confirmLogout()">Log Out</button>
        </div>
      </div>
    `);
  }

  function confirmLogout() {
    CC_MODALS.close();
    CC_AUTH.logout();
    CC_AUTH.showToast('👋 Logged out successfully.');
    setTimeout(() => CC_APP.navigate('/', true), 500);
  }

  return { render, switchTab, toggleEdit, saveProfile, editInterests, updatePref, logout, confirmLogout };
})();
