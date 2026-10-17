/* ============================================
   CampusConnect — App Router & Main Orchestrator
   ============================================ */

window.CC_APP = (function() {

  const routes = {
    '/':           renderLanding,
    '/login':      renderLogin,
    '/signup':     renderSignup,
    '/onboarding': renderOnboarding,
    '/dashboard':  renderDashboard,
    '/free':       renderFreeNow,
    '/campus':     renderCampus,
    '/discover':   renderDiscover,
    '/activities': renderActivities,
    '/events':     renderEvents,
    '/messages':   renderMessages,
    '/profile':    renderProfile,
    '/admin':      renderAdmin,
  };

  let currentRoute = null;

  function getRoute() {
    const hash = window.location.hash.replace('#', '') || '/';
    return hash.split('?')[0];
  }

  function navigate(path, replace = false) {
    if (replace) {
      window.location.replace('#' + path);
    } else {
      window.location.hash = path;
    }
  }

  function renderRoute() {
    const route = getRoute();
    currentRoute = route;

    // Auth guard: protect authenticated routes
    const publicRoutes = ['/', '/login', '/signup', '/onboarding'];
    if (!publicRoutes.includes(route) && !CC_AUTH.isLoggedIn()) {
      navigate('/login', true);
      return;
    }
    // Redirect logged-in users away from landing/auth
    if ((route === '/' || route === '/login' || route === '/signup') && CC_AUTH.isLoggedIn()) {
      navigate('/dashboard', true);
      return;
    }

    const main  = document.getElementById('cc-main');
    const header = document.getElementById('cc-header');
    const bottomNav = document.getElementById('cc-bottom-nav');

    // Reset scroll
    main.scrollTop = 0;
    window.scrollTo(0, 0);

    const isAuthed = CC_AUTH.isLoggedIn() && !publicRoutes.includes(route);

    // Toggle header/nav
    if (isAuthed) {
      header.classList.remove('hidden');
      bottomNav.classList.remove('hidden');
      main.classList.add('with-header', 'with-bottom-nav');
      CC_HEADER.render();
      CC_BOTTOM_NAV.render(route);
    } else {
      header.classList.add('hidden');
      bottomNav.classList.add('hidden');
      main.classList.remove('with-header', 'with-bottom-nav');
    }

    // Render page
    const renderer = routes[route] || renderNotFound;
    renderer(main);

    // Init Lucide icons after render
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
  }

  function renderNotFound(container) {
    container.innerHTML = `
      <div class="empty-state" style="margin-top:80px">
        <div class="empty-icon">🔍</div>
        <h3>Page Not Found</h3>
        <p>The page you're looking for doesn't exist.</p>
        <button class="btn btn-primary mt-4" onclick="CC_APP.navigate('/dashboard')">Go Home</button>
      </div>
    `;
  }

  // Delegate to page renderers
  function renderLanding(c)      { CC_LANDING.render(c); }
  function renderLogin(c)        { CC_ONBOARDING.renderLogin(c); }
  function renderSignup(c)       { CC_ONBOARDING.renderSignup(c); }
  function renderOnboarding(c)   { CC_ONBOARDING.renderOnboarding(c); }
  function renderDashboard(c)    { CC_DASHBOARD.render(c); }
  function renderFreeNow(c)      { CC_FREE_NOW.render(c); }
  function renderCampus(c)       { CC_CAMPUS.render(c); }
  function renderDiscover(c)     { CC_DISCOVER.render(c); }
  function renderActivities(c)   { CC_ACTIVITIES.render(c); }
  function renderEvents(c)       { CC_EVENTS.render(c); }
  function renderMessages(c)     { CC_MESSAGES.render(c); }
  function renderProfile(c)      { CC_PROFILE.render(c); }
  function renderAdmin(c)        { CC_ADMIN.render(c); }

  function init() {
    CC_AUTH.initTheme();

    window.addEventListener('hashchange', renderRoute);

    // Close notification panel on outside click
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('cc-notif-panel');
      const btn   = document.getElementById('cc-notif-btn');
      if (panel && !panel.classList.contains('hidden') &&
          !panel.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
        panel.classList.add('hidden');
      }

      // Close modal on overlay click
      const overlay = document.getElementById('cc-modal-overlay');
      if (overlay && !overlay.classList.contains('hidden') &&
          e.target === overlay) {
        CC_MODALS.close();
      }
    });

    renderRoute();
  }

  return { init, navigate, getRoute, renderRoute };

})();

// ---- Bootstrap ----
document.addEventListener('DOMContentLoaded', () => CC_APP.init());
