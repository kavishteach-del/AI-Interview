/* ============================================
   CampusConnect — Header Component
   ============================================ */

window.CC_HEADER = (function() {

  function render() {
    const header = document.getElementById('cc-header');
    const profile = CC_AUTH.getProfile();
    const freeStatus = CC_AUTH.getFreeStatus();
    const route = CC_APP.getRoute();

    const initials = profile.initials || (profile.name || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
    const avatarClass = `avatar-gradient-${profile.avatarGradient || 0}`;

    const unreadNotifs = CC_DATA.notifications.filter(n => n.unread).length;

    header.innerHTML = `
      <div class="header-inner">
        <!-- Logo -->
        <a class="header-logo" href="#/dashboard" aria-label="CampusConnect Home">
          <div class="header-logo-icon">🎓</div>
          <span class="header-logo-text hide-mobile">CampusConnect</span>
        </a>

        <!-- Search -->
        <div class="header-search hide-mobile">
          <div class="input-group">
            <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" class="form-control" id="header-search-input" placeholder="Search people, activities, events..." autocomplete="off">
          </div>
        </div>

        <!-- Actions -->
        <div class="header-actions">

          <!-- Free Now indicator -->
          ${freeStatus.active ? `
            <div class="free-pill" style="cursor:pointer" onclick="CC_APP.navigate('/free')" title="You're free now">
              🟢 Free
            </div>
          ` : ''}

          <!-- Dark mode toggle -->
          <button class="header-btn" id="cc-theme-btn" title="Toggle dark mode" aria-label="Toggle dark mode">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="theme-icon-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="theme-icon-sun" class="hidden"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          </button>

          <!-- Notifications -->
          <button class="header-btn ${unreadNotifs > 0 ? 'active' : ''}" id="cc-notif-btn" title="Notifications" aria-label="Notifications">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            ${unreadNotifs > 0 ? `<span class="header-badge">${unreadNotifs}</span>` : ''}
          </button>

          <!-- Messages -->
          <button class="header-btn" onclick="CC_APP.navigate('/messages')" title="Messages" aria-label="Messages">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>

          <!-- Profile Avatar -->
          <div class="avatar avatar-sm ${avatarClass} header-avatar" 
               onclick="CC_APP.navigate('/profile')" 
               title="My Profile"
               style="cursor:pointer">
            ${initials}
          </div>

        </div>
      </div>
    `;

    attachHeaderEvents();
    updateThemeIcon();
  }

  function attachHeaderEvents() {
    // Theme toggle
    const themeBtn = document.getElementById('cc-theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        CC_AUTH.toggleTheme();
        updateThemeIcon();
      });
    }

    // Notifications
    const notifBtn = document.getElementById('cc-notif-btn');
    if (notifBtn) {
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        CC_NOTIFICATIONS.toggle();
      });
    }

    // Search
    const searchInput = document.getElementById('header-search-input');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
          CC_AUTH.showToast(`🔍 Searching for "${searchInput.value.trim()}"...`);
          searchInput.value = '';
        }
      });
    }
  }

  function updateThemeIcon() {
    const theme = CC_AUTH.getPrefs().theme;
    const moon = document.getElementById('theme-icon-moon');
    const sun  = document.getElementById('theme-icon-sun');
    if (moon && sun) {
      if (theme === 'dark') {
        moon.classList.add('hidden');
        sun.classList.remove('hidden');
      } else {
        moon.classList.remove('hidden');
        sun.classList.add('hidden');
      }
    }
  }

  return { render };
})();
