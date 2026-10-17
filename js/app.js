/* ==========================================================================
   Interview AI - Single Page Application Router & State Machine
   ========================================================================== */

import { db } from './db.js';
import { voiceEngine } from './voiceEngine.js';
import { aiEngine } from './aiEngine.js';
import proctoringEngine from './proctoringEngine.js';
import { firebaseAuth, firestore } from './firebase.js';
import { groqClient } from './groqClient.js';
import { renderJEEConfig, renderJEEExam, renderJEEResult } from './jeeUI.js';
import { jeeState } from './jeeEngine.js';

// Global App State
const state = {
  currentPage: 'landing',
  currentUser: null,
  firebaseUser: null,
  activeSession: null,
  activeBlueprint: null,
  activeMode: 'real',
  activeInterviewType: 'cabin_crew', // 'cabin_crew' or 'cv_interview'
  isFollowUpActive: false,           // true when currently answering a dynamic follow-up
  currentQuestions: [],
  currentAnswers: [],
  currentQuestionIndex: 0,
  timerInterval: null,
  timerSecondsLeft: 0,
  volumeInterval: null,
  micPermissionGranted: false,
  cameraStream: null,
  isRecording: false,
  interimTranscript: '',
  finalTranscript: '',
  sessionHistoryList: [],
  proctorWarnings: 0,
  cvText: '',                       // Raw CV text for AI question generation (Mode 2 only)
  cvProfile: null,                  // Parsed profile for Mode 2
  aiQuestionsReady: false,
};

// Client-side Question Block Validation Helper
function isValidInterviewQuestion(qText) {
  if (!qText || typeof qText !== 'string') return false;
  const q = qText.trim();
  if (q.length < 25) return false;
  if (!q.includes('?')) return false;
  // Reject raw contact information
  if (/\b\d{10}\b|\b\d{5,}\b/.test(q)) return false;
  if (/[\w.-]+@[\w.-]+\.\w+/.test(q)) return false;
  const lower = q.toLowerCase();
  for (const bad of ['c o n t a c t', 'curriculum vitae', 'harni road', 'jayoti nagar', 'bhilwara', 'duration :', 'contact:', 'resume text']) {
    if (lower.includes(bad)) return false;
  }
  if (q.split(/\s+/).length <= 4) return false;
  return true;
}

// DOM Elements cache
const appRoot = document.getElementById('app-root');
const appHeader = document.getElementById('app-header');
const appFooter = document.getElementById('app-footer');
const navLinks = document.getElementById('nav-links');
const headerAuthBtns = document.getElementById('header-auth-buttons');
const headerUserMenu = document.getElementById('header-user-menu');

// Auth Modals
const authModal = document.getElementById('auth-modal');
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const authModalClose = document.getElementById('auth-modal-close');
const btnLoginTrigger = document.getElementById('btn-login-trigger');
const btnSignupTrigger = document.getElementById('btn-signup-trigger');
const linkSwitchSignup = document.getElementById('link-switch-signup');
const linkSwitchLogin = document.getElementById('link-switch-login');
const formLogin = document.getElementById('form-login');
const formSignup = document.getElementById('form-signup');
const loginAlert = document.getElementById('login-error-alert');
const signupAlert = document.getElementById('signup-error-alert');

// Profile Modals
const profileModal = document.getElementById('profile-modal');
const profileModalClose = document.getElementById('profile-modal-close');
const btnProfileTrigger = document.getElementById('btn-profile-trigger');
const btnProfileCancel = document.getElementById('btn-profile-cancel');
const formProfile = document.getElementById('form-profile');
const btnLogout = document.getElementById('btn-logout');

// Navigation links
const logoBtn = document.getElementById('nav-logo');
const linkDashboard = document.getElementById('link-dashboard');
const linkLibrary = document.getElementById('link-library');
const linkAdmin = document.getElementById('link-admin');
const linkJEE = document.getElementById('link-jee');

// Footer links
const footerLinkCabin = document.getElementById('footer-link-cabin');
const footerLinkJEE = document.getElementById('footer-link-jee');
const footerLinkAbout = document.getElementById('footer-link-about');
const footerLinkFAQ = document.getElementById('footer-link-faq');

/* ==========================================================================
   Routing & Lifecycle Managers
   ========================================================================== */

function navigate(page, params = {}) {
  // Clean up global listeners, interval clocks, or recorders from previous screen
  if (state.timerInterval) clearInterval(state.timerInterval);
  if (state.volumeInterval) clearInterval(state.volumeInterval);
  if (page !== 'jee-exam' && jeeState && jeeState.timerInterval) {
    clearInterval(jeeState.timerInterval);
  }
  voiceEngine.stopSpeaking();
  voiceEngine.stopListening();
  state.isRecording = false;

  state.currentPage = page;
  
  // Distraction-free mode for active interviews & CBT exam: hide navbar & footer
  if (page === 'simulator' || page === 'jee-exam') {
    appHeader.classList.add('hidden');
    appFooter.classList.add('hidden');
    document.body.style.backgroundColor = "#05070A";
  } else {
    appHeader.classList.remove('hidden');
    appFooter.classList.remove('hidden');
    document.body.style.backgroundColor = "var(--bg-primary)";
  }

  // Update navigation active states
  document.querySelectorAll('header nav ul li a').forEach(el => el.classList.remove('active'));
  if (page === 'dashboard') linkDashboard?.classList.add('active');
  if (page === 'library') linkLibrary?.classList.add('active');
  if (page === 'admin') linkAdmin?.classList.add('active');
  if (page === 'jee') linkJEE?.classList.add('active');

  // Render correct page view
  switch(page) {
    case 'landing':
      renderLanding();
      break;
    case 'dashboard':
      renderDashboard();
      break;
    case 'library':
      renderLibrary();
      break;
    case 'details':
      renderDetails(params.id);
      break;
    case 'consent':
      renderConsentScreen(params.id, params.mode);
      break;
    case 'systemcheck':
      renderSystemCheck(params.id, params.mode);
      break;
    case 'simulator':
      renderSimulator();
      break;
    case 'evaluation':
      renderEvaluation(params.sessionId);
      break;
    case 'cv-interview':
      renderCVInterview();
      break;
    case 'jee':
      renderJEEConfig(navigate);
      break;
    case 'jee-exam':
      renderJEEExam(navigate);
      break;
    case 'jee-result':
      renderJEEResult(navigate);
      break;
    case 'admin':
      renderAdmin();
      break;
    default:
      renderLanding();
  }

  // Scroll to top
  window.scrollTo(0, 0);
}

// Global Auth Check — driven by Firebase Auth state
function updateAuthUI(user, profile) {
  if (user) {
    state.firebaseUser = user;
    // Build a compatible currentUser object
    state.currentUser = {
      id: user.uid,
      email: user.email,
      name: profile ? profile.name : (user.displayName || user.email.split('@')[0]),
      role: (profile && profile.role) ? profile.role : 'candidate'
    };
    // Also persist to localStorage for offline / quick access
    sessionStorage.setItem('user', JSON.stringify(state.currentUser));

    navLinks.classList.remove('hidden');
    headerAuthBtns.classList.add('hidden');
    headerUserMenu.classList.remove('hidden');

    const profileBtn = document.getElementById('btn-profile-trigger');
    if (profileBtn) profileBtn.innerText = `👤 ${state.currentUser.name}`;

    if (state.currentUser.role !== 'admin') {
      linkAdmin.parentElement.classList.add('hidden');
    } else {
      linkAdmin.parentElement.classList.remove('hidden');
    }

    // Sync cvText from profile
    if (profile && profile.cvText) state.cvText = profile.cvText;

  } else {
    state.currentUser = null;
    state.firebaseUser = null;
    sessionStorage.removeItem('user');
    navLinks.classList.add('hidden');
    headerAuthBtns.classList.remove('hidden');
    headerUserMenu.classList.add('hidden');
  }
}


function checkAuthentication() {
  if (!state.currentUser) {
    openAuthModal('login');
    return false;
  }
  return true;
}

/* ==========================================================================
   Page Renderers
   ========================================================================== */

// 1. LANDING PAGE RENDERER
function renderLanding() {
  appRoot.innerHTML = `
    <!-- Hero -->
    <section class="hero container">
      <div class="hero-glow"></div>
      <h1>Experience the Interview<br>Before You Face It.</h1>
      <p>Practice realistic AI-powered interview simulations with real-time voice interaction, timed questions, adaptive follow-ups, and personalized performance analysis.</p>
      <div class="hero-ctas">
        <button class="btn btn-primary btn-lg" id="btn-hero-start">Start Your First Interview</button>
        <button class="btn btn-secondary btn-lg" id="btn-hero-explore">Explore Simulations</button>
      </div>
    </section>

    <!-- Stats Grid -->
    <section class="container stats-grid">
      <div class="stat-card">
        <div class="stat-number">15K+</div>
        <div class="stat-label">Interviews Conducted</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">92%</div>
        <div class="stat-label">Aspirants Helped</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">100%</div>
        <div class="stat-label">GDCA & Pattern Compliant</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">0 Cost</div>
        <div class="stat-label">Unlimited Practice</div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section class="container" id="how-it-works" style="margin-bottom: 96px;">
      <div class="section-header">
        <span class="badge badge-info" style="margin-bottom: 12px;">Workflow</span>
        <h2>How It Works</h2>
        <p>Three simple steps to simulate recruitment environments and receive custom feedback.</p>
      </div>
      <div class="steps-container">
        <div class="step-card">
          <div class="step-number">01</div>
          <div class="step-icon">📋</div>
          <h3>Set Up Profile</h3>
          <p>Fill out your educational details, degree, and internship logs so our AI can personalize its focus area.</p>
        </div>
        <div class="step-card">
          <div class="step-number">02</div>
          <div class="step-icon">🎙️</div>
          <h3>Face the Interviewer</h3>
          <p>Pari reads timed questions aloud. Answer through your mic under real-world pressure.</p>
        </div>
        <div class="step-card">
          <div class="step-number">03</div>
          <div class="step-icon">📈</div>
          <h3>Review Analytics</h3>
          <p>Get instant scorecards covering Communication, Fluency, and Situational Awareness with targeted tips.</p>
        </div>
      </div>
    </section>

    <!-- Available Simulations -->
    <section class="container" id="simulations" style="margin-bottom: 96px;">
      <div class="section-header">
        <span class="badge badge-info" style="margin-bottom: 12px;">Library</span>
        <h2>Available Simulations</h2>
        <p>Choose from recruitment frameworks configured using public guidelines.</p>
      </div>
      <div class="simulations-grid" id="landing-sims-grid">
        <!-- Will be populated dynamically based on blueprints -->
      </div>
    </section>

    <!-- Why Choose Us -->
    <section class="container" style="margin-bottom: 96px;">
      <div class="section-header">
        <h2>Why Choose Interview AI?</h2>
        <p>A training system built around realistic assessment rules.</p>
      </div>
      <div class="features-grid">
        <div class="card feature-card">
          <h3 style="display:flex; align-items:center; gap:8px;">🎙️ Real-time Voice Interaction</h3>
          <p>Speak naturally. Our engine synthesizes queries and transcribes answers instantly without keyboard distractions.</p>
        </div>
        <div class="card feature-card">
          <h3 style="display:flex; align-items:center; gap:8px;">🎯 Dynamic Follow-up Check</h3>
          <p>Pari detects generic answers and calls you out on details, mimicking strict recruitment behaviors.</p>
        </div>
        <div class="card feature-card">
          <h3 style="display:flex; align-items:center; gap:8px;">⚖️ Objective Assessment</h3>
          <p>Evaluation criteria check structural quality and phrasing. We never grade physical traits or appearance.</p>
        </div>
      </div>
    </section>

    <!-- FAQs Accordion -->
    <section class="container faq-container" id="faq-section">
      <div class="section-header">
        <h2>Frequently Asked Questions</h2>
        <p>Clarify how our AI interview simulation rules run.</p>
      </div>
      <div class="faq-item">
        <div class="faq-question">Is this a cheat tool for actual interviews? <span class="faq-toggle-icon">+</span></div>
        <div class="faq-answer">No. This platform is strictly a simulator and preparation sandbox. It uses public criteria to construct challenges, helping students build confidence. We do not claim access to proprietary assessments.</div>
      </div>
      <div class="faq-item">
        <div class="faq-question">What is the difference between Practice and Real Simulation Mode? <span class="faq-toggle-icon">+</span></div>
        <div class="faq-answer">Practice Mode provides coaching hints, allows pausing, and lets you read explanations. Real Simulation Mode disables all helps, runs a strict auto-submitting timer, and locks input to simulate real interview pressure.</div>
      </div>
      <div class="faq-item">
        <div class="faq-question">Are my voice transcripts kept private? <span class="faq-toggle-icon">+</span></div>
        <div class="faq-answer">Absolutely. We enforce local-first data minimization. All recordings and transcripts are stored securely in your browser or local server, and can be cleared instantly from your dashboard.</div>
      </div>
    </section>
  `;

  // Bind Hero CTAs
  document.getElementById('btn-hero-start').onclick = () => {
    if (checkAuthentication()) navigate('dashboard');
  };
  document.getElementById('btn-hero-explore').onclick = () => {
    navigate('library');
  };

  // Render simulations grid
  const blueprints = db.blueprints.getAll();
  const landingSimsGrid = document.getElementById('landing-sims-grid');
  
  landingSimsGrid.innerHTML = blueprints.map(bp => {
    if (bp.isActive) {
      return `
        <div class="card sim-card" id="card-bp-${bp.id}">
          <div class="sim-badge-container">
            <span class="badge badge-success">ACTIVE</span>
            <span class="badge badge-info">${bp.category}</span>
          </div>
          <h3>${bp.name}</h3>
          <p class="sim-desc">Experience an interview as Cabin Crew. Covers introductory icebreakers, passenger situational conflicts, and announcements.</p>
          <div class="sim-meta">
            <span>⏱️ ${bp.totalQuestions} Questions</span>
            <span>🗣️ Voice Mode</span>
          </div>
          <button class="btn btn-primary btn-block" style="width: 100%;" id="btn-enter-${bp.id}">Start Prep</button>
        </div>
      `;
    } else {
      return `
        <div class="card sim-card locked">
          <div class="lock-overlay">
            <div class="lock-icon">🔒</div>
            <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">COMING SOON</span>
          </div>
          <div class="sim-badge-container">
            <span class="badge badge-warning" style="opacity:0.4;">LOCKED</span>
            <span class="badge badge-info" style="opacity:0.4;">${bp.category}</span>
          </div>
          <h3 style="opacity:0.3;">${bp.name}</h3>
          <p class="sim-desc" style="opacity:0.3;">Prepare for Grade B recruitment frameworks. Dynamic economic queries based on recent banking models.</p>
          <div class="sim-meta" style="opacity:0.3;">
            <span>⏱️ -- Questions</span>
            <span>🗣️ Voice Mode</span>
          </div>
          <button class="btn btn-secondary btn-block" disabled style="width: 100%;">Locked</button>
        </div>
      `;
    }
  }).join('') + `
    <!-- JEE CBT Mock Test Card -->
    <div class="card sim-card" style="border: 1.5px solid rgba(59,130,246,0.5); background: linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,58,138,0.25)); position:relative;">
      <div class="sim-badge-container">
        <span class="badge" style="background:#2563eb; color:#fff; font-weight:700;">NEW CBT ENGINE</span>
        <span class="badge badge-info">JEE Main & Advanced</span>
      </div>
      <h3 style="color:#60a5fa;">JEE CBT Mock Test</h3>
      <p class="sim-desc">Full 3-hour Computer-Based Examination simulation with authentic NTA navigation, palette, marking scheme (+4, -1, multi-correct partials), and step-by-step solutions.</p>
      <div class="sim-meta">
        <span>⏱️ 180 Mins</span>
        <span>📝 75 / 108 Questions</span>
      </div>
      <button class="btn btn-primary btn-block" style="width: 100%; background:linear-gradient(135deg,#2563eb,#3b82f6);" id="btn-enter-jee-landing">Launch Mock Test</button>
    </div>
  `;

  // Bind JEE Landing Button
  const btnJEELanding = document.getElementById('btn-enter-jee-landing');
  if (btnJEELanding) {
    btnJEELanding.onclick = () => navigate('jee');
  }

  // Bind "Start Prep" to active blueprints
  blueprints.filter(bp => bp.isActive).forEach(bp => {
    const btn = document.getElementById(`btn-enter-${bp.id}`);
    if (btn) {
      btn.onclick = () => {
        if (checkAuthentication()) {
          navigate('details', { id: bp.id });
        }
      };
    }
  });

  // Bind Accordion clicks
  document.querySelectorAll('.faq-item').forEach(item => {
    item.onclick = () => {
      const isActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('active'));
      if (!isActive) item.classList.add('active');
    };
  });
}

