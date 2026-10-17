/* ============================================
   CampusConnect — Events Page
   College events, workshops, hackathons, etc.
   ============================================ */

window.CC_EVENTS = (function() {

  let activeFilter = 'All';

  function render(container) {
    container.innerHTML = `
    <div class="events-page animate-fade-in">

      <!-- Header -->
      <div class="section-header mb-4">
        <div>
          <h1 style="font-size:22px;font-weight:800">📅 Campus Events</h1>
          <p class="text-secondary text-sm">Workshops, hackathons, cultural programs & more.</p>
        </div>
      </div>

      <!-- Category Filter -->
      <div class="flex flex-wrap gap-2 mb-5">
        ${['All', 'Hackathon', 'Workshop', 'Cultural', 'Sports', 'Seminar', 'Social'].map(cat => `
          <button class="chip ${activeFilter===cat?'chip-primary':'chip-default'} chip-selectable"
                  onclick="CC_EVENTS.filterEvents('${cat}', this)">${cat}</button>
        `).join('')}
      </div>

      <!-- Featured Event (first one) -->
      ${renderFeaturedEvent(CC_DATA.events[0])}

      <!-- Events Grid -->
      <div class="section-header mb-3 mt-5">
        <span class="section-title">All Events</span>
        <span class="text-muted text-sm">${CC_DATA.events.length} events</span>
      </div>
      <div class="events-grid" id="events-grid">
        ${CC_DATA.events.map(e => renderEventCard(e)).join('')}
      </div>

    </div>
    `;
  }

  function renderFeaturedEvent(event) {
    if (!event) return '';
    const isInterested = CC_AUTH.isInterested(event.id);

    return `
      <div style="background:linear-gradient(135deg,var(--primary),var(--secondary));border-radius:var(--radius-lg);padding:28px;color:#fff;position:relative;overflow:hidden;margin-bottom:8px">
        <div style="position:absolute;top:-30%;right:-5%;width:200px;height:200px;background:rgba(255,255,255,0.06);border-radius:50%"></div>
        <div style="position:relative;z-index:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <div style="background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:var(--radius-full);font-size:12px;font-weight:700">
              ⭐ FEATURED
            </div>
            <div style="background:rgba(255,255,255,0.15);padding:4px 12px;border-radius:var(--radius-full);font-size:12px;font-weight:700">
              ${event.category.toUpperCase()}
            </div>
          </div>
          <div style="font-size:44px;margin-bottom:12px">${event.emoji}</div>
          <h2 style="font-size:22px;font-weight:800;margin-bottom:6px">${event.title}</h2>
          <div style="font-size:14px;opacity:0.9;margin-bottom:6px">📅 ${event.date} • 🕐 ${event.time}</div>
          <div style="font-size:14px;opacity:0.9;margin-bottom:16px">📍 ${event.location}</div>
          <p style="font-size:14px;opacity:0.85;margin-bottom:20px;line-height:1.6">${event.desc}</p>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="font-size:14px;font-weight:600">👥 ${event.interested} interested • ${event.registered} registered</div>
            <button style="background:#fff;color:var(--primary);border:none;border-radius:var(--radius-full);padding:10px 22px;font-size:14px;font-weight:700;cursor:pointer"
                    onclick="CC_MODALS.openEventDetail(CC_DATA.getEvent('${event.id}'))">
              ${isInterested ? '✓ Interested' : '⭐ I\'m Interested'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderEventCard(event) {
    const isInterested = CC_AUTH.isInterested(event.id);
    const bannerColors = {
      'gradient-primary': 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      'gradient-warm':    'linear-gradient(135deg,#f97316,#f59e0b)',
      'gradient-blue':    'linear-gradient(135deg,#3b82f6,#6366f1)',
      'gradient-success': 'linear-gradient(135deg,#10b981,#06b6d4)',
    };
    const bannerStyle = bannerColors[event.banner] || bannerColors['gradient-primary'];

    return `
      <div class="event-card">
        <div class="event-card-banner" style="background:${bannerStyle}">
          <span>${event.emoji}</span>
          ${isInterested ? `<div style="position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.2);border-radius:var(--radius-full);padding:4px 10px;font-size:11px;font-weight:700;color:#fff">✓ Interested</div>` : ''}
        </div>
        <div class="event-card-body">
          <div class="event-card-category" style="color:var(--primary)">${event.category}</div>
          <h3 class="event-card-title">${event.title}</h3>
          <div class="event-card-meta">
            <span>📅 ${event.date}</span>
            <span>•</span>
            <span>🕐 ${event.time}</span>
          </div>
          <div class="event-card-meta">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/></svg>
            <span>${event.location}</span>
          </div>
          <div class="flex flex-wrap gap-1 mb-3">
            ${event.tags.map(t => `<span class="chip chip-default chip-sm">${t}</span>`).join('')}
          </div>
          <div class="event-card-footer">
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--primary)">${event.interested} interested</div>
              <div style="font-size:11px;color:var(--text-muted)">${event.registered} registered</div>
            </div>
            <button class="btn btn-sm ${isInterested ? 'btn-outline' : 'btn-primary'}"
                    onclick="CC_EVENTS.toggleInterest('${event.id}',this)">
              ${isInterested ? '✓ Interested' : '⭐ Interested'}
            </button>
          </div>

          <!-- Connect with others interested -->
          ${isInterested ? `
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Others also interested:</div>
              <div style="display:flex;gap:-4px">
                ${CC_DATA.getStudentsExceptCurrent().slice(0,4).map(s => `
                  <div class="avatar avatar-xs avatar-gradient-${s.avatarGradient}" style="margin-left:-6px;border:2px solid var(--card-bg);cursor:pointer" title="${s.name}"
                       onclick="CC_MODALS.openConnectModal(${JSON.stringify(s).replace(/"/g,'&quot;')})">
                    ${s.initials}
                  </div>
                `).join('')}
                <div style="font-size:12px;color:var(--text-secondary);margin-left:10px;display:flex;align-items:center">
                  +${event.interested - 4} more
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function toggleInterest(eventId, btn) {
    const interested = CC_AUTH.toggleInterested(eventId);
    btn.className = `btn btn-sm ${interested ? 'btn-outline' : 'btn-primary'}`;
    btn.textContent = interested ? '✓ Interested' : '⭐ Interested';
    CC_AUTH.showToast(interested ? '⭐ Marked as interested!' : 'Removed interest.');
    // Re-render to show/hide "Others interested" section
    render(document.getElementById('cc-main'));
  }

  function filterEvents(category, btn) {
    activeFilter = category;
    document.querySelectorAll('.chip-selectable').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    const grid   = document.getElementById('events-grid');
    const events = category === 'All'
      ? CC_DATA.events
      : CC_DATA.events.filter(e => e.category === category);

    if (grid) grid.innerHTML = events.length > 0
      ? events.map(e => renderEventCard(e)).join('')
      : `<div class="empty-state"><div class="empty-icon">📅</div><h3>No ${category} events</h3><p>Check back later!</p></div>`;
  }

  return { render, toggleInterest, filterEvents };
})();
