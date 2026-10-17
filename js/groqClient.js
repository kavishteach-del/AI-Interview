/* ==========================================================================
   Grok AI API Client
   Interview AI | Calls Flask backend which proxies to xAI Grok
   ========================================================================== */

const API_BASE = window.location.origin;

// Loading overlay helper
function showAILoader(message = 'Grok AI is thinking...') {
  let el = document.getElementById('grok-loader-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'grok-loader-overlay';
    el.style.cssText = `
      position:fixed; inset:0; background:rgba(5,7,10,0.92); z-index:9999;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      backdrop-filter:blur(8px);
    `;
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div style="text-align:center; padding:40px;">
      <div style="font-size:3rem; margin-bottom:20px; animation: pulse 1.5s infinite;">🤖</div>
      <div style="font-size:1.1rem; font-weight:700; color:#F1F5F9; margin-bottom:8px;">${message}</div>
      <div style="font-size:0.85rem; color:#64748B; margin-bottom:28px;">Powered by Grok xAI</div>
      <div style="display:flex; gap:8px; justify-content:center;">
        <div class="grok-dot" style="width:10px;height:10px;border-radius:50%;background:#3B82F6;animation:bounce 1.2s ease-in-out infinite 0s;"></div>
        <div class="grok-dot" style="width:10px;height:10px;border-radius:50%;background:#3B82F6;animation:bounce 1.2s ease-in-out infinite 0.2s;"></div>
        <div class="grok-dot" style="width:10px;height:10px;border-radius:50%;background:#3B82F6;animation:bounce 1.2s ease-in-out infinite 0.4s;"></div>
      </div>
    </div>
    <style>
      @keyframes bounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1.2)} }
      @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
    </style>
  `;
  el.style.display = 'flex';
}

function hideAILoader() {
  const el = document.getElementById('grok-loader-overlay');
  if (el) el.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
export const groqClient = {

  // Generate CV-based or role-based interview questions
  generateQuestions: async (cvText, jobRole = 'Candidate', candidateName = '', options = {}) => {
    const isCV = options.interviewType === 'cv_interview' || jobRole !== 'Cabin Crew';
    showAILoader(isCV ? '💼 Generating personalized CV interview questions...' : '✈️ Generating Cabin Crew assessment questions...');
    try {
      const payload = {
        cv_text: cvText || '',
        job_role: jobRole,
        candidate_name: candidateName,
        interview_type: options.interviewType || (isCV ? 'cv_interview' : 'cabin_crew'),
        question_count: options.questionCount || 10,
        language: options.language || 'English',
        hindi_count: options.hindiCount || 0,
        english_count: options.englishCount || 0,
        difficulty: options.difficulty || 'Medium',
        difficulty_dist: options.difficultyDist || {}
      };
      const resp = await fetch(`${API_BASE}/api/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Question generation failed');
      return data.questions;
    } finally {
      hideAILoader();
    }
  },

  // Evaluate the full interview session with AI
  evaluateSession: async (questions, answers, cvText, jobRole = 'Candidate', options = {}) => {
    const opts = typeof options === 'string' ? { interviewType: options } : (options || {});
    const isCV = opts.interviewType === 'cv_interview' || jobRole !== 'Cabin Crew';
    showAILoader(isCV ? '💼 Compiling comprehensive CV scorecard...' : '✈️ Pari is analyzing your assessment performance...');
    try {
      const payload = {
        questions,
        answers,
        cv_text: cvText || '',
        job_role: jobRole,
        interview_type: opts.interviewType || (isCV ? 'cv_interview' : 'cabin_crew'),
        mode: opts.mode || 'real',
        difficulty: opts.difficulty || 'Medium',
        language: opts.language || 'English'
      };
      const resp = await fetch(`${API_BASE}/api/evaluate-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      return data;
    } finally {
      hideAILoader();
    }
  },

  // Parse CV and auto-fill profile fields
  analyzeCV: async (cvText) => {
    showAILoader('📄 Extracting your profile from CV...');
    try {
      const resp = await fetch(`${API_BASE}/api/analyze-cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv_text: cvText })
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'CV analysis failed');
      return data.profile;
    } finally {
      hideAILoader();
    }
  },

  // AI Coach chatbot
  chatCoach: async (context, userMessage, coach = 'aria', interviewType = 'cv_interview') => {
    const resp = await fetch(`${API_BASE}/api/chat-coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, message: userMessage, coach, interview_type: interviewType })
    });
    const data = await resp.json();
    return data.reply || 'I could not process your question right now.';
  },

  // Skill gap analysis
  analyzeSkillGap: async (cvText, jobRole = 'Cabin Crew') => {
    showAILoader('🔍 Analyzing your CV against job requirements...');
    try {
      const resp = await fetch(`${API_BASE}/api/skill-gap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv_text: cvText, job_role: jobRole })
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'Skill gap analysis failed');
      return data.analysis;
    } finally {
      hideAILoader();
    }
  }
};
