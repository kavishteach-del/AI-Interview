/* ============================================
   CampusConnect — Auth State Management
   localStorage-based session management
   ============================================ */

window.CC_AUTH = (function() {

  const STORAGE_KEYS = {
    session:    'cc_session',
    profile:    'cc_profile',
    freeStatus: 'cc_free_status',
    prefs:      'cc_prefs',
    joined:     'cc_joined',        // joined activities / spots
    interested: 'cc_interested',    // interested events
    connected:  'cc_connected',     // connected student IDs
    liked:      'cc_liked_moments', // liked moment IDs
  };

  // ---- Session ----
  function setSession(userData) {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(userData));
  }

  function getSession() {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.session);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }

  function clearSession() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  }

  function isLoggedIn() {
    return !!getSession();
  }

  // ---- Profile ----
  function setProfile(profile) {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  }

  function getProfile() {
    try {
      const p = localStorage.getItem(STORAGE_KEYS.profile);
      if (p) return JSON.parse(p);
      // Fall back to mock current user
      return CC_DATA.getCurrentUser();
    } catch { return CC_DATA.getCurrentUser(); }
  }

  function updateProfile(updates) {
    const current = getProfile();
    setProfile({ ...current, ...updates });
  }

  // ---- Free Now Status ----
  function setFreeStatus(status) {
    // status: { active: bool, duration: str, activities: [], location: str, expiresAt: timestamp }
    localStorage.setItem(STORAGE_KEYS.freeStatus, JSON.stringify(status));
  }

  function getFreeStatus() {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.freeStatus);
      if (!s) return { active: false };
      const data = JSON.parse(s);
      // Check if expired
      if (data.expiresAt && Date.now() > data.expiresAt) {
        clearFreeStatus();
        return { active: false };
      }
      return data;
    } catch { return { active: false }; }
  }

  function clearFreeStatus() {
    localStorage.removeItem(STORAGE_KEYS.freeStatus);
  }

  // ---- Preferences ----
  function setPrefs(prefs) {
    localStorage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs));
  }

  function getPrefs() {
    try {
      const p = localStorage.getItem(STORAGE_KEYS.prefs);
      return p ? JSON.parse(p) : {
        theme: 'light',
        showInFreeNow: true,
        showInSuggestions: true,
        allowMessages: 'all',
        showActivityHistory: true,
      };
    } catch {
      return {
        theme: 'light',
        showInFreeNow: true,
        showInSuggestions: true,
        allowMessages: 'all',
        showActivityHistory: true,
      };
    }
  }

  function updatePrefs(updates) {
    const current = getPrefs();
    setPrefs({ ...current, ...updates });
  }

  // ---- Joined Activities / Spots ----
  function getJoined() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.joined) || '[]'); }
    catch { return []; }
  }

  function toggleJoined(id) {
    const joined = getJoined();
    const idx = joined.indexOf(id);
    if (idx === -1) joined.push(id);
    else joined.splice(idx, 1);
    localStorage.setItem(STORAGE_KEYS.joined, JSON.stringify(joined));
    return idx === -1; // true = joined, false = left
  }

  function isJoined(id) {
    return getJoined().includes(id);
  }

  // ---- Interested Events ----
  function getInterested() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.interested) || '[]'); }
    catch { return []; }
  }

  function toggleInterested(id) {
    const list = getInterested();
    const idx = list.indexOf(id);
    if (idx === -1) list.push(id);
    else list.splice(idx, 1);
    localStorage.setItem(STORAGE_KEYS.interested, JSON.stringify(list));
    return idx === -1;
  }

  function isInterested(id) {
    return getInterested().includes(id);
  }

  // ---- Connected Students ----
  function getConnected() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.connected) || '[]'); }
    catch { return []; }
  }

  function toggleConnected(id) {
    const list = getConnected();
    const idx = list.indexOf(id);
    if (idx === -1) list.push(id);
    else list.splice(idx, 1);
    localStorage.setItem(STORAGE_KEYS.connected, JSON.stringify(list));
    return idx === -1;
  }

  function isConnected(id) {
    return getConnected().includes(id);
  }

  // ---- Liked Moments ----
  function getLiked() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.liked) || '[]'); }
    catch { return []; }
  }

  function toggleLiked(id) {
    const list = getLiked();
    const idx = list.indexOf(id);
    if (idx === -1) list.push(id);
    else list.splice(idx, 1);
    localStorage.setItem(STORAGE_KEYS.liked, JSON.stringify(list));
    return idx === -1;
  }

  function isLiked(id) {
    return getLiked().includes(id);
  }

  // ---- Simulated login ----
  function login(email, password) {
    // For prototype: accept any @jecrcuniversity.edu.in email
    if (!email.endsWith('@jecrcuniversity.edu.in')) {
      return { success: false, error: 'Only JECRC University email addresses are allowed.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    const session = {
      email,
      userId: 'stu-001',
      loginAt: Date.now(),
    };
    setSession(session);
    return { success: true, session };
  }

  function signup(email, name, password) {
    if (!email.endsWith('@jecrcuniversity.edu.in')) {
      return { success: false, error: 'Only JECRC University email addresses (@jecrcuniversity.edu.in) are accepted.' };
    }
    if (!name || name.trim().length < 2) {
      return { success: false, error: 'Please enter your full name.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    const session = {
      email,
      userId: 'stu-001',
      loginAt: Date.now(),
      isNew: true,
    };
    setSession(session);
    return { success: true, session, needsOnboarding: true };
  }

  function logout() {
    clearSession();
  }

  // ---- Theme ----
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    updatePrefs({ theme });
  }

  function toggleTheme() {
    const current = getPrefs().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    return next;
  }

  function initTheme() {
    const prefs = getPrefs();
    applyTheme(prefs.theme || 'light');
  }

  // ---- Toast ----
  function showToast(message, duration = 2800) {
    const toast = document.getElementById('cc-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, duration);
  }

  return {
    // Session
    setSession, getSession, clearSession, isLoggedIn,
    // Profile
    setProfile, getProfile, updateProfile,
    // Free Status
    setFreeStatus, getFreeStatus, clearFreeStatus,
    // Prefs
    getPrefs, updatePrefs,
    // Joined
    getJoined, toggleJoined, isJoined,
    // Interested
    getInterested, toggleInterested, isInterested,
    // Connected
    getConnected, toggleConnected, isConnected,
    // Liked
    getLiked, toggleLiked, isLiked,
    // Auth actions
    login, signup, logout,
    // Theme
    applyTheme, toggleTheme, initTheme,
    // UI helpers
    showToast,
  };

})();