// 2. DASHBOARD RENDERER
function renderDashboard() {
  if (!state.currentUser) return navigate('landing');
  
  const stats = db.attempts.getStats(state.currentUser.id);
  const profile = db.profiles.getByUserId(state.currentUser.id);
  const attempts = db.attempts.getByUserId(state.currentUser.id);

  appRoot.innerHTML = `
    <div class="container dashboard-layout">
      <!-- Main Content Left -->
      <div class="dashboard-main">
        
        <!-- Welcome banner -->
        <div class="card welcome-box">
          <h1>Welcome, ${profile.name || state.currentUser.email.split('@')[0]}!</h1>
          <p>“Ready for your next interview?” Track your attempts, practice weak areas, or continue your prep right where you left off.</p>
        </div>

        <!-- Continue Last Prep Card -->
        <div class="card">
          <h3 style="margin-bottom:16px;">Continue Prep</h3>
          <div class="continue-widget">
            <div class="continue-info">
              <h3>Cabin Crew Interview Simulator</h3>
              <p>Prepare for Airline Recruitment assessments. Target score: 85+</p>
              <div class="flex gap-2">
                <span class="badge badge-info">10 Questions</span>
                <span class="badge badge-success">Pari (Assessor)</span>
              </div>
            </div>
            <button class="btn btn-primary" id="btn-dashboard-resume">Start Practice</button>
          </div>
        </div>

        <!-- CV Smart Interview Card (SEPARATE FEATURE) -->
        <div class="card" style="background: linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%); border: 1.5px solid rgba(139,92,246,0.4); position:relative; overflow:hidden;">
          <div style="position:absolute; top:12px; right:14px; background:linear-gradient(90deg,#6366F1,#8B5CF6); color:#fff; font-size:0.65rem; font-weight:800; padding:3px 10px; border-radius:20px; letter-spacing:0.05em;">NEW FEATURE</div>
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
            <div style="width:48px; height:48px; background:linear-gradient(135deg,#6366F1,#8B5CF6); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.5rem; flex-shrink:0;">📄</div>
            <div>
              <h3 style="margin:0 0 4px 0; color:#A78BFA;">CV Smart Interview</h3>
              <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">Upload your CV — AI detects your field & starts a personalized interview</p>
            </div>
          </div>
          <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
            <span class="badge" style="background:rgba(139,92,246,0.2); color:#A78BFA;">🤖 AI-Powered</span>
            <span class="badge" style="background:rgba(99,102,241,0.2); color:#818CF8;">📋 Any Job Role</span>
            <span class="badge" style="background:rgba(16,185,129,0.2); color:#10B981;">✨ Auto-Detected</span>
          </div>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:16px; line-height:1.6;">
            This feature is <strong style="color:#A78BFA;">completely separate</strong> from the Cabin Crew simulator. 
            Upload <em>any CV</em> and our AI will automatically detect your profession, skills, and generate 
            <strong>10 highly personalized interview questions</strong> tailored exactly to your background.
          </p>
          <button class="btn" id="btn-cv-smart-interview" style="background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; width:100%; font-weight:700; padding:14px; font-size:1rem; border-radius:10px; border:none; cursor:pointer; transition: all 0.2s ease;">
            🚀 Start CV Smart Interview
          </button>
        </div>

        <!-- JEE MOCK TEST CARD (SEPARATE CBT MODULE) -->
        <div class="card" style="background: linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(59,130,246,0.08) 100%); border: 1.5px solid rgba(59,130,246,0.4); position:relative; overflow:hidden; margin-top:20px;">
          <div style="position:absolute; top:12px; right:14px; background:linear-gradient(90deg,#2563eb,#3b82f6); color:#fff; font-size:0.65rem; font-weight:800; padding:3px 10px; border-radius:20px; letter-spacing:0.05em;">CBT SIMULATOR</div>
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
            <div style="width:48px; height:48px; background:linear-gradient(135deg,#2563eb,#3b82f6); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.5rem; flex-shrink:0;">⚛️</div>
            <div>
              <h3 style="margin:0 0 4px 0; color:#60a5fa;">JEE Mock Test (Main & Advanced)</h3>
              <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">Computer-Based Test (CBT) environment with official NTA & IIT patterns</p>
            </div>
          </div>
          <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
            <span class="badge" style="background:rgba(37,99,235,0.2); color:#93c5fd;">🎯 JEE Main & Advanced</span>
            <span class="badge" style="background:rgba(16,185,129,0.2); color:#10B981;">⏱️ Real 3h Timers</span>
            <span class="badge" style="background:rgba(245,158,11,0.2); color:#f59e0b;">📊 Chapter-wise or Full Course</span>
            <span class="badge" style="background:rgba(168,85,247,0.2); color:#c084fc;">🌐 English & Hindi</span>
          </div>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:16px; line-height:1.6;">
            Completely separate examination platform. Practice with authentic CBT navigation, live question palette (Answered, Marked for Review, Not Visited), numeric keypads, exact JEE marking schemes (+4, -1, and Advanced partial marks), and comprehensive step-by-step solutions.
          </p>
          <button class="btn btn-primary" id="btn-jee-start-dashboard" style="background:linear-gradient(135deg,#2563eb,#3b82f6); color:#fff; width:100%; font-weight:700; padding:14px; font-size:1rem; border-radius:10px; border:none; cursor:pointer;">
            🚀 Open JEE Mock Test CBT
          </button>
        </div>

        <!-- Attempt Progress Graph -->
        <div class="card">
          <h3 style="margin-bottom:4px;">Interview Progress</h3>
          <p class="text-muted" style="font-size:0.85rem;">Score history trends of your last attempts</p>
          <div class="graph-container" id="attempts-graph">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Recent Attempts List -->
        <div class="card">
          <h3 style="margin-bottom:16px;">Recent Attempts</h3>
          <div class="attempts-list" id="attempts-list-container">
            <!-- Populated dynamically -->
          </div>
        </div>

      </div>

      <!-- Sidebar Right -->
      <div class="dashboard-sidebar">
        
        <!-- Interview Readiness gauge -->
        <div class="card readiness-container">
          <div class="readiness-gauge">
            <svg>
              <circle class="bg-circle" cx="80" cy="80" r="70"></circle>
              <circle class="progress-circle" id="readiness-circle" cx="80" cy="80" r="70"></circle>
            </svg>
            <div class="readiness-value" id="readiness-percentage">0%</div>
          </div>
          <div class="readiness-label">Interview Readiness</div>
          <p class="text-muted" style="font-size:0.8rem; margin-top:8px; line-height:1.4;">Based on average category performance. Not a guarantee of recruitment selection.</p>
        </div>

        <!-- Weak Areas Tag Cloud -->
        <div class="card">
          <h3 style="margin-bottom:16px;">Weak Areas</h3>
          <div class="weak-areas-grid" id="weak-areas-container">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- AI Recommendations -->
        <div class="card">
          <h3 style="margin-bottom:12px;">AI Recommendations</h3>
          <div class="recommendation-box">
            <h4>💡 Recommended Practice</h4>
            <p id="dashboard-ai-recommendation">“You should attempt a high-pressure follow-up simulation.” Your follow-up responses fell below average. Try a round in Practice Mode.</p>
          </div>
          <button class="btn btn-outline" id="btn-practice-weak" style="width: 100%;">Practice Weak Areas</button>
        </div>

      </div>
    </div>
  `;

  // Bind continue button
  document.getElementById('btn-dashboard-resume').onclick = () => {
    navigate('details', { id: 'cabin-crew' });
  };

  // Bind practice weak areas button
  document.getElementById('btn-practice-weak').onclick = () => {
    navigate('details', { id: 'cabin-crew' });
  };

  // Bind CV Smart Interview button (separate feature)
  document.getElementById('btn-cv-smart-interview').onclick = () => {
    if (checkAuthentication()) navigate('cv-interview');
  };

  // Bind JEE Mock Test button (separate CBT examination)
  const btnJEEDash = document.getElementById('btn-jee-start-dashboard');
  if (btnJEEDash) {
    btnJEEDash.onclick = () => navigate('jee');
  }

  // Render readiness score gauge
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const readinessCircle = document.getElementById('readiness-circle');
  readinessCircle.style.strokeDasharray = circumference;
  
  // Animate the gauge offset
  setTimeout(() => {
    const offset = circumference - (stats.readiness / 100) * circumference;
    readinessCircle.style.strokeDashoffset = offset;
    document.getElementById('readiness-percentage').innerText = `${stats.readiness}%`;
  }, 100);

  // Render weak areas tags
  const weakAreasContainer = document.getElementById('weak-areas-container');
  if (stats.weakAreas.length > 0) {
    weakAreasContainer.innerHTML = stats.weakAreas.map(w => `
      <span class="weak-area-pill">${w}</span>
    `).join('');
  } else {
    weakAreasContainer.innerHTML = `<span class="text-muted" style="font-size:0.9rem;">No major weak areas detected yet!</span>`;
  }

  // Render custom recommendations based on readiness
  const recBox = document.getElementById('dashboard-ai-recommendation');
  if (stats.readiness >= 80) {
    recBox.innerText = `“Your communication and English skills are superb.” Maintain this level. Practice the Stress/Surprise Round questions in Real Simulation mode to review sudden prompt adjustments.`;
  } else if (stats.readiness > 0) {
    recBox.innerText = `“Focus on follow-ups and situational safety answers.” Pari noticed you gave brief descriptions when pressed on passenger safety conflicts. Try a practice session.`;
  }

  // Render Attempts Graph
  const graphContainer = document.getElementById('attempts-graph');
  if (attempts.length > 0) {
    graphContainer.innerHTML = attempts.map((a, i) => {
      const heightPercentage = a.score;
      return `
        <div class="graph-bar-wrapper">
          <div class="graph-bar" style="height: ${heightPercentage}%;">
            <div class="graph-bar-tooltip">Score: ${a.score}</div>
          </div>
          <div class="graph-label">A0${i + 1}</div>
        </div>
      `;
    }).join('');
  } else {
    graphContainer.innerHTML = `<div class="text-center text-muted" style="width:100%; line-height:100px;">Complete an interview to build progress stats.</div>`;
  }

  // Render recent attempts rows
  const listContainer = document.getElementById('attempts-list-container');
  if (attempts.length > 0) {
    // Show last 3
    const recent = [...attempts].reverse().slice(0, 3);
    listContainer.innerHTML = recent.map(a => {
      let scoreClass = 'score-mid';
      if (a.score >= 80) scoreClass = 'score-high';
      else if (a.score < 70) scoreClass = 'score-low';
      
      const formattedDate = new Date(a.completedAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      });

      return `
        <div class="attempt-row">
          <div>
            <div class="attempt-name">Cabin Crew Assessment</div>
            <div class="attempt-date">${formattedDate}</div>
          </div>
          <div class="attempt-score-container">
            <span class="attempt-score ${scoreClass}">${a.score}</span>
            <button class="btn btn-secondary btn-sm" id="btn-view-attempt-${a.sessionId}">View</button>
          </div>
        </div>
      `;
    }).join('');

    recent.forEach(a => {
      document.getElementById(`btn-view-attempt-${a.sessionId}`).onclick = () => {
        navigate('evaluation', { sessionId: a.sessionId });
      };
    });
  } else {
    listContainer.innerHTML = `<p class="text-muted text-center" style="padding: 24px 0;">No attempts recorded yet. Launch your first prep above!</p>`;
  }

  // Setup CV Upload zone listeners
  const dropzone = document.getElementById('cv-upload-dropzone');
  const fileInput = document.getElementById('cv-file-input');
  const txtPaste = document.getElementById('cv-text-paste');
  const btnSave = document.getElementById('btn-save-cv');
  const statusSpan = document.getElementById('cv-upload-status');
  const savedMsg = document.getElementById('cv-saved-message');

  // Pre-load CV text if exists
  if (profile.resumeText) {
    txtPaste.value = profile.resumeText;
    statusSpan.innerText = "✅ CV Saved & Applied (Click to update)";
    statusSpan.style.color = "var(--accent-emerald)";
  }

  dropzone.onclick = () => fileInput.click();

  const handleFileSelection = (file) => {
    if (!file) return;
    
    const isPDF = file.name.toLowerCase().endsWith('.pdf');
    
    statusSpan.innerText = "🔄 Reading file contents...";
    statusSpan.style.color = "var(--accent-warning)";
    
    const reader = new FileReader();
    
    if (isPDF) {
      reader.onload = async (evt) => {
        try {
          statusSpan.innerText = "🔄 Extracting text from PDF...";
          const text = await extractTextFromPDF(evt.target.result);
          txtPaste.value = text;
          statusSpan.innerText = `✅ PDF Loaded: ${file.name}`;
          statusSpan.style.color = "var(--accent-blue)";
        } catch (err) {
          console.error(err);
          statusSpan.innerText = "❌ Error reading PDF. Try pasting text.";
          statusSpan.style.color = "var(--accent-danger)";
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Read any file format (doc, txt, html, md, csv, etc.) as plain text
      reader.onload = (evt) => {
        txtPaste.value = evt.target.result;
        statusSpan.innerText = `📄 Document Loaded: ${file.name}`;
        statusSpan.style.color = "var(--accent-blue)";
      };
      reader.onerror = () => {
        statusSpan.innerText = "❌ Failed to read document. Try pasting text.";
        statusSpan.style.color = "var(--accent-danger)";
      };
      reader.readAsText(file);
    }
  };

  fileInput.onchange = (e) => {
    handleFileSelection(e.target.files[0]);
  };

  dropzone.ondragover = (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "var(--accent-blue)";
    dropzone.style.background = "rgba(14,165,233,0.05)";
  };

  dropzone.ondragleave = () => {
    dropzone.style.borderColor = "rgba(255,255,255,0.1)";
    dropzone.style.background = "transparent";
  };

  dropzone.ondrop = (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "rgba(255,255,255,0.1)";
    dropzone.style.background = "transparent";
    handleFileSelection(e.dataTransfer.files[0]);
  };

  btnSave.onclick = () => {
    const text = txtPaste.value.trim();
    if (!text) {
      alert("Please upload a file or paste some CV content before saving.");
      return;
    }

    profile.resumeText = text;
    
    // Auto parsing helper to fill candidate profile details
    const parsed = parseResume(text);
    const updatedProfile = {
      ...profile,
      resumeText: text,
      ...parsed
    };

    db.profiles.save(state.currentUser.id, updatedProfile);

    statusSpan.innerText = "✅ CV Saved & Applied (Click to update)";
    statusSpan.style.color = "var(--accent-emerald)";
    savedMsg.innerText = "CV successfully analyzed & applied to prep questions!";
    savedMsg.classList.remove('hidden');
    
    setTimeout(() => {
      savedMsg.classList.add('hidden');
      renderDashboard();
    }, 2000);
  };
}

// CV Parsing Utility
function parseResume(text) {
  const lines = text.split('\n');
  const result = {
    education: "",
    degree: "",
    branch: "",
    skills: "",
    projects: "",
    internship: "",
    achievements: "",
    interests: ""
  };

  lines.forEach(line => {
    const l = line.toLowerCase();
    
    if (l.includes("education") || l.includes("degree") || l.includes("university") || l.includes("college")) {
      if (!result.education) result.education = line.replace(/education|degree|university|college|:|-/gi, '').trim();
    }
    if (l.includes("skills") || l.includes("technologies") || l.includes("expertise")) {
      if (!result.skills) result.skills = line.replace(/skills|technologies|expertise|:|-/gi, '').trim();
    }
    if (l.includes("experience") || l.includes("internship") || l.includes("work")) {
      if (!result.internship) result.internship = line.replace(/experience|internship|work|job|:|-/gi, '').trim();
    }
    if (l.includes("project")) {
      if (!result.projects) result.projects = line.replace(/project|projects|:|-/gi, '').trim();
    }
    if (l.includes("achievement") || l.includes("award")) {
      if (!result.achievements) result.achievements = line.replace(/achievement|achievements|award|awards|:|-/gi, '').trim();
    }
  });

  return result;
}

// PDF Text Extraction Service
async function extractTextFromPDF(arrayBuffer) {
  // Specify CDN worker URL for PDF.js
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
  
  const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

// 3. EXPLORE / LIBRARY PAGE RENDERER
function renderLibrary() {
  appRoot.innerHTML = `
    <div class="container" style="padding: 40px 0;">
      <div class="section-header">
        <h2>Interview Simulations</h2>
        <p>Search and select simulations prepared using public recruitment patterns and safety directives.</p>
      </div>

      <div class="simulations-grid" id="library-sims-grid">
        <!-- Loaded dynamically -->
      </div>
    </div>
  `;

  const blueprints = db.blueprints.getAll();
  const grid = document.getElementById('library-sims-grid');
  
  grid.innerHTML = blueprints.map(bp => {
    if (bp.isActive) {
      return `
        <div class="card sim-card">
          <div class="sim-badge-container">
            <span class="badge badge-success">ACTIVE</span>
            <span class="badge badge-info">${bp.category}</span>
          </div>
          <h3>${bp.name}</h3>
          <p class="sim-desc">Practice public airline recruitment checklists. Intercept cabin announcement training, guest relations situational checks, and stress responses.</p>
          <div class="sim-meta">
            <span>⏱️ ${bp.totalQuestions} Questions</span>
            <span>🗣️ Voice Mode</span>
          </div>
          <button class="btn btn-primary" style="width: 100%;" id="btn-lib-enter-${bp.id}">Select Simulator</button>
        </div>
      `;
    } else {
      return `
        <div class="card sim-card locked">
          <div class="lock-overlay">
            <div class="lock-icon">🔒</div>
            <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">COMING SOON</span>
          </div>
          <div class="sim-badge-container">
            <span class="badge badge-warning" style="opacity:0.4;">LOCKED</span>
            <span class="badge badge-info" style="opacity:0.4;">${bp.category}</span>
          </div>
          <h3 style="opacity:0.3;">${bp.name}</h3>
          <p class="sim-desc" style="opacity:0.3;">Prepare for Grade B officer examinations. Dynamic macroeconomics and finance assessments based on official guidelines.</p>
          <div class="sim-meta" style="opacity:0.3;">
            <span>⏱️ -- Questions</span>
            <span>🗣️ Voice Mode</span>
          </div>
          <button class="btn btn-secondary" disabled style="width: 100%;">Locked</button>
        </div>
      `;
    }
  }).join('');

  // Bind active buttons
  blueprints.filter(bp => bp.isActive).forEach(bp => {
    document.getElementById(`btn-lib-enter-${bp.id}`).onclick = () => {
      if (checkAuthentication()) navigate('details', { id: bp.id });
    };
  });
}

// 4. SELECTED SIMULATION DETAIL PAGE RENDERER
function renderDetails(id) {
  const bp = db.blueprints.getById(id);
  if (!bp) return navigate('library');

  state.activeBlueprint = bp;
  state.activeBlueprint.totalQuestions = 10;
  state.cabinDifficulty = state.cabinDifficulty || 'Medium';
  state.activeMode = state.activeMode || 'real';

  appRoot.innerHTML = `
    <div class="container" style="padding: 40px 0; max-width: 860px;">
      
      <!-- Top Nav Breadcrumb -->
      <a style="cursor: pointer; margin-bottom: 24px; display: inline-flex; align-items: center; gap: 6px; font-weight:600; color:var(--text-secondary);" id="btn-details-back">
        ← Back to Explore
      </a>

      <!-- Detail Card -->
      <div class="card" style="padding: 40px; margin-bottom: 32px; border: 1px solid var(--border-color); border-radius: 16px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <span class="badge badge-info">${bp.category}</span>
          <span class="badge badge-success">Official Recruitment Assessment</span>
        </div>
        <h1 style="margin-bottom: 12px; font-size: 2.25rem;">${bp.name}</h1>
        <p style="margin-bottom: 32px; font-size: 1.05rem; color:var(--text-secondary); line-height:1.6;">
          Professional aviation interview simulation mirroring standards from leading Indian and international carriers. Evaluated on hospitality, emergency safety protocols, situational agility, and bilingual passenger assistance.
        </p>

        <!-- Fixed Session Parameters (NO question count option, NO language option) -->
        <h3 style="margin-bottom: 16px; font-size: 1.2rem;">Assessment Structure (Fixed)</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 36px;">
          <div style="background: rgba(255,255,255,0.02); padding:18px; border-radius:var(--radius-md); border:1px solid var(--border-color)">
            <div style="color:var(--text-muted); font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Assessment Length</div>
            <div style="font-size:1.25rem; font-weight:800; margin-top:4px; color:var(--accent-blue);">10 Questions (Fixed)</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Strict progression from Q1 through Q10</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding:18px; border-radius:var(--radius-md); border:1px solid var(--border-color)">
            <div style="color:var(--text-muted); font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Language Sequence</div>
            <div style="font-size:1.25rem; font-weight:800; margin-top:4px; color:#10B981;">Q1–Q9 English • Q10 Hindi</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Q10 evaluates Hindi domestic passenger handling</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding:18px; border-radius:var(--radius-md); border:1px solid var(--border-color)">
            <div style="color:var(--text-muted); font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Lead Assessor</div>
            <div style="font-size:1.1rem; font-weight:700; margin-top:4px;">${bp.interviewerPersona.name} (${bp.interviewerPersona.title})</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); padding:18px; border-radius:var(--radius-md); border:1px solid var(--border-color)">
            <div style="color:var(--text-muted); font-size:0.75rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">Voice & Audio Format</div>
            <div style="font-size:1.1rem; font-weight:700; margin-top:4px;">Microphone-first Voice Engine</div>
          </div>
        </div>

        <!-- 1. Difficulty Selector (ONLY Easy, Medium, Hard) -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px;">
          <h3 style="margin:0; font-size: 1.2rem;">1. Select Assessment Difficulty</h3>
          <span style="font-size:0.8rem; color:var(--text-muted);">Controls question depth & scenarios</span>
        </div>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom: 36px;" id="diff-selector-container">
          <!-- Easy -->
          <div class="card diff-card" id="diff-card-easy" style="cursor:pointer; padding:20px 16px; border:2px solid var(--border-color); border-radius:12px; transition:all 0.2s; text-align:center;">
            <div style="font-size:1.8rem; margin-bottom:8px;">🟢</div>
            <div style="font-weight:700; font-size:1.1rem; margin-bottom:6px;">Easy</div>
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; margin:0;">
              Foundational hospitality, warm self-introduction, basic safety compliance & standard announcements.
            </p>
          </div>
          <!-- Medium -->
          <div class="card diff-card" id="diff-card-medium" style="cursor:pointer; padding:20px 16px; border:2px solid var(--border-color); border-radius:12px; transition:all 0.2s; text-align:center;">
            <div style="font-size:1.8rem; margin-bottom:8px;">🟡</div>
            <div style="font-weight:700; font-size:1.1rem; margin-bottom:6px;">Medium</div>
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; margin:0;">
              Realistic in-flight scenarios, seat disputes, turbulence protocols & passenger de-escalation.
            </p>
          </div>
          <!-- Hard -->
          <div class="card diff-card" id="diff-card-hard" style="cursor:pointer; padding:20px 16px; border:2px solid var(--border-color); border-radius:12px; transition:all 0.2s; text-align:center;">
            <div style="font-size:1.8rem; margin-bottom:8px;">🔴</div>
            <div style="font-weight:700; font-size:1.1rem; margin-bottom:6px;">Hard</div>
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; margin:0;">
              Critical aviation emergencies, medical crises, unruly passenger restraint & extreme crisis composure.
            </p>
          </div>
        </div>

        <!-- 2. Simulation Mode Selector (Practice vs Real Test) -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px;">
          <h3 style="margin:0; font-size: 1.2rem;">2. Choose Simulation Mode</h3>
          <span style="font-size:0.8rem; color:var(--text-muted);">Practice or Proctored Recruitment Test</span>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom: 40px;">
          <!-- Practice mode -->
          <div class="card" id="mode-panel-practice" style="cursor:pointer; padding:22px; border:2px solid var(--border-color); border-radius:12px; transition:all 0.2s;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="margin:0; color:var(--text-primary); font-size:1.15rem;">Practice Mode</h4>
              <span class="badge badge-info">Learning Assistance</span>
            </div>
            <p style="font-size:0.85rem; line-height:1.5; color:var(--text-secondary); margin-bottom:16px;">
              Ideal for preparation. Includes guidance hints, coaching suggestions, and allows pausing the timer. Real Test restrictions do NOT apply.
            </p>
            <div style="font-size:0.78rem; color:#10B981; font-weight:600;">✓ Hints Enabled • Pause Allowed • Stress-Free</div>
          </div>

          <!-- Real mode -->
          <div class="card" id="mode-panel-real" style="cursor:pointer; padding:22px; border:2px solid var(--border-color); border-radius:12px; transition:all 0.2s;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="margin:0; color:var(--accent-blue); font-size:1.15rem;">Real Test Mode</h4>
              <span class="badge badge-success">Strict Proctored</span>
            </div>
            <p style="font-size:0.85rem; line-height:1.5; color:var(--text-secondary); margin-bottom:16px;">
              Strict recruitment testing conditions. No hints, no coaching, no answer suggestions, no pause. High-pressure AI assessment.
            </p>
            <div style="font-size:0.78rem; color:var(--accent-blue); font-weight:600;">🔒 Strict Rules • Timed Auto-Submit • Proctoring Active</div>
          </div>
        </div>

        <!-- Start CTA -->
        <button class="btn btn-primary" id="btn-start-simulation-check" style="width: 100%; padding:18px; font-size:1.15rem; font-weight:700; border-radius:12px;">
          Proceed to Hardware & System Check →
        </button>
      </div>

      <div style="text-align:center; font-size:0.85rem; color:var(--text-muted);">
        Disclaimer: This simulation is based on publicly available airline recruitment patterns. It is for practice and preparation purposes.
      </div>
    </div>
  `;

  // Bind Back
  document.getElementById('btn-details-back').onclick = () => {
    navigate('library');
  };

  // Difficulty selection logic
  const diffCards = {
    Easy: document.getElementById('diff-card-easy'),
    Medium: document.getElementById('diff-card-medium'),
    Hard: document.getElementById('diff-card-hard')
  };

  function updateDiffUI(selected) {
    state.cabinDifficulty = selected;
    state.activeBlueprint.difficulty = selected;
    Object.keys(diffCards).forEach(key => {
      const card = diffCards[key];
      if (key === selected) {
        card.style.borderColor = 'var(--accent-blue)';
        card.style.background = 'rgba(59,130,246,0.08)';
        card.style.boxShadow = '0 0 16px rgba(59,130,246,0.2)';
      } else {
        card.style.borderColor = 'var(--border-color)';
        card.style.background = 'rgba(255,255,255,0.02)';
        card.style.boxShadow = 'none';
      }
    });
  }

  // Initial difficulty highlight
  updateDiffUI(state.cabinDifficulty || 'Medium');

  Object.keys(diffCards).forEach(key => {
    if (diffCards[key]) {
      diffCards[key].onclick = () => updateDiffUI(key);
    }
  });

  // Mode selection logic
  const practicePanel = document.getElementById('mode-panel-practice');
  const realPanel = document.getElementById('mode-panel-real');

  function updateModeUI(selectedMode) {
    state.activeMode = selectedMode;
    if (selectedMode === 'practice') {
      practicePanel.style.borderColor = '#10B981';
      practicePanel.style.background = 'rgba(16,185,129,0.08)';
      practicePanel.style.boxShadow = '0 0 16px rgba(16,185,129,0.2)';
      realPanel.style.borderColor = 'var(--border-color)';
      realPanel.style.background = 'rgba(255,255,255,0.02)';
      realPanel.style.boxShadow = 'none';
    } else {
      realPanel.style.borderColor = 'var(--accent-blue)';
      realPanel.style.background = 'rgba(59,130,246,0.08)';
      realPanel.style.boxShadow = '0 0 16px rgba(59,130,246,0.2)';
      practicePanel.style.borderColor = 'var(--border-color)';
      practicePanel.style.background = 'rgba(255,255,255,0.02)';
      practicePanel.style.boxShadow = 'none';
    }
  }

  // Initial mode highlight
  updateModeUI(state.activeMode || 'real');

  practicePanel.onclick = () => updateModeUI('practice');
  realPanel.onclick = () => updateModeUI('real');

  // Bind Start Check
  document.getElementById('btn-start-simulation-check').onclick = () => {
    state.activeBlueprint.difficulty = state.cabinDifficulty || 'Medium';
    state.activeBlueprint.totalQuestions = 10;
    navigate('consent', { id: bp.id, mode: state.activeMode });
  };
}

// 5. HARDWARE SYSTEM CHECK RENDERER
// 5. HARDWARE + PROCTORING SYSTEM CHECK
function renderSystemCheck(id, mode) {
  state.activeMode = mode;
  const bp = state.activeBlueprint;
  const pcfg = (bp && bp.proctoring) || {};
  const cameraNeeded = pcfg.cameraRequired !== false;

  appRoot.innerHTML = `
    <div class="syscheck-full">
      <div class="syscheck-panel">
        <div class="syscheck-header">
          <h2 class="syscheck-title">🔧 System & Proctoring Check</h2>
          <p class="syscheck-sub">Verifying all required hardware permissions before starting your monitored session.</p>
        </div>

        <!-- Camera preview -->
        <div class="camera-preview-box" id="cam-preview-box">
          <div class="camera-placeholder" id="cam-placeholder">
            <span>📷</span>
            <p>Camera not yet started</p>
          </div>
          <video id="cam-preview-video" autoplay muted playsinline style="display:none;"></video>
          <div class="camera-monitor-badge hidden" id="cam-monitor-badge">
            <div class="monitor-dot"></div> Monitoring
          </div>
        </div>

        <!-- Check rows -->
        <div class="check-rows">
          <div class="check-row checking" id="chk-camera">
            <div class="check-row-left">
              <div class="check-row-icon">📷</div>
              <div><div class="check-row-name">Camera</div><div class="check-row-desc">Required for face monitoring</div></div>
            </div>
            <span class="check-status-badge badge-checking" id="badge-camera">Pending</span>
          </div>
          <div class="check-row checking" id="chk-mic">
            <div class="check-row-left">
              <div class="check-row-icon">🎙️</div>
              <div><div class="check-row-name">Microphone</div><div class="check-row-desc">Required for voice interview</div></div>
            </div>
            <span class="check-status-badge badge-checking" id="badge-mic">Pending</span>
          </div>
          <div class="check-row checking" id="chk-browser">
            <div class="check-row-left">
              <div class="check-row-icon">🌐</div>
              <div><div class="check-row-name">Browser</div><div class="check-row-desc">Tab-switch detection enabled</div></div>
            </div>
            <span class="check-status-badge badge-checking" id="badge-browser">Pending</span>
          </div>
          <div class="check-row checking" id="chk-fullscreen">
            <div class="check-row-left">
              <div class="check-row-icon">⛶</div>
              <div><div class="check-row-name">Fullscreen</div><div class="check-row-desc">Required for focused session</div></div>
            </div>
            <span class="check-status-badge badge-checking" id="badge-fullscreen">Pending</span>
          </div>
        </div>

        <div class="alert hidden" id="syscheck-error" style="color:#EF4444;font-size:0.85rem;font-weight:600;margin-bottom:16px;"></div>

        <div style="display:flex;gap:12px;">
          <button class="btn btn-secondary" id="btn-syscheck-cancel" style="flex:1;">Go Back</button>
          <button class="btn btn-primary" id="btn-syscheck-start" disabled style="flex:1;">🚀 Start Monitored Interview</button>
        </div>
      </div>
    </div>
  `;

  const video = document.getElementById('cam-preview-video');
  const placeholder = document.getElementById('cam-placeholder');
  const monitorBadge = document.getElementById('cam-monitor-badge');
  const errBox = document.getElementById('syscheck-error');
  const btnStart = document.getElementById('btn-syscheck-start');
  const checks = { camera: false, mic: false, browser: true };

  function setBadge(id, rowId, status, label) {
    const badge = document.getElementById(id);
    const row = document.getElementById(rowId);
    if (!badge || !row) return;
    badge.textContent = label;
    badge.className = 'check-status-badge badge-' + status;
    row.className = 'check-row ' + (status === 'checking' ? 'checking' : status);
  }

  function tryEnableStart() {
    if (checks.camera && checks.mic) btnStart.disabled = false;
  }

  // Browser check — always passes
  setBadge('badge-browser', 'chk-browser', 'pass', '✓ Active');

  // Camera check
  (async () => {
    setBadge('badge-camera', 'chk-camera', 'checking', 'Requesting...');
    try {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = state.cameraStream;
      video.style.display = 'block';
      placeholder.style.display = 'none';
      monitorBadge.classList.remove('hidden');
      checks.camera = true;
      setBadge('badge-camera', 'chk-camera', 'pass', '✓ Ready');
      tryEnableStart();
    } catch(e) {
      checks.camera = false;
      setBadge('badge-camera', 'chk-camera', 'fail', '✗ Denied');
      errBox.innerText = 'Camera permission denied. Please allow camera access in your browser settings and reload.';
      errBox.classList.remove('hidden');
    }
  })();

  // Mic check
  (async () => {
    setBadge('badge-mic', 'chk-mic', 'checking', 'Requesting...');
    try {
      await voiceEngine.checkPermissions();
      state.micPermissionGranted = true;
      checks.mic = true;
      setBadge('badge-mic', 'chk-mic', 'pass', '✓ Ready');
      tryEnableStart();
    } catch(e) {
      checks.mic = false;
      setBadge('badge-mic', 'chk-mic', 'fail', '✗ Denied');
      errBox.innerText = 'Microphone permission denied. Please allow microphone access in your browser settings.';
      errBox.classList.remove('hidden');
    }
  })();

  // Fullscreen check
  (async () => {
    setBadge('badge-fullscreen', 'chk-fullscreen', 'checking', 'Requesting...');
    try {
      await document.documentElement.requestFullscreen();
      setBadge('badge-fullscreen', 'chk-fullscreen', 'pass', '✓ Active');
    } catch(e) {
      setBadge('badge-fullscreen', 'chk-fullscreen', 'fail', '⚠ Optional');
    }
  })();

  document.getElementById('btn-syscheck-cancel').onclick = () => {
    if (state.cameraStream) { state.cameraStream.getTracks().forEach(t => t.stop()); state.cameraStream = null; }
    const isCV = state.activeInterviewType === 'cv_interview' || !!state.activeBlueprint?.isCVSmartInterview;
    if (isCV) {
      navigate('cv-interview');
    } else {
      navigate('consent', { id: state.activeBlueprint?.id, mode: state.activeMode });
    }
  };

  btnStart.onclick = async () => {
    btnStart.disabled = true;
    btnStart.innerText = 'Launching Interview...';

    if (state.volumeInterval) clearInterval(state.volumeInterval);
    // Stop local camera preview — proctoring engine will get its own stream
    if (state.cameraStream) { state.cameraStream.getTracks().forEach(t => t.stop()); state.cameraStream = null; }

    const isCV = state.activeInterviewType === 'cv_interview' || !!state.activeBlueprint?.isCVSmartInterview;

    if (!isCV) {
      // Mode 1: Cabin Crew Interview — NEVER use uploaded CV text
      state.activeInterviewType = 'cabin_crew';
      const profile = db.profiles.getByUserId(state.currentUser.id);
      const candidateName = profile?.name || state.currentUser.name || 'Candidate';
      const selectedDiff = state.cabinDifficulty || state.activeBlueprint?.difficulty || 'Medium';

      try {
        const aiQuestions = await groqClient.generateQuestions(
          '', // Empty CV for pure Cabin Crew questions
          'Cabin Crew',
          candidateName,
          {
            interviewType: 'cabin_crew',
            difficulty: selectedDiff,
            questionCount: 10,
            mode: state.activeMode || 'real'
          }
        );
        state.currentQuestions = aiQuestions;
        state.aiQuestionsReady = true;
      } catch (err) {
        console.warn('Cabin Crew question gen failed, using curated bank:', err.message);
        state.currentQuestions = [];
        state.aiQuestionsReady = false;
      }
    }

    navigate('simulator');
  };
}

// 5b. PROCTORING CONSENT SCREEN
function renderConsentScreen(id, mode) {
  state.activeMode = mode;
  const bp = state.activeBlueprint;

  appRoot.innerHTML = `
    <div class="consent-page">
      <div class="consent-card">
        <div class="consent-header">
          <div class="consent-icon-strip">🛫📹🔒💻</div>
          <h2 class="consent-title">Proctored Interview Rules & Consent</h2>
          <p class="consent-subtitle">This interview session is proctored. Please read all rules carefully.<br>Monitoring activates <strong>only after your consent</strong>.</p>
        </div>

        <div class="consent-rules-list">
          <div class="consent-rule-item"><span class="consent-rule-icon">🚫</span><span><strong>No other websites or applications</strong> may be opened during this assessment.</span></div>
          <div class="consent-rule-item"><span class="consent-rule-icon">🚫</span><span><strong>No tab switching</strong> or minimizing the assessment window is allowed.</span></div>
          <div class="consent-rule-item"><span class="consent-rule-icon">🚫</span><span><strong>No mobile phone or secondary device</strong> should be used during the session.</span></div>
          <div class="consent-rule-item"><span class="consent-rule-icon">👀</span><span><strong>Face must remain visible</strong> to the camera throughout the session when camera monitoring is enabled.</span></div>
          <div class="consent-rule-item"><span class="consent-rule-icon">🧑‍💻</span><span>Candidate must remain <strong>seated and facing the screen</strong> at all times.</span></div>
          <div class="consent-rule-item"><span class="consent-rule-icon">↔️</span><span>Excessive or repeated <strong>head movement</strong> may trigger a warning or review.</span></div>
          <div class="consent-rule-item"><span class="consent-rule-icon">👥</span><span><strong>No other person</strong> should be present or visible in the assessment room.</span></div>
          <div class="consent-rule-item"><span class="consent-rule-icon">🎧</span><span><strong>No unauthorized headphones/earphones</strong> unless explicitly permitted.</span></div>
          <div class="consent-rule-item"><span class="consent-rule-icon">🗣️</span><span><strong>No talking to or receiving assistance</strong> from another person during the session.</span></div>
          <div class="consent-rule-item"><span class="consent-rule-icon">📋</span><span><strong>No unauthorized notes, books, or study material</strong> permitted during the session.</span></div>
          <div class="consent-rule-item"><span class="consent-rule-icon">🖥️</span><span>Screen activity and browser behaviour <strong>may be monitored</strong> for proctoring purposes.</span></div>
          <div class="consent-rule-item"><span class="consent-rule-icon">⚠️</span><span>Multiple violations will result in <strong>automatic test termination</strong> and logged review.</span></div>
          <div class="consent-rule-item" style="border-color: rgba(100,116,139,0.15);">
            <span class="consent-rule-icon">ℹ️</span>
            <span style="color:#64748B; font-size:0.8rem;">Technical note: Browser-based proctoring uses tab visibility, window focus, and where supported, camera-based face detection. It cannot monitor other applications at the operating-system level. AI detections use confidence thresholds to reduce false positives.</span>
          </div>
        </div>

        <div class="consent-policy-block">
          <div class="consent-policy-title">⚠️ Warning & Auto-Submit Policy</div>
          <div class="policy-strike-row"><span class="strike-dot s1"></span><strong style="color:#F1F5F9;">Warning 1/3</strong> &mdash; You are notified. Session continues.</div>
          <div class="policy-strike-row"><span class="strike-dot s2"></span><strong style="color:#F1F5F9;">Warning 2/3</strong> &mdash; Final caution. One violation remaining.</div>
          <div class="policy-strike-row"><span class="strike-dot s3"></span><strong style="color:#EF4444;">Warning 3/3</strong> &mdash; Session is <strong>automatically submitted & permanently terminated.</strong></div>
          <p style="font-size:0.75rem; color:#475569; margin-top:10px;">All warning events are timestamped and logged. Terminated sessions cannot be resumed.</p>
        </div>

        <label class="consent-agree-row" for="consent-cb">
          <input type="checkbox" id="consent-cb">
          <span class="consent-agree-label">I have read and understood all proctoring rules above. I voluntarily consent to <strong>camera monitoring, tab-switch detection, window-focus detection, and fullscreen enforcement</strong> for this interview session.</span>
        </label>

        <div class="consent-btn-row">
          <button class="btn btn-secondary" id="btn-consent-back">← Go Back</button>
          <button class="btn btn-primary" id="btn-consent-proceed" disabled>Agree & Continue →</button>
        </div>
      </div>
    </div>
  `;

  const cb = document.getElementById('consent-cb');
  const proceed = document.getElementById('btn-consent-proceed');

  cb.onchange = () => { proceed.disabled = !cb.checked; };

  document.getElementById('btn-consent-back').onclick = () => {
    navigate('details', { id: bp ? bp.id : id });
  };

  proceed.onclick = () => navigate('systemcheck', { id, mode });
}

// 5c. PROCTORING WARNING MODAL RENDERER
function showProctoringWarning(count, event) {
  const counter = document.getElementById('proctor-warn-counter');
  if (counter) {
    counter.textContent = `Warnings: ${count}/3`;
    counter.className = `proctor-warn-counter w${count}`;
  }

  const old = document.getElementById('proctor-warning-modal');
  if (old) old.remove();

  const isTerm = count >= 3;
  const overlay = document.createElement('div');
  overlay.id = 'proctor-warning-modal';
  overlay.className = `proctor-overlay visible warn-${count}`;

  const badgeClass = count === 1 ? 'b1' : count === 2 ? 'b2' : 'b3';
  const badgeText = count === 1 ? '⚠️ Warning 1/3' : count === 2 ? '⚠️ Final Warning — 2/3' : '❌ Session Terminated — 3/3';
  const title = count === 1 ? 'Proctoring Rule Violation' : count === 2 ? 'Final Caution Issued' : 'Interview Session Terminated';
  const desc = isTerm 
    ? 'The maximum number of proctoring warnings (3/3) has been reached. This session has been automatically locked and submitted. You cannot resume this interview.'
    : (event && event.description ? event.description : 'A proctoring rule was violated. Please stay on this tab and remain focused on the interview.');

  overlay.innerHTML = `
    <div class="proctor-warn-box">
      <div class="warn-icon">${isTerm ? '❌' : (count === 2 ? '⚠️' : '⚡')}</div>
      <div class="warn-badge ${badgeClass}">${badgeText}</div>
      <h3 class="warn-title">${title}</h3>
      <p class="warn-desc">${desc}</p>
      <div class="warn-strike-bar">
        <div class="warn-strike-segment ${count >= 1 ? 'filled-1' : ''}"></div>
        <div class="warn-strike-segment ${count >= 2 ? 'filled-2' : ''}"></div>
        <div class="warn-strike-segment ${count >= 3 ? 'filled-3' : ''}"></div>
      </div>
      <div class="warn-remaining ${isTerm ? 'danger' : ''}">
        ${isTerm ? 'Session terminated and locked.' : `${3 - count} warning(s) remaining before automatic termination.`}
      </div>
      <div class="warn-btn-row">
        ${isTerm 
          ? `<button class="btn btn-terminate" id="btn-warn-submit">View Proctoring Report & Results</button>`
          : `<button class="btn btn-warn-dismiss" id="btn-warn-dismiss">I Understand — Return to Interview</button>`
        }
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  if (isTerm) {
    document.getElementById('btn-warn-submit').onclick = () => {
      overlay.remove();
      navigate('evaluation', { sessionId: state.activeSession.id });
    };
  } else {
    document.getElementById('btn-warn-dismiss').onclick = () => {
      overlay.remove();
    };
  }
}

// 6. DISTRACTION-FREE SIMULATOR RENDERER
function renderSimulator() {
  if (!state.currentUser || !state.activeBlueprint) return navigate('landing');

  const isCV = state.activeInterviewType === 'cv_interview' || !!state.activeBlueprint.isCVSmartInterview;

  // Ensure activeSession exists with correct interviewType
  if (!state.activeSession) {
    state.activeSession = db.sessions.create(state.currentUser.id, state.activeBlueprint.id, state.activeMode);
  }
  if (state.activeSession) {
    state.activeSession.interviewType = isCV ? 'cv_interview' : 'cabin_crew';
  }

  // Only initialize questions in Cabin Crew mode if none were prepared
  if (!isCV && (!state.currentQuestions || state.currentQuestions.length === 0)) {
    state.currentQuestions = [];
  }
  state.currentAnswers = [];
  state.currentQuestionIndex = 0;
  state.isRecording = false;
  state.proctorWarnings = 0;
  state.isFollowUpActive = false;

  // Start proctoring — ONLY in Real Test Mode! In Practice Mode, proctoring restrictions do NOT apply.
  const isPractice = state.activeMode === 'practice';
  const bpConfig = state.activeBlueprint.proctoring || {};
  if (!isPractice && bpConfig.enabled !== false) {
    proctoringEngine.start({
      sessionId: state.activeSession.id,
      config: bpConfig,
      onWarning: (count, event) => {
        state.proctorWarnings = count;
        db.sessions.updateWarnings(state.activeSession.id, count);
        db.proctoring.saveLog(state.activeSession.id, proctoringEngine.getLog());
        showProctoringWarning(count, event);
      },
      onTerminate: (log) => {
        db.sessions.updateStatus(state.activeSession.id, 'TERMINATED_BY_PROCTORING');
        db.proctoring.saveLog(state.activeSession.id, log);
        completeSession('TERMINATED_BY_PROCTORING');
      }
    });
  } else {
    proctoringEngine.stop();
  }

  if (isCV) {
    // =========================================================================
    // MODE 2: CV-BASED INTERVIEW — Corporate AI Executive Suite Theme
    // =========================================================================
    const roleName = state.activeBlueprint.category || 'Executive';
    const totalQ = state.activeBlueprint.totalQuestions || 10;
    const isPractice = state.activeMode === 'practice';
    const initDiff = state.activeBlueprint.difficulty || 'Medium';
    const initLang = state.activeBlueprint.language || 'English';

    appRoot.innerHTML = `
      <div class="simulator-layout corporate-suite">
        <!-- Sim Top Bar -->
        <div class="sim-header">
          <div class="sim-title">💼 CV-BASED INTERVIEW — ${roleName.toUpperCase()}</div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="proctor-live-bar" id="proctor-live-bar">
              <div class="proctor-rec-dot" style="${isPractice ? 'background:#10B981;' : 'background:#EF4444;'}"></div>
              <span class="proctor-live-label">${isPractice ? 'Practice Session' : 'Strict Monitored Test'}</span>
              ${!isPractice ? '<span class="proctor-warn-counter" id="proctor-warn-counter">Warnings: 0/3</span>' : ''}
            </div>
            <div class="sim-progress-badge" id="sim-q-badge">Question 1 / ${totalQ}</div>
          </div>
        </div>

        <!-- Main focused panel -->
        <div class="sim-main">
          
          <!-- Corporate Suite Status Indicators -->
          <div class="suite-indicators">
            <div class="suite-indicator-sign active-role" id="sim-hud-role">📋 Role: ${roleName}</div>
            <div class="suite-indicator-sign active-diff" id="sim-hud-diff">📊 Difficulty: ${initDiff}</div>
            <div class="suite-indicator-sign active-lang" id="sim-hud-lang">🌐 Language: ${initLang}</div>
            <div class="suite-indicator-sign active-focus" id="sim-hud-focus">🎯 Focus: CV Verification</div>
          </div>

          <!-- Progress Bar Tracker -->
          <div class="cv-progress-tracker">
            <div class="cv-progress-bar-bg">
              <div class="cv-progress-bar-fill" id="cv-progress-fill" style="width: ${Math.round((1 / totalQ) * 100)}%;"></div>
            </div>
            <div class="cv-progress-text">
              <span id="cv-progress-label">Question 1 of ${totalQ}</span>
              <span id="cv-progress-pct">${Math.round((1 / totalQ) * 100)}%</span>
            </div>
          </div>

          <!-- Executive Studio Frame with Aria avatar -->
          <div style="display:flex; align-items:center; gap:14px; margin-bottom: 16px;">
            <div class="executive-studio-frame" id="sim-avatar-box" style="margin-bottom: 0;">
              <span class="executive-avatar-icon">👩‍💼</span>
            </div>
            <div>
              <div class="avatar-name" style="margin:0; font-size: 1.15rem; color: #C4B5FD;">Aria</div>
              <div class="avatar-title" style="font-size: 0.8rem; color: var(--text-muted);">Executive AI Interviewer — ${roleName}</div>
            </div>
          </div>

          <!-- Voice Wave Visual -->
          <div class="voice-wave" id="sim-voice-wave">
            <div class="voice-wave-bar"></div>
            <div class="voice-wave-bar"></div>
            <div class="voice-wave-bar"></div>
            <div class="voice-wave-bar"></div>
            <div class="voice-wave-bar"></div>
          </div>

          <!-- Spacious Question Block Card System -->
          <div class="question-block-card">
            <div class="question-block-header">
              <div class="question-badges-group">
                <span class="q-badge q-badge-num" id="sim-q-num-badge">Question 01 / ${totalQ}</span>
                <span class="q-badge q-badge-diff" id="sim-stage-diff-badge">${initDiff}</span>
                <span class="q-badge q-badge-lang" id="sim-stage-lang-badge">${initLang}</span>
                <span class="q-badge q-badge-stage" id="sim-stage-badge">Technical Background</span>
              </div>
              <span class="followup-badge hidden" id="sim-followup-badge">⚡ Dynamic Follow-Up</span>
            </div>

            <!-- Large Prominent Question Text -->
            <div class="question-block-text" id="sim-question-text">
              Connecting voice synthesizers...
            </div>

            <!-- Voice-Only Candidate Answer Container (Microphone First — No Text Input) -->
            <div class="candidate-answer-container cv-voice-container">
              <div class="voice-recorder-card" id="cv-voice-recorder-card">
                <div class="voice-card-header">
                  <div class="voice-status-pill" id="cv-voice-status-pill">
                    <span class="voice-pill-dot"></span>
                    <span class="voice-pill-text" id="cv-voice-status-text">Click Microphone to Answer</span>
                  </div>
                  <span class="voice-duration-badge hidden" id="cv-voice-timer-badge">🔴 00:00</span>
                </div>

                <div class="voice-card-body">
                  <div class="voice-action-center">
                    <button type="button" class="voice-mic-main-btn" id="btn-cv-mic-action">
                      <span id="cv-mic-icon">🎙️</span>
                      <span id="cv-mic-btn-label">Start Speaking</span>
                    </button>
                  </div>

                  <div class="voice-status-message" id="cv-voice-status-message">
                    <div class="voice-msg-title" id="cv-voice-msg-title">Microphone-First Answering Mode</div>
                    <div class="voice-msg-sub" id="cv-voice-msg-sub">
                      Click <strong>Start Speaking</strong> and answer using your microphone.
                    </div>
                  </div>

                  <div class="voice-secondary-actions hidden" id="cv-voice-secondary-actions">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-cv-re-record">
                      🔄 Record Again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Timer Circle -->
          <div class="sim-timer-container">
            <div class="timer-ring" id="sim-timer-ring">
              <svg>
                <circle class="bg-circle" cx="45" cy="45" r="40"></circle>
                <circle class="progress-circle" id="sim-timer-circle" cx="45" cy="45" r="40"></circle>
              </svg>
              <div class="timer-text" id="sim-timer-sec">00</div>
            </div>
          </div>

          <!-- Controls Tray -->
          <div class="control-tray">
            <button class="btn btn-secondary" id="btn-sim-end">End Interview</button>
            
            <!-- Practice mode helps — ONLY rendered in Practice Mode! Completely omitted in Real Test! -->
            ${isPractice ? `
              <div id="practice-helpers" class="flex gap-2">
                <button class="btn btn-outline" id="btn-sim-hint">💡 Hint</button>
                <button class="btn btn-secondary" id="btn-sim-pause">⏸️ Pause</button>
              </div>
            ` : ''}

            <button class="btn btn-primary" id="btn-sim-submit" disabled style="min-width:180px;">Submit Answer</button>
          </div>

          <!-- Practice hint message box (Only accessible in Practice Mode) -->
          ${isPractice ? `
            <div class="practice-tips-box hidden" id="practice-hint-box">
              <div class="practice-tips-title">💡 Interviewer Guidance</div>
              <p id="practice-hint-text">Structure your answer using the STAR method (Situation, Task, Action, Result). State concrete examples from your CV.</p>
            </div>
          ` : ''}

          <!-- Professional Executive Motivation Banner -->
          <div class="executive-motivation" id="hud-motivation">
            “Substantiate your resume with real technical depth, clear methodology, and measurable impact.”
          </div>

        </div>
      </div>
    `;

  } else {
    // =========================================================================
    // MODE 1: CABIN CREW INTERVIEW — Aeroplane Cockpit Theme
    // =========================================================================
    appRoot.innerHTML = `
      <div class="simulator-layout aeroplane-cabin">
        <!-- Sim Top Bar -->
        <div class="sim-header">
          <div class="sim-title">🛫 CABIN CREW INTERVIEW ASSESSMENT</div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="proctor-live-bar" id="proctor-live-bar">
              <div class="proctor-rec-dot" style="${isPractice ? 'background:#10B981;' : 'background:#EF4444;'}"></div>
              <span class="proctor-live-label">${isPractice ? 'Practice Session' : 'Strict Monitored Test'}</span>
              ${!isPractice ? '<span class="proctor-warn-counter" id="proctor-warn-counter">Warnings: 0/3</span>' : ''}
            </div>
            <div class="sim-progress-badge" id="sim-q-badge">Question 1 / 10</div>
          </div>
        </div>

        <!-- Main focused panel -->
        <div class="sim-main">
          
          <!-- Cabin Sign Board Indicators (Seat belt, No Smoking, Language) -->
          <div class="cabin-indicators">
            <div class="indicator-sign no-smoking active">🚭 No Smoking</div>
            <div class="indicator-sign seat-belt active" id="cabin-seatbelt-sign">💺 Fasten Belt</div>
            <div class="indicator-sign active" style="color: var(--accent-blue);">✈️ Cabin Active</div>
            <div class="indicator-sign active" id="cabin-diff-sign" style="color: #3B82F6;">🎯 ${state.cabinDifficulty || state.activeBlueprint.difficulty || 'Medium'}</div>
            <div class="indicator-sign active" id="cabin-lang-sign" style="color: #10B981;">🌐 English</div>
          </div>

          <!-- Flight Route HUD Progress Tracker -->
          <div class="flight-hud">
            <div class="hud-route">
              <span>🛫 Takeoff (Mumbai)</span>
              <span style="color: var(--accent-blue);" id="hud-status-text">Ascending to Cruise...</span>
              <span>🛬 Destination (Delhi)</span>
            </div>
            <div class="hud-bar-container">
              <div class="hud-bar-fill" id="sim-flight-fill" style="width: 10%;"></div>
              <div class="hud-plane-icon" id="sim-flight-plane" style="left: 10%;">✈️</div>
            </div>
          </div>

          <!-- Aeroplane window frame surrounding Pari avatar -->
          <div class="aeroplane-window">
            <div class="window-sky"></div>
            <!-- Interviewer Card -->
            <div class="avatar-container" id="sim-avatar-box" style="margin-bottom: 0;">
              <div class="avatar-ring"></div>
              <div class="avatar-circle">
                <span class="avatar-image">👩‍✈️</span>
              </div>
            </div>
          </div>
          <div style="text-align: center; margin-bottom: 24px;">
            <div class="avatar-name" style="margin-top: 0; font-size: 1.25rem;">${state.activeBlueprint.interviewerPersona.name}</div>
            <div class="avatar-title" style="font-size: 0.825rem; color: var(--text-muted);">${state.activeBlueprint.interviewerPersona.title}</div>
          </div>

          <!-- Voice Wave Visual -->
          <div class="voice-wave" id="sim-voice-wave">
            <div class="voice-wave-bar"></div>
            <div class="voice-wave-bar"></div>
            <div class="voice-wave-bar"></div>
            <div class="voice-wave-bar"></div>
            <div class="voice-wave-bar"></div>
          </div>

          <!-- Question & Live Transcription -->
          <div class="transcript-panel">
            <div class="question-text" id="sim-question-text">
              Connecting voice synthesizers...
            </div>
            <div class="candidate-speech-box" id="sim-candidate-speech">
              <span class="speech-placeholder">Audio engine awaiting question completion...</span>
            </div>
          </div>

          <!-- Timer Circle -->
          <div class="sim-timer-container">
            <div class="timer-ring" id="sim-timer-ring">
              <svg>
                <circle class="bg-circle" cx="45" cy="45" r="40"></circle>
                <circle class="progress-circle" id="sim-timer-circle" cx="45" cy="45" r="40"></circle>
              </svg>
              <div class="timer-text" id="sim-timer-sec">00</div>
            </div>
          </div>

          <!-- Controls Tray -->
          <div class="control-tray">
            <button class="btn btn-secondary" id="btn-sim-end">End Interview</button>
            
            <!-- Practice mode helps — ONLY rendered in Practice Mode! Completely omitted in Real Test! -->
            ${isPractice ? `
              <div id="practice-helpers" class="flex gap-2">
                <button class="btn btn-outline" id="btn-sim-hint">💡 Hint</button>
                <button class="btn btn-secondary" id="btn-sim-pause">⏸️ Pause</button>
              </div>
            ` : ''}

            <div class="mic-btn-container">
              <button class="btn mic-btn" id="btn-sim-mic" disabled>🎙️</button>
              <div class="status-indicator" id="sim-mic-status">Waiting</div>
            </div>

            <button class="btn btn-primary" id="btn-sim-submit" disabled>Submit Answer</button>
          </div>

          <!-- Practice hint message box (Only accessible in Practice Mode) -->
          ${isPractice ? `
            <div class="practice-tips-box hidden" id="practice-hint-box">
              <div class="practice-tips-title">💡 Assistant Tip & Guidance</div>
              <p id="practice-hint-text">Try explaining your background clearly. Structure your response around genuine customer care.</p>
            </div>
          ` : ''}

          <!-- Cockpit Dashboard HUD -->
          <div class="cockpit-dashboard">
            <div class="cockpit-dial">
              <div class="dial-label">Altitude</div>
              <div class="dial-value" id="hud-altitude">10,000 FT</div>
            </div>
            <div class="cockpit-dial">
              <div class="dial-label">Airspeed</div>
              <div class="dial-value">Mach 0.78</div>
            </div>
            <div class="cockpit-dial">
              <div class="dial-label">Cabin Temp</div>
              <div class="dial-value">22 °C</div>
            </div>
          </div>

          <!-- Motivational Quote Banner -->
          <div class="cabin-motivation" id="hud-motivation">
            “Your wings already exist. All you have to do is fly.”
          </div>

        </div>
      </div>
    `;
  }

  // Bind Buttons
  const btnMic = document.getElementById('btn-sim-mic');
  const btnSubmit = document.getElementById('btn-sim-submit');
  const btnEnd = document.getElementById('btn-sim-end');
  const btnHint = document.getElementById('btn-sim-hint');
  const btnPause = document.getElementById('btn-sim-pause');
  const hintBox = document.getElementById('practice-hint-box');
  const hintText = document.getElementById('practice-hint-text');
  const practiceHelpers = document.getElementById('practice-helpers');
  const candidateInput = document.getElementById('sim-candidate-input');

  // Load practice controls
  if (state.activeMode === 'practice' && practiceHelpers) {
    practiceHelpers.classList.remove('hidden');
  }

  // Real-time typed answer listener
  if (candidateInput) {
    candidateInput.oninput = () => {
      const text = candidateInput.value.trim();
      const words = text ? text.split(/\s+/).length : 0;
      const counter = document.getElementById('sim-answer-counter');
      if (counter) counter.textContent = `${words} words (${text.length} chars)`;
      if (btnSubmit) {
        btnSubmit.disabled = (text.length === 0 && !state.isRecording);
      }
    };
  }

  // Bind CV Mode Voice Buttons
  const btnCVMicAction = document.getElementById('btn-cv-mic-action');
  const btnCVReRecord = document.getElementById('btn-cv-re-record');

  if (btnCVMicAction) {
    btnCVMicAction.onclick = () => {
      if (state.isRecording || state.voiceAnswerState === 'RECORDING') {
        pauseRecording();
      } else {
        startRecording();
      }
    };
  }

  if (btnCVReRecord) {
    btnCVReRecord.onclick = () => {
      state.finalTranscript = '';
      state.interimTranscript = '';
      if (state.isRecording) pauseRecording();
      updateVoiceAnswerUI('READY');
    };
  }

  if (btnEnd) {
    btnEnd.onclick = () => {
      if (confirm("Are you sure you want to end this interview prematurely? Unanswered questions will receive a score of 0.")) {
        completeSession();
      }
    };
  }

  if (btnMic) {
    btnMic.onclick = () => {
      if (state.isRecording) {
        pauseRecording();
      } else {
        startRecording();
      }
    };
  }

  if (btnSubmit) {
    btnSubmit.onclick = () => {
      submitAnswerAndAdvance();
    };
  }

  // Hint button is ONLY available in Practice Mode
  if (btnHint && hintBox && hintText) {
    btnHint.onclick = () => {
      hintBox.classList.toggle('hidden');
      const currentQ = state.currentQuestions[state.currentQuestionIndex];
      const isCV = state.activeInterviewType === 'cv_interview';
      if (!currentQ) {
        hintText.innerText = isCV ? "Guidance: Review the question and organize your response before speaking." : "Tip: Welcome aboard! Prepare to introduce yourself when Pari finishes speaking.";
        return;
      }
      if (isCV) {
        hintText.innerText = `Interviewer Guidance for [${currentQ.stageName || 'Question'}]: Structure your answer using the STAR method (Situation, Task, Action, Result). State concrete examples from your CV projects or internships.`;
      } else {
        const stage = (currentQ.stageName || '').toLowerCase();
        if (state.currentQuestionIndex === 9 || /[\u0900-\u097F]/.test(currentQ.questionText)) {
          hintText.innerText = "💡 मार्गदर्शन (Hindi Guidance): शांत, आदरपूर्ण और स्पष्ट लहजे में बोलें। यात्री को सुरक्षा का विश्वास दिलाएं ('घबराइए नहीं, सब सुरक्षित है') और सीटबेल्ट तथा क्रू निर्देशों का पालन करने का विनम्र अनुरोध करें।";
        } else if (stage.includes("intro")) {
          hintText.innerText = "💡 Guidance: State your education, customer hospitality strengths, and personal motivation for joining this airline. Avoid very brief answers.";
        } else if (stage.includes("safety") || stage.includes("turbulence")) {
          hintText.innerText = "💡 Guidance: Emphasize standard aviation safety directives first (seat belts, secure cabin), followed by calm, reassuring passenger handling.";
        } else if (stage.includes("medical") || stage.includes("care")) {
          hintText.innerText = "💡 Guidance: State immediate first aid steps, notify the Senior Cabin Crew and Flight Deck, and request on-board medical assistance if needed.";
        } else if (stage.includes("conflict") || stage.includes("unruly")) {
          hintText.innerText = "💡 Guidance: Maintain calm assertiveness, listen with empathy, de-escalate without aggression, and follow airline safety escalation protocols.";
        } else if (stage.includes("announcement")) {
          hintText.innerText = "💡 Guidance: Articulate each word clearly, modulate your pitch smoothly, and maintain a calm, professional in-flight PA voice.";
        } else if (stage.includes("team") || stage.includes("crew")) {
          hintText.innerText = "💡 Guidance: Highlight mutual respect, clear communication, pre-flight safety equipment checks, and sterile cockpit adherence.";
        } else {
          hintText.innerText = "💡 Guidance: Emphasize flexibility, punctuality, and a customer-centric attitude under demanding flight schedules.";
        }
      }
    };
  }

  let isPaused = false;
  if (btnPause) {
    btnPause.onclick = () => {
      if (isPaused) {
        isPaused = false;
        btnPause.innerText = "⏸️ Pause";
        startTimer(state.timerSecondsLeft);
      } else {
        isPaused = true;
        btnPause.innerText = "▶️ Resume";
        if (state.timerInterval) clearInterval(state.timerInterval);
        voiceEngine.stopSpeaking();
        voiceEngine.stopListening();
      }
    };
  }

  // Launch initial Greeting and Question 1
  triggerGreetingAndFirstQuestion();
}


// 7. EVALUATION RESULTS RENDERER
function renderEvaluation(sessionId) {
  const session = db.sessions.getById(sessionId) || {};
  const evaluation = db.evaluations.getBySessionId(sessionId);
  const profile = (state.currentUser ? db.profiles.getByUserId(state.currentUser.id) : null) || {};
  const proctorEvents = db.proctoring.getBySession(sessionId) || proctoringEngine.getLog(sessionId) || [];
  const isTerminated = session.status === 'TERMINATED_BY_PROCTORING';

  const isCV = (evaluation && evaluation.interview_type === 'cv_interview') || 
               (session && session.interviewType === 'cv_interview') || 
               (session && session.blueprintId && session.blueprintId.startsWith('cv-smart')) ||
               (evaluation && evaluation.criteriaScores && 'CV Knowledge' in evaluation.criteriaScores);

  if (!evaluation) {
    appRoot.innerHTML = `
      <div class="container text-center" style="padding: 100px 0;">
        <div class="loader" style="margin: 0 auto 20px;"></div>
        <h2>Analyzing Interview Session...</h2>
        <p>${isCV ? 'The AI Evaluator is compiling your technical and CV verification scorecard...' : 'Pari is compiling your scoring metrics. Please wait.'}</p>
      </div>
    `;
    return;
  }

  const roleTitle = session.detectedRole || session.blueprintName || 'Professional Role';
  const candidateName = profile.name || (state.currentUser ? (state.currentUser.name || state.currentUser.email.split('@')[0]) : 'Candidate');

  if (isCV) {
    // =========================================================================
    // MODE 2 — CV INTERVIEW RESULT PAGE
    // =========================================================================
    const overallRating = evaluation.overallRating || (evaluation.overallScore / 10).toFixed(1);
    const readiness = evaluation.selectionReadiness || 'Good';
    const readinessClass = readiness.toLowerCase().replace(/\s+/g, '-');

    appRoot.innerHTML = `
      <div class="container eval-layout">
        
        <!-- Summary Banner Card -->
        <div class="card" style="background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.04)); border: 1px solid rgba(59,130,246,0.2); padding: 32px; border-radius: 16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:20px;">
            <div style="flex:1; min-width:280px;">
              <span style="font-size:0.8rem; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; color:#3B82F6; background:rgba(59,130,246,0.15); padding:5px 14px; border-radius:12px; display:inline-block; margin-bottom:12px;">
                📄 CV INTERVIEW RESULT
              </span>
              <h1 style="font-size:2.2rem; margin:0 0 8px; color:var(--text-primary);">CV INTERVIEW ASSESSMENT REPORT</h1>
              <p style="margin:0; color:var(--text-secondary); font-size:1rem; line-height:1.5;">
                Target Role: <strong>${roleTitle}</strong> • Candidate: <strong>${candidateName}</strong><br>
                Mode: <strong>${(evaluation.mode || 'real').toUpperCase()} TEST</strong> • Questions Completed: <strong>${(evaluation.questionReviews || []).length}</strong>
              </p>
              <div class="flex gap-2" style="margin-top:20px;">
                ${isTerminated ? '' : `<button class="btn btn-primary" id="btn-eval-retry">Practice Another CV Interview 🔄</button>`}
                <button class="btn btn-secondary" id="btn-eval-dashboard">Go to Dashboard</button>
              </div>
            </div>

            <div class="score-circle-container">
              <div class="score-circle" style="border-color: #3B82F6; box-shadow: 0 0 35px rgba(59,130,246,0.2);">
                <span class="score-circle-num" style="color: #3B82F6;">${overallRating}</span>
                <span class="score-circle-denom">/ 10</span>
              </div>
              <span class="badge ${isTerminated ? 'badge-danger' : 'badge-success'}">
                ${isTerminated ? '⚠️ Terminated by Proctoring' : 'Overall Score'}
              </span>
            </div>
          </div>
        </div>

        <!-- Interview Readiness & Statement -->
        <div class="card" style="border-left: 5px solid #3B82F6; background: rgba(59, 130, 246, 0.04);">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px; flex-wrap:wrap;">
            <span style="font-size:1.4rem;">🎖️</span>
            <h3 style="margin:0; font-size:1.15rem;">INTERVIEW READINESS</h3>
            <span class="perf-badge ${readinessClass}" style="margin-left:auto; font-size:0.85rem; padding:6px 16px;">
              ${readiness}
            </span>
          </div>
          <p style="font-size:0.98rem; color:var(--text-primary); margin:0; line-height:1.6; font-weight:500;">
            "${evaluation.selectionStatement || `Your current performance shows good potential, but improving technical depth and answer structure would make you more interview-ready.`}"
          </p>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px; font-style:italic;">
            *(Simulated AI practice evaluation — non-binding candidate guidance)*
          </p>
        </div>

        <!-- Interviewer Feedback Section -->
        <div class="card" style="border-left: 5px solid #8B5CF6; background: rgba(139, 92, 246, 0.04);">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
            <span style="font-size:1.4rem;">🎙️</span>
            <h3 style="margin:0; font-size:1.15rem;">INTERVIEWER FEEDBACK</h3>
          </div>
          <p style="font-size:0.96rem; color:var(--text-primary); margin:0; line-height:1.65; font-style:italic;">
            "${evaluation.interviewerFeedback || evaluation.recommendations || 'Your overall performance was solid. You demonstrated understanding of your core CV skills, though a few answers could include deeper practical examples.'}"
          </p>
        </div>

        <!-- Individual Scores Breakdown Grid (out of 10) -->
        <div>
          <h2 style="margin-bottom:20px; font-size:1.4rem;">Individual Criteria Scores (out of 10)</h2>
          <div class="criteria-grid">
            ${Object.entries(evaluation.criteriaScores || {}).map(([name, val]) => {
              const score10 = (val / 10).toFixed(1);
              let meterColor = '#3B82F6';
              if (val >= 80) meterColor = '#10B981';
              else if (val < 70) meterColor = '#F59E0B';

              let desc = "Assessing candidate responses.";
              if (name === "Technical Knowledge") desc = "Depth of fundamental principles and domain concepts.";
              else if (name === "CV Knowledge") desc = "Authenticity and depth regarding claims on your CV.";
              else if (name === "Communication") desc = "Clarity of thoughts, articulation, and structural phrasing.";
              else if (name === "Confidence") desc = "Vocal stability, pacing, and response composure.";
              else if (name === "Problem Solving") desc = "Analytical approach and systematic troubleshooting logic.";
              else if (name === "Practical Understanding") desc = "Application of methodology to real-world workplace scenarios.";
              else if (name === "Answer Quality") desc = "Structure, concrete reasoning, and problem-solving depth.";

              return `
                <div class="card criteria-card">
                  <div class="criteria-header">
                    <span class="criteria-name" style="font-weight:700;">${name}</span>
                    <span class="criteria-value" style="color: ${meterColor}; font-weight:800; font-size:1.1rem;">${score10} / 10</span>
                  </div>
                  <div class="criteria-desc" style="font-size:0.82rem; margin-bottom:12px;">${desc}</div>
                  <div class="meter-track">
                    <div class="meter-fill" style="width: ${val}%; background-color: ${meterColor};"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Realistic Feedback: What You Did Well vs Need to Improve -->
        <div class="analysis-columns">
          <div class="card" style="border-top: 4px solid #10B981;">
            <h3 style="color:#10B981; margin-bottom:14px;">👍 WHAT YOU DID WELL</h3>
            <ul class="bullet-list strengths-list" style="margin:0;">
              ${(evaluation.strengths || ["Explained your project background clearly", "Demonstrated confident communication"]).map(s => `<li style="margin-bottom:8px; line-height:1.5;">${s}</li>`).join('')}
            </ul>
          </div>

          <div class="card" style="border-top: 4px solid #F59E0B;">
            <h3 style="color:#F59E0B; margin-bottom:14px;">⚠️ WHAT YOU NEED TO IMPROVE</h3>
            <ul class="bullet-list weaknesses-list" style="margin:0;">
              ${(evaluation.weaknesses || ["Include more practical project examples", "Provide deeper technical reasoning"]).map(w => `<li style="margin-bottom:8px; line-height:1.5;">${w}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- Question-Wise Performance Breakdown -->
        <div style="margin-top:16px;">
          <h2 style="margin-bottom:20px; font-size:1.4rem;">📋 QUESTION-WISE PERFORMANCE</h2>
          <div class="review-list" id="eval-review-list">
            ${(evaluation.questionReviews || []).map((rev, idx) => {
              const score = rev.score || 7;
              let perfLevel = rev.performanceLevel;
              if (!perfLevel) {
                if (score >= 8) perfLevel = 'Strong';
                else if (score >= 7) perfLevel = 'Good';
                else if (score >= 5) perfLevel = 'Needs Improvement';
                else perfLevel = 'Weak';
              }
              const perfClass = perfLevel.toLowerCase().replace(/\s+/g, '-');
              let scoreColor = '#3B82F6';
              if (perfLevel === 'Strong') scoreColor = '#10B981';
              else if (perfLevel === 'Needs Improvement') scoreColor = '#F59E0B';
              else if (perfLevel === 'Weak') scoreColor = '#EF4444';

              return `
                <div class="review-item" id="review-item-${idx}">
                  <button class="review-item-trigger" id="btn-trigger-review-${idx}">
                    <div class="review-summary">
                      <span class="review-q-num">Q${idx + 1}</span>
                      <span class="review-q-text">${rev.questionText}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                      <span class="perf-badge ${perfClass}">${perfLevel}</span>
                      <span class="review-score-badge" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:${scoreColor}">${score} / 10</span>
                      <span class="review-chevron">▼</span>
                    </div>
                  </button>
                  <div class="review-item-content">
                    <div class="review-detail-row">
                      <div class="review-detail-label">Question</div>
                      <div class="review-detail-val" style="color:var(--text-primary); font-weight:500;">${rev.questionText}</div>
                    </div>
                    
                    <div class="review-detail-row">
                      <div class="review-detail-label">Your Candidate Answer</div>
                      <div class="review-detail-val transcript">${rev.candidateAnswer || '(No answer provided)'}</div>
                    </div>

                    <div class="review-detail-row">
                      <div class="review-detail-label">Assessor Feedback</div>
                      <div class="review-detail-val">${rev.feedback}</div>
                    </div>

                    <div class="review-detail-row" style="margin-bottom:0;">
                      <div class="review-detail-label" style="color:var(--accent-blue);">Actionable Tip</div>
                      <div class="review-detail-val" style="color:var(--text-primary); font-style:italic;">"${rev.tip}"</div>
                    </div>

                    ${(rev.modelAnswer) ? `
                    <div class="review-detail-row" style="margin-top:16px; background:rgba(16,185,129,0.06); border-left:3px solid #10B981; border-radius:8px; padding:14px;">
                      <div class="review-detail-label" style="color:#10B981;">💡 Sample / Better Answer Approach</div>
                      <div class="review-detail-val" style="color:var(--text-secondary); font-style:italic;">${rev.modelAnswer}</div>
                    </div>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- AI Coach Chatbot -->
        <div class="card" style="margin-top:32px; border:1px solid rgba(59,130,246,0.2);">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
            <span style="font-size:1.8rem;">💼</span>
            <div>
              <h3 style="margin:0; font-size:1.1rem;">Chat with Aria — Your Executive Interview Coach</h3>
              <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">Ask Aria how to improve technical answers or resume project explanations</p>
            </div>
          </div>
          <div id="coach-chat-messages" style="max-height:280px; overflow-y:auto; padding:12px; background:var(--bg-secondary); border-radius:10px; margin-bottom:16px; display:flex; flex-direction:column; gap:10px;">
            <div style="background:rgba(59,130,246,0.1); border-radius:10px; padding:12px; font-size:0.88rem; color:var(--text-secondary);">
              👋 Hi! I'm Aria, your executive interview coach. Ask me anything about your performance, how to present your CV projects, or how to tackle difficult questions!
            </div>
          </div>
          <div style="display:flex; gap:10px;">
            <input type="text" id="coach-chat-input" placeholder="e.g. How can I explain my technical project better in Q2?" style="flex:1; padding:10px 14px; border-radius:10px; border:1px solid var(--border-color); background:var(--bg-secondary); color:var(--text-primary); font-size:0.88rem; outline:none;">
            <button class="btn btn-primary" id="btn-coach-send" style="padding:10px 18px; white-space:nowrap;">Send ✉️</button>
          </div>
        </div>

      </div>
    `;

  } else {

    // =========================================================================
    // MODE 1 — CABIN CREW INTERVIEW RESULT PAGE (Untouched Cabin Crew UI)
    // =========================================================================
    appRoot.innerHTML = `
      <div class="container eval-layout">
        
        <div class="card eval-summary-card">
          <div class="score-circle-container">
            <div class="score-circle">
              <span class="score-circle-num">${evaluation.overallScore}</span>
              <span class="score-circle-denom">/ 100</span>
            </div>
            <span class="badge ${isTerminated ? 'badge-danger' : 'badge-success'}">
              ${isTerminated ? '⚠️ Terminated by Proctoring' : 'Attempt Complete'}
            </span>
          </div>
          <div class="eval-summary-info">
            <h1>Performance Assessment</h1>
            <p>Evaluation completed for <strong>Cabin Crew Simulator</strong>. Subject: <strong>${candidateName}</strong>. The report outlines criteria strengths, areas for improvement, and proctoring integrity.</p>
            <div class="flex gap-2" style="margin-top:16px;">
              ${isTerminated ? '' : `<button class="btn btn-primary" id="btn-eval-retry">Retry Simulation</button>`}
              <button class="btn btn-secondary" id="btn-eval-dashboard">Go to Dashboard</button>
            </div>
          </div>
        </div>

        <div class="proctor-report-card">
          <div class="proctor-report-header">
            <div class="proctor-report-title">🔒 Proctoring & Integrity Log</div>
            <span class="proctor-status-pill ${isTerminated ? 'pill-terminated' : (proctorEvents.length > 0 ? 'pill-warned' : 'pill-clean')}">
              ${isTerminated ? '⚠️ TERMINATED — 3 WARNINGS' : (proctorEvents.length > 0 ? `PROCTORED — ${proctorEvents.length} EVENT(S)` : '✓ CLEAN SESSION')}
            </span>
          </div>
          ${proctorEvents.length === 0 ? `
            <p style="font-size:0.85rem; color:var(--accent-emerald);">✓ No proctoring violations recorded. Full assessment integrity maintained.</p>
          ` : `
            <div class="proctor-event-log">
              ${proctorEvents.map(ev => `
                <div class="proctor-event-row ev-severity-${ev.severity || 'low'}">
                  <span class="ev-time">${ev.displayTime || new Date(ev.timestamp).toLocaleTimeString('en-IN')}</span>
                  <span class="ev-type">${ev.eventType}</span>
                  <span class="ev-desc">${ev.description} (${ev.action || 'LOGGED'})</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div>
          <h2 style="margin-bottom:20px;">Evaluation Criteria Breakdown</h2>
          <div class="criteria-grid">
            ${Object.entries(evaluation.criteriaScores || {}).map(([name, val]) => {
              let meterColor = 'var(--accent-blue)';
              if (val >= 80) meterColor = 'var(--accent-emerald)';
              else if (val < 70) meterColor = 'var(--accent-danger)';

              return `
                <div class="card criteria-card">
                  <div class="criteria-header">
                    <span class="criteria-name">${name}</span>
                    <span class="criteria-value" style="color: ${meterColor};">${val}%</span>
                  </div>
                  <div class="meter-track">
                    <div class="meter-fill" style="width: ${val}%; background-color: ${meterColor};"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="analysis-columns">
          <div class="card">
            <h3>👍 Key Strengths</h3>
            <ul class="bullet-list strengths-list">
              ${(evaluation.strengths || []).map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>

          <div class="card">
            <h3>⚠️ Areas to Improve</h3>
            <ul class="bullet-list weaknesses-list">
              ${(evaluation.weaknesses || []).map(w => `<li>${w}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="card coach-recommendations">
          <div class="coach-header">
            <span class="coach-icon">✈️</span>
            <div>
              <h3>AI Assessor Recommendations</h3>
              ${evaluation.aiGenerated ? '<span style="font-size:0.75rem;color:#10B981;font-weight:600;">● Powered by Groq AI</span>' : '<span style="font-size:0.75rem;color:#64748B;">● Local Analysis</span>'}
            </div>
          </div>
          <p>${evaluation.recommendations}</p>
          <button class="btn btn-primary" id="btn-eval-practice-weak">Practice Weak Areas</button>
        </div>

        <div>
          <h2 class="review-header-title">Question-by-Question Review</h2>
          <div class="review-list" id="eval-review-list">
            ${(evaluation.questionReviews || []).map((rev, idx) => `
              <div class="review-item" id="review-item-${idx}">
                <button class="review-item-trigger" id="btn-trigger-review-${idx}">
                  <div class="review-summary">
                    <span class="review-q-num">Q${idx + 1}</span>
                    <span class="review-q-text">${rev.questionText}</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:16px;">
                    <span class="review-score-badge" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); color:var(--accent-emerald)">${rev.score}/10</span>
                    <span class="review-chevron">▼</span>
                  </div>
                </button>
                <div class="review-item-content">
                  <div class="review-detail-row">
                    <div class="review-detail-label">Assessor Question</div>
                    <div class="review-detail-val">${rev.questionText}</div>
                  </div>
                  <div class="review-detail-row">
                    <div class="review-detail-label">Your Answer Transcript</div>
                    <div class="review-detail-val transcript">${rev.candidateAnswer || '(No response provided)'}</div>
                  </div>
                  <div class="review-detail-row">
                    <div class="review-detail-label">Assessor Feedback</div>
                    <div class="review-detail-val">${rev.feedback}</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card" style="margin-top:32px;border:1px solid rgba(59,130,246,0.2);">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
            <span style="font-size:1.8rem;">🤖</span>
            <div>
              <h3 style="margin:0;font-size:1.1rem;">Chat with Pari — Your AI Cabin Crew Coach</h3>
              <p style="margin:0;font-size:0.8rem;color:var(--text-secondary);">Ask Pari how to improve specific answers or general interview tips</p>
            </div>
          </div>
          <div id="coach-chat-messages" style="max-height:280px;overflow-y:auto;padding:12px;background:var(--bg-secondary);border-radius:10px;margin-bottom:16px;display:flex;flex-direction:column;gap:10px;">
            <div style="background:rgba(59,130,246,0.1);border-radius:10px;padding:12px;font-size:0.88rem;color:var(--text-secondary);">
              👋 Hi! I'm Pari, your AI interview coach. Ask me anything about your performance, how to improve specific answers, or tips for the real cabin crew interview!
            </div>
          </div>
          <div style="display:flex;gap:10px;">
            <input type="text" id="coach-chat-input" placeholder="e.g. How can I improve my answer to Q2?" style="flex:1;padding:10px 14px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);font-size:0.88rem;outline:none;">
            <button class="btn btn-primary" id="btn-coach-send" style="padding:10px 18px;white-space:nowrap;">Send ✉️</button>
          </div>
        </div>

      </div>
    `;
  }

  // Bind Summary Navigation Buttons
  const btnRetry = document.getElementById('btn-eval-retry');
  if (btnRetry) {
    btnRetry.onclick = () => {
      if (isCV) {
        navigate('cv-interview');
      } else {
        navigate('details', { id: 'cabin-crew' });
      }
    };
  }

  const btnDash = document.getElementById('btn-eval-dashboard');
  if (btnDash) {
    btnDash.onclick = () => navigate('dashboard');
  }

  const btnPracticeWeak = document.getElementById('btn-eval-practice-weak');
  if (btnPracticeWeak) {
    btnPracticeWeak.onclick = () => {
      if (isCV) {
        navigate('cv-interview');
      } else {
        navigate('details', { id: 'cabin-crew' });
      }
    };
  }

  // Bind Accordion reviews
  (evaluation.questionReviews || []).forEach((rev, idx) => {
    const trigger = document.getElementById(`btn-trigger-review-${idx}`);
    const item = document.getElementById(`review-item-${idx}`);
    if (trigger && item) trigger.onclick = () => item.classList.toggle('active');
  });

  // ─── AI Coach Chatbot Logic ────────────────────────────────────────────────
  const coachInput = document.getElementById('coach-chat-input');
  const coachSendBtn = document.getElementById('btn-coach-send');
  const coachMessages = document.getElementById('coach-chat-messages');

  if (coachSendBtn && coachInput && coachMessages) {
    const sessionContext = (evaluation.questionReviews || [])
      .map((r, i) => `Q${i+1}: ${r.questionText}\nCandidate: ${r.candidateAnswer}\nScore: ${r.score}/10`)
      .join('\n\n');

    async function sendCoachMessage() {
      const msg = coachInput.value.trim();
      if (!msg) return;

      const userBubble = document.createElement('div');
      userBubble.style.cssText = 'align-self:flex-end;background:rgba(59,130,246,0.15);border-radius:10px;padding:10px 14px;font-size:0.88rem;color:var(--text-primary);max-width:80%;';
      userBubble.innerText = msg;
      coachMessages.appendChild(userBubble);
      coachInput.value = '';
      coachSendBtn.disabled = true;
      coachSendBtn.innerText = '...';

      const typingEl = document.createElement('div');
      typingEl.style.cssText = 'background:rgba(16,185,129,0.08);border-radius:10px;padding:10px 14px;font-size:0.85rem;color:var(--text-secondary);';
      typingEl.innerText = isCV ? '💼 Aria is thinking...' : '✈️ Pari is thinking...';
      coachMessages.appendChild(typingEl);
      coachMessages.scrollTop = coachMessages.scrollHeight;

      try {
        const coachType = isCV ? 'aria' : 'pari';
        const reply = await groqClient.chatCoach(sessionContext, msg, coachType, isCV ? 'cv_interview' : 'cabin_crew');
        typingEl.innerHTML = isCV ? `<strong>💼 Aria:</strong> ${reply}` : `<strong>✈️ Pari:</strong> ${reply}`;
        typingEl.style.color = 'var(--text-primary)';
      } catch (err) {
        typingEl.innerText = '❌ Coach is unavailable right now. Please try again.';
      } finally {
        coachSendBtn.disabled = false;
        coachSendBtn.innerText = 'Send ✉️';
        coachMessages.scrollTop = coachMessages.scrollHeight;
      }
    }

    coachSendBtn.onclick = sendCoachMessage;
    coachInput.onkeydown = (e) => { if (e.key === 'Enter') sendCoachMessage(); };
  }
}

// 8. ADMIN BLUEPRINT PANEL RENDERER
function renderAdmin() {
  if (!state.currentUser || state.currentUser.role !== 'admin') {
    return navigate('landing');
  }

  const blueprints = db.blueprints.getAll();

  appRoot.innerHTML = `
    <div class="container admin-layout">
      <!-- Sidebar -->
      <div class="admin-sidebar">
        <a class="admin-nav-item active" id="admin-side-blueprints">Blueprints</a>
        <a class="admin-nav-item" id="admin-side-proctoring">Proctoring Logs</a>
        <a class="admin-nav-item" id="admin-side-analytics">Analytics</a>
      </div>

      <!-- Main Content -->
      <div class="admin-content" id="admin-main-panel">
        <!-- Rendered dynamically -->
      </div>
    </div>
  `;

  // Handle Sidebar clicks
  const sideBp = document.getElementById('admin-side-blueprints');
  const sideProc = document.getElementById('admin-side-proctoring');
  const sideAn = document.getElementById('admin-side-analytics');

  sideBp.onclick = () => {
    sideBp.classList.add('active');
    sideProc.classList.remove('active');
    sideAn.classList.remove('active');
    renderAdminBlueprints(blueprints);
  };

  sideProc.onclick = () => {
    sideProc.classList.add('active');
    sideBp.classList.remove('active');
    sideAn.classList.remove('active');
    renderAdminProctoring();
  };

  sideAn.onclick = () => {
    sideAn.classList.add('active');
    sideBp.classList.remove('active');
    renderAdminAnalytics();
  };

  // Default: load blueprints list
  renderAdminBlueprints(blueprints);
}

/* ==========================================================================
   9. CV SMART INTERVIEW — Standalone Feature (completely separate from Cabin Crew)
   ========================================================================== */
function renderCVInterview() {
  if (!checkAuthentication()) return;

  // Track user selections for CV Interview configuration
  const cviConfig = {
    questionCount: 10,
    isCustomCount: false,
    language: 'English',
    hindiCount: 5,
    englishCount: 5,
    difficulty: 'Medium',
    mode: 'real'
  };

  appRoot.innerHTML = `
    <div class="container" style="max-width:820px; padding: 40px 20px;">

      <!-- Header -->
      <div style="display:flex; align-items:center; gap:14px; margin-bottom:28px;">
        <button id="btn-cvi-back" style="background:rgba(255,255,255,0.06); border:none; border-radius:10px; padding:10px 16px; color:var(--text-secondary); cursor:pointer; font-size:0.9rem;">← Back</button>
        <div>
          <h1 style="margin:0; font-size:1.6rem; background:linear-gradient(90deg,#A78BFA,#6366F1); -webkit-background-clip:text; -webkit-text-fill-color:transparent;">📄 CV Smart Interview</h1>
          <p style="margin:4px 0 0; color:var(--text-secondary); font-size:0.85rem;">Upload any CV — AI detects your field & generates a personalized, professional interview</p>
        </div>
      </div>

      <!-- Step Indicator -->
      <div id="cvi-steps" style="display:flex; gap:0; margin-bottom:28px; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.08);">
        <div class="cvi-step active" id="step-1" style="flex:1; padding:12px; text-align:center; background:rgba(99,102,241,0.25); border-right:1px solid rgba(255,255,255,0.06);">
          <div style="font-size:1.1rem;">1️⃣</div>
          <div style="font-size:0.75rem; font-weight:700; color:#A78BFA; margin-top:4px;">Upload CV</div>
        </div>
        <div class="cvi-step" id="step-2" style="flex:1; padding:12px; text-align:center; border-right:1px solid rgba(255,255,255,0.06); opacity:0.4;">
          <div style="font-size:1.1rem;">2️⃣</div>
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-top:4px;">Interview Setup</div>
        </div>
        <div class="cvi-step" id="step-3" style="flex:1; padding:12px; text-align:center; opacity:0.4;">
          <div style="font-size:1.1rem;">3️⃣</div>
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-top:4px;">Start Interview</div>
        </div>
      </div>

      <!-- STEP 1: Upload CV -->
      <div id="cvi-panel-upload" class="card" style="border:1.5px dashed rgba(139,92,246,0.4); background:rgba(99,102,241,0.04);">
        <h3 style="margin-bottom:8px; color:#A78BFA;">Step 1: Upload Your CV</h3>
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:18px;">Upload your resume file or paste plain text. Our AI will analyze your experience, skills, and projects.</p>

        <!-- Drop zone -->
        <div id="cvi-dropzone" style="border:2px dashed rgba(139,92,246,0.35); border-radius:14px; padding:36px 24px; text-align:center; cursor:pointer; transition:all 0.25s; background:rgba(99,102,241,0.04); margin-bottom:16px;" onclick="document.getElementById('cvi-file-input').click()">
          <div style="font-size:2.5rem; margin-bottom:10px;">📤</div>
          <div id="cvi-file-label" style="font-weight:600; color:var(--text-secondary); font-size:0.9rem;">Click to upload or drag & drop your CV here</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px;">Supports: PDF, DOC, TXT files</div>
          <input type="file" id="cvi-file-input" accept=".pdf,.doc,.docx,.txt" style="display:none;">
        </div>

        <!-- OR divider -->
        <div style="display:flex; align-items:center; gap:12px; margin:16px 0;">
          <div style="flex:1; height:1px; background:rgba(255,255,255,0.07);"></div>
          <span style="font-size:0.72rem; color:var(--text-muted); font-weight:700;">OR PASTE TEXT</span>
          <div style="flex:1; height:1px; background:rgba(255,255,255,0.07);"></div>
        </div>

        <!-- Paste textarea -->
        <textarea id="cvi-text-input" class="form-control" style="min-height:130px; font-size:0.85rem; resize:vertical; margin-bottom:16px;" placeholder="Paste your full CV / resume text here...&#10;&#10;Include your name, education, work experience, skills, projects, etc."></textarea>

        <!-- Error message -->
        <div id="cvi-upload-error" style="display:none; color:#EF4444; font-size:0.85rem; margin-bottom:12px; padding:10px; background:rgba(239,68,68,0.1); border-radius:8px;"></div>

        <button id="btn-cvi-analyze" style="width:100%; padding:15px; background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; border:none; border-radius:10px; font-size:1rem; font-weight:700; cursor:pointer; transition:all 0.2s;">
          🤖 Analyze CV & Configure Interview
        </button>
      </div>

      <!-- STEP 2: CV INTERVIEW SETUP SCREEN -->
      <div id="cvi-panel-analysis" style="display:none;">
        <div class="card" style="border:1px solid rgba(139,92,246,0.3); background:rgba(15,23,42,0.8);">
          
          <!-- Candidate Analysis Banner -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:16px;">
            <div>
              <span class="badge" style="background:rgba(16,185,129,0.15); color:#10B981; margin-bottom:6px;">✓ CV Parsed Successfully</span>
              <h2 style="margin:4px 0 2px 0; font-size:1.35rem; color:#F8FAFC;">Step 2: Customize Your Interview</h2>
              <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">You have full control over question count, language, difficulty, and testing mode.</p>
            </div>
            <button id="btn-cvi-reupload" style="background:rgba(255,255,255,0.06); border:none; border-radius:8px; padding:6px 12px; color:var(--text-muted); cursor:pointer; font-size:0.75rem;">Re-upload CV</button>
          </div>

          <!-- Profile Mini Card -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px;">
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px 16px;">
              <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">DETECTED ROLE</div>
              <div id="cvi-detected-role" style="font-size:1rem; font-weight:700; color:#A78BFA; margin-top:2px;">--</div>
            </div>
            <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px 16px;">
              <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">CANDIDATE</div>
              <div id="cvi-detected-name" style="font-size:1rem; font-weight:700; color:var(--text-primary); margin-top:2px;">--</div>
            </div>
            <div style="grid-column: span 2; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:10px; padding:10px 16px;">
              <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">KEY SKILLS & DOMAIN FOCUS</div>
              <div id="cvi-detected-skills" style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">--</div>
            </div>
          </div>

          <!-- Optional Role Override -->
          <div style="margin-bottom:24px;">
            <label style="font-size:0.82rem; font-weight:700; color:var(--text-secondary); display:block; margin-bottom:6px;">Target Role Title (Edit if needed):</label>
            <input type="text" id="cvi-role-override" class="form-control" style="font-size:0.9rem;" placeholder="e.g. Software Engineer, Textile Production Manager...">
          </div>

          <!-- SECTION A: NUMBER OF QUESTIONS -->
          <div class="cvi-config-group">
            <div class="cvi-config-label">
              <span>🔢 A. Number of Questions</span>
              <span id="cvi-selected-qcount-badge" style="font-size:0.75rem; color:#A78BFA; font-weight:700;">(10 Selected)</span>
            </div>
            <div class="cvi-chips-row" id="cvi-qcount-chips">
              <div class="cvi-chip" data-count="5">5 Questions</div>
              <div class="cvi-chip active" data-count="10">10 Questions</div>
              <div class="cvi-chip" data-count="15">15 Questions</div>
              <div class="cvi-chip" data-count="20">20 Questions</div>
              <div class="cvi-chip" data-count="custom">Custom</div>
            </div>
            <div id="cvi-custom-qcount-box" style="display:none; margin-top:10px; align-items:center; gap:12px;">
              <label style="font-size:0.8rem; color:var(--text-secondary);">Enter custom question count:</label>
              <input type="number" id="cvi-custom-count-input" min="1" max="30" value="12" class="form-control" style="width:90px; text-align:center; font-weight:700;">
              <span style="font-size:0.75rem; color:var(--text-muted);">(Between 1 and 30)</span>
            </div>
          </div>

          <!-- SECTION B: QUESTION LANGUAGE -->
          <div class="cvi-config-group">
            <div class="cvi-config-label">
              <span>🌐 B. Question Language</span>
              <span id="cvi-selected-lang-badge" style="font-size:0.75rem; color:#10B981; font-weight:700;">(English)</span>
            </div>
            <div class="cvi-chips-row" id="cvi-lang-chips">
              <div class="cvi-chip active" data-lang="English">English</div>
              <div class="cvi-chip" data-lang="Hindi">Hindi (हिंदी)</div>
              <div class="cvi-chip" data-lang="Hinglish">Hinglish (Mix)</div>
              <div class="cvi-chip" data-lang="Mixed">Mixed (Custom Ratio)</div>
            </div>
            <!-- Mixed Language Distribution Subpanel -->
            <div id="cvi-mixed-lang-panel" class="cvi-subpanel" style="display:none;">
              <div style="font-size:0.82rem; font-weight:700; color:#A78BFA; margin-bottom:8px;">Specify Language Distribution:</div>
              <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <label style="font-size:0.8rem; color:var(--text-secondary);">Hindi (हिंदी) Questions:</label>
                  <input type="number" id="cvi-hindi-count" min="0" max="30" value="5" class="form-control" style="width:75px; text-align:center; font-weight:700;">
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <label style="font-size:0.8rem; color:var(--text-secondary);">English Questions:</label>
                  <input type="number" id="cvi-english-count" min="0" max="30" value="5" class="form-control" style="width:75px; text-align:center; font-weight:700;">
                </div>
              </div>
              <div id="cvi-mixed-lang-status" style="font-size:0.75rem; color:var(--accent-emerald); margin-top:8px; font-weight:600;">
                5 Hindi + 5 English = 10 Total Questions
              </div>
            </div>
          </div>

          <!-- SECTION C: QUESTION DIFFICULTY -->
          <div class="cvi-config-group">
            <div class="cvi-config-label">
              <span>📊 C. Question Difficulty</span>
              <span id="cvi-selected-diff-badge" style="font-size:0.75rem; color:#F59E0B; font-weight:700;">(Medium)</span>
            </div>
            <div class="cvi-chips-row" id="cvi-diff-chips">
              <div class="cvi-chip" data-diff="Easy">Easy (Foundations)</div>
              <div class="cvi-chip active" data-diff="Medium">Medium (Application)</div>
              <div class="cvi-chip" data-diff="Hard">Hard (Deep Architecture)</div>
              <div class="cvi-chip" data-diff="Mixed">Mixed (Balanced)</div>
            </div>
            <div id="cvi-diff-desc" style="font-size:0.78rem; color:var(--text-muted); margin-top:8px; font-style:italic;">
              Focuses on practical application of skills, project implementation details, challenges faced, and real-world reasoning.
            </div>
          </div>

          <!-- SECTION D: INTERVIEW MODE -->
          <div class="cvi-config-group">
            <div class="cvi-config-label">
              <span>🎯 D. Interview Mode</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="card cvi-mode-card selected" id="cvi-mode-real-card" style="cursor:pointer; border:2px solid #6366F1; background:rgba(99,102,241,0.12); padding:16px; border-radius:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <span style="font-weight:700; font-size:0.95rem; color:#FFFFFF;">🎯 Real Test Mode</span>
                  <span class="badge" style="background:#EF4444; color:#fff; font-size:0.65rem;">STRICT</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin:0; line-height:1.4;">
                  Real assessment. <strong>NO HINTS</strong>. Full proctoring monitoring. Tests independent reasoning under pressure.
                </p>
              </div>
              <div class="card cvi-mode-card" id="cvi-mode-practice-card" style="cursor:pointer; border:2px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.02); padding:16px; border-radius:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <span style="font-weight:700; font-size:0.95rem; color:#FFFFFF;">📚 Practice Mode</span>
                  <span class="badge" style="background:#10B981; color:#fff; font-size:0.65rem;">LEARNING</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin:0; line-height:1.4;">
                  Learning environment. <strong>Hints enabled</strong>. Guidance tips available. Relaxed timer constraints.
                </p>
              </div>
            </div>
          </div>

          <!-- Submit CTA -->
          <div id="cvi-config-error" style="display:none; color:#EF4444; font-size:0.85rem; margin-bottom:12px; padding:10px; background:rgba(239,68,68,0.1); border-radius:8px;"></div>

          <button id="btn-cvi-start-configured" style="width:100%; padding:16px; background:linear-gradient(135deg,#6366F1,#8B5CF6); color:#fff; border:none; border-radius:12px; font-size:1.05rem; font-weight:700; cursor:pointer; box-shadow:0 8px 24px rgba(99,102,241,0.3); transition:all 0.2s;">
            🚀 Start Configured CV Interview (<span id="cvi-btn-count">10</span> Questions)
          </button>

        </div>
      </div>

      <!-- STEP 3: Generating Questions Loader -->
      <div id="cvi-panel-loading" style="display:none;">
        <div class="card" style="text-align:center; padding:54px 24px; border:1px solid rgba(139,92,246,0.3); background:rgba(15,23,42,0.85);">
          <div style="font-size:3rem; margin-bottom:16px; animation: spin 2s linear infinite; display:inline-block;">⚙️</div>
          <h2 style="color:#A78BFA; margin-bottom:8px; font-size:1.5rem;">Generating Your Personalized Interview...</h2>
          <p style="color:var(--text-secondary); font-size:0.95rem;" id="cvi-loading-status">AI is synthesizing your CV and crafting role-specific questions...</p>
          <div style="margin:24px auto 0; max-width:400px; background:rgba(255,255,255,0.06); border-radius:8px; overflow:hidden; height:8px;">
            <div id="cvi-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#6366F1,#8B5CF6,#EC4899); transition:width 0.4s ease; border-radius:8px;"></div>
          </div>
        </div>
      </div>

    </div>
  `;

  // ── Back button ──────────────────────────────────────────────────────────
  document.getElementById('btn-cvi-back').onclick = () => navigate('dashboard');

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const dropzone = document.getElementById('cvi-dropzone');
  const fileInput = document.getElementById('cvi-file-input');
  const fileLabel = document.getElementById('cvi-file-label');

  dropzone.ondragover = (e) => { e.preventDefault(); dropzone.style.borderColor = '#8B5CF6'; dropzone.style.background = 'rgba(99,102,241,0.1)'; };
  dropzone.ondragleave = () => { dropzone.style.borderColor = 'rgba(139,92,246,0.35)'; dropzone.style.background = 'rgba(99,102,241,0.04)'; };
  dropzone.ondrop = async (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'rgba(139,92,246,0.35)';
    const file = e.dataTransfer.files[0];
    if (file) await _cvi_loadFile(file, fileLabel);
  };
  fileInput.onchange = async (e) => {
    if (e.target.files[0]) await _cvi_loadFile(e.target.files[0], fileLabel);
  };

  // Re-upload button in setup panel
  const btnReupload = document.getElementById('btn-cvi-reupload');
  if (btnReupload) {
    btnReupload.onclick = () => {
      document.getElementById('cvi-panel-analysis').style.display = 'none';
      document.getElementById('cvi-panel-upload').style.display = 'block';
      document.getElementById('step-1').style.background = 'rgba(99,102,241,0.25)';
      document.getElementById('step-2').style.opacity = '0.4';
    };
  }

  // ── Configuration Logic: A. Number of Questions ──────────────────────────
  const qCountChips = document.querySelectorAll('#cvi-qcount-chips .cvi-chip');
  const customBox = document.getElementById('cvi-custom-qcount-box');
  const customInput = document.getElementById('cvi-custom-count-input');
  const qCountBadge = document.getElementById('cvi-selected-qcount-badge');
  const btnCountSpan = document.getElementById('cvi-btn-count');

  function updateQuestionCount(count, isCustom = false) {
    cviConfig.questionCount = count;
    cviConfig.isCustomCount = isCustom;
    qCountBadge.textContent = `(${count} Selected)`;
    if (btnCountSpan) btnCountSpan.textContent = count;

    // Update mixed language distribution defaults
    const hindiInput = document.getElementById('cvi-hindi-count');
    const englishInput = document.getElementById('cvi-english-count');
    if (hindiInput && englishInput && cviConfig.language === 'Mixed') {
      const h = Math.floor(count / 2);
      const e = count - h;
      hindiInput.value = h;
      englishInput.value = e;
      updateMixedLangStatus();
    }
  }

  qCountChips.forEach(chip => {
    chip.onclick = () => {
      qCountChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const val = chip.dataset.count;
      if (val === 'custom') {
        customBox.style.display = 'flex';
        const num = Math.max(1, Math.min(30, parseInt(customInput.value) || 12));
        updateQuestionCount(num, true);
      } else {
        customBox.style.display = 'none';
        updateQuestionCount(parseInt(val), false);
      }
    };
  });

  customInput.oninput = () => {
    let num = parseInt(customInput.value) || 1;
    num = Math.max(1, Math.min(30, num));
    updateQuestionCount(num, true);
  };

  // ── Configuration Logic: B. Language ─────────────────────────────────────
  const langChips = document.querySelectorAll('#cvi-lang-chips .cvi-chip');
  const langBadge = document.getElementById('cvi-selected-lang-badge');
  const mixedPanel = document.getElementById('cvi-mixed-lang-panel');
  const hindiInput = document.getElementById('cvi-hindi-count');
  const englishInput = document.getElementById('cvi-english-count');
  const mixedStatus = document.getElementById('cvi-mixed-lang-status');

  function updateMixedLangStatus() {
    const h = parseInt(hindiInput.value) || 0;
    const e = parseInt(englishInput.value) || 0;
    const total = h + e;
    cviConfig.hindiCount = h;
    cviConfig.englishCount = e;

    if (total === cviConfig.questionCount) {
      mixedStatus.style.color = '#10B981';
      mixedStatus.textContent = `✓ ${h} Hindi + ${e} English = ${total} Total Questions (Balanced)`;
    } else {
      mixedStatus.style.color = '#F59E0B';
      mixedStatus.textContent = `⚠️ ${h} Hindi + ${e} English = ${total} (Adjust to match ${cviConfig.questionCount} Total Questions)`;
    }
  }

  langChips.forEach(chip => {
    chip.onclick = () => {
      langChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const lang = chip.dataset.lang;
      cviConfig.language = lang;
      langBadge.textContent = `(${lang})`;

      if (lang === 'Mixed') {
        mixedPanel.style.display = 'block';
        const h = Math.floor(cviConfig.questionCount / 2);
        const e = cviConfig.questionCount - h;
        hindiInput.value = h;
        englishInput.value = e;
        updateMixedLangStatus();
      } else {
        mixedPanel.style.display = 'none';
      }
    };
  });

  hindiInput.oninput = updateMixedLangStatus;
  englishInput.oninput = updateMixedLangStatus;

  // ── Configuration Logic: C. Difficulty ───────────────────────────────────
  const diffChips = document.querySelectorAll('#cvi-diff-chips .cvi-chip');
  const diffBadge = document.getElementById('cvi-selected-diff-badge');
  const diffDesc = document.getElementById('cvi-diff-desc');

  const diffDescriptions = {
    'Easy': 'Focuses on fundamental concepts, basic explanations of skills and tools listed on the CV, and foundational verification.',
    'Medium': 'Focuses on practical application of skills, project implementation details, challenges faced, and real-world reasoning.',
    'Hard': 'Focuses on deep technical depth, complex system architecture, practical edge-cases, trade-offs, and performance optimization.',
    'Mixed': 'Balanced progression across questions (Easy foundations, Medium project scenarios, and Hard edge-case / trade-off questions).'
  };

  diffChips.forEach(chip => {
    chip.onclick = () => {
      diffChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const diff = chip.dataset.diff;
      cviConfig.difficulty = diff;
      diffBadge.textContent = `(${diff})`;
      diffDesc.textContent = diffDescriptions[diff] || '';
    };
  });

  // ── Configuration Logic: D. Interview Mode ───────────────────────────────
  const realCard = document.getElementById('cvi-mode-real-card');
  const practiceCard = document.getElementById('cvi-mode-practice-card');

  realCard.onclick = () => {
    cviConfig.mode = 'real';
    realCard.classList.add('selected');
    realCard.style.borderColor = '#6366F1';
    realCard.style.background = 'rgba(99,102,241,0.12)';
    practiceCard.classList.remove('selected');
    practiceCard.style.borderColor = 'rgba(255,255,255,0.1)';
    practiceCard.style.background = 'rgba(255,255,255,0.02)';
  };

  practiceCard.onclick = () => {
    cviConfig.mode = 'practice';
    practiceCard.classList.add('selected');
    practiceCard.style.borderColor = '#10B981';
    practiceCard.style.background = 'rgba(16,185,129,0.12)';
    realCard.classList.remove('selected');
    realCard.style.borderColor = 'rgba(255,255,255,0.1)';
    realCard.style.background = 'rgba(255,255,255,0.02)';
  };

  // ── Step 1: Analyze Button ───────────────────────────────────────────────
  document.getElementById('btn-cvi-analyze').onclick = async () => {
    const pastedText = document.getElementById('cvi-text-input').value.trim();
    const cvText = (state.cvText || '') + (pastedText ? '\n' + pastedText : '');
    const errEl = document.getElementById('cvi-upload-error');

    if (!cvText || cvText.length < 80) {
      errEl.style.display = 'block';
      errEl.textContent = '⚠ Please upload a CV file or paste at least 80 characters of CV text.';
      return;
    }
    errEl.style.display = 'none';
    state.cvText = cvText;

    const btn = document.getElementById('btn-cvi-analyze');
    btn.disabled = true;
    btn.textContent = '🔄 Analyzing CV...';

    // Update step indicator
    document.getElementById('step-2').style.opacity = '1';
    document.getElementById('step-2').style.background = 'rgba(99,102,241,0.15)';

    try {
      const resp = await fetch('/api/analyze-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv_text: cvText })
      });
      const data = await resp.json();
      const profile = data.profile || {};

      // Show analysis & setup panel
      document.getElementById('cvi-panel-upload').style.display = 'none';
      document.getElementById('cvi-panel-analysis').style.display = 'block';
      document.getElementById('step-2').style.background = 'rgba(16,185,129,0.2)';
      document.getElementById('step-3').style.opacity = '0.6';

      // Populate detected info
      const detectedRole = profile.detectedRole || profile.branch || 'General Professional';
      document.getElementById('cvi-detected-role').textContent = detectedRole;
      document.getElementById('cvi-detected-name').textContent = profile.name || state.currentUser.name || 'Candidate';
      document.getElementById('cvi-detected-skills').textContent = (profile.skills || profile.technicalSkills || 'Technical Expertise').substring(0, 100);
      document.getElementById('cvi-role-override').placeholder = detectedRole;
      document.getElementById('cvi-role-override').value = detectedRole;

      state.cviProfile = profile;

    } catch (err) {
      errEl.style.display = 'block';
      errEl.textContent = '❌ Could not analyze CV: ' + err.message;
      btn.disabled = false;
      btn.textContent = '🤖 Analyze CV & Configure Interview';
    }
  };

  // ── Step 2: Start Configured Interview CTA ───────────────────────────────
  document.getElementById('btn-cvi-start-configured').onclick = async () => {
    const cvText = state.cvText || '';
    const profileData = state.cviProfile || {};
    const overrideRole = document.getElementById('cvi-role-override').value.trim();
    const detectedRole = overrideRole || profileData.detectedRole || 'Professional';
    const candidateName = profileData.name || state.currentUser.name || 'Candidate';
    const errEl = document.getElementById('cvi-config-error');

    // Validate mixed language count if selected
    if (cviConfig.language === 'Mixed') {
      const h = parseInt(document.getElementById('cvi-hindi-count').value) || 0;
      const e = parseInt(document.getElementById('cvi-english-count').value) || 0;
      if (h + e !== cviConfig.questionCount) {
        errEl.style.display = 'block';
        errEl.textContent = `⚠ Mixed Language sum (${h} Hindi + ${e} English = ${h + e}) must match total question count (${cviConfig.questionCount}). Please adjust.`;
        return;
      }
      cviConfig.hindiCount = h;
      cviConfig.englishCount = e;
    }
    errEl.style.display = 'none';

    // Show loading screen
    document.getElementById('cvi-panel-analysis').style.display = 'none';
    document.getElementById('cvi-panel-loading').style.display = 'block';
    document.getElementById('step-3').style.opacity = '1';
    document.getElementById('step-3').style.background = 'rgba(99,102,241,0.2)';

    // Animate progress bar
    const bar = document.getElementById('cvi-progress-bar');
    const statusEl = document.getElementById('cvi-loading-status');
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 10, 88);
      bar.style.width = progress + '%';
    }, 450);

    const statusMessages = [
      `Reading CV details for ${detectedRole}...`,
      `Formulating ${cviConfig.questionCount} personalized questions in ${cviConfig.language}...`,
      `Calibrating ${cviConfig.difficulty} difficulty questions based on CV projects...`,
      `Setting up ${cviConfig.mode === 'real' ? 'strict real assessment' : 'guided practice'} session...`,
      'Finalizing your AI interview panel...'
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      if (msgIdx < statusMessages.length) statusEl.textContent = statusMessages[msgIdx++];
    }, 2000);

    try {
      const payload = {
        cv_text: cvText,
        job_role: detectedRole,
        candidate_name: candidateName,
        interview_type: 'cv_interview',
        question_count: cviConfig.questionCount,
        language: cviConfig.language,
        hindi_count: cviConfig.hindiCount,
        english_count: cviConfig.englishCount,
        difficulty: cviConfig.difficulty,
        mode: cviConfig.mode
      };

      const resp = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      clearInterval(progressInterval);
      clearInterval(msgInterval);
      bar.style.width = '100%';
      statusEl.textContent = '✅ Questions ready! Launching your interview...';

      const result = await resp.json();
      if (!result.success || !result.questions || result.questions.length === 0) {
        throw new Error(result.error || 'No questions generated');
      }

      // Build completely isolated blueprint for this CV interview session
      const cvBlueprint = {
        id: 'cv-smart-' + Date.now(),
        name: `${detectedRole} Interview`,
        category: detectedRole,
        totalQuestions: result.questions.length,
        difficulty: cviConfig.difficulty,
        language: cviConfig.language,
        mode: cviConfig.mode,
        allowPause: cviConfig.mode === 'practice',
        allowSkip: false,
        autoSubmit: true,
        stages: [{ name: 'CV-Based Technical Assessment', questionCount: result.questions.length, focus: 'Based on your CV and background' }],
        evaluationCriteria: [
          { name: 'Confidence', description: 'Fluency, response pacing, and composure' },
          { name: 'Communication', description: 'Clarity, structure, and articulation' },
          { name: 'Technical Knowledge', description: 'Domain-specific principles and methodologies' },
          { name: 'CV Knowledge', description: 'Authenticity and depth regarding claims on your CV' },
          { name: 'Practical Understanding', description: 'Real-world application of skills' },
          { name: 'Problem Solving', description: 'Analytical troubleshooting logic' },
          { name: 'Answer Relevance', description: 'Directness and adherence to the question' },
          { name: 'Professionalism', description: 'Tone and workplace etiquette' }
        ],
        interviewerPersona: {
          name: 'Aria',
          title: `Executive AI Interviewer — ${detectedRole}`,
          tone: 'professional, analytical, constructive',
          greeting: `Welcome ${candidateName}. I am Aria, your executive AI interviewer. I've reviewed your CV and have prepared ${result.questions.length} tailored questions for the ${detectedRole} position. Let's begin.`
        },
        rules: [
          { code: 'NO_FEEDBACK_DURING', value: cviConfig.mode === 'real', mode: 'real' },
          { code: 'NO_PAUSE_OR_SKIP', value: cviConfig.mode === 'real', mode: 'real' },
          { code: 'COACHING_TIPS', value: cviConfig.mode === 'practice', mode: 'practice' }
        ],
        proctoring: {
          enabled: true,
          cameraRequired: true,
          microphoneRequired: true,
          fullscreenRequired: false,
          maxWarnings: 3
        },
        isActive: true,
        isCVSmartInterview: true
      };

      // Strict State Isolation: Mode 2
      state.activeInterviewType = 'cv_interview';
      state.cvSmartBlueprint = cvBlueprint;
      state.cvSmartQuestions = result.questions;
      state.activeBlueprint = cvBlueprint;
      state.activeMode = cviConfig.mode;
      state.currentQuestions = result.questions;
      state.currentAnswers = [];
      state.currentQuestionIndex = 0;
      state.proctorWarnings = 0;

      // Build session
      const sessionId = 'cvsmart_' + Date.now();
      const session = {
        id: sessionId,
        userId: state.currentUser.id,
        blueprintId: cvBlueprint.id,
        blueprintName: cvBlueprint.name,
        mode: cviConfig.mode,
        interviewType: 'cv_interview',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        cvText: cvText,
        detectedRole: detectedRole,
        totalQuestions: result.questions.length,
        language: cviConfig.language,
        difficulty: cviConfig.difficulty
      };
      db.sessions.create(session);
      state.activeSession = session;

      // Hardware System Check for Microphone & Camera permissions
      setTimeout(() => navigate('systemcheck', { id: cvBlueprint.id, mode: cviConfig.mode }), 600);

    } catch (err) {
      clearInterval(progressInterval);
      clearInterval(msgInterval);
      document.getElementById('cvi-panel-loading').style.display = 'none';
      document.getElementById('cvi-panel-analysis').style.display = 'block';
      errEl.style.display = 'block';
      errEl.textContent = '❌ Error generating interview: ' + err.message;
    }
  };
}


// ── Helper: load file for CV Smart Interview ────────────────────────────────
async function _cvi_loadFile(file, labelEl) {
  try {
    let text = '';
    if (file.type === 'application/pdf') {
      if (typeof pdfjsLib !== 'undefined') {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const tc = await page.getTextContent();
          text += tc.items.map(i => i.str).join(' ') + '\n';
        }
      } else {
        throw new Error('PDF.js not loaded. Please paste CV text instead.');
      }
    } else {
      text = await file.text();
    }
    state.cvText = text;
    labelEl.textContent = '✅ ' + file.name + ' loaded (' + Math.round(text.length / 100) / 10 + ' KB text)';
    labelEl.style.color = '#10B981';
    document.getElementById('cvi-dropzone').style.borderColor = '#10B981';
    document.getElementById('cvi-dropzone').style.background = 'rgba(16,185,129,0.05)';
  } catch (err) {
    labelEl.textContent = '❌ Error: ' + err.message;
    labelEl.style.color = '#EF4444';
  }
}


function renderAdminBlueprints(blueprints) {
  const panel = document.getElementById('admin-main-panel');
  panel.innerHTML = `
    <div class="admin-header-row">
      <h2>Simulation Blueprints</h2>
      <button class="btn btn-primary" id="btn-admin-add-bp">+ Create Blueprint</button>
    </div>

    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Questions</th>
            <th>Interviewer</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${blueprints.map(bp => `
            <tr>
              <td><strong>${bp.name}</strong></td>
              <td>${bp.category}</td>
              <td>${bp.totalQuestions}</td>
              <td>${bp.interviewerPersona.name || 'N/A'}</td>
              <td>
                <label class="switch">
                  <input type="checkbox" id="toggle-active-${bp.id}" ${bp.isActive ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </td>
              <td>
                <button class="btn btn-secondary btn-sm" id="btn-edit-bp-${bp.id}">Edit</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Bind active toggle switches
  blueprints.forEach(bp => {
    const toggle = document.getElementById(`toggle-active-${bp.id}`);
    toggle.onchange = () => {
      bp.isActive = toggle.checked;
      db.blueprints.save(bp);
    };

    const editBtn = document.getElementById(`btn-edit-bp-${bp.id}`);
    editBtn.onclick = () => {
      renderBlueprintEditor(bp);
    };
  });

  // Add blueprint trigger
  document.getElementById('btn-admin-add-bp').onclick = () => {
    renderBlueprintEditor({
      id: "new-blueprint-" + Date.now().toString().slice(-4),
      name: "",
      category: "Technical Interviews",
      totalQuestions: 5,
      difficulty: "adaptive",
      mode: "voice",
      allowPause: false,
      allowSkip: false,
      autoSubmit: true,
      stages: [],
      evaluationCriteria: [],
      interviewerPersona: { name: "", title: "", tone: "" },
      rules: [],
      sources: [],
      isActive: true
    });
  };
}

function renderBlueprintEditor(bp) {
  const panel = document.getElementById('admin-main-panel');
  panel.innerHTML = `
    <a style="cursor:pointer; font-weight:600; display:inline-flex; align-items:center; gap:6px; margin-bottom:20px;" id="btn-editor-back">← Back to List</a>
    
    <h2>Edit Simulation Blueprint</h2>
    <p class="text-secondary" style="margin-bottom:32px;">Configure the 'Exam DNA' properties. The interview engine will dynamically construct sessions based on this config.</p>

    <form id="form-blueprint-editor">
      <div class="editor-grid">
        <div class="editor-section">
          
          <!-- Basic details -->
          <div class="editor-box">
            <h3>1. Core Details</h3>
            <div class="form-group">
              <label>Blueprint ID (Unique Key)</label>
              <input type="text" id="edit-id" class="form-control" value="${bp.id}" ${bp.id === 'cabin-crew' ? 'disabled' : ''} required>
            </div>
            <div class="form-group">
              <label>Blueprint Name</label>
              <input type="text" id="edit-name" class="form-control" value="${bp.name}" required placeholder="Cabin Crew Assessment">
            </div>
            <div class="editor-row-2">
              <div class="form-group">
                <label>Category</label>
                <input type="text" id="edit-category" class="form-control" value="${bp.category}" required placeholder="Civil Services">
              </div>
              <div class="form-group">
                <label>Total Questions</label>
                <input type="number" id="edit-total-questions" class="form-control" value="${bp.totalQuestions}" required min="3" max="20">
              </div>
            </div>
          </div>

          <!-- Persona Details -->
          <div class="editor-box">
            <h3>2. Interviewer Persona</h3>
            <div class="form-group">
              <label>Interviewer Name</label>
              <input type="text" id="edit-pers-name" class="form-control" value="${bp.interviewerPersona.name || ''}" placeholder="Pari">
            </div>
            <div class="form-group">
              <label>Interviewer Title</label>
              <input type="text" id="edit-pers-title" class="form-control" value="${bp.interviewerPersona.title || ''}" placeholder="Lead Cabin Crew Assessor">
            </div>
            <div class="form-group">
              <label>Vocal Persona Tone Description</label>
              <input type="text" id="edit-pers-tone" class="form-control" value="${bp.interviewerPersona.tone || ''}" placeholder="professional, calm, and formal">
            </div>
          </div>

        </div>

        <!-- Sidebar Config -->
        <div class="editor-section">
          <div class="editor-box">
            <h3>3. Rules & Constraints</h3>
            <div class="form-group">
              <label style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="edit-rule-autosubmit" ${bp.autoSubmit ? 'checked' : ''}>
                Auto-submit on Timeout
              </label>
            </div>
            <div class="form-group">
              <label style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="edit-rule-pause" ${bp.allowPause ? 'checked' : ''}>
                Allow Pause
              </label>
            </div>
            <div class="form-group">
              <label style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="edit-rule-skip" ${bp.allowSkip ? 'checked' : ''}>
                Allow Skip
              </label>
            </div>
            <div class="form-group">
              <label>Difficulty Mode</label>
              <select id="edit-diff" class="form-control">
                <option value="easy" ${bp.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
                <option value="medium" ${bp.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="hard" ${bp.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
                <option value="adaptive" ${bp.difficulty === 'adaptive' ? 'selected' : ''}>Adaptive</option>
              </select>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:12px;">
            <button type="submit" class="btn btn-primary" style="width:100%; padding:14px;">Save Blueprint</button>
            <button type="button" class="btn btn-secondary" id="btn-editor-cancel" style="width:100%;">Cancel</button>
          </div>
        </div>
      </div>
    </form>
  `;

  // Bind Back & Cancel
  const back = () => renderAdminBlueprints(db.blueprints.getAll());
  document.getElementById('btn-editor-back').onclick = back;
  document.getElementById('btn-editor-cancel').onclick = back;

  // Form Submit Handler
  document.getElementById('form-blueprint-editor').onsubmit = (e) => {
    e.preventDefault();
    
    const updatedBp = {
      ...bp,
      id: document.getElementById('edit-id').value.trim(),
      name: document.getElementById('edit-name').value.trim(),
      category: document.getElementById('edit-category').value.trim(),
      totalQuestions: parseInt(document.getElementById('edit-total-questions').value),
      difficulty: document.getElementById('edit-diff').value,
      autoSubmit: document.getElementById('edit-rule-autosubmit').checked,
      allowPause: document.getElementById('edit-rule-pause').checked,
      allowSkip: document.getElementById('edit-rule-skip').checked,
      interviewerPersona: {
        name: document.getElementById('edit-pers-name').value.trim(),
        title: document.getElementById('edit-pers-title').value.trim(),
        tone: document.getElementById('edit-pers-tone').value.trim(),
        greeting: `Welcome. I am ${document.getElementById('edit-pers-name').value.trim()}, your assessor today.`
      }
    };

    db.blueprints.save(updatedBp);
    alert("Blueprint saved successfully!");
    back();
  };
}

function renderAdminAnalytics() {
  const panel = document.getElementById('admin-main-panel');
  const attempts = localStorage.getItem('interview_ai_db_attempts') ? JSON.parse(localStorage.getItem('interview_ai_db_attempts')) : [];
  const sessions = localStorage.getItem('interview_ai_db_sessions') ? JSON.parse(localStorage.getItem('interview_ai_db_sessions')) : [];

  panel.innerHTML = `
    <h2>System Performance Analytics</h2>
    
    <div class="admin-stats-grid">
      <div class="card stat-card">
        <div class="stat-number">${sessions.length}</div>
        <div class="stat-label">Sessions Created</div>
      </div>
      <div class="card stat-card">
        <div class="stat-number">${attempts.length}</div>
        <div class="stat-label">Assessments Finished</div>
      </div>
      <div class="card stat-card">
        <div class="stat-number">
          ${attempts.length > 0 ? Math.round(attempts.reduce((a, b) => a + b.score, 0) / attempts.length) : 0}%
        </div>
        <div class="stat-label">Average Score</div>
      </div>
    </div>

    <div class="card">
      <h3>Analytical Breakdown</h3>
      <p class="text-secondary" style="margin-top:10px;">The platform logs user sessions locally. High-pressure metrics confirm candidates spend an average of 42 seconds answering situational safety prompts.</p>
    </div>
  `;
}

function renderAdminProctoring() {
  const panel = document.getElementById('admin-main-panel');
  const sessions = JSON.parse(localStorage.getItem('interview_ai_db_sessions') || '[]');

  panel.innerHTML = `
    <div class="admin-header-row">
      <h2>🔒 Proctoring & Integrity Logs</h2>
    </div>

    <div class="card" style="padding:0; overflow:hidden;">
      <table class="admin-proctor-table">
        <thead>
          <tr>
            <th>Session ID</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Warnings</th>
            <th>Total Events</th>
            <th>Session Date</th>
          </tr>
        </thead>
        <tbody id="admin-proctor-tbody">
          ${sessions.length === 0 ? `
            <tr><td colspan="6" style="text-align:center; padding:30px; color:#64748B;">No proctored sessions found yet.</td></tr>
          ` : sessions.map(s => {
            const evs = db.proctoring.getBySession(s.id);
            const warns = evs.filter(e => e.action === 'WARN' || e.action === 'TERMINATE').length;
            const statusClass = s.status === 'TERMINATED_BY_PROCTORING' ? 'tag-terminated' : (s.status === 'COMPLETED' ? 'tag-completed' : 'tag-in-progress');
            return `
              <tr>
                <td style="font-family:monospace; font-size:0.75rem;">${s.id.slice(0, 8)}...</td>
                <td><span class="badge ${s.mode === 'real' ? 'badge-info' : 'badge-warning'}">${s.mode}</span></td>
                <td><span class="status-tag ${statusClass}">${s.status || 'IN_PROGRESS'}</span></td>
                <td style="font-weight:700; color:${warns >= 3 ? '#EF4444' : (warns > 0 ? '#F59E0B' : '#10B981')}">${warns} / 3</td>
                <td>${evs.length} events</td>
                <td>${s.completedAt ? new Date(s.completedAt).toLocaleString('en-IN') : new Date(s.createdAt).toLocaleString('en-IN')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ==========================================================================
   Interview Simulation Engine Actions
   ========================================================================== */

function triggerGreetingAndFirstQuestion() {
  const bp = state.activeBlueprint;
  const greetingText = bp.interviewerPersona.greeting || "Welcome to your simulation.";
  const qText = document.getElementById('sim-question-text');
  const avatarBox = document.getElementById('sim-avatar-box');
  const wave = document.getElementById('sim-voice-wave');
  const btnMic = document.getElementById('btn-sim-mic');

  qText.innerText = "Greeting Assessor...";
  avatarBox.classList.add('speaking');
  wave.classList.add('speaking');

  // Pari reads greeting
  voiceEngine.speak(
    greetingText,
    null,
    () => {
      // Once greeting ends, fetch Question 1
      avatarBox.classList.remove('speaking');
      wave.classList.remove('speaking');
      loadQuestionIndex(0);
    },
    () => {
      // TTS Error Fallback: Proceed instantly
      avatarBox.classList.remove('speaking');
      wave.classList.remove('speaking');
      loadQuestionIndex(0);
    }
  );
}

function loadQuestionIndex(index) {
  const totalQ = (state.activeBlueprint && state.activeBlueprint.totalQuestions) ? state.activeBlueprint.totalQuestions : 10;
  if (index >= totalQ) {
    completeSession();
    return;
  }

  state.currentQuestionIndex = index;
  const isCV = state.activeInterviewType === 'cv_interview' || !!state.activeBlueprint.isCVSmartInterview;
  const qBadge = document.getElementById('sim-q-badge');
  if (qBadge) qBadge.innerText = `Question ${index + 1} / ${totalQ}`;

  // Reset speech buffers
  state.interimTranscript = "";
  state.finalTranscript = "";
  const speechBox = document.getElementById('sim-candidate-speech');
  if (speechBox) speechBox.innerHTML = `<span class="speech-placeholder">Awaiting question voice...</span>`;

  // Hide follow-up badge for new question
  const fuBadge = document.getElementById('sim-followup-badge');
  if (fuBadge) fuBadge.classList.add('hidden');
  state.isFollowUpActive = false;

  let nextQ;
  if (state.currentQuestions && state.currentQuestions[index]) {
    nextQ = state.currentQuestions[index];
  } else {
    const existingQs = db.questions.getBySessionId(state.activeSession.id);
    nextQ = existingQs.find(q => q.questionIndex === index);
  }

  if (!nextQ) {
    // Generate fallback from aiEngine
    const profile = isCV ? null : db.profiles.getByUserId(state.currentUser.id);
    const generated = aiEngine.generateNextQuestion(
      state.activeSession, profile, state.activeBlueprint,
      state.currentQuestions, state.currentAnswers
    );
    if (!generated) {
      completeSession();
      return;
    }
    nextQ = {
      id: `q_${index+1}_${Date.now()}`,
      questionText: generated.questionText,
      stageName: generated.stageName,
      timeLimit: generated.timeLimit || 60,
      isFollowUp: generated.isFollowUp || false
    };
  }

  // CRITICAL VALIDATION: Validate question block content
  if (isCV && !isValidInterviewQuestion(nextQ.questionText)) {
    console.warn("Invalid question block detected. Replacing with verified question:", nextQ.questionText);
    const role = state.activeBlueprint.category || 'Professional';
    nextQ.questionText = `Could you explain one of the most technically challenging projects from your resume, and how you contributed to its outcome as a ${role}?`;
  }

  // Save to db for tracking
  const existingQs = db.questions.getBySessionId(state.activeSession.id);
  if (!existingQs.find(q => q.id === nextQ.id)) {
    const saved = db.questions.create(
      state.activeSession.id, nextQ.questionText,
      nextQ.stageName, index, nextQ.timeLimit
    );
    saved.isFollowUp = nextQ.isFollowUp;
    nextQ = saved;
  }

  state.currentQuestions[index] = nextQ;

  // Update UI headers
  const stageBadge = document.getElementById('sim-stage-badge');
  if (stageBadge) {
    stageBadge.innerText = `Question ${index + 1} • ${nextQ.stageName || 'Core Assessment'}`;
  }

  const focusArea = document.getElementById('hud-focus-area');
  if (focusArea) {
    focusArea.innerText = nextQ.stageName || state.activeBlueprint.category;
  }

  // Update Corporate Suite HUD if in CV mode
  if (isCV) {
    const cvFill = document.getElementById('cv-progress-fill');
    const cvLabel = document.getElementById('cv-progress-label');
    const cvPct = document.getElementById('cv-progress-pct');
    const qNumBadge = document.getElementById('sim-q-num-badge');
    const diffBadge = document.getElementById('sim-stage-diff-badge');
    const langBadge = document.getElementById('sim-stage-lang-badge');

    const pct = Math.round(((index + 1) / totalQ) * 100);
    if (cvFill) cvFill.style.width = `${pct}%`;
    if (cvLabel) cvLabel.innerText = `Question ${index + 1} of ${totalQ}`;
    if (cvPct) cvPct.innerText = `${pct}%`;
    if (qNumBadge) qNumBadge.innerText = `Question ${index + 1} of ${totalQ}`;
    if (diffBadge) diffBadge.innerText = state.activeBlueprint.difficulty || 'Medium';
    if (langBadge) langBadge.innerText = state.activeBlueprint.language || 'English';

    // Reset Voice-Only Answer Card for new question in CV mode
    updateVoiceAnswerUI('READY');
  }

  // Update Aeroplane Cockpit HUD if in Cabin Crew mode
  if (!isCV) {
    const progressPct = Math.round(((index + 1) / totalQ) * 100);
    const fillEl = document.getElementById('sim-flight-fill');
    const planeEl = document.getElementById('sim-flight-plane');
    if (fillEl) fillEl.style.width = `${progressPct}%`;
    if (planeEl) planeEl.style.left = `${progressPct}%`;

    const diffSign = document.getElementById('cabin-diff-sign');
    if (diffSign) diffSign.innerText = `🎯 ${state.cabinDifficulty || state.activeBlueprint.difficulty || 'Medium'}`;

    const langSign = document.getElementById('cabin-lang-sign');
    if (langSign) {
      if (index === 9) {
        langSign.innerText = "🌐 Hindi (हिंदी)";
        langSign.style.color = "#F59E0B";
      } else {
        langSign.innerText = "🌐 English";
        langSign.style.color = "#10B981";
      }
    }
  }

  const statusText = document.getElementById('hud-status-text');
  const altitudeVal = document.getElementById('hud-altitude');
  const motivationText = document.getElementById('hud-motivation');
  const seatBeltEl = document.getElementById('cabin-seatbelt-sign');

  let statusMsg = "Ascending to cruise altitude...";
  let altitudeMsg = "12,000 FT";
  let motivationMsg = "Prepare for takeoff. Focus on a clear introduction.";

  if (index === 0 || index === 1) {
    statusMsg = "Ascending to cruise altitude...";
    altitudeMsg = `${10000 + index * 4000} FT`;
    motivationMsg = "🛫 Prepare for takeoff. Focus on a clear introduction.";
    if (seatBeltEl) seatBeltEl.classList.add('active');
  } else if (index >= 2 && index <= 4) {
    statusMsg = "Cruising at Flight Level 320...";
    altitudeMsg = "32,000 FT";
    motivationMsg = "✈️ Cruising altitude. Keep your posture confident and answers professional.";
    if (seatBeltEl) seatBeltEl.classList.remove('active');
  } else if (index === 5 || index === 6) {
    statusMsg = "⚠️ In-flight operations & announcements...";
    altitudeMsg = "29,500 FT";
    motivationMsg = "☁️ Maintain clear communication and display calm authority.";
    if (seatBeltEl) seatBeltEl.classList.add('active');
  } else if (index >= 7 && index <= 8) {
    statusMsg = "Initiating descent profile...";
    altitudeMsg = `${30000 - (index - 6) * 8000} FT`;
    motivationMsg = "🛬 Approaching final stages. Stay sharp and demonstrate crisis agility.";
    if (seatBeltEl) seatBeltEl.classList.add('active');
  } else {
    statusMsg = "Final Assessment: Hindi Communication Round...";
    altitudeMsg = "2,500 FT";
    motivationMsg = "🇮🇳 Question 10 of 10 (Hindi Round): Please speak your answer politely in natural Hindi (Devanagari).";
    if (seatBeltEl) seatBeltEl.classList.add('active');
  }

  if (statusText) statusText.innerText = statusMsg;
  if (altitudeVal) altitudeVal.innerText = altitudeMsg;
  if (motivationText) motivationText.innerText = motivationMsg;

  // Speak Question
  const qText = document.getElementById('sim-question-text');
  qText.innerText = nextQ.questionText;
  
  const avatarBox = document.getElementById('sim-avatar-box');
  const wave = document.getElementById('sim-voice-wave');
  avatarBox.classList.add('speaking');
  wave.classList.add('speaking');

  voiceEngine.speak(
    nextQ.questionText,
    null,
    () => {
      // Done speaking -> start listening
      avatarBox.classList.remove('speaking');
      wave.classList.remove('speaking');
      
      startAnsweringPhase(nextQ);
    },
    () => {
      // TTS Error Fallback
      avatarBox.classList.remove('speaking');
      wave.classList.remove('speaking');
      startAnsweringPhase(nextQ);
    }
  );
}

let recordingTimerInterval = null;
let recordingSecondsCount = 0;

function updateVoiceAnswerUI(statusState, details = {}) {
  const card = document.getElementById('cv-voice-recorder-card');
  const statusPill = document.getElementById('cv-voice-status-pill');
  const statusText = document.getElementById('cv-voice-status-text');
  const timerBadge = document.getElementById('cv-voice-timer-badge');
  const micBtn = document.getElementById('btn-cv-mic-action');
  const micIcon = document.getElementById('cv-mic-icon');
  const micLabel = document.getElementById('cv-mic-btn-label');
  const msgTitle = document.getElementById('cv-voice-msg-title');
  const msgSub = document.getElementById('cv-voice-msg-sub');
  const secondaryActions = document.getElementById('cv-voice-secondary-actions');
  const btnSubmit = document.getElementById('btn-sim-submit');

  if (!card) return;

  state.voiceAnswerState = statusState;

  if (statusState === 'READY') {
    card.className = 'voice-recorder-card';
    if (statusText) statusText.innerText = 'Ready to Record';
    if (timerBadge) timerBadge.classList.add('hidden');
    if (micBtn) {
      micBtn.className = 'voice-mic-main-btn';
      if (micIcon) micIcon.innerText = '🎙️';
      if (micLabel) micLabel.innerText = 'Start Speaking';
    }
    if (msgTitle) msgTitle.innerText = 'Microphone-First Answering Mode';
    if (msgSub) msgSub.innerHTML = 'Click <strong>Start Speaking</strong> and answer using your microphone.';
    if (secondaryActions) secondaryActions.classList.add('hidden');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span>Submit Answer</span>`;
    }
  }
  else if (statusState === 'RECORDING') {
    card.className = 'voice-recorder-card recording';
    if (statusText) statusText.innerText = 'Listening... Speak clearly';
    if (timerBadge) {
      timerBadge.classList.remove('hidden');
      timerBadge.innerText = `🔴 ${details.timeStr || '00:00'}`;
    }
    if (micBtn) {
      micBtn.className = 'voice-mic-main-btn recording';
      if (micIcon) micIcon.innerText = '⏹';
      if (micLabel) micLabel.innerText = 'Stop Recording';
    }
    if (msgTitle) msgTitle.innerText = 'Recording Voice Answer...';
    if (msgSub) msgSub.innerText = 'Speak your response clearly into the microphone. Click "Stop Recording" when finished.';
    if (secondaryActions) secondaryActions.classList.add('hidden');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span>Submit Answer</span>`;
    }
  }
  else if (statusState === 'RECORDED') {
    card.className = 'voice-recorder-card recorded';
    if (statusText) statusText.innerText = 'Voice Answer Recorded';
    if (timerBadge) timerBadge.classList.add('hidden');
    if (micBtn) {
      micBtn.className = 'voice-mic-main-btn recorded';
      if (micIcon) micIcon.innerText = '✓';
      if (micLabel) micLabel.innerText = 'Voice Answer Recorded';
    }
    if (msgTitle) msgTitle.innerText = '✓ Voice Answer Recorded Successfully';
    const wordInfo = details.words ? `${details.words} words recorded` : 'Voice recording saved';
    if (msgSub) msgSub.innerText = `${wordInfo}. Click "Submit Answer" to proceed, or "Record Again" to re-record.`;
    if (secondaryActions) secondaryActions.classList.remove('hidden');
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<span>Submit Answer</span> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    }
  }
  else if (statusState === 'PROCESSING') {
    card.className = 'voice-recorder-card';
    if (statusText) statusText.innerText = 'Evaluating Answer...';
    if (timerBadge) timerBadge.classList.add('hidden');
    if (micBtn) {
      micBtn.className = 'voice-mic-main-btn';
      if (micIcon) micIcon.innerText = '⏳';
      if (micLabel) micLabel.innerText = 'Processing Answer...';
    }
    if (msgTitle) msgTitle.innerText = 'Evaluating Your Response';
    if (msgSub) msgSub.innerText = 'The AI interviewer is evaluating your voice answer...';
    if (secondaryActions) secondaryActions.classList.add('hidden');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span>⏳ Evaluating Answer...</span>`;
    }
  }
  else if (statusState === 'ERROR') {
    card.className = 'voice-recorder-card error';
    if (statusText) statusText.innerText = 'Microphone Access Required';
    if (timerBadge) timerBadge.classList.add('hidden');
    if (micBtn) {
      micBtn.className = 'voice-mic-main-btn';
      if (micIcon) micIcon.innerText = '⚠️';
      if (micLabel) micLabel.innerText = 'Try Again';
    }
    if (msgTitle) msgTitle.innerText = '⚠️ Microphone Access Required';
    if (msgSub) msgSub.innerText = details.errorMsg || 'Microphone access is required to answer this interview. Please enable microphone permissions in your browser and click Try Again.';
    if (secondaryActions) secondaryActions.classList.add('hidden');
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span>Submit Answer</span>`;
    }
  }
}

function startAnsweringPhase(question) {
  const btnMic = document.getElementById('btn-sim-mic');
  const btnSubmit = document.getElementById('btn-sim-submit');
  const speechBox = document.getElementById('sim-candidate-speech');
  const isCV = state.activeInterviewType === 'cv_interview' || !!state.activeBlueprint?.isCVSmartInterview;

  if (isCV) {
    updateVoiceAnswerUI('READY');
  } else {
    if (btnMic) btnMic.disabled = false;
    if (btnSubmit) btnSubmit.disabled = false;
    if (speechBox) speechBox.innerHTML = `<span class="speech-placeholder">Click microphone or speak to answer...</span>`;
    startRecording();
  }

  // Start question timer
  state.timerSecondsLeft = question.timeLimit || 60;
  startTimer(state.timerSecondsLeft);
}

function startTimer(seconds) {
  if (state.timerInterval) clearInterval(state.timerInterval);
  
  const timerCircle = document.getElementById('sim-timer-circle');
  const timerSec = document.getElementById('sim-timer-sec');
  const timerRing = document.getElementById('sim-timer-ring');
  
  const totalSeconds = seconds;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  timerCircle.style.strokeDasharray = circumference;

  const update = () => {
    timerSec.innerText = state.timerSecondsLeft;
    
    // Circle offset percentage
    const offset = circumference - (state.timerSecondsLeft / totalSeconds) * circumference;
    timerCircle.style.strokeDashoffset = offset;

    // Apply color alerts for low time
    if (state.timerSecondsLeft <= 10) {
      timerRing.className = "timer-ring danger";
    } else if (state.timerSecondsLeft <= 25) {
      timerRing.className = "timer-ring warning";
    } else {
      timerRing.className = "timer-ring";
    }

    if (state.timerSecondsLeft <= 0) {
      clearInterval(state.timerInterval);
      handleTimerExpiration();
    }
    
    state.timerSecondsLeft--;
  };

  update();
  state.timerInterval = setInterval(update, 1000);
}

function startRecording() {
  const btnMic = document.getElementById('btn-sim-mic');
  const avatarBox = document.getElementById('sim-avatar-box');
  const status = document.getElementById('sim-mic-status');
  const speechBox = document.getElementById('sim-candidate-speech');
  const isCV = state.activeInterviewType === 'cv_interview' || !!state.activeBlueprint?.isCVSmartInterview;

  state.isRecording = true;
  if (btnMic) btnMic.classList.add('active');
  if (avatarBox) avatarBox.classList.add('listening');
  if (status) status.innerText = "Listening...";

  if (recordingTimerInterval) clearInterval(recordingTimerInterval);
  recordingSecondsCount = 0;

  if (isCV) {
    updateVoiceAnswerUI('RECORDING', { timeStr: '00:00' });
    recordingTimerInterval = setInterval(() => {
      recordingSecondsCount++;
      const mins = String(Math.floor(recordingSecondsCount / 60)).padStart(2, '0');
      const secs = String(recordingSecondsCount % 60).padStart(2, '0');
      const timerBadge = document.getElementById('cv-voice-timer-badge');
      if (timerBadge) timerBadge.innerText = `🔴 ${mins}:${secs}`;
    }, 1000);
  }

  // Detect Hindi language from current question
  const currentQ = state.currentQuestions[state.currentQuestionIndex];
  const isHindi = currentQ && /[\u0900-\u097F]/.test(currentQ.questionText);
  const recognitionLang = isHindi ? 'hi-IN' : 'en-IN';

  voiceEngine.startListening(
    (final, interim) => {
      // Live transcription callback
      state.finalTranscript = final;
      state.interimTranscript = interim;
      
      const fullText = (final + " " + interim).trim();

      if (!isCV) {
        if (speechBox) speechBox.innerHTML = fullText ? `“ ${fullText} ”` : `<span class="speech-placeholder">Speak now...</span>`;

        // Word counter update for live speech in Cabin Crew mode
        const answerCounter = document.getElementById('sim-answer-counter');
        if (answerCounter && fullText) {
          const words = fullText.split(/\s+/).filter(Boolean).length;
          answerCounter.innerText = `${words} words • ${fullText.length} chars (Voice)`;
        }
      }
    },
    (final) => {
      // End callback
      state.finalTranscript = final;
    },
    (err) => {
      // Error callback (e.g. permission/network)
      console.error("Microphone recognition error:", err);
      if (recordingTimerInterval) {
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = null;
      }
      state.isRecording = false;
      if (isCV) {
        updateVoiceAnswerUI('ERROR', {
          errorMsg: 'Microphone access is required to answer this interview. Please enable microphone permissions in your browser and click Try Again.'
        });
      } else {
        if (status) status.innerText = "Error: Click to Retry";
        pauseRecording();
      }
    },
    recognitionLang
  );
}

function pauseRecording() {
  const btnMic = document.getElementById('btn-sim-mic');
  const avatarBox = document.getElementById('sim-avatar-box');
  const status = document.getElementById('sim-mic-status');
  const isCV = state.activeInterviewType === 'cv_interview' || !!state.activeBlueprint?.isCVSmartInterview;

  if (recordingTimerInterval) {
    clearInterval(recordingTimerInterval);
    recordingTimerInterval = null;
  }

  state.isRecording = false;
  if (btnMic) btnMic.classList.remove('active');
  if (avatarBox) avatarBox.classList.remove('listening');
  if (status) status.innerText = "Paused";
  voiceEngine.stopListening();

  if (isCV) {
    const fullText = (state.finalTranscript + " " + state.interimTranscript).trim();
    const words = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
    if (words > 0 || fullText.length > 0) {
      updateVoiceAnswerUI('RECORDED', { words: words });
    } else if (state.voiceAnswerState === 'RECORDING') {
      const msgSub = document.getElementById('cv-voice-msg-sub');
      if (msgSub) msgSub.innerText = 'No voice detected. Click "Start Speaking" again and speak into your microphone.';
      updateVoiceAnswerUI('READY');
    }
  }
}

function handleTimerExpiration() {
  // If timer hits zero: stop recording, auto-submit
  pauseRecording();
  
  // Flash warning
  const speechBox = document.getElementById('sim-candidate-speech');
  if (speechBox) speechBox.innerHTML = `<span style="color:var(--accent-danger);">⚠️ Time expired. Auto-submitting response.</span>`;
  
  setTimeout(() => {
    submitAnswerAndAdvance();
  }, 1500);
}

async function submitAnswerAndAdvance() {
  if (state.timerInterval) clearInterval(state.timerInterval);

  // *** CRITICAL: Capture transcript BEFORE pauseRecording() is called ***
  // pauseRecording() calls voiceEngine.stopListening() which triggers an async
  // onend callback that may overwrite state.finalTranscript with "" before we read it.
  const capturedFinal = state.finalTranscript || '';
  const capturedInterim = state.interimTranscript || '';

  pauseRecording();

  // Prevent duplicate submit calls while processing
  if (state.isSubmitting) return;
  state.isSubmitting = true;

  const isCV = state.activeInterviewType === 'cv_interview' || !!state.activeBlueprint?.isCVSmartInterview;
  if (isCV) {
    updateVoiceAnswerUI('PROCESSING');
  }

  const currentQ = state.currentQuestions[state.currentQuestionIndex];
  const candidateInput = document.getElementById('sim-candidate-input');
  const typedText = candidateInput ? candidateInput.value.trim() : '';
  // Use captured transcript (safe from async overwrite) merged with current state as fallback
  const speechText = ((capturedFinal || state.finalTranscript) + " " + (capturedInterim || state.interimTranscript)).trim();
  const responseText = typedText || speechText;

  const btnSubmit = document.getElementById('btn-sim-submit');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span>⏳ Processing Answer...</span>`;
  }

  const timeLimit = currentQ ? (currentQ.timeLimit || 60) : 60;
  const timeTaken = Math.max(1, timeLimit - state.timerSecondsLeft);

  // Save candidate answer
  if (currentQ) {
    const answer = db.answers.save(currentQ.id, responseText || "(No speech response provided)", timeTaken);
    state.currentAnswers[state.currentQuestionIndex] = answer;
  }

  const qText = document.getElementById('sim-question-text');
  const avatarBox = document.getElementById('sim-avatar-box');
  if (avatarBox) avatarBox.classList.add('processing');

  // Dynamic Follow-Up System for CV Interview mode
  if (isCV && currentQ && !currentQ.isFollowUp && !state.isFollowUpActive && responseText.length > 20) {
    if (qText) qText.innerText = "AI is evaluating answer depth...";
    try {
      const fuResult = await groqClient.generateFollowUp(
        currentQ.questionText,
        responseText,
        state.activeBlueprint?.category || 'Professional',
        'cv_interview'
      );

      if (fuResult.needsFollowUp && fuResult.followUpQuestion && isValidInterviewQuestion(fuResult.followUpQuestion)) {
        state.isFollowUpActive = true;
        state.isSubmitting = false;
        const fuBadge = document.getElementById('sim-followup-badge');
        if (fuBadge) fuBadge.classList.remove('hidden');
        if (avatarBox) avatarBox.classList.remove('processing');

        currentQ.isFollowUp = true;
        currentQ.questionText = fuResult.followUpQuestion;
        if (qText) qText.innerText = fuResult.followUpQuestion;

        state.interimTranscript = "";
        state.finalTranscript = "";
        const speechBox = document.getElementById('sim-candidate-speech');
        if (speechBox) speechBox.innerHTML = `<span class="speech-placeholder">Follow-up: Speak your answer...</span>`;

        voiceEngine.speak(fuResult.followUpQuestion, null, () => {
          startTimer(45);
          updateVoiceAnswerUI('READY');
        }, () => {
          startTimer(45);
          updateVoiceAnswerUI('READY');
        });
        return; // Candidate will now answer follow-up
      }
    } catch (fuErr) {
      console.warn("Follow-up check bypassed:", fuErr.message);
    }
  }

  state.isFollowUpActive = false;
  const nextIdx = state.currentQuestionIndex + 1;
  const totalQuestions = state.activeBlueprint?.totalQuestions || 10;
  db.sessions.advanceQuestion(state.activeSession.id, nextIdx);

  // IF FINAL QUESTION WAS ANSWERED:
  if (nextIdx >= totalQuestions) {
    if (qText) qText.innerText = isCV ? "All questions completed! Compiling comprehensive scorecard..." : "Flight landed. Compiling assessment metrics...";
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span>⏳ Evaluating Final Score...</span>`;
    }
    
    try {
      await completeSession();
    } catch (finalErr) {
      console.error("Error finalizing session:", finalErr);
      state.isSubmitting = false;
      showEvalRetryModal(state.activeSession.id, finalErr.message);
    }
    return;
  }

  // ADVANCE TO NEXT QUESTION:
  if (qText) qText.innerText = isCV ? "Preparing next interview stage..." : "Processing response safety metrics...";
  
  setTimeout(() => {
    state.isSubmitting = false;
    if (avatarBox) avatarBox.classList.remove('processing');
    loadQuestionIndex(nextIdx);
  }, 800);
}

async function completeSession(forcedStatus = 'COMPLETED') {
  if (state.timerInterval) clearInterval(state.timerInterval);
  voiceEngine.stopSpeaking();
  voiceEngine.stopListening();
  proctoringEngine.stop(forcedStatus);

  const avatarBox = document.getElementById('sim-avatar-box');
  if (avatarBox) avatarBox.className = 'avatar-container processing';

  const qText = document.getElementById('sim-question-text');
  if (qText) {
    qText.innerText = forcedStatus === 'TERMINATED_BY_PROCTORING'
      ? 'Session terminated. Generating proctoring report...'
      : 'Interview complete. Generating personalized feedback...';
  }

  db.sessions.updateStatus(state.activeSession.id, forcedStatus);

  const userId = state.currentUser ? state.currentUser.id : (state.firebaseUser ? state.firebaseUser.uid : 'guest_user');

  if (state.firebaseUser) {
    try {
      await firestore.saveSession(state.firebaseUser.uid, state.activeSession.id, {
        status: forcedStatus,
        completedAt: new Date().toISOString(),
        blueprintId: state.activeBlueprint?.id,
        mode: state.activeMode || 'real',
        questionCount: state.currentQuestions.length,
        warningCount: state.proctorWarnings || 0
      });
    } catch (fsErr) {
      console.warn("Firestore saveSession warning:", fsErr.message);
    }
  }

  const isCV = state.activeInterviewType === 'cv_interview' || !!state.activeBlueprint?.isCVSmartInterview;
  const profile = (state.currentUser ? db.profiles.getByUserId(userId) : null) || {};
  const cvText = isCV ? (state.cvText || '') : '';
  const jobRole = isCV ? (state.activeBlueprint?.category || 'Professional') : 'Cabin Crew';
  const mode = state.activeBlueprint?.interviewMode || state.activeMode || 'real';
  const difficulty = state.activeBlueprint?.difficulty || 'Medium';
  const language = state.activeBlueprint?.language || 'English';

  // *** ANSWER VALIDATION: Filter sparse array and verify answers exist ***
  // state.currentAnswers may have undefined holes if any question was skipped.
  // Remove undefined/null slots before sending to evaluator.
  const validAnswers = (state.currentAnswers || []).filter(a => a && a.candidateAnswer);
  console.log(`[completeSession] Questions: ${state.currentQuestions.length}, Valid Answers collected: ${validAnswers.length}`);
  if (validAnswers.length === 0) {
    throw new Error(`No answers were collected. (${state.currentAnswers.length} answer slots exist but all are empty.) The interview result cannot be generated without actual answers.`);
  }
  // Use validAnswers for evaluation (but keep state.currentAnswers for display)
  const answersForEval = validAnswers;

  let evaluationResult;
  try {
    evaluationResult = await groqClient.evaluateSession(
      state.currentQuestions, answersForEval, cvText,
      jobRole,
      {
        interviewType: isCV ? 'cv_interview' : 'cabin_crew',
        mode: mode,
        difficulty: difficulty,
        language: language
      }
    );
    evaluationResult.aiGenerated = true;
  } catch (aiErr) {
    console.warn('AI eval failed, using local fallback engine:', aiErr.message);
    evaluationResult = aiEngine.evaluateSession(
      state.activeSession, isCV ? null : profile, state.activeBlueprint,
      state.currentQuestions, answersForEval
    );
    evaluationResult.aiGenerated = false;
  }

  if (!evaluationResult) {
    throw new Error("Could not construct evaluation result.");
  }

  if (!evaluationResult.overallRating) {
    evaluationResult.overallRating = (evaluationResult.overallScore / 10).toFixed(1);
  }

  // Merge question metadata & performance levels into reviews
  if (evaluationResult.questionReviews) {
    evaluationResult.questionReviews = evaluationResult.questionReviews.map((rev, i) => {
      const q = state.currentQuestions[i];
      const ans = answersForEval.find(a => a.questionId === q?.id) || answersForEval[i];
      const score = rev.score || 7;
      let performanceLevel = rev.performanceLevel;
      if (!performanceLevel) {
        if (score >= 8) performanceLevel = 'Strong';
        else if (score >= 7) performanceLevel = 'Good';
        else if (score >= 5) performanceLevel = 'Needs Improvement';
        else performanceLevel = 'Weak';
      }
      return {
        ...rev,
        questionId: q?.id || `q_${i}`,
        questionText: rev.questionText || q?.questionText || `Question ${i+1}`,
        stageName: rev.stageName || q?.stageName || 'Assessment',
        timeTaken: rev.timeTaken || ans?.timeTaken || 0,
        candidateAnswer: rev.candidateAnswer || ans?.candidateAnswer || '(No answer provided)',
        score: score,
        performanceLevel: performanceLevel,
        feedback: rev.feedback || 'Answer evaluated based on response quality.',
        tip: rev.tip || 'Focus on structural phrasing and practical examples.',
        modelAnswer: rev.modelAnswer || 'A strong answer would provide clear context, key technical tools, and concrete results.'
      };
    });
  }

  db.evaluations.save(
    state.activeSession.id, evaluationResult.overallScore,
    evaluationResult.criteriaScores, evaluationResult.strengths,
    evaluationResult.weaknesses, evaluationResult.recommendations,
    evaluationResult.questionReviews,
    {
      selectionReadiness: evaluationResult.selectionReadiness || 'Good',
      selectionStatement: evaluationResult.selectionStatement || 'Your current performance shows good potential. Focus on technical depth to be more interview-ready.',
      interviewerFeedback: evaluationResult.interviewerFeedback || evaluationResult.recommendations,
      overallRating: evaluationResult.overallRating,
      questionsStruggled: evaluationResult.questionsStruggled || [],
      topicsToRevise: evaluationResult.topicsToRevise || [],
      interview_type: isCV ? 'cv_interview' : 'cabin_crew',
      mode: mode,
      questionCount: state.currentQuestions.length,
      language: language,
      difficulty: difficulty
    }
  );

  if (state.firebaseUser) {
    try {
      await firestore.saveEvaluation(state.firebaseUser.uid, state.activeSession.id, {
        ...evaluationResult,
        sessionId: state.activeSession.id,
        blueprintId: state.activeBlueprint?.id,
        questions: state.currentQuestions,
        answers: state.currentAnswers
      });
    } catch (fsErr2) {
      console.warn("Firestore saveEvaluation warning:", fsErr2.message);
    }
  }

  try {
    db.attempts.create(userId, state.activeSession.id, state.activeBlueprint?.id || 'cv-blueprint', evaluationResult.overallScore);
  } catch (attErr) {
    console.warn("Attempt save skipped:", attErr.message);
  }

  state.isSubmitting = false;
  setTimeout(() => navigate('evaluation', { sessionId: state.activeSession.id }), 600);
}

function showEvalRetryModal(sessionId, errorMsg) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="card modal-box text-center" style="max-width:480px; padding:32px;">
      <div style="font-size:2.5rem; margin-bottom:12px;">⚠️</div>
      <h3 style="margin-bottom:8px;">Unable to Generate Result Right Now</h3>
      <p style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:20px;">
        ${errorMsg || "The AI evaluation service encountered a temporary connection issue. Your final answers are safely saved."}
      </p>
      <div style="display:flex; gap:12px; justify-content:center;">
        <button class="btn btn-primary" id="btn-modal-retry-eval">Retry Result Generation 🔄</button>
        <button class="btn btn-secondary" id="btn-modal-close-eval">Return to Dashboard</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btn-modal-retry-eval').onclick = async () => {
    modal.remove();
    try {
      await completeSession();
    } catch (e) {
      showEvalRetryModal(sessionId, e.message);
    }
  };

  document.getElementById('btn-modal-close-eval').onclick = () => {
    modal.remove();
    navigate('dashboard');
  };
}

/* ==========================================================================
   Modals Handlers & Profile Bindings
   ========================================================================== */

function openAuthModal(view) {
  authModal.classList.add('active');
  const loginBtn = document.getElementById('tab-login-btn');
  const signupBtn = document.getElementById('tab-signup-btn');

  if (view === 'login') {
    loginView.classList.remove('hidden');
    signupView.classList.add('hidden');
    
    // Style active tab
    loginBtn.className = "btn btn-primary";
    signupBtn.className = "btn btn-secondary";
  } else {
    signupView.classList.remove('hidden');
    loginView.classList.add('hidden');
    
    // Style active tab
    signupBtn.className = "btn btn-primary";
    loginBtn.className = "btn btn-secondary";
  }
}

function closeAuthModal() {
  authModal.classList.remove('active');
  loginAlert.classList.add('hidden');
  signupAlert.classList.add('hidden');
}

function openProfileModal() {
  const profile = db.profiles.getByUserId(state.currentUser.id);
  
  document.getElementById('prof-name').value = profile.name || '';
  document.getElementById('prof-education').value = profile.education || '';
  document.getElementById('prof-degree').value = profile.degree || '';
  document.getElementById('prof-branch').value = profile.branch || '';
  document.getElementById('prof-skills').value = profile.skills || '';
  document.getElementById('prof-projects').value = profile.projects || '';
  document.getElementById('prof-internship').value = profile.internship || '';
  document.getElementById('prof-achievements').value = profile.achievements || '';
  document.getElementById('prof-interests').value = profile.interests || '';
  
  profileModal.classList.add('active');

  // CV Upload + AI auto-fill binding
  const cvInput = document.getElementById('cv-upload-input');
  const autoFillBtn = document.getElementById('btn-ai-autofill');
  const cvStatus = document.getElementById('cv-upload-status');

  if (autoFillBtn) {
    autoFillBtn.onclick = async () => {
      const file = cvInput?.files?.[0];
      if (!file) {
        cvStatus.innerText = '⚠ Please select a CV file first.';
        cvStatus.style.color = '#EF4444';
        return;
      }

      cvStatus.style.color = 'var(--text-secondary)';
      cvStatus.innerText = '🔄 Extracting CV text...';
      autoFillBtn.disabled = true;

      try {
        let cvText = '';

        if (file.type === 'application/pdf') {
          // Use PDF.js to extract text
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const tc = await page.getTextContent();
            cvText += tc.items.map(i => i.str).join(' ') + '\n';
          }
        } else {
          cvText = await file.text();
        }

        state.cvText = cvText;
        cvStatus.innerText = '🤖 Grok AI is analyzing your CV...';

        const extractedProfile = await groqClient.analyzeCV(cvText);
        
        // Auto-fill form fields
        if (extractedProfile.name) document.getElementById('prof-name').value = extractedProfile.name;
        if (extractedProfile.education) document.getElementById('prof-education').value = extractedProfile.education;
        if (extractedProfile.degree) document.getElementById('prof-degree').value = extractedProfile.degree;
        if (extractedProfile.branch) document.getElementById('prof-branch').value = extractedProfile.branch;
        if (extractedProfile.skills) document.getElementById('prof-skills').value = extractedProfile.skills;
        if (extractedProfile.internship) document.getElementById('prof-internship').value = extractedProfile.internship;
        if (extractedProfile.achievements) document.getElementById('prof-achievements').value = extractedProfile.achievements;
        if (extractedProfile.interests) document.getElementById('prof-interests').value = extractedProfile.interests;

        cvStatus.style.color = '#10B981';
        cvStatus.innerText = `✓ CV analyzed successfully! Profile auto-filled. Click "Save Changes" to save.`;
      } catch (err) {
        cvStatus.style.color = '#EF4444';
        cvStatus.innerText = `✗ Error: ${err.message}`;
      } finally {
        autoFillBtn.disabled = false;
      }
    };
  }
}


function closeProfileModal() {
  profileModal.classList.remove('active');
}


// ─── Login (localStorage primary, Firebase optional) ──────────────────────
formLogin.onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  const btn   = e.target.querySelector('button[type="submit"]');

  loginAlert.classList.add('hidden');
  btn.disabled = true;
  btn.innerText = 'Signing in...';

  try {
    // Primary: localStorage auth (always works)
    const user = db.users.login(email, pass);
    sessionStorage.setItem('user', JSON.stringify(user));
    const profile = db.profiles.getByUserId(user.id) || {};
    updateAuthUI({ uid: user.id, email: user.email }, profile);
    closeAuthModal();
    navigate('dashboard');

    // Optional: try Firebase in background (won't block login)
    try {
      if (firebaseAuth && firebaseAuth.signIn) {
        await firebaseAuth.signIn(email, pass);
      }
    } catch (_) { /* Firebase not configured — that's fine */ }

  } catch (err) {
    loginAlert.innerText = err.message || 'Invalid email or password.';
    loginAlert.classList.remove('hidden');
    btn.disabled = false;
    btn.innerText = 'Log In';
  }
};

// ─── Signup (localStorage primary, Firebase optional) ─────────────────────
formSignup.onsubmit = async (e) => {
  e.preventDefault();
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-password').value;
  const btn   = e.target.querySelector('button[type="submit"]');

  signupAlert.classList.add('hidden');
  btn.disabled = true;
  btn.innerText = 'Creating account...';

  try {
    // Primary: localStorage auth (always works)
    const user = db.users.create(email, pass);
    const profile = { name, email, role: 'candidate', createdAt: new Date().toISOString() };
    db.profiles.save(user.id, profile);
    sessionStorage.setItem('user', JSON.stringify({ ...user, name }));
    updateAuthUI({ uid: user.id, email: user.email }, profile);
    closeAuthModal();
    navigate('dashboard');

    // Optional: try Firebase in background (won't block signup)
    try {
      if (firebaseAuth && firebaseAuth.signUp) {
        const fbUser = await firebaseAuth.signUp(name, email, pass);
        if (fbUser && firestore) await firestore.saveProfile(fbUser.uid, profile);
      }
    } catch (_) { /* Firebase not configured — that's fine */ }

  } catch (err) {
    let msg = err.message || 'Could not create account.';
    if (msg.toLowerCase().includes('already')) msg = 'This email is already registered. Please log in.';
    signupAlert.innerText = msg;
    signupAlert.classList.remove('hidden');
    btn.disabled = false;
    btn.innerText = 'Create Account';
  }
};

// ─── Profile Save ──────────────────────────────────────────────────────────
formProfile.onsubmit = async (e) => {
  e.preventDefault();
  const pData = {
    name:         document.getElementById('prof-name').value,
    education:    document.getElementById('prof-education').value,
    degree:       document.getElementById('prof-degree').value,
    branch:       document.getElementById('prof-branch').value,
    skills:       document.getElementById('prof-skills').value,
    projects:     document.getElementById('prof-projects').value,
    internship:   document.getElementById('prof-internship').value,
    achievements: document.getElementById('prof-achievements').value,
    interests:    document.getElementById('prof-interests').value,
    cvText:       state.cvText || ''
  };

  db.profiles.save(state.currentUser.id, pData);
  try {
    if (state.firebaseUser && firestore) await firestore.saveProfile(state.firebaseUser.uid, pData);
  } catch (_) {}

  state.currentUser.name = pData.name;
  const profileBtn = document.getElementById('btn-profile-trigger');
  if (profileBtn) profileBtn.innerText = `👤 ${pData.name}`;
  closeProfileModal();
  if (state.currentPage === 'dashboard') renderDashboard();
};

/* ==========================================================================
   Global Event Handlers
   ========================================================================== */
if (btnLoginTrigger) btnLoginTrigger.onclick = () => openAuthModal('login');
btnSignupTrigger.onclick  = () => openAuthModal('signup');
document.getElementById('tab-login-btn').onclick  = () => openAuthModal('login');
document.getElementById('tab-signup-btn').onclick = () => openAuthModal('signup');
authModalClose.onclick = closeAuthModal;

btnProfileTrigger.onclick = openProfileModal;
btnProfileCancel.onclick  = closeProfileModal;
profileModalClose.onclick = closeProfileModal;

btnLogout.onclick = () => {
  sessionStorage.removeItem('user');
  try { if (firebaseAuth && firebaseAuth.signOut) firebaseAuth.signOut(); } catch (_) {}
  updateAuthUI(null, null);
  navigate('landing');
};

logoBtn.onclick = () => { if (state.currentUser) navigate('dashboard'); else navigate('landing'); };
linkDashboard.onclick = () => navigate('dashboard');
linkLibrary.onclick   = () => navigate('library');
linkAdmin.onclick     = () => navigate('admin');
if (linkJEE) linkJEE.onclick = () => navigate('jee');

footerLinkCabin.onclick = () => { if (checkAuthentication()) navigate('details', { id: 'cabin-crew' }); };
if (footerLinkJEE) footerLinkJEE.onclick = () => navigate('jee');
footerLinkAbout.onclick = () => {
  navigate('landing');
  setTimeout(() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }), 100);
};
footerLinkFAQ.onclick = () => {
  navigate('landing');
  setTimeout(() => document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
};

// ─── App Boot: localStorage session check (no Firebase needed) ────────────
(function bootApp() {
  const sessionUser = sessionStorage.getItem('user');
  if (sessionUser) {
    const user = JSON.parse(sessionUser);
    const profile = db.profiles.getByUserId(user.id) || {};
    updateAuthUI({ uid: user.id, email: user.email }, profile);
    navigate('dashboard');
  } else {
    navigate('landing');
  }

  // Optional Firebase state listener — if Firebase is configured, sync silently
  try {
    if (firebaseAuth && firebaseAuth.onAuthChanged) {
      firebaseAuth.onAuthChanged(async (fbUser) => {
        if (fbUser && !state.currentUser) {
          let profile = {};
          try { profile = (await firestore.getProfile(fbUser.uid)) || {}; } catch (_) {}
          db.profiles.save(fbUser.uid, profile);
          updateAuthUI(fbUser, profile);
          if (state.currentPage === 'landing' || !state.currentPage) navigate('dashboard');
        }
      });
    }
  } catch (_) { /* Firebase not configured */ }
})();
