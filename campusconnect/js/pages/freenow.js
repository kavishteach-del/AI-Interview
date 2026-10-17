/* ============================================
   CampusConnect — I'm Free Now Page
   ============================================ */

window.CC_FREE_NOW = (function() {

  let selectedDuration = null;
  let selectedActivities = [];
  let selectedLocation = null;

  function render(container) {
    const freeStatus = CC_AUTH.getFreeStatus();
    const freeStudents = CC_DATA.getFreeStudents();

    // Load existing selections
    if (freeStatus.active) {
      selectedDuration   = freeStatus.duration;
      selectedActivities = freeStatus.activities || [];
      selectedLocation   = freeStatus.location;
    }

    container.innerHTML = `
    <div class="free-now-page animate-fade-in">

      <!-- Page Header -->
      <div class="section-header mb-4">
        <div>
          <h1 style="font-size:22px;font-weight:800">🟢 I'm Free Now</h1>
          <p class="text-secondary text-sm">Let others know you're available on campus.</p>
        </div>
      </div>

      <!-- Toggle Card -->
      <div class="free-now-toggle-card ${freeStatus.active ? 'active' : ''}" id="free-toggle-card">
        <div style="font-size:52px;margin-bottom:12px">${freeStatus.active ? '🟢' : '⭕'}</div>
        <h2 style="font-size:20px;font-weight:800;margin-bottom:4px">
          ${freeStatus.active ? 'You\'re Visible on Campus' : 'Activate Free Status'}
        </h2>
        <p class="text-secondary text-sm mb-4">
          ${freeStatus.active
            ? `Active for ${freeStatus.duration} • Others can see you and connect`
            : 'Tell others you\'re free and what you want to do'}
        </p>
        <button class="btn ${freeStatus.active ? 'btn-danger' : 'btn-success'} btn-lg"
                id="free-toggle-btn"
                onclick="CC_FREE_NOW.toggleFreeStatus()">
          ${freeStatus.active ? '🔴 Go Offline' : '🟢 Go Free Now'}
        </button>
      </div>

      <!-- Configuration (shown when not active or configuring) -->
      <div id="free-config" class="${freeStatus.active ? 'hidden' : ''}">

        <!-- Duration -->
        <div class="dashboard-section">
          <h3 style="font-size:15px;font-weight:700;margin-bottom:12px">⏱️ I'm free for...</h3>
          <div class="duration-grid">
            ${['15 minutes', '30 minutes', '1 hour', '2+ hours'].map(d => `
              <button class="duration-btn ${selectedDuration === d ? 'selected' : ''}"
                      onclick="CC_FREE_NOW.selectDuration('${d}', this)">
                <div class="duration-btn-time">${d === '15 minutes' ? '15 min' : d === '30 minutes' ? '30 min' : d === '1 hour' ? '1 hr' : '2+ hrs'}</div>
                <div class="duration-btn-label">${d}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Activity -->
        <div class="dashboard-section">
          <h3 style="font-size:15px;font-weight:700;margin-bottom:12px">🎯 Looking for...</h3>
          <div class="activity-select-grid">
            ${CC_DATA.activityTypes.map(a => `
              <button class="activity-select-btn ${selectedActivities.includes(a.name) ? 'selected' : ''}"
                      onclick="CC_FREE_NOW.toggleActivitySelect('${a.name}', this)">
                ${a.emoji} ${a.name}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Location -->
        <div class="dashboard-section">
          <h3 style="font-size:15px;font-weight:700;margin-bottom:12px">📍 Campus Area (optional)</h3>
          <div class="location-select-grid">
            ${CC_DATA.campusAreas.map(a => `
              <button class="location-btn ${selectedLocation === a.name ? 'selected' : ''}"
                      onclick="CC_FREE_NOW.selectLocation('${a.name}', this)">
                ${a.emoji} ${a.name}
              </button>
            `).join('')}
          </div>
          <p class="form-hint mt-2">📌 Only general area is shared — not your exact location.</p>
        </div>

        <!-- Preview Card -->
        <div class="dashboard-section">
          <h3 style="font-size:15px;font-weight:700;margin-bottom:12px">👁️ Preview — how others see you</h3>
          <div class="preview-card">
            <div class="preview-label">Your Card Preview</div>
            ${renderPreviewCard()}
          </div>
        </div>

        <!-- Activate Button -->
        <button class="btn btn-success btn-block btn-lg mb-6" onclick="CC_FREE_NOW.activateFreeNow()">
          🟢 Go Free Now
        </button>

      </div>

      <!-- People Free Now -->
      <div class="dashboard-section" id="free-people-section">
        <div class="section-header">
          <span class="section-title">People Free Now (${freeStudents.length})</span>
          <span class="section-link" onclick="CC_APP.navigate('/discover')">See all</span>
        </div>
        <div class="people-free-grid">
          ${freeStudents.map(s => renderFreePersonCard(s)).join('')}
        </div>
      </div>

    </div>
    `;
  }

  function renderPreviewCard() {
    const profile = CC_AUTH.getProfile();
    const initials = profile.initials || 'NR';
    const avatarClass = `avatar-gradient-${profile.avatarGradient || 0}`;

    return `
      <div class="person-card" style="border-color:var(--success);background:rgba(16,185,129,0.03)">
        <div class="person-card-header">
          <div class="avatar avatar-md ${avatarClass}">${initials}</div>
          <div class="person-card-info">
            <div class="person-card-name">${profile.name || 'Your Name'}</div>
            <div class="person-card-meta">${profile.branch || 'CSE AI & DS'} • ${profile.year || 3}${(profile.year||3)===1?'st':(profile.year||3)===2?'nd':'rd'} Year</div>
            <div class="mt-1">
              <span class="free-pill">Free for ${selectedDuration || '?'}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1 mt-1">
          ${selectedActivities.length > 0
            ? selectedActivities.map(a => `<span class="chip chip-success chip-sm">${a}</span>`).join('')
            : '<span class="chip chip-default chip-sm">Select activities above</span>'
          }
          ${selectedLocation ? `<span class="chip chip-default chip-sm">📍 ${selectedLocation}</span>` : ''}
        </div>
      </div>
    `;
  }

  function renderFreePersonCard(student) {
    const avatarClass = `avatar-gradient-${student.avatarGradient}`;
    return `
      <div class="person-card">
        <div class="person-card-header">
          <div class="avatar avatar-md ${avatarClass}" style="cursor:pointer" onclick="CC_MODALS.openConnectModal(${JSON.stringify(student).replace(/"/g, '&quot;')})">
            ${student.initials}
          </div>
          <div class="person-card-info">
            <div class="person-card-name">${student.name}</div>
            <div class="person-card-meta">${student.branch} • ${student.year}${student.year===1?'st':student.year===2?'nd':student.year===3?'rd':'th'} Year</div>
            <div class="mt-1"><span class="free-pill">Free for ${student.freeFor}</span></div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1">
          ${(student.freeActivity || []).map(a => `<span class="chip chip-success chip-sm">${a}</span>`).join('')}
          <span class="chip chip-default chip-sm">📍 ${student.campusArea}</span>
        </div>
        <div class="person-card-actions mt-2">
          <button class="btn btn-sm btn-secondary flex-1" onclick="CC_MODALS.openIceBreaker('${student.name.split(' ')[0]}')">🧊 Ice Break</button>
          <button class="btn btn-sm btn-primary flex-1" onclick="handleConnect('${student.id}', '${student.name}', this)">
            ${CC_AUTH.isConnected(student.id) ? '✓ Connected' : '🤝 Connect'}
          </button>
        </div>
      </div>
    `;
  }

  // ---- Actions ----
  function selectDuration(duration, btn) {
    selectedDuration = duration;
    document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    refreshPreview();
  }

  function toggleActivitySelect(name, btn) {
    btn.classList.toggle('selected');
    const idx = selectedActivities.indexOf(name);
    if (idx === -1) selectedActivities.push(name);
    else selectedActivities.splice(idx, 1);
    refreshPreview();
  }

  function selectLocation(name, btn) {
    selectedLocation = name;
    document.querySelectorAll('.location-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    refreshPreview();
  }

  function refreshPreview() {
    const previewEl = document.querySelector('.preview-card');
    if (previewEl) {
      previewEl.innerHTML = `<div class="preview-label">Your Card Preview</div>` + renderPreviewCard().replace(/<div class="preview-card">|<\/div>$/, '');
      // Simpler: just replace inner content
      previewEl.innerHTML = `<div class="preview-label">Your Card Preview</div>${renderPreviewCard().replace(/class="preview-card"/, 'class="preview-card-inner"')}`;
    }
  }

  function activateFreeNow() {
    if (!selectedDuration) {
      CC_AUTH.showToast('⚠️ Please select how long you\'re free.');
      return;
    }
    if (selectedActivities.length === 0) {
      CC_AUTH.showToast('⚠️ Please select at least one activity.');
      return;
    }

    // Calculate expiry
    const durationMs = {
      '15 minutes': 15 * 60 * 1000,
      '30 minutes': 30 * 60 * 1000,
      '1 hour': 60 * 60 * 1000,
      '2+ hours': 2 * 60 * 60 * 1000,
    }[selectedDuration] || 60 * 60 * 1000;

    CC_AUTH.setFreeStatus({
      active: true,
      duration: selectedDuration,
      activities: selectedActivities,
      location: selectedLocation || 'Campus',
      expiresAt: Date.now() + durationMs,
    });

    CC_AUTH.showToast('🟢 You\'re now visible to other students!');
    CC_APP.renderRoute();
  }

  function toggleFreeStatus() {
    const status = CC_AUTH.getFreeStatus();
    if (status.active) {
      CC_AUTH.clearFreeStatus();
      selectedDuration = null;
      selectedActivities = [];
      selectedLocation = null;
      CC_AUTH.showToast('🔴 Free status deactivated.');
    } else {
      activateFreeNow();
      return;
    }
    CC_APP.renderRoute();
  }

  return { render, selectDuration, toggleActivitySelect, selectLocation, activateFreeNow, toggleFreeStatus };
})();
