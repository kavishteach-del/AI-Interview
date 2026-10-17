/* ============================================
   CampusConnect — Landing Page
   ============================================ */

window.CC_LANDING = (function() {

  function render(container) {
    container.innerHTML = `
    <div class="landing-page">

      <!-- Header -->
      <header class="landing-header">
        <div class="landing-header-inner">
          <div class="landing-logo">
            <div class="landing-logo-icon">🎓</div>
            <span class="landing-logo-text">CampusConnect</span>
          </div>
          <div class="landing-nav-links">
            <button class="btn btn-ghost" onclick="CC_APP.navigate('/login')">Log In</button>
            <button class="btn btn-primary" onclick="CC_APP.navigate('/signup')">Get Started</button>
          </div>
        </div>
      </header>

      <!-- Hero -->
      <section class="hero">
        <div class="hero-bg">
          <div class="hero-blob-1"></div>
          <div class="hero-blob-2"></div>
          <div class="hero-blob-3"></div>
        </div>
        <div class="hero-content">
          <div class="hero-badge">
            🎓 Made for JECRC University Students
          </div>
          <h1 class="hero-title">
            Campus feels better when<br>
            you have <span class="highlight">someone to share it with.</span>
          </h1>
          <p class="hero-subtitle">
            Find students, discover activities, join groups, and make meaningful connections — all within your campus.
          </p>
          <div class="hero-actions">
            <button class="btn btn-primary btn-lg" onclick="CC_APP.navigate('/signup')">
              🚀 Get Started — It's Free
            </button>
            <button class="btn btn-secondary btn-lg" onclick="document.getElementById('features-section').scrollIntoView({behavior:'smooth'})">
              Explore Features
            </button>
          </div>
          <div class="hero-stats">
            <div class="text-center">
              <div class="hero-stat-num">847+</div>
              <div class="hero-stat-label">JECRC Students</div>
            </div>
            <div class="text-center">
              <div class="hero-stat-num">1,200+</div>
              <div class="hero-stat-label">Activities Created</div>
            </div>
            <div class="text-center">
              <div class="hero-stat-num">3,500+</div>
              <div class="hero-stat-label">Connections Made</div>
            </div>
            <div class="text-center">
              <div class="hero-stat-num">10+</div>
              <div class="hero-stat-label">Interest Circles</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section class="features-section" id="features-section">
        <div style="text-align:center;margin-bottom:48px">
          <div class="section-eyebrow">What can you do?</div>
          <h2 class="section-heading">Everything you need to connect on campus</h2>
          <p class="section-desc mx-auto">No awkward cold approaches. Just open CampusConnect, see who's free, what's happening, and jump in.</p>
        </div>
        <div class="features-grid">
          ${renderFeatureCards()}
        </div>
      </section>

      <!-- Campus Now Preview -->
      <section class="how-section">
        <div class="how-inner">
          <div class="section-eyebrow">🟢 Live on Campus</div>
          <h2 class="section-heading">See what's happening right now</h2>
          <p class="section-desc mx-auto">Real-time campus activity snapshot — without invading anyone's privacy.</p>
          <div class="live-cards" style="margin-top:40px">
            <div class="live-card"><div class="live-card-emoji">☕</div><div class="live-card-count">18</div><div class="live-card-label">At Cafeteria</div></div>
            <div class="live-card"><div class="live-card-emoji">📚</div><div class="live-card-count">8</div><div class="live-card-label">In Library</div></div>
            <div class="live-card"><div class="live-card-emoji">🏸</div><div class="live-card-count">14</div><div class="live-card-label">Sports Ground</div></div>
            <div class="live-card"><div class="live-card-emoji">💻</div><div class="live-card-count">11</div><div class="live-card-label">In Computer Labs</div></div>
            <div class="live-card"><div class="live-card-emoji">🌿</div><div class="live-card-count">5</div><div class="live-card-label">Sustainability Plaza</div></div>
            <div class="live-card"><div class="live-card-emoji">🎤</div><div class="live-card-count">22</div><div class="live-card-label">In Auditorium</div></div>
          </div>
        </div>
      </section>

      <!-- How it works -->
      <section style="padding:72px 24px;max-width:1100px;margin:0 auto">
        <div style="text-align:center;margin-bottom:52px">
          <div class="section-eyebrow">How it works</div>
          <h2 class="section-heading">From discovery to real interaction</h2>
        </div>
        <div class="how-steps">
          <div class="how-step">
            <div class="how-step-num">1</div>
            <h3 class="how-step-title">Open CampusConnect</h3>
            <p class="how-step-desc">Sign up with your JECRC University email. Set up your profile — interests, skills, availability.</p>
          </div>
          <div class="how-step" style="position:relative">
            <div class="how-step-num">2</div>
            <h3 class="how-step-title">Discover & Connect</h3>
            <p class="how-step-desc">See who's free now, what's happening on campus, and find people with shared interests.</p>
          </div>
          <div class="how-step">
            <div class="how-step-num">3</div>
            <h3 class="how-step-title">Meet on Campus</h3>
            <p class="how-step-desc">Join activities, open spots, and tables. Turn online discovery into real campus interaction.</p>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="cta-section">
        <div class="cta-card">
          <h2 class="cta-title">No one should feel alone on campus.</h2>
          <p class="cta-desc">Whether you're a fresher finding your way or a senior wanting to meet new faces — CampusConnect is for you.</p>
          <div class="cta-actions">
            <button class="btn btn-white btn-lg" onclick="CC_APP.navigate('/signup')">
              🎓 Join CampusConnect
            </button>
            <button class="btn btn-outline-white btn-lg" onclick="CC_APP.navigate('/login')">
              Log In
            </button>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="landing-footer">
        <div class="footer-logo-text">CampusConnect</div>
        <div class="footer-tagline">Find People. Find Activities. Find Your Place on Campus.</div>
        <div class="footer-copy">© 2026 CampusConnect • JECRC University, Jaipur • Built for students, by students</div>
      </footer>

    </div>
    `;
  }

  function renderFeatureCards() {
    const features = [
      { emoji: '🟢', title: 'I\'m Free Now', desc: 'Tell others you\'re free and what you want to do. Discover who else is free nearby.', color: 'green' },
      { emoji: '📍', title: 'Campus Map', desc: 'See activity hotspots across campus. Click any zone to see who\'s there and what\'s happening.', color: 'blue' },
      { emoji: '👥', title: 'Find My People', desc: 'AI-powered interest matching connects you with students who share your passions.', color: 'indigo' },
      { emoji: '🎯', title: 'Open Spots', desc: 'Create or join an open invitation — study, chai, gaming, walk. No awkward cold approaches.', color: 'purple' },
      { emoji: '☕', title: 'Open Tables', desc: 'Cafeteria Open Table lets anyone join your table. Random chai, real friendships.', color: 'amber' },
      { emoji: '💻', title: 'Find Partners', desc: 'Study partner, project partner, sports partner, content partner — all in one place.', color: 'cyan' },
      { emoji: '🎤', title: 'Events', desc: 'Discover college events, workshops, hackathons, cultural programs — and who else is going.', color: 'orange' },
      { emoji: '🏆', title: 'Together Challenges', desc: 'Gamified activities to help you explore campus and meet people — badges included.', color: 'pink' },
    ];

    return features.map(f => `
      <div class="feature-card animate-fade-in">
        <div class="feature-icon-wrap ${f.color}">
          <span style="font-size:26px">${f.emoji}</span>
        </div>
        <h3 class="feature-title">${f.title}</h3>
        <p class="feature-desc">${f.desc}</p>
      </div>
    `).join('');
  }

  return { render };
})();
