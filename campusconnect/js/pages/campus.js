/* ============================================
   CampusConnect — Campus Map Page
   Interactive SVG campus map + Who's Around
   ============================================ */

window.CC_CAMPUS = (function() {

  let selectedZone = null;

  function render(container) {
    container.innerHTML = `
    <div class="page animate-fade-in" style="padding:0">
      <div class="campus-page-inner">

        <!-- Sidebar: Zone List -->
        <div class="campus-sidebar">
          <div class="campus-sidebar-header">
            <div class="campus-sidebar-title">📍 Campus Zones</div>
            <div class="campus-sidebar-sub">Tap a zone to see what's happening</div>
          </div>
          <div class="zone-list" id="zone-list">
            ${CC_DATA.campusAreas.map(z => renderZoneCard(z)).join('')}
          </div>
        </div>

        <!-- Map Area -->
        <div class="campus-map-area" id="campus-map-area">
          <!-- Campus Now bar -->
          <div style="position:absolute;top:12px;left:12px;right:12px;z-index:5;
                      background:var(--glass-bg);backdrop-filter:blur(12px);
                      border:1px solid var(--border);border-radius:var(--radius-md);
                      padding:12px 16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
            <div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--success)">
              <div style="width:8px;height:8px;background:var(--success);border-radius:50%;animation:pulse-dot 2s infinite"></div>
              Campus Now
            </div>
            <div style="display:flex;gap:12px;overflow-x:auto;scrollbar-width:none;flex:1">
              <span style="font-size:12px;white-space:nowrap;color:var(--text-secondary)">☕ 18 Cafeteria</span>
              <span style="font-size:12px;white-space:nowrap;color:var(--text-secondary)">📚 8 Library</span>
              <span style="font-size:12px;white-space:nowrap;color:var(--text-secondary)">🏸 14 Sports</span>
              <span style="font-size:12px;white-space:nowrap;color:var(--text-secondary)">💻 11 Labs</span>
              <span style="font-size:12px;white-space:nowrap;color:var(--text-secondary)">🌿 5 Plaza</span>
              <span style="font-size:12px;white-space:nowrap;color:var(--text-secondary)">🎤 22 Auditorium</span>
            </div>
          </div>

          <!-- SVG Map -->
          <div class="campus-svg-wrap" style="padding-top:72px">
            ${renderCampusSVG()}
          </div>

          <!-- Zone Detail Panel -->
          <div class="zone-detail-panel hidden" id="zone-detail-panel"></div>
        </div>

      </div>
    </div>
    `;

    attachMapEvents();
  }

  function renderZoneCard(zone) {
    return `
      <div class="zone-card" id="zone-card-${zone.id}" onclick="CC_CAMPUS.selectZone('${zone.id}')">
        <div class="zone-card-header">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:20px">${zone.emoji}</span>
            <span class="zone-name">${zone.name}</span>
          </div>
          <div class="zone-count">
            <div style="width:7px;height:7px;background:var(--success);border-radius:50%;animation:pulse-dot 2s infinite"></div>
            ${zone.activeCount}
          </div>
        </div>
        <div class="zone-activities">
          ${zone.activities.map(a => `<span class="chip chip-default chip-sm">${a}</span>`).join('')}
        </div>
      </div>
    `;
  }

  function renderCampusSVG() {
    const zones = CC_DATA.campusAreas;
    // Build SVG with labeled zones
    const svgWidth  = 620;
    const svgHeight = 480;

    const zoneRects = zones.map(z => {
      const isSelected = selectedZone === z.id;
      return `
        <g class="campus-zone" onclick="CC_CAMPUS.selectZone('${z.id}')" style="cursor:pointer">
          <rect x="${z.svgX}" y="${z.svgY}" width="${z.svgW}" height="${z.svgH}"
                rx="10" ry="10"
                fill="${isSelected ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.08)'}"
                stroke="${isSelected ? '#6366f1' : 'rgba(99,102,241,0.3)'}"
                stroke-width="${isSelected ? 2.5 : 1.5}"
                style="transition:all 0.2s ease" />
          <text x="${z.svgX + z.svgW/2}" y="${z.svgY + 22}"
                text-anchor="middle" font-size="16" style="pointer-events:none">${z.emoji}</text>
          <text x="${z.svgX + z.svgW/2}" y="${z.svgY + 40}"
                text-anchor="middle" font-size="11" font-weight="600"
                fill="${isSelected ? '#6366f1' : 'var(--text-primary)'}"
                style="pointer-events:none">${z.name}</text>
          <text x="${z.svgX + z.svgW/2}" y="${z.svgY + 56}"
                text-anchor="middle" font-size="10"
                fill="${isSelected ? '#6366f1' : 'var(--success)'}"
                font-weight="700"
                style="pointer-events:none">● ${z.activeCount} active</text>
        </g>
      `;
    }).join('');

    // Road / path lines between zones
    const roads = `
      <line x1="280" y1="200" x2="340" y2="200" stroke="rgba(148,163,184,0.35)" stroke-width="8" stroke-linecap="round"/>
      <line x1="340" y1="200" x2="340" y2="320" stroke="rgba(148,163,184,0.35)" stroke-width="8" stroke-linecap="round"/>
      <line x1="250" y1="245" x2="370" y2="245" stroke="rgba(148,163,184,0.35)" stroke-width="6" stroke-linecap="round"/>
      <line x1="250" y1="245" x2="250" y2="320" stroke="rgba(148,163,184,0.35)" stroke-width="6" stroke-linecap="round"/>
      <line x1="370" y1="200" x2="460" y2="200" stroke="rgba(148,163,184,0.35)" stroke-width="8" stroke-linecap="round"/>
      <line x1="410" y1="245" x2="460" y2="310" stroke="rgba(148,163,184,0.35)" stroke-width="6" stroke-linecap="round"/>
    `;

    // Main campus boundary
    const boundary = `
      <rect x="110" y="110" width="420" height="300" rx="20" ry="20"
            fill="none" stroke="rgba(99,102,241,0.15)" stroke-width="2" stroke-dasharray="8,4"/>
      <text x="320" y="102" text-anchor="middle" font-size="12" font-weight="700"
            fill="rgba(99,102,241,0.5)">JECRC UNIVERSITY CAMPUS</text>
    `;

    return `
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="campus-svg"
           style="max-height:400px">
        <!-- Background -->
        <rect width="${svgWidth}" height="${svgHeight}" fill="transparent"/>
        <!-- Campus boundary -->
        ${boundary}
        <!-- Roads -->
        ${roads}
        <!-- Green areas -->
        <ellipse cx="330" cy="230" rx="30" ry="20" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.2)" stroke-width="1"/>
        <text x="330" y="233" text-anchor="middle" font-size="12" fill="rgba(16,185,129,0.6)">🌳</text>
        <!-- Zone rectangles -->
        ${zoneRects}
      </svg>
    `;
  }

  function renderZoneDetailPanel(zone) {
    const students  = CC_DATA.getFreeStudents().filter(s => s.campusArea === zone.name);
    const acts      = CC_DATA.getActiveActivities().filter(a => a.location === zone.name || a.location.includes(zone.name.split(' ')[0]));

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div>
          <div style="font-size:18px;font-weight:800">${zone.emoji} ${zone.name}</div>
          <div class="zone-count" style="font-size:13px;margin-top:2px">
            <div style="width:7px;height:7px;background:var(--success);border-radius:50%"></div>
            ${zone.activeCount} students active
          </div>
        </div>
        <button class="btn btn-icon btn-ghost" onclick="CC_CAMPUS.closeDetail()">✕</button>
      </div>

      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">${zone.description}</p>

      <div class="zone-activities mb-3">
        ${zone.activities.map(a => `<span class="chip chip-success chip-sm">${a}</span>`).join('')}
      </div>

      ${students.length > 0 ? `
        <div style="margin-bottom:14px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">FREE NOW HERE</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${students.slice(0,3).map(s => `
              <div style="display:flex;align-items:center;gap:8px;background:var(--bg-secondary);border-radius:var(--radius);padding:8px 10px">
                <div class="avatar avatar-sm avatar-gradient-${s.avatarGradient}">${s.initials}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:600">${s.name}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${s.freeActivity?.join(', ') || ''}</div>
                </div>
                <button class="btn btn-sm btn-primary" onclick="handleConnect('${s.id}','${s.name}',this)">
                  ${CC_AUTH.isConnected(s.id) ? '✓' : 'Connect'}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${acts.length > 0 ? `
        <div style="margin-bottom:14px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">ACTIVITIES</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${acts.slice(0,3).map(a => `
              <div style="display:flex;align-items:center;gap:8px;background:var(--bg-secondary);border-radius:var(--radius);padding:8px 10px;cursor:pointer"
                   onclick="CC_MODALS.openActivityDetail(CC_DATA.getActivity('${a.id}'))">
                <span style="font-size:18px">${a.emoji}</span>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:600">${a.name}</div>
                  <div style="font-size:11px;color:var(--text-muted)">🕐 ${a.time} • 👥 ${a.joined}/${a.max}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <button class="btn btn-primary btn-block btn-sm" onclick="CC_APP.navigate('/activities')">
        See What's Happening →
      </button>
    `;
  }

  function selectZone(zoneId) {
    selectedZone = zoneId;
    const zone = CC_DATA.campusAreas.find(z => z.id === zoneId);
    if (!zone) return;

    // Highlight zone card in sidebar
    document.querySelectorAll('.zone-card').forEach(c => c.classList.remove('active'));
    const zoneCard = document.getElementById(`zone-card-${zoneId}`);
    if (zoneCard) {
      zoneCard.classList.add('active');
      zoneCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Update SVG (re-render)
    const mapArea = document.getElementById('campus-map-area');
    const svgWrap = mapArea?.querySelector('.campus-svg-wrap');
    if (svgWrap) {
      svgWrap.innerHTML = renderCampusSVG();
    }

    // Show detail panel
    const panel = document.getElementById('zone-detail-panel');
    if (panel) {
      panel.innerHTML = renderZoneDetailPanel(zone);
      panel.classList.remove('hidden');
    }
  }

  function closeDetail() {
    selectedZone = null;
    const panel = document.getElementById('zone-detail-panel');
    if (panel) panel.classList.add('hidden');
    document.querySelectorAll('.zone-card').forEach(c => c.classList.remove('active'));
  }

  function attachMapEvents() {
    // Mobile: if sidebar is below map, handle scroll
  }

  return { render, selectZone, closeDetail };
})();
