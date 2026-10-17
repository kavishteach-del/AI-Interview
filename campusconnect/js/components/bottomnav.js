/* ============================================
   CampusConnect — Bottom Navigation Component
   ============================================ */

window.CC_BOTTOM_NAV = (function() {

  const navItems = [
    {
      route: '/dashboard',
      label: 'Home',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    },
    {
      route: '/campus',
      label: 'Campus',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    },
    {
      route: '/activities',
      label: 'Create',
      isCreate: true,
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    },
    {
      route: '/discover',
      label: 'Discover',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
    },
    {
      route: '/messages',
      label: 'Messages',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    },
  ];

  function render(currentRoute) {
    const nav = document.getElementById('cc-bottom-nav');

    nav.innerHTML = navItems.map(item => {
      const isActive = currentRoute === item.route;

      if (item.isCreate) {
        return `
          <button class="nav-item nav-create" onclick="CC_APP.navigate('${item.route}')">
            <div class="nav-icon-wrap">${item.icon}</div>
            <span class="nav-label">${item.label}</span>
          </button>
        `;
      }

      return `
        <button class="nav-item ${isActive ? 'active' : ''}" onclick="CC_APP.navigate('${item.route}')">
          <div class="nav-icon">${item.icon}</div>
          <span class="nav-label">${item.label}</span>
        </button>
      `;
    }).join('');
  }

  return { render };
})();
