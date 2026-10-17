/* ============================================
   CampusConnect — Auth / Onboarding Pages
   Login, Signup, OTP, Multi-step Onboarding
   ============================================ */

window.CC_ONBOARDING = (function() {

  let onboardingStep = 1;
  const TOTAL_STEPS = 5;
  let onboardingData = {};

  // ---- LOGIN PAGE ----
  function renderLogin(container) {
    container.innerHTML = `
    <div class="auth-page">
      <div class="auth-bg"><div class="auth-blob-1"></div><div class="auth-blob-2"></div></div>
      <div class="auth-card animate-scale-in">
        <div class="auth-logo" onclick="CC_APP.navigate('/')" style="cursor:pointer">
          <div class="auth-logo-icon">🎓</div>
          <span class="auth-logo-text">CampusConnect</span>
        </div>

        <h1 class="auth-title">Welcome back! 👋</h1>
        <p class="auth-subtitle">Log in with your <span>JECRC University email</span></p>

        <div id="login-error" class="form-error mb-3 hidden"></div>

        <form id="login-form" onsubmit="CC_ONBOARDING.handleLogin(event)">
          <div class="form-group">
            <label class="form-label">University Email <span>*</span></label>
            <div class="input-group">
              <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
              <input type="email" class="form-control" id="login-email" placeholder="yourname@jecrcuniversity.edu.in" required autocomplete="email">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Password <span>*</span></label>
            <div class="input-group">
              <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input type="password" class="form-control" id="login-password" placeholder="••••••••" required minlength="6" autocomplete="current-password">
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block mt-2" id="login-btn">
            🔐 Log In
          </button>
        </form>

        <div class="auth-divider">or</div>

        <div class="email-note">
          🎓 Only <strong>@jecrcuniversity.edu.in</strong> email addresses are accepted. This keeps our community safe and verified.
        </div>

        <div class="auth-link">
          Don't have an account? <span onclick="CC_APP.navigate('/signup')">Sign up</span>
        </div>
        <div class="auth-link mt-2">
          <span onclick="CC_APP.navigate('/')">← Back to home</span>
        </div>
      </div>
    </div>
    `;
  }

  function handleLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn      = document.getElementById('login-btn');
    const errEl    = document.getElementById('login-error');

    btn.disabled = true;
    btn.textContent = 'Logging in...';

    setTimeout(() => {
      const result = CC_AUTH.login(email, password);
      if (result.success) {
        CC_AUTH.showToast('✅ Logged in successfully!');
        CC_APP.navigate('/dashboard', true);
      } else {
        errEl.textContent = result.error;
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '🔐 Log In';
      }
    }, 800);
  }

  // ---- SIGNUP PAGE ----
  function renderSignup(container) {
    container.innerHTML = `
    <div class="auth-page">
      <div class="auth-bg"><div class="auth-blob-1"></div><div class="auth-blob-2"></div></div>
      <div class="auth-card animate-scale-in">
        <div class="auth-logo" onclick="CC_APP.navigate('/')" style="cursor:pointer">
          <div class="auth-logo-icon">🎓</div>
          <span class="auth-logo-text">CampusConnect</span>
        </div>

        <h1 class="auth-title">Join CampusConnect 🎓</h1>
        <p class="auth-subtitle">Create your account with your <span>JECRC University email</span></p>

        <div id="signup-error" class="form-error mb-3 hidden"></div>

        <div id="signup-step-1">
          <form id="signup-form" onsubmit="CC_ONBOARDING.handleSignup(event)">
            <div class="form-group">
              <label class="form-label">Full Name <span>*</span></label>
              <input type="text" class="form-control" id="signup-name" placeholder="Nikhil Rathore" required autocomplete="name">
            </div>
            <div class="form-group">
              <label class="form-label">University Email <span>*</span></label>
              <div class="input-group">
                <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
                <input type="email" class="form-control" id="signup-email" placeholder="yourname@jecrcuniversity.edu.in" required autocomplete="email">
              </div>
              <div class="form-hint">Must be your @jecrcuniversity.edu.in email</div>
            </div>
            <div class="form-group">
              <label class="form-label">Password <span>*</span></label>
              <input type="password" class="form-control" id="signup-password" placeholder="Min. 6 characters" required minlength="6" autocomplete="new-password">
            </div>
            <button type="submit" class="btn btn-primary btn-block mt-2" id="signup-btn">
              🚀 Create Account
            </button>
          </form>
        </div>

        <div class="auth-divider">or</div>
        <div class="auth-link">
          Already have an account? <span onclick="CC_APP.navigate('/login')">Log in</span>
        </div>
        <div class="auth-link mt-2">
          <span onclick="CC_APP.navigate('/')">← Back to home</span>
        </div>
      </div>
    </div>
    `;
  }

  function handleSignup(e) {
    e.preventDefault();
    const name     = document.getElementById('signup-name').value.trim();
    const email    = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const btn      = document.getElementById('signup-btn');
    const errEl    = document.getElementById('signup-error');

    // Validate email
    if (!email.endsWith('@jecrcuniversity.edu.in')) {
      errEl.textContent = 'Only @jecrcuniversity.edu.in emails are allowed.';
      errEl.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account...';

    setTimeout(() => {
      const result = CC_AUTH.signup(email, name, password);
      if (result.success) {
        CC_AUTH.showToast('✅ Account created! Setting up your profile...');
        CC_APP.navigate('/onboarding', true);
      } else {
        errEl.textContent = result.error || 'Failed to create account.';
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '🚀 Create Account';
      }
    }, 400);
  }

  function setupOTPInputs() {
    // OTP system currently paused
  }

  function verifyOTP() {
    // OTP system currently paused
  }

  // ---- ONBOARDING MULTI-STEP ----
  function renderOnboarding(container) {
    onboardingStep = 1;
    onboardingData = {};
    renderOnboardingStep(container);
  }

  function renderOnboardingStep(container) {
    const pct = Math.round((onboardingStep / TOTAL_STEPS) * 100);
    container.innerHTML = `
    <div class="onboarding-page">
      <div class="onboarding-header">
        <span class="onboarding-logo">CampusConnect</span>
        <span class="onboarding-skip" onclick="CC_ONBOARDING.skipOnboarding()">Skip for now</span>
      </div>
      <div class="onboarding-progress">
        <div class="onboarding-progress-label">
          <span>Step ${onboardingStep} of ${TOTAL_STEPS}</span>
          <span>${pct}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="onboarding-body" id="onboarding-body">
        ${getStepContent(onboardingStep)}
      </div>
      <div class="onboarding-footer" id="onboarding-footer">
        ${onboardingStep > 1 ? `<button class="btn btn-secondary" onclick="CC_ONBOARDING.prevStep()">← Back</button>` : `<div></div>`}
        ${onboardingStep < TOTAL_STEPS
          ? `<button class="btn btn-primary" onclick="CC_ONBOARDING.nextStep()">Continue →</button>`
          : `<button class="btn btn-success" onclick="CC_ONBOARDING.completeOnboarding()">🚀 Let's Go!</button>`
        }
      </div>
    </div>
    `;
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
  }

  function getStepContent(step) {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      default: return '';
    }
  }

  function renderStep1() {
    return `
      <div class="onboarding-step-title">👋 Basic Information</div>
      <div class="onboarding-step-desc">Tell us about yourself so others can find you.</div>

      <div class="photo-upload-area" onclick="CC_AUTH.showToast('📸 Photo upload coming soon!')">
        <div class="photo-upload-preview" id="photo-preview">NR</div>
        <div class="photo-upload-label">Upload Profile Photo</div>
        <div class="photo-upload-hint">Tap to upload (optional)</div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">First Name <span>*</span></label>
          <input type="text" class="form-control" id="ob-firstname" placeholder="Nikhil" value="Nikhil">
        </div>
        <div class="form-group">
          <label class="form-label">Last Name <span>*</span></label>
          <input type="text" class="form-control" id="ob-lastname" placeholder="Rathore" value="Rathore">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Course</label>
          <select class="form-control form-select" id="ob-course">
            <option>B.Tech</option>
            <option>M.Tech</option>
            <option>MBA</option>
            <option>BBA</option>
            <option>MCA</option>
            <option>B.Sc</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Year</label>
          <select class="form-control form-select" id="ob-year">
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3" selected>3rd Year</option>
            <option value="4">4th Year</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Branch</label>
          <select class="form-control form-select" id="ob-branch">
            <option>CSE AI &amp; DS</option>
            <option>CSE AI &amp; ML</option>
            <option>CSE Cyber Security</option>
            <option>CSE</option>
            <option>ECE</option>
            <option>EEE</option>
            <option>Mechanical</option>
            <option>Civil</option>
            <option>IT</option>
            <option>Data Science</option>
            <option>Business Analytics</option>
            <option>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Section</label>
          <select class="form-control form-select" id="ob-section">
            <option>A</option><option>B</option><option>C</option><option>D</option><option>E</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Short Bio</label>
        <textarea class="form-control" id="ob-bio" placeholder="Tell others a bit about yourself... (e.g. AI enthusiast, cricket fan, chai lover)" rows="3"></textarea>
      </div>
    `;
  }

  function renderStep2() {
    const interestsList = CC_DATA.interestsList;
    return `
      <div class="onboarding-step-title">🎯 Your Interests</div>
      <div class="onboarding-step-desc">Select at least 3 interests so we can find your people.</div>
      <div class="interest-select-grid">
        ${interestsList.map(i => `
          <button class="interest-chip ${(onboardingData.interests || []).includes(i.name) ? 'selected' : ''}"
                  onclick="CC_ONBOARDING.toggleInterest(this, '${i.name}')">
            <span class="interest-chip-emoji">${i.emoji}</span>
            ${i.name}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderStep3() {
    const skillsList = CC_DATA.skillsList;
    return `
      <div class="onboarding-step-title">💡 Skills & Hobbies</div>
      <div class="onboarding-step-desc">What are you good at? What do you love to do?</div>

      <div class="form-group">
        <label class="form-label">Your Skills</label>
        <div class="interest-select-grid">
          ${skillsList.slice(0, 16).map(s => `
            <button class="interest-chip ${(onboardingData.skills || []).includes(s) ? 'selected' : ''}"
                    onclick="CC_ONBOARDING.toggleSkill(this, '${s}')">
              ${s}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="form-group mt-4">
        <label class="form-label">Hobbies (comma separated)</label>
        <input type="text" class="form-control" id="ob-hobbies" 
               value="${(onboardingData.hobbies || []).join(', ')}"
               placeholder="e.g. Photography, Badminton, Gaming">
      </div>
    `;
  }

  function renderStep4() {
    return `
      <div class="onboarding-step-title">📅 Campus Activity Preferences</div>
      <div class="onboarding-step-desc">What would you like to do on campus? Select all that apply.</div>

      <div class="activity-pref-grid">
        ${CC_DATA.activityTypes.map(a => `
          <button class="activity-pref-item ${(onboardingData.activities || []).includes(a.name) ? 'selected' : ''}"
                  onclick="CC_ONBOARDING.toggleActivity(this, '${a.name}')">
            <span class="activity-pref-emoji">${a.emoji}</span>
            <span class="activity-pref-label">${a.name}</span>
          </button>
        `).join('')}
      </div>

      <div class="form-group mt-5">
        <label class="form-label">When are you usually free on campus?</label>
        <div class="avail-grid">
          ${['Morning (8–12)', 'Afternoon (12–4)', 'Evening (4–7)', 'After 5 PM', 'Weekends'].map(t => `
            <button class="avail-chip ${(onboardingData.availability || []).includes(t) ? 'selected' : ''}"
                    onclick="CC_ONBOARDING.toggleAvailability(this, '${t}')">
              ${t}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderStep5() {
    return `
      <div class="onboarding-complete">
        <div class="complete-animation">🎉</div>
        <h2 class="complete-title">You're all set, ${(onboardingData.firstName || 'friend')}!</h2>
        <p class="complete-desc">
          Your profile is ready. Discover people, find activities, and make your campus experience unforgettable.
        </p>
        <div style="background:var(--bg-secondary);border-radius:var(--radius-lg);padding:20px;text-align:left;margin-bottom:24px">
          <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase">YOUR QUICK START</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:10px;font-size:14px">
              <span style="font-size:20px">🟢</span>
              <span>Tap <strong>I'm Free Now</strong> when you have free time</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:14px">
              <span style="font-size:20px">📍</span>
              <span>Explore the <strong>Campus Map</strong> to see who's where</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:14px">
              <span style="font-size:20px">👥</span>
              <span>Check <strong>Find My People</strong> for interest matches</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ---- Toggle Helpers ----
  function toggleInterest(btn, name) {
    btn.classList.toggle('selected');
    if (!onboardingData.interests) onboardingData.interests = [];
    const idx = onboardingData.interests.indexOf(name);
    if (idx === -1) onboardingData.interests.push(name);
    else onboardingData.interests.splice(idx, 1);
  }

  function toggleSkill(btn, name) {
    btn.classList.toggle('selected');
    if (!onboardingData.skills) onboardingData.skills = [];
    const idx = onboardingData.skills.indexOf(name);
    if (idx === -1) onboardingData.skills.push(name);
    else onboardingData.skills.splice(idx, 1);
  }

  function toggleActivity(btn, name) {
    btn.classList.toggle('selected');
    if (!onboardingData.activities) onboardingData.activities = [];
    const idx = onboardingData.activities.indexOf(name);
    if (idx === -1) onboardingData.activities.push(name);
    else onboardingData.activities.splice(idx, 1);
  }

  function toggleAvailability(btn, name) {
    btn.classList.toggle('selected');
    if (!onboardingData.availability) onboardingData.availability = [];
    const idx = onboardingData.availability.indexOf(name);
    if (idx === -1) onboardingData.availability.push(name);
    else onboardingData.availability.splice(idx, 1);
  }

  // ---- Step Navigation ----
  function nextStep() {
    // Collect current step data
    collectStepData();
    if (onboardingStep < TOTAL_STEPS) {
      onboardingStep++;
      renderOnboardingStep(document.getElementById('cc-main'));
    }
  }

  function prevStep() {
    if (onboardingStep > 1) {
      onboardingStep--;
      renderOnboardingStep(document.getElementById('cc-main'));
    }
  }

  function collectStepData() {
    if (onboardingStep === 1) {
      onboardingData.firstName   = document.getElementById('ob-firstname')?.value || 'Nikhil';
      onboardingData.lastName    = document.getElementById('ob-lastname')?.value || 'Rathore';
      onboardingData.course      = document.getElementById('ob-course')?.value || 'B.Tech';
      onboardingData.year        = parseInt(document.getElementById('ob-year')?.value || '3');
      onboardingData.branch      = document.getElementById('ob-branch')?.value || 'CSE AI & DS';
      onboardingData.section     = document.getElementById('ob-section')?.value || 'A';
      onboardingData.bio         = document.getElementById('ob-bio')?.value || '';
    }
    if (onboardingStep === 3) {
      const hobbiesInput = document.getElementById('ob-hobbies');
      if (hobbiesInput) {
        onboardingData.hobbies = hobbiesInput.value.split(',').map(h => h.trim()).filter(Boolean);
      }
    }
  }

  function completeOnboarding() {
    collectStepData();
    // Save profile
    const profile = CC_DATA.getCurrentUser();
    CC_AUTH.setProfile({ ...profile, ...onboardingData });
    CC_AUTH.showToast('🎉 Profile set up! Welcome to CampusConnect!');
    CC_APP.navigate('/dashboard', true);
  }

  function skipOnboarding() {
    CC_AUTH.showToast('Profile setup skipped. You can complete it later.');
    CC_APP.navigate('/dashboard', true);
  }

  return {
    renderLogin, renderSignup, renderOnboarding,
    handleLogin, handleSignup, verifyOTP,
    nextStep, prevStep, completeOnboarding, skipOnboarding,
    toggleInterest, toggleSkill, toggleActivity, toggleAvailability,
  };
})();
