/* ============================================
   CampusConnect — Discover Page
   Find My People, Partners, Random Chai,
   Skill Exchange, Interest Circles
   ============================================ */

window.CC_DISCOVER = (function() {

  let activeTab = 'people';

  function render(container) {
    const suggestions = CC_DATA.getMatchingStudents('stu-001', 10);

    container.innerHTML = `
    <div class="discover-page animate-fade-in">

      <!-- Hero Banner -->
      <div class="discover-hero mb-4">
        <div style="position:relative;z-index:1">
          <h1 style="font-size:22px;font-weight:800;margin-bottom:4px;color:#fff">👥 Find My People</h1>
          <p style="font-size:14px;opacity:0.9;color:#fff;margin-bottom:16px">
            Discover JECRC students who share your interests, skills, and campus vibe.
          </p>
          <div style="display:flex;gap:8px;align-items:center">
            <div style="background:rgba(255,255,255,0.15);border-radius:var(--radius-full);padding:6px 14px;font-size:13px;color:#fff">
              🤝 ${CC_DATA.students.length - 1} students to discover
            </div>
            <div style="background:rgba(255,255,255,0.15);border-radius:var(--radius-full);padding:6px 14px;font-size:13px;color:#fff">
              🔥 ${CC_DATA.getFreeStudents().length} free now
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-underline">
        <button class="tab-btn-underline ${activeTab==='people'?'active':''}" onclick="CC_DISCOVER.switchTab('people')">👥 Find People</button>
        <button class="tab-btn-underline ${activeTab==='partner'?'active':''}" onclick="CC_DISCOVER.switchTab('partner')">🤝 Find Partners</button>
        <button class="tab-btn-underline ${activeTab==='circles'?'active':''}" onclick="CC_DISCOVER.switchTab('circles')">🌐 Circles</button>
        <button class="tab-btn-underline ${activeTab==='skills'?'active':''}" onclick="CC_DISCOVER.switchTab('skills')">💡 Skill Exchange</button>
        <button class="tab-btn-underline ${activeTab==='chai'?'active':''}" onclick="CC_DISCOVER.switchTab('chai')">☕ Random Chai</button>
      </div>

      <!-- Tab Content -->
      <div id="discover-tab-content">
        ${renderTabContent(activeTab, suggestions)}
      </div>

    </div>
    `;
  }

  function renderTabContent(tab, suggestions) {
    switch (tab) {
      case 'people':  return renderPeopleTab(suggestions);
      case 'partner': return renderPartnerTab();
      case 'circles': return renderCirclesTab();
      case 'skills':  return renderSkillsTab();
      case 'chai':    return renderChaiTab();
      default:        return '';
    }
  }

  function renderPeopleTab(suggestions) {
    const allStudents = CC_DATA.getStudentsExceptCurrent();
    const freeNow     = CC_DATA.getFreeStudents();

    return `
      <!-- Filter Chips -->
      <div class="flex flex-wrap gap-2 mb-4">
        <button class="chip chip-primary" style="cursor:pointer" onclick="CC_AUTH.showToast('Showing: All Students')">All Students</button>
        <button class="chip chip-default" style="cursor:pointer" onclick="CC_AUTH.showToast('Showing: Free Now')">🟢 Free Now</button>
        <button class="chip chip-default" style="cursor:pointer" onclick="CC_AUTH.showToast('Showing: Same Branch')">Same Branch</button>
        <button class="chip chip-default" style="cursor:pointer" onclick="CC_AUTH.showToast('Showing: Same Year')">Same Year</button>
        <button class="chip chip-default" style="cursor:pointer" onclick="CC_AUTH.showToast('Showing: Common Interests')">Common Interests</button>
      </div>

      <!-- Suggestions heading -->
      <div class="section-header">
        <span class="section-title">✨ Best Matches for You</span>
        <span class="text-muted text-sm">${suggestions.length} people</span>
      </div>
      <div class="people-cards-grid mb-6">
        ${suggestions.map(s => renderPersonCard(s, true)).join('')}
      </div>

      <!-- All students -->
      <div class="section-header">
        <span class="section-title">👥 All Students</span>
      </div>
      <div class="people-cards-grid">
        ${allStudents.slice(0, 8).map(s => {
          const user    = CC_DATA.getCurrentUser();
          const common  = s.interests.filter(i => user.interests.includes(i));
          return renderPersonCard({ ...s, commonInterests: common }, false);
        }).join('')}
      </div>
    `;
  }

  function renderPersonCard(student, showMatch) {
    const avatarClass = `avatar-gradient-${student.avatarGradient}`;
    const common      = student.commonInterests || [];

    return `
      <div class="person-card" style="cursor:default">
        <div class="person-card-header">
          <div class="avatar avatar-md ${avatarClass}" style="cursor:pointer"
               onclick="CC_MODALS.openConnectModal(${JSON.stringify(student).replace(/"/g,'&quot;')})">
            ${student.initials}
          </div>
          <div class="person-card-info">
            <div class="person-card-name">${student.name}</div>
            <div class="person-card-meta">${student.branch} • ${student.year}${student.year===1?'st':student.year===2?'nd':student.year===3?'rd':'th'} Year</div>
            ${student.isFree ? `<div class="mt-1"><span class="free-pill">Free Now</span></div>` : ''}
          </div>
        </div>

        ${student.bio ? `<p class="text-secondary" style="font-size:12.5px;font-style:italic;margin-top:-4px">"${student.bio.slice(0,80)}${student.bio.length>80?'…':''}"</p>` : ''}

        <div class="flex flex-wrap gap-1">
          ${student.interests.slice(0, 4).map(i => `<span class="chip chip-primary chip-sm">${i}</span>`).join('')}
        </div>

        ${showMatch && common.length > 0 ? `
          <div style="font-size:12px;color:var(--primary);font-weight:600">
            ✨ ${common.length} interest${common.length>1?'s':''} in common: ${common.slice(0,2).join(', ')}${common.length>2?'…':''}
          </div>
        ` : ''}

        <div class="person-card-actions">
          <button class="btn btn-sm btn-secondary flex-1" onclick="CC_MODALS.openIceBreaker('${student.name.split(' ')[0]}')">🧊 Ice Break</button>
          <button class="btn btn-sm btn-primary flex-1" id="connect-btn-${student.id}"
                  onclick="handleConnect('${student.id}','${student.name}',this)">
            ${CC_AUTH.isConnected(student.id) ? '✓ Connected' : '🤝 Connect'}
          </button>
        </div>
      </div>
    `;
  }

  function renderPartnerTab() {
    return `
      <div class="section-header mb-2">
        <span class="section-title">🤝 Find a Partner</span>
      </div>
      <p class="text-secondary text-sm mb-4">Connect with students who need exactly what you offer.</p>

      <!-- Partner Type Filter -->
      <div class="flex flex-wrap gap-2 mb-4">
        ${['📚 Study', '💻 Project', '🏸 Sports', '🎥 Content', '🎮 Gaming', '🚶 Walk'].map(t => `
          <button class="chip chip-selectable" onclick="this.classList.toggle('selected')">${t}</button>
        `).join('')}
      </div>

      <!-- Partner Requests -->
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">
        ${CC_DATA.partnerRequests.map(pr => {
          const student = CC_DATA.getStudent(pr.studentId);
          return `
            <div class="partner-card">
              <div class="partner-type-badge">${pr.type}</div>
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <div class="avatar avatar-sm avatar-gradient-${student?.avatarGradient||0}">${student?.initials||'?'}</div>
                <div>
                  <div style="font-size:14px;font-weight:700">${student?.name || 'Student'}</div>
                  <div style="font-size:12px;color:var(--text-secondary)">${student?.branch} • ${student?.year}${student?.year===1?'st':student?.year===2?'nd':student?.year===3?'rd':'th'} Year</div>
                </div>
              </div>
              <p class="text-secondary" style="font-size:13px;margin-bottom:10px">${pr.desc}</p>
              <div class="flex flex-wrap gap-1 mb-3">
                ${pr.skills.map(s => `<span class="chip chip-cyan chip-sm">${s}</span>`).join('')}
              </div>
              <div class="flex gap-2">
                <span class="chip chip-default chip-sm">👥 ${pr.openings} spot${pr.openings>1?'s':''} left</span>
                <button class="btn btn-sm btn-primary" style="margin-left:auto"
                        onclick="handleConnect('${pr.studentId}','${student?.name||'Student'}',this)">
                  ${CC_AUTH.isConnected(pr.studentId) ? '✓ Connected' : 'Connect'}
                </button>
              </div>
            </div>
          `;
        }).join('')}

        <!-- Create own request -->
        <div class="partner-card" style="border:2px dashed var(--border);background:var(--bg-secondary);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:180px;cursor:pointer"
             onclick="CC_MODALS.openCreateActivity()">
          <div style="font-size:36px;margin-bottom:10px">➕</div>
          <div style="font-size:14px;font-weight:700;margin-bottom:4px">Post Your Request</div>
          <div style="font-size:12px;color:var(--text-secondary)">Looking for a study/project/sports partner? Let others find you.</div>
        </div>
      </div>
    `;
  }

  function renderCirclesTab() {
    return `
      <div class="section-header mb-2">
        <span class="section-title">🌐 Interest Circles</span>
      </div>
      <p class="text-secondary text-sm mb-4">Join communities of students who share your passion.</p>
      <div class="circles-grid">
        ${CC_DATA.circles.map(c => `
          <div class="circle-card" onclick="CC_DISCOVER.openCircle('${c.id}','${c.name}')">
            <div class="circle-icon">${c.emoji}</div>
            <div class="circle-name">${c.name}</div>
            <div class="circle-members">👥 ${c.members} members</div>
            <p class="text-secondary" style="font-size:12px;margin-top:6px">${c.desc}</p>
            <button class="btn btn-sm btn-primary w-full mt-3"
                    onclick="event.stopPropagation();CC_AUTH.showToast('✅ Joined ${c.name}!')">
              Join Circle
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderSkillsTab() {
    return `
      <div class="section-header mb-2">
        <span class="section-title">💡 Skill Exchange</span>
      </div>
      <p class="text-secondary text-sm mb-4">Teach what you know. Learn what you don't.</p>

      <!-- My Skill Exchange Card -->
      <div class="card-hero mb-5" style="position:relative;overflow:hidden">
        <div style="position:relative;z-index:1">
          <div style="font-size:13px;font-weight:700;opacity:0.8;margin-bottom:10px">YOUR SKILL EXCHANGE CARD</div>
          <div class="flex gap-4 flex-wrap">
            <div style="flex:1;min-width:140px">
              <div class="skill-section-label skill-can mb-2">✅ I Can Teach</div>
              <div class="flex flex-wrap gap-1">
                ${['Python', 'React', 'Machine Learning'].map(s => `
                  <span style="background:rgba(255,255,255,0.2);color:#fff;border-radius:var(--radius-full);padding:4px 10px;font-size:12px;font-weight:600">${s}</span>
                `).join('')}
                <button style="background:rgba(255,255,255,0.15);color:#fff;border-radius:var(--radius-full);padding:4px 10px;font-size:12px;border:1px dashed rgba(255,255,255,0.4);cursor:pointer"
                        onclick="CC_AUTH.showToast('Add your skills in Profile settings')">+ Add</button>
              </div>
            </div>
            <div style="flex:1;min-width:140px">
              <div style="font-size:11px;font-weight:700;opacity:0.8;text-transform:uppercase;margin-bottom:8px">🎯 I Want to Learn</div>
              <div class="flex flex-wrap gap-1">
                ${['Figma', 'Video Editing'].map(s => `
                  <span style="background:rgba(255,255,255,0.2);color:#fff;border-radius:var(--radius-full);padding:4px 10px;font-size:12px;font-weight:600">${s}</span>
                `).join('')}
                <button style="background:rgba(255,255,255,0.15);color:#fff;border-radius:var(--radius-full);padding:4px 10px;font-size:12px;border:1px dashed rgba(255,255,255,0.4);cursor:pointer"
                        onclick="CC_AUTH.showToast('Add skills you want to learn')">+ Add</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Other students' skill exchange -->
      <div class="section-header mb-3">
        <span class="section-title">Students Offering Skills</span>
      </div>
      <div class="skill-exchange-section">
        ${CC_DATA.skillExchangeProfiles.map(skex => {
          const s = CC_DATA.getStudent(skex.studentId);
          return `
            <div class="skill-card">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                <div class="avatar avatar-md avatar-gradient-${s?.avatarGradient||0}">${s?.initials||'?'}</div>
                <div>
                  <div style="font-size:14px;font-weight:700">${s?.name||'Student'}</div>
                  <div style="font-size:12px;color:var(--text-secondary)">${s?.branch} • ${s?.year}${s?.year===1?'st':s?.year===2?'nd':s?.year===3?'rd':'th'} Year</div>
                </div>
              </div>
              <div class="mb-2">
                <div class="skill-section-label skill-can">✅ Can Teach</div>
                <div class="flex flex-wrap gap-1 mt-1">
                  ${skex.canTeach.map(sk => `<span class="chip chip-success chip-sm">${sk}</span>`).join('')}
                </div>
              </div>
              <div class="mb-3">
                <div class="skill-section-label skill-want">🎯 Wants to Learn</div>
                <div class="flex flex-wrap gap-1 mt-1">
                  ${skex.wantToLearn.map(sk => `<span class="chip chip-primary chip-sm">${sk}</span>`).join('')}
                </div>
              </div>
              <button class="btn btn-sm btn-primary w-full"
                      onclick="handleConnect('${skex.studentId}','${s?.name||'Student'}',this)">
                ${CC_AUTH.isConnected(skex.studentId) ? '✓ Connected' : '🤝 Connect & Exchange'}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderChaiTab() {
    const currentUser  = CC_DATA.getCurrentUser();
    const suggestions  = CC_DATA.getMatchingStudents('stu-001', 3);

    return `
      <div class="chai-card">
        <div class="chai-icon">☕</div>
        <div class="chai-title">Random Chai</div>
        <div class="chai-desc">
          Meet someone new from JECRC. We'll suggest a student based on your interests and schedule.
          Both of you must mutually accept before anything happens.
        </div>
        <button class="btn btn-primary btn-lg" onclick="CC_DISCOVER.findRandomChai()">
          ☕ Find My Chai Partner
        </button>
      </div>

      <div style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:14px;margin-bottom:20px;font-size:13px;color:var(--text-secondary)">
        <strong>How it works:</strong><br>
        1. Tap "Find My Chai Partner"<br>
        2. We suggest a student with similar interests<br>
        3. Both students must accept<br>
        4. Connect and decide where to meet for chai! ☕
      </div>

      <div class="section-header mb-3">
        <span class="section-title">✨ Suggested for You</span>
      </div>
      <div class="people-cards-grid">
        ${suggestions.map(s => renderPersonCard(s, true)).join('')}
      </div>
    `;
  }

  function switchTab(tab) {
    activeTab = tab;
    const suggestions = CC_DATA.getMatchingStudents('stu-001', 10);
    const content = document.getElementById('discover-tab-content');
    if (content) content.innerHTML = renderTabContent(tab, suggestions);

    document.querySelectorAll('.tab-btn-underline').forEach(b => b.classList.remove('active'));
    const tabs = { people:'people', partner:'partner', circles:'circles', skills:'skills', chai:'chai' };
    document.querySelectorAll('.tab-btn-underline').forEach(b => {
      if (b.textContent.toLowerCase().includes(tab.toLowerCase())) b.classList.add('active');
    });
  }

  function openCircle(id, name) {
    CC_AUTH.showToast(`🌐 Opening ${name}…`);
    setTimeout(() => CC_AUTH.showToast(`Welcome to ${name}! (Full circle feature coming soon)`), 1200);
  }

  function findRandomChai() {
    const suggestions = CC_DATA.getMatchingStudents('stu-001', 3);
    const pick = suggestions[Math.floor(Math.random() * suggestions.length)];
    if (!pick) return;
    CC_MODALS.open(`
      <div style="text-align:center">
        <div style="font-size:48px;margin-bottom:12px">☕</div>
        <div class="modal-title">We found someone for you!</div>
        <div class="modal-subtitle">Based on your interests and availability</div>
        <div class="avatar avatar-xl avatar-gradient-${pick.avatarGradient} mx-auto mb-3">${pick.initials}</div>
        <div style="font-size:18px;font-weight:800">${pick.name}</div>
        <div style="font-size:14px;color:var(--text-secondary);margin-bottom:12px">${pick.branch} • ${pick.year}${pick.year===1?'st':pick.year===2?'nd':pick.year===3?'rd':'th'} Year</div>
        <div class="flex flex-wrap gap-1 justify-center mb-4">
          ${pick.interests.slice(0,4).map(i=>`<span class="chip chip-primary chip-sm">${i}</span>`).join('')}
        </div>
        ${pick.commonInterests?.length > 0 ? `<p style="color:var(--primary);font-size:14px;font-weight:600;margin-bottom:16px">✨ ${pick.commonInterests.length} interests in common</p>` : ''}
        <div style="background:var(--bg-secondary);border-radius:var(--radius);padding:12px;margin-bottom:20px;font-size:13px;color:var(--text-secondary)">
          A connection request will be sent to ${pick.name.split(' ')[0]}. They'll need to accept before you can chat.
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-secondary flex-1" onclick="CC_MODALS.close()">Skip</button>
          <button class="btn btn-primary flex-1" onclick="CC_MODALS.sendConnection('${pick.id}','${pick.name}')">☕ Send Request</button>
        </div>
      </div>
    `);
  }

  return { render, switchTab, openCircle, findRandomChai };
})();
