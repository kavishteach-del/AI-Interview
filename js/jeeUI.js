/* ==========================================================================
   JEE CBT USER INTERFACE CONTROLLER (jeeUI.js)
   Clean 4-Stage Flow: Landing -> Configuration Wizard -> CBT Screen -> Results
   ========================================================================== */

import {
  jeeState,
  JEE_CHAPTERS,
  JEE_EXAM_PRESETS,
  renderMath,
  saveJEESession,
  loadJEESession,
  clearJEESession,
  buildExamQuestions,
  getPaletteCounts,
  saveResponse,
  markForReview,
  clearResponse,
  navigateToQuestion,
  switchSubjectTab,
  evaluateFinalResults
} from './jeeEngine.js';

let appNavigate = null;

export function setJEENavigate(navFn) {
  appNavigate = navFn;
}

/* ==========================================================================
   ROUTER ENTRY FOR JEE
   ========================================================================== */
export function renderJEE(navigate) {
  if (navigate) appNavigate = navigate;
  
  const saved = loadJEESession();
  // If user has an active, non-submitted CBT test in progress, prompt to resume or show landing
  if (saved && saved.active && !saved.isSubmitted && saved.questions?.length > 0) {
    Object.assign(jeeState, saved);
    renderJEECBT(navigate);
    return;
  }

  renderJEELanding(navigate);
}

/* ==========================================================================
   STAGE 1: JEE MOCK TEST LANDING PAGE
   ========================================================================== */
export function renderJEELanding(navigate) {
  if (navigate) appNavigate = navigate;
  const appRoot = document.getElementById('app-root');
  if (!appRoot) return;

  appRoot.innerHTML = `
    <div class="jee-container">
      <div class="jee-landing-hero">
        <div class="jee-badge">NTA & IIT CBT SIMULATOR</div>
        <h1>JEE Computer-Based Mock Test</h1>
        <p>Practice JEE Main and JEE Advanced in a realistic computer-based examination environment.</p>
      </div>

      <div class="jee-cards-grid">
        <!-- CARD A: JEE MAIN -->
        <div class="jee-exam-card featured">
          <div>
            <div class="jee-card-header">
              <div>
                <h2 class="jee-card-title">JEE (Main) Mock Test</h2>
                <div class="jee-card-subtitle">Official NTA Computer-Based Format</div>
              </div>
              <span class="jee-badge" style="margin:0;">300 Marks</span>
            </div>

            <p style="color:var(--jee-text-sub); font-size:0.92rem; line-height:1.5;">
              Single-session CBT examination designed to test fundamental clarity, speed, and accuracy across Physics, Chemistry, and Mathematics.
            </p>

            <div class="jee-pattern-specs">
              <div class="spec-item">
                <span class="spec-item-label">Duration</span>
                <span class="spec-item-val">⏱️ 180 Minutes (3h)</span>
              </div>
              <div class="spec-item">
                <span class="spec-item-label">Questions</span>
                <span class="spec-item-val">📝 75 Questions (25/subj)</span>
              </div>
              <div class="spec-item">
                <span class="spec-item-label">Question Types</span>
                <span class="spec-item-val">MCQs & Numerical</span>
              </div>
              <div class="spec-item">
                <span class="spec-item-label">Marking</span>
                <span class="spec-item-val">+4 for Correct, -1 for Incorrect</span>
              </div>
            </div>
          </div>

          <button class="jee-btn-cta" id="btn-start-jee-main">
            Start JEE (Main) Mock Test &rarr;
          </button>
        </div>

        <!-- CARD B: JEE ADVANCED -->
        <div class="jee-exam-card">
          <div>
            <div class="jee-card-header">
              <div>
                <h2 class="jee-card-title">JEE (Advanced) Mock Test</h2>
                <div class="jee-card-subtitle">IIT Comprehensive Testing Pattern</div>
              </div>
              <span class="jee-badge" style="margin:0; border-color:rgba(139,92,246,0.5); color:#c084fc;">High Rigor</span>
            </div>

            <p style="color:var(--jee-text-sub); font-size:0.92rem; line-height:1.5;">
              Rigorous test simulating IIT entrance difficulty with multi-concept problems, advanced numerical calculations, and selective marking rules.
            </p>

            <div class="jee-pattern-specs">
              <div class="spec-item">
                <span class="spec-item-label">Format</span>
                <span class="spec-item-val">⏱️ 3 Hours Examination</span>
              </div>
              <div class="spec-item">
                <span class="spec-item-label">Depth</span>
                <span class="spec-item-val">📊 Multi-Concept Synthesis</span>
              </div>
              <div class="spec-item">
                <span class="spec-item-label">Question Types</span>
                <span class="spec-item-val">Single, Multi-Correct & Num</span>
              </div>
              <div class="spec-item">
                <span class="spec-item-label">Marking</span>
                <span class="spec-item-val">Advanced Partial Marking</span>
              </div>
            </div>
          </div>

          <button class="jee-btn-cta" style="background:linear-gradient(135deg,#7c3aed,#6d28d9);" id="btn-start-jee-adv">
            Start JEE (Advanced) Mock Test &rarr;
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-start-jee-main').onclick = () => {
    renderJEEWizard(navigate, 'jee_main');
  };

  document.getElementById('btn-start-jee-adv').onclick = () => {
    renderJEEWizard(navigate, 'jee_advanced');
  };
}

/* ==========================================================================
   STAGE 2: STEP-BY-STEP CONFIGURATION WIZARD
   ========================================================================== */
export function renderJEEWizard(navigate, initialExam = 'jee_main') {
  if (navigate) appNavigate = navigate;
  const appRoot = document.getElementById('app-root');
  if (!appRoot) return;

  // Wizard state
  let currentStep = 1;
  let wizardExam = initialExam;
  let wizardDiff = 'medium';
  let wizardLang = 'en';
  let wizardScope = 'full_course';
  let wizardClass = 'all';
  let currentChapSubj = 'physics';

  // Selected chapters map
  const selectedChapters = {
    physics: [...(JEE_CHAPTERS.physics.class_11 || []), ...(JEE_CHAPTERS.physics.class_12 || [])],
    chemistry: [...(JEE_CHAPTERS.chemistry.class_11 || []), ...(JEE_CHAPTERS.chemistry.class_12 || [])],
    mathematics: [...(JEE_CHAPTERS.mathematics.class_11 || []), ...(JEE_CHAPTERS.mathematics.class_12 || [])]
  };

  function updateWizardDOM() {
    appRoot.innerHTML = `
      <div class="jee-container" style="max-width:960px;">
        
        <!-- Header -->
        <div class="jee-wizard-header">
          <div class="jee-badge">STEP-BY-STEP TEST CONFIGURATION</div>
          <h2 style="font-size:2rem; margin:0 0 8px 0; color:#fff;">Configure Your CBT Session</h2>
          <p style="color:var(--jee-text-sub); margin:0;">Customize the exam pattern, difficulty level, language, and syllabus scope.</p>
        </div>

        <!-- Progress Indicator -->
        <div class="jee-wizard-progress">
          <div class="wizard-step-pill ${currentStep === 1 ? 'active' : (currentStep > 1 ? 'done' : '')}">
            <span class="step-num">1</span> EXAM
          </div>
          <div class="wizard-step-pill ${currentStep === 2 ? 'active' : (currentStep > 2 ? 'done' : '')}">
            <span class="step-num">2</span> DIFFICULTY
          </div>
          <div class="wizard-step-pill ${currentStep === 3 ? 'active' : (currentStep > 3 ? 'done' : '')}">
            <span class="step-num">3</span> LANGUAGE
          </div>
          <div class="wizard-step-pill ${currentStep === 4 ? 'active' : (currentStep > 4 ? 'done' : '')}">
            <span class="step-num">4</span> SCOPE
          </div>
          <div class="wizard-step-pill ${currentStep === 5 ? 'active' : ''}">
            <span class="step-num">5</span> SUMMARY
          </div>
        </div>

        <!-- STEP 1: EXAM -->
        <div class="jee-step-card" id="step-card-1" style="${currentStep === 1 ? '' : 'display:none;'}">
          <div class="step-title-wrap">
            <span class="step-indicator">STEP 1</span>
            <h3>Select Examination</h3>
          </div>
          <p class="step-description">Choose between the official JEE Main format or the high-rigor JEE Advanced format.</p>

          <div class="jee-choice-row">
            <div class="jee-choice-box ${wizardExam === 'jee_main' ? 'selected' : ''}" data-choice-exam="jee_main">
              <div class="choice-box-top">
                <span class="choice-title">JEE MAIN</span>
                <span class="choice-check">${wizardExam === 'jee_main' ? '✓' : ''}</span>
              </div>
              <p class="choice-desc">NTA CBT standard format: 75 Questions, 300 Marks, 3 Hours duration.</p>
            </div>

            <div class="jee-choice-box ${wizardExam === 'jee_advanced' ? 'selected' : ''}" data-choice-exam="jee_advanced">
              <div class="choice-box-top">
                <span class="choice-title">JEE ADVANCED</span>
                <span class="choice-check">${wizardExam === 'jee_advanced' ? '✓' : ''}</span>
              </div>
              <p class="choice-desc">IIT Advanced testing format with multi-correct and advanced numerical problems.</p>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; margin-top:24px;">
            <button class="jee-btn-cta" style="width:auto; padding:10px 24px;" id="btn-next-step-1">Proceed to Difficulty &rarr;</button>
          </div>
        </div>

        <!-- STEP 2: DIFFICULTY -->
        <div class="jee-step-card" id="step-card-2" style="${currentStep === 2 ? '' : 'display:none;'}">
          <div class="step-title-wrap">
            <span class="step-indicator">STEP 2</span>
            <h3>Select Difficulty</h3>
          </div>
          <p class="step-description">Controls the depth of concepts, formula combination, and calculation complexity.</p>

          <div class="jee-choice-row">
            <div class="jee-choice-box ${wizardDiff === 'easy' ? 'selected' : ''}" data-choice-diff="easy">
              <div class="choice-box-top">
                <span class="choice-title">EASY</span>
                <span class="choice-check">${wizardDiff === 'easy' ? '✓' : ''}</span>
              </div>
              <p class="choice-desc">Core concepts and direct applications.</p>
            </div>

            <div class="jee-choice-box ${wizardDiff === 'medium' ? 'selected' : ''}" data-choice-diff="medium">
              <div class="choice-box-top">
                <span class="choice-title">MEDIUM</span>
                <span class="choice-check">${wizardDiff === 'medium' ? '✓' : ''}</span>
              </div>
              <p class="choice-desc">Standard JEE-level conceptual problems.</p>
            </div>

            <div class="jee-choice-box ${wizardDiff === 'hard' ? 'selected' : ''}" data-choice-diff="hard">
              <div class="choice-box-top">
                <span class="choice-title">HARD</span>
                <span class="choice-check">${wizardDiff === 'hard' ? '✓' : ''}</span>
              </div>
              <p class="choice-desc">Advanced multi-concept and calculation-heavy problems.</p>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-top:24px;">
            <button class="btn-nav-cbt btn-nav-prev" id="btn-back-step-2">&larr; Back</button>
            <button class="jee-btn-cta" style="width:auto; padding:10px 24px;" id="btn-next-step-2">Proceed to Language &rarr;</button>
          </div>
        </div>

        <!-- STEP 3: LANGUAGE -->
        <div class="jee-step-card" id="step-card-3" style="${currentStep === 3 ? '' : 'display:none;'}">
          <div class="step-title-wrap">
            <span class="step-indicator">STEP 3</span>
            <h3>Select Language</h3>
          </div>
          <p class="step-description">Choose the primary language for questions and examination instructions.</p>

          <div class="jee-choice-row">
            <div class="jee-choice-box ${wizardLang === 'en' ? 'selected' : ''}" data-choice-lang="en">
              <div class="choice-box-top">
                <span class="choice-title">English</span>
                <span class="choice-check">${wizardLang === 'en' ? '✓' : ''}</span>
              </div>
              <p class="choice-desc">Standard English terminology and mathematical notations.</p>
            </div>

            <div class="jee-choice-box ${wizardLang === 'hi' ? 'selected' : ''}" data-choice-lang="hi">
              <div class="choice-box-top">
                <span class="choice-title">हिन्दी (Hindi)</span>
                <span class="choice-check">${wizardLang === 'hi' ? '✓' : ''}</span>
              </div>
              <p class="choice-desc">हिंदी माध्यम प्रश्न एवं स्पष्ट वैज्ञानिक शब्दावली।</p>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-top:24px;">
            <button class="btn-nav-cbt btn-nav-prev" id="btn-back-step-3">&larr; Back</button>
            <button class="jee-btn-cta" style="width:auto; padding:10px 24px;" id="btn-next-step-3">Proceed to Scope &rarr;</button>
          </div>
        </div>

        <!-- STEP 4: SCOPE -->
        <div class="jee-step-card" id="step-card-4" style="${currentStep === 4 ? '' : 'display:none;'}">
          <div class="step-title-wrap">
            <span class="step-indicator">STEP 4</span>
            <h3>Select Test Scope</h3>
          </div>
          <p class="step-description">Practice the full course syllabus or choose specific target chapters.</p>

          <div class="jee-choice-row" style="margin-bottom:20px;">
            <div class="jee-choice-box ${wizardScope === 'full_course' ? 'selected' : ''}" data-choice-scope="full_course">
              <div class="choice-box-top">
                <span class="choice-title">FULL COURSE</span>
                <span class="choice-check">${wizardScope === 'full_course' ? '✓' : ''}</span>
              </div>
              <p class="choice-desc">Class 11 + Class 12 comprehensive syllabus across Physics, Chemistry, and Mathematics.</p>
            </div>

            <div class="jee-choice-box ${wizardScope === 'chapter_wise' ? 'selected' : ''}" data-choice-scope="chapter_wise">
              <div class="choice-box-top">
                <span class="choice-title">CHAPTER-WISE</span>
                <span class="choice-check">${wizardScope === 'chapter_wise' ? '✓' : ''}</span>
              </div>
              <p class="choice-desc">Targeted practice on select chapters of your choice.</p>
            </div>
          </div>

          ${wizardScope === 'chapter_wise' ? `
            <div style="background:rgba(0,0,0,0.25); border:1px solid var(--jee-border); border-radius:10px; padding:18px;">
              
              <!-- Selected chips display -->
              <div style="font-size:0.8rem; font-weight:700; color:var(--jee-text-muted); margin-bottom:8px; text-transform:uppercase;">
                Currently Selected Chapters:
              </div>
              <div class="chapter-tags-bar">
                ${['physics', 'chemistry', 'mathematics'].map(s => {
                  const arr = selectedChapters[s];
                  if (!arr || arr.length === 0) return '';
                  return arr.map(ch => `
                    <span class="chap-tag-chip">
                      <span style="text-transform:capitalize; opacity:0.75;">${s.slice(0,4)}:</span>
                      ${ch}
                      <span class="remove-chip" data-remove-subj="${s}" data-remove-ch="${ch}">&times;</span>
                    </span>
                  `).join('');
                }).join('')}
              </div>

              <!-- Subject tabs for chapter picker -->
              <div class="jee-chapter-tabs">
                <button class="jee-chap-tab ${currentChapSubj === 'physics' ? 'active' : ''}" data-chtab="physics">
                  Physics (${selectedChapters.physics.length})
                </button>
                <button class="jee-chap-tab ${currentChapSubj === 'chemistry' ? 'active' : ''}" data-chtab="chemistry">
                  Chemistry (${selectedChapters.chemistry.length})
                </button>
                <button class="jee-chap-tab ${currentChapSubj === 'mathematics' ? 'active' : ''}" data-chtab="mathematics">
                  Mathematics (${selectedChapters.mathematics.length})
                </button>
              </div>

              <!-- Filter Class & Bulk controls -->
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; gap:6px;">
                  <button class="btn-nav-cbt ${wizardClass === 'all' ? 'btn-nav-save' : 'btn-nav-prev'}" data-cls="all" style="padding:4px 12px; font-size:0.78rem;">All Classes</button>
                  <button class="btn-nav-cbt ${wizardClass === '11' ? 'btn-nav-save' : 'btn-nav-prev'}" data-cls="11" style="padding:4px 12px; font-size:0.78rem;">Class 11</button>
                  <button class="btn-nav-cbt ${wizardClass === '12' ? 'btn-nav-save' : 'btn-nav-prev'}" data-cls="12" style="padding:4px 12px; font-size:0.78rem;">Class 12</button>
                </div>
                <div>
                  <button class="btn-nav-cbt btn-nav-clear" id="btn-ch-select-all" style="padding:4px 10px; font-size:0.78rem;">Select All</button>
                  <button class="btn-nav-cbt btn-nav-clear" id="btn-ch-clear-all" style="padding:4px 10px; font-size:0.78rem;">Deselect All</button>
                </div>
              </div>

              <!-- Checkbox List -->
              <div class="jee-chap-checkbox-grid">
                ${getFilteredChapters(currentChapSubj, wizardClass).map(ch => {
                  const isChecked = selectedChapters[currentChapSubj].includes(ch);
                  return `
                    <label class="chap-checkbox-item">
                      <input type="checkbox" class="chap-input-chk" data-subj="${currentChapSubj}" data-ch="${ch}" ${isChecked ? 'checked' : ''}>
                      <span>${ch}</span>
                    </label>
                  `;
                }).join('')}
              </div>

            </div>
          ` : ''}

          <div style="display:flex; justify-content:space-between; margin-top:24px;">
            <button class="btn-nav-cbt btn-nav-prev" id="btn-back-step-4">&larr; Back</button>
            <button class="jee-btn-cta" style="width:auto; padding:10px 24px;" id="btn-next-step-4">Review Summary &rarr;</button>
          </div>
        </div>

        <!-- STEP 5: SUMMARY & INSTRUCTIONS -->
        <div class="jee-step-card" id="step-card-5" style="${currentStep === 5 ? '' : 'display:none;'}">
          <div class="step-title-wrap">
            <span class="step-indicator">STEP 5</span>
            <h3>Test Instructions & Summary</h3>
          </div>
          <p class="step-description">Verify your mock test specification before launching the full computer-based examination.</p>

          <table class="jee-summary-table">
            <tr>
              <td>Examination</td>
              <td>${wizardExam === 'jee_main' ? 'JEE (Main) Computer-Based Mock Test' : 'JEE (Advanced) Examination'}</td>
            </tr>
            <tr>
              <td>Difficulty</td>
              <td style="text-transform:capitalize;">${wizardDiff}</td>
            </tr>
            <tr>
              <td>Language</td>
              <td>${wizardLang === 'en' ? 'English' : 'हिन्दी (Hindi)'}</td>
            </tr>
            <tr>
              <td>Scope</td>
              <td>${wizardScope === 'full_course' ? 'Full Course (Class 11 + Class 12)' : `Chapter-Wise (${selectedChapters.physics.length + selectedChapters.chemistry.length + selectedChapters.mathematics.length} chapters selected)`}</td>
            </tr>
            <tr>
              <td>Duration</td>
              <td>180 Minutes (3.0 Hours)</td>
            </tr>
            <tr>
              <td>Subjects</td>
              <td>Physics | Chemistry | Mathematics</td>
            </tr>
            <tr>
              <td>Marking Rules</td>
              <td>${wizardExam === 'jee_main' ? '+4 for Correct, -1 for Incorrect, 0 for Unattempted' : 'Single Correct (+3, -1), Multi-Correct (+4 with Partial Marking), Numerical (+4, 0)'}</td>
            </tr>
          </table>

          <div style="background:rgba(37,99,235,0.1); border-left:4px solid #3b82f6; padding:14px; border-radius:4px; font-size:0.86rem; color:#cbd5e1; margin-bottom:24px; line-height:1.5;">
            <strong>ℹ️ Exam Instructions:</strong> The timer begins automatically upon clicking "Start CBT Examination". Use the Question Palette to jump between questions. Answered questions turn green; marked questions turn purple. Unsaved answers will not be evaluated.
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <button class="btn-nav-cbt btn-nav-prev" id="btn-back-step-5">&larr; Back</button>
            <button class="jee-btn-cta" id="btn-launch-cbt" style="padding:14px 36px; font-size:1.1rem;">
              🚀 Start CBT Examination
            </button>
          </div>
        </div>

      </div>
    `;

    bindWizardEvents();
  }

  function getFilteredChapters(subj, cls) {
    if (cls === '11') return JEE_CHAPTERS[subj].class_11 || [];
    if (cls === '12') return JEE_CHAPTERS[subj].class_12 || [];
    return [...(JEE_CHAPTERS[subj].class_11 || []), ...(JEE_CHAPTERS[subj].class_12 || [])];
  }

  function bindWizardEvents() {
    // Step navigation buttons
    const btnNext1 = document.getElementById('btn-next-step-1');
    if (btnNext1) btnNext1.onclick = () => { currentStep = 2; updateWizardDOM(); };

    const btnBack2 = document.getElementById('btn-back-step-2');
    if (btnBack2) btnBack2.onclick = () => { currentStep = 1; updateWizardDOM(); };

    const btnNext2 = document.getElementById('btn-next-step-2');
    if (btnNext2) btnNext2.onclick = () => { currentStep = 3; updateWizardDOM(); };

    const btnBack3 = document.getElementById('btn-back-step-3');
    if (btnBack3) btnBack3.onclick = () => { currentStep = 2; updateWizardDOM(); };

    const btnNext3 = document.getElementById('btn-next-step-3');
    if (btnNext3) btnNext3.onclick = () => { currentStep = 4; updateWizardDOM(); };

    const btnBack4 = document.getElementById('btn-back-step-4');
    if (btnBack4) btnBack4.onclick = () => { currentStep = 3; updateWizardDOM(); };

    const btnNext4 = document.getElementById('btn-next-step-4');
    if (btnNext4) btnNext4.onclick = () => { currentStep = 5; updateWizardDOM(); };

    const btnBack5 = document.getElementById('btn-back-step-5');
    if (btnBack5) btnBack5.onclick = () => { currentStep = 4; updateWizardDOM(); };

    // Exam choice selection
    document.querySelectorAll('[data-choice-exam]').forEach(el => {
      el.onclick = () => {
        wizardExam = el.getAttribute('data-choice-exam');
        updateWizardDOM();
      };
    });

    // Difficulty choice selection
    document.querySelectorAll('[data-choice-diff]').forEach(el => {
      el.onclick = () => {
        wizardDiff = el.getAttribute('data-choice-diff');
        updateWizardDOM();
      };
    });

    // Language choice selection
    document.querySelectorAll('[data-choice-lang]').forEach(el => {
      el.onclick = () => {
        wizardLang = el.getAttribute('data-choice-lang');
        updateWizardDOM();
      };
    });

    // Scope choice selection
    document.querySelectorAll('[data-choice-scope]').forEach(el => {
      el.onclick = () => {
        wizardScope = el.getAttribute('data-choice-scope');
        updateWizardDOM();
      };
    });

    // Chapter subject tabs
    document.querySelectorAll('[data-chtab]').forEach(el => {
      el.onclick = () => {
        currentChapSubj = el.getAttribute('data-chtab');
        updateWizardDOM();
      };
    });

    // Class filters
    document.querySelectorAll('[data-cls]').forEach(el => {
      el.onclick = () => {
        wizardClass = el.getAttribute('data-cls');
        updateWizardDOM();
      };
    });

    // Checkboxes
    document.querySelectorAll('.chap-input-chk').forEach(chk => {
      chk.onchange = (e) => {
        const subj = e.target.getAttribute('data-subj');
        const ch = e.target.getAttribute('data-ch');
        if (e.target.checked) {
          if (!selectedChapters[subj].includes(ch)) selectedChapters[subj].push(ch);
        } else {
          selectedChapters[subj] = selectedChapters[subj].filter(x => x !== ch);
        }
        updateWizardDOM();
      };
    });

    // Remove chip
    document.querySelectorAll('[data-remove-ch]').forEach(btn => {
      btn.onclick = () => {
        const subj = btn.getAttribute('data-remove-subj');
        const ch = btn.getAttribute('data-remove-ch');
        selectedChapters[subj] = selectedChapters[subj].filter(x => x !== ch);
        updateWizardDOM();
      };
    });

    // Select all / clear all chapters
    const btnSelectAll = document.getElementById('btn-ch-select-all');
    if (btnSelectAll) {
      btnSelectAll.onclick = () => {
        const list = getFilteredChapters(currentChapSubj, wizardClass);
        selectedChapters[currentChapSubj] = Array.from(new Set([...selectedChapters[currentChapSubj], ...list]));
        updateWizardDOM();
      };
    }

    const btnClearAll = document.getElementById('btn-ch-clear-all');
    if (btnClearAll) {
      btnClearAll.onclick = () => {
        const list = getFilteredChapters(currentChapSubj, wizardClass);
        selectedChapters[currentChapSubj] = selectedChapters[currentChapSubj].filter(x => !list.includes(x));
        updateWizardDOM();
      };
    }

    // Launch CBT Examination
    const btnLaunch = document.getElementById('btn-launch-cbt');
    if (btnLaunch) {
      btnLaunch.onclick = () => {
        btnLaunch.disabled = true;
        btnLaunch.textContent = 'Preparing Examination...';

        jeeState.active = true;
        jeeState.examType = wizardExam;
        jeeState.paper = 1;
        jeeState.difficulty = wizardDiff;
        jeeState.language = wizardLang;
        jeeState.mode = wizardScope;
        jeeState.selectedChapters = selectedChapters;
        jeeState.currentQuestionIndex = 0;
        jeeState.currentSubject = 'physics';
        jeeState.isSubmitted = false;
        jeeState.results = null;

        // Build question list
        jeeState.questions = buildExamQuestions(jeeState);

        // Initialize state for each question
        jeeState.answers = {};
        jeeState.questions.forEach((q, idx) => {
          jeeState.answers[q.id] = {
            value: null,
            status: idx === 0 ? 'not_answered' : 'not_visited',
            timeSpent: 0
          };
        });

        // Set authoritative timer timestamps
        jeeState.totalDurationSeconds = 180 * 60;
        jeeState.examStartTime = Date.now();
        jeeState.examEndTime = Date.now() + (jeeState.totalDurationSeconds * 1000);

        saveJEESession();
        navigate('jee-exam');
      };
    }
  }

  updateWizardDOM();
}

/* ==========================================================================
   STAGE 3: ACTUAL CBT EXAM WORKSPACE
   ========================================================================== */
export function renderJEECBT(navigate) {
  if (navigate) appNavigate = navigate;
  const appRoot = document.getElementById('app-root');
  if (!appRoot) return;

  // Single authoritative timer interval
  if (jeeState.timerInterval) clearInterval(jeeState.timerInterval);

  jeeState.timerInterval = setInterval(() => {
    const remainingSeconds = Math.max(0, Math.floor((jeeState.examEndTime - Date.now()) / 1000));
    updateTimerText(remainingSeconds);

    if (remainingSeconds <= 0) {
      clearInterval(jeeState.timerInterval);
      alert('Time is up! Your examination will now be submitted.');
      triggerSubmit();
    }
  }, 1000);

  function formatHHMMSS(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function updateTimerText(sec) {
    const digitsEl = document.getElementById('cbt-timer-val');
    if (digitsEl) {
      digitsEl.textContent = formatHHMMSS(sec);
      if (sec < 600) {
        digitsEl.classList.add('warning-pulse');
      }
    }
  }

  function renderCurrentCBTView() {
    const currentQ = jeeState.questions[jeeState.currentQuestionIndex];
    if (!currentQ) return;

    const currentAns = jeeState.answers[currentQ.id] || { value: null, status: 'not_answered' };
    const paletteCounts = getPaletteCounts();
    const isHindi = jeeState.language === 'hi';

    const phyCount = jeeState.questions.filter(q => q.subject === 'physics').length;
    const chemCount = jeeState.questions.filter(q => q.subject === 'chemistry').length;
    const mathCount = jeeState.questions.filter(q => q.subject === 'mathematics').length;

    // Remaining time in seconds
    const remainingSec = Math.max(0, Math.floor((jeeState.examEndTime - Date.now()) / 1000));

    appRoot.innerHTML = `
      <div class="jee-cbt-screen">
        
        <!-- TOP HEADER -->
        <header class="cbt-top-bar">
          <div>
            <div class="cbt-exam-title">${jeeState.examType === 'jee_main' ? 'JEE (Main) Mock Test' : 'JEE (Advanced) Mock Test'}</div>
            <div class="cbt-exam-sub">NTA Computer-Based Examination Environment</div>
          </div>

          <!-- Subject Tabs in Top Center -->
          <div class="cbt-subject-tabs-center">
            <button class="cbt-subj-tab ${jeeState.currentSubject === 'physics' ? 'active' : ''}" data-nav-subj="physics">
              Physics <span class="cbt-subj-badge">${phyCount}</span>
            </button>
            <button class="cbt-subj-tab ${jeeState.currentSubject === 'chemistry' ? 'active' : ''}" data-nav-subj="chemistry">
              Chemistry <span class="cbt-subj-badge">${chemCount}</span>
            </button>
            <button class="cbt-subj-tab ${jeeState.currentSubject === 'mathematics' ? 'active' : ''}" data-nav-subj="mathematics">
              Mathematics <span class="cbt-subj-badge">${mathCount}</span>
            </button>
          </div>

          <!-- Countdown Timer -->
          <div class="cbt-timer-box">
            <span class="timer-label">Time Left:</span>
            <span class="timer-digits ${remainingSec < 600 ? 'warning-pulse' : ''}" id="cbt-timer-val">${formatHHMMSS(remainingSec)}</span>
          </div>
        </header>

        <!-- SECOND HEADER -->
        <div class="cbt-sub-bar">
          <div class="sub-bar-left">
            <span>Candidate ID: <strong>JEE-MOCK-2026</strong></span>
            <span>Test Mode: <strong>${jeeState.mode === 'full_course' ? 'Full Course' : 'Chapter-Wise'}</strong></span>
            <span>Difficulty: <strong style="text-transform:capitalize;">${jeeState.difficulty}</strong></span>
          </div>

          <div class="sub-bar-right">
            <label for="cbt-lang-select" style="margin-right:6px;">Language:</label>
            <select id="cbt-lang-select">
              <option value="en" ${jeeState.language === 'en' ? 'selected' : ''}>English</option>
              <option value="hi" ${jeeState.language === 'hi' ? 'selected' : ''}>हिन्दी (Hindi)</option>
            </select>
          </div>
        </div>

        <!-- CBT BODY: QUESTION AREA + PALETTE -->
        <div class="cbt-main-body">
          
          <!-- QUESTION PANEL -->
          <div class="cbt-question-area">
            
            <div class="q-header-meta">
              <div class="q-meta-left">
                <span class="q-num-pill">Question ${jeeState.currentQuestionIndex + 1} of ${jeeState.questions.length}</span>
                <span class="q-type-badge">${currentQ.section}</span>
                <span class="q-chap-badge">${currentQ.subject.toUpperCase()} &bull; ${currentQ.chapter}</span>
              </div>
              <div class="q-marks-indicator">
                <span class="pos">+${currentQ.marks?.positive || 4}</span>
                <span class="neg">${currentQ.marks?.negative || -1}</span>
              </div>
            </div>

            <!-- Question Body -->
            <div class="q-body-panel">
              <div class="q-text-content">
                ${renderMath(isHindi && currentQ.question_hi ? currentQ.question_hi : currentQ.question)}
              </div>

              <!-- Options Area -->
              <div class="q-options-container" id="cbt-options-box">
                ${renderQuestionOptionsHTML(currentQ, currentAns, isHindi)}
              </div>
            </div>

          </div>

          <!-- RIGHT PALETTE SIDEBAR -->
          <aside class="cbt-palette-sidebar">
            <div class="candidate-box">
              <div class="candidate-icon">🎓</div>
              <div>
                <div style="font-weight:700; font-size:0.86rem;">Candidate: Aspirant</div>
                <div style="font-size:0.75rem; color:var(--jee-text-muted);">Roll No: 2026-JEE-8841</div>
              </div>
            </div>

            <!-- Palette Legend -->
            <div class="palette-legend-grid">
              <div class="legend-chip">
                <span class="legend-badge badge-answered">${paletteCounts.answered}</span>
                <span>Answered</span>
              </div>
              <div class="legend-chip">
                <span class="legend-badge badge-not-answered">${paletteCounts.notAnswered}</span>
                <span>Not Answered</span>
              </div>
              <div class="legend-chip">
                <span class="legend-badge badge-marked">${paletteCounts.marked}</span>
                <span>Marked</span>
              </div>
              <div class="legend-chip">
                <span class="legend-badge badge-not-visited">${paletteCounts.notVisited}</span>
                <span>Not Visited</span>
              </div>
            </div>

            <div class="palette-heading">Question Palette (${jeeState.currentSubject.toUpperCase()})</div>

            <!-- Palette Grid Pins -->
            <div class="palette-pins-grid">
              ${jeeState.questions.map((q, idx) => {
                const ans = jeeState.answers[q.id];
                const status = ans?.status || 'not_visited';
                const isCurrent = idx === jeeState.currentQuestionIndex;

                return `
                  <button class="palette-pin status-${status} ${isCurrent ? 'current' : ''}" data-pin-idx="${idx}" title="Q${idx + 1}: ${status.replace('_', ' ')}">
                    ${idx + 1}
                  </button>
                `;
              }).join('')}
            </div>
          </aside>

        </div>

        <!-- FIXED BOTTOM NAVIGATION BAR -->
        <footer class="cbt-bottom-bar">
          <div class="nav-cluster">
            <button class="btn-nav-cbt btn-nav-prev" id="cbt-btn-prev" ${jeeState.currentQuestionIndex === 0 ? 'disabled' : ''}>
              &larr; Previous
            </button>
            <button class="btn-nav-cbt btn-nav-clear" id="cbt-btn-clear">
              Clear Response
            </button>
          </div>

          <div class="nav-cluster">
            <button class="btn-nav-cbt btn-nav-review" id="cbt-btn-review">
              Mark for Review & Next
            </button>
            <button class="btn-nav-cbt btn-nav-save" id="cbt-btn-save">
              Save & Next &rarr;
            </button>
          </div>

          <div class="nav-cluster">
            <button class="btn-nav-cbt btn-nav-submit" id="cbt-btn-submit">
              Submit Examination
            </button>
          </div>
        </footer>

        <!-- SUBMIT CONFIRMATION MODAL -->
        <div class="jee-modal-overlay" id="cbt-modal-submit" style="display:none;">
          <div class="jee-modal-box">
            <h3 class="modal-title">Submit Examination?</h3>
            <p class="modal-text">Are you sure you want to finish and submit your exam? You cannot modify answers after submission.</p>

            <table class="modal-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Answered</th>
                  <th>Not Answered</th>
                  <th>Marked</th>
                  <th>Not Visited</th>
                </tr>
              </thead>
              <tbody>
                ${['physics', 'chemistry', 'mathematics'].map(s => {
                  const sQs = jeeState.questions.filter(q => q.subject === s);
                  let a = 0, na = 0, m = 0, nv = 0;
                  sQs.forEach(sq => {
                    const st = jeeState.answers[sq.id]?.status || 'not_visited';
                    if (st === 'answered' || st === 'marked_answered') a++;
                    else if (st === 'not_answered') na++;
                    else if (st === 'marked') m++;
                    else nv++;
                  });
                  return `
                    <tr>
                      <td style="text-transform:capitalize; text-align:left; padding-left:14px;">${s}</td>
                      <td style="color:#22c55e;">${a}</td>
                      <td style="color:#ef4444;">${na}</td>
                      <td style="color:#a855f7;">${m}</td>
                      <td style="color:#94a3b8;">${nv}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="modal-actions-row">
              <button class="btn-nav-cbt btn-nav-prev" id="cbt-modal-cancel">Cancel</button>
              <button class="btn-nav-cbt btn-nav-save" id="cbt-modal-confirm">Submit Final Examination</button>
            </div>
          </div>
        </div>

      </div>
    `;

    bindCBTWorkspaceEvents();
  }

  function renderQuestionOptionsHTML(q, ans, isHindi) {
    const userVal = ans.value;
    const opts = (isHindi && q.options_hi && q.options_hi.length > 0) ? q.options_hi : (q.options || []);

    if (q.type === 'single_choice') {
      const letters = ['A', 'B', 'C', 'D'];
      return opts.map((optText, i) => {
        const letter = letters[i];
        const isSelected = userVal === letter;
        return `
          <label class="q-option-row ${isSelected ? 'selected' : ''}" data-choice-row="${letter}">
            <input type="radio" name="cbt_option_radio" value="${letter}" ${isSelected ? 'checked' : ''}>
            <div class="option-body-text">${renderMath(optText)}</div>
          </label>
        `;
      }).join('');
    } else {
      // Numerical
      return `
        <div class="numerical-input-panel">
          <div style="font-size:0.86rem; color:var(--jee-text-sub); margin-bottom:12px;">
            Enter your final numerical value:
          </div>
          <div class="numerical-field-row">
            <input type="text" id="cbt-num-input" class="numerical-text-input" value="${userVal !== null && userVal !== undefined ? userVal : ''}" placeholder="0.0">
            <button class="btn-nav-cbt btn-nav-clear" id="btn-clear-num-field" style="height:48px;">Clear</button>
          </div>

          <div class="numerical-keypad-grid">
            <button class="numkey-btn" data-key="1">1</button>
            <button class="numkey-btn" data-key="2">2</button>
            <button class="numkey-btn" data-key="3">3</button>
            <button class="numkey-btn action" data-key="back">⌫</button>

            <button class="numkey-btn" data-key="4">4</button>
            <button class="numkey-btn" data-key="5">5</button>
            <button class="numkey-btn" data-key="6">6</button>
            <button class="numkey-btn" data-key=".">.</button>

            <button class="numkey-btn" data-key="7">7</button>
            <button class="numkey-btn" data-key="8">8</button>
            <button class="numkey-btn" data-key="9">9</button>
            <button class="numkey-btn" data-key="-">-</button>

            <button class="numkey-btn" data-key="0" style="grid-column: span 4;">0</button>
          </div>
        </div>
      `;
    }
  }

  function getActiveAnswerValue() {
    const q = jeeState.questions[jeeState.currentQuestionIndex];
    if (!q) return null;

    if (q.type === 'single_choice') {
      const checked = document.querySelector('input[name="cbt_option_radio"]:checked');
      return checked ? checked.value : null;
    } else {
      const input = document.getElementById('cbt-num-input');
      return (input && input.value.trim() !== '') ? input.value.trim() : null;
    }
  }

  function bindCBTWorkspaceEvents() {
    // Subject tab switching
    document.querySelectorAll('[data-nav-subj]').forEach(btn => {
      btn.onclick = () => {
        const targetSubj = btn.getAttribute('data-nav-subj');
        switchSubjectTab(targetSubj);
        renderCurrentCBTView();
      };
    });

    // Language switcher
    const langSelect = document.getElementById('cbt-lang-select');
    if (langSelect) {
      langSelect.onchange = (e) => {
        jeeState.language = e.target.value;
        saveJEESession();
        renderCurrentCBTView();
      };
    }

    // Palette pins direct jump
    document.querySelectorAll('[data-pin-idx]').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-pin-idx'), 10);
        navigateToQuestion(idx);
        renderCurrentCBTView();
      };
    });

    // Option row click
    document.querySelectorAll('[data-choice-row]').forEach(row => {
      row.onclick = () => {
        const radio = row.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          document.querySelectorAll('[data-choice-row]').forEach(r => r.classList.remove('selected'));
          row.classList.add('selected');
        }
      };
    });

    // Numerical keypad
    document.querySelectorAll('.numkey-btn').forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-key');
        const input = document.getElementById('cbt-num-input');
        if (!input) return;

        if (key === 'back') {
          input.value = input.value.slice(0, -1);
        } else if (key === '-') {
          if (!input.value.startsWith('-')) input.value = '-' + input.value;
          else input.value = input.value.slice(1);
        } else if (key === '.') {
          if (!input.value.includes('.')) input.value += '.';
        } else {
          input.value += key;
        }
      };
    });

    const btnClearNum = document.getElementById('btn-clear-num-field');
    if (btnClearNum) {
      btnClearNum.onclick = () => {
        const input = document.getElementById('cbt-num-input');
        if (input) input.value = '';
      };
    }

    // Previous Button
    const btnPrev = document.getElementById('cbt-btn-prev');
    if (btnPrev) {
      btnPrev.onclick = () => {
        if (jeeState.currentQuestionIndex > 0) {
          navigateToQuestion(jeeState.currentQuestionIndex - 1);
          renderCurrentCBTView();
        }
      };
    }

    // Clear Response Button
    const btnClear = document.getElementById('cbt-btn-clear');
    if (btnClear) {
      btnClear.onclick = () => {
        clearResponse(jeeState.currentQuestionIndex);
        renderCurrentCBTView();
      };
    }

    // Mark for Review & Next
    const btnReview = document.getElementById('cbt-btn-review');
    if (btnReview) {
      btnReview.onclick = () => {
        const val = getActiveAnswerValue();
        markForReview(jeeState.currentQuestionIndex, val);
        if (jeeState.currentQuestionIndex < jeeState.questions.length - 1) {
          navigateToQuestion(jeeState.currentQuestionIndex + 1);
        }
        renderCurrentCBTView();
      };
    }

    // Save & Next
    const btnSave = document.getElementById('cbt-btn-save');
    if (btnSave) {
      btnSave.onclick = () => {
        const val = getActiveAnswerValue();
        saveResponse(jeeState.currentQuestionIndex, val);
        if (jeeState.currentQuestionIndex < jeeState.questions.length - 1) {
          navigateToQuestion(jeeState.currentQuestionIndex + 1);
        }
        renderCurrentCBTView();
      };
    }

    // Submit Modal triggers
    const btnSubmit = document.getElementById('cbt-btn-submit');
    const modal = document.getElementById('cbt-modal-submit');
    if (btnSubmit && modal) {
      btnSubmit.onclick = () => {
        modal.style.display = 'flex';
      };
    }

    const btnCancelModal = document.getElementById('cbt-modal-cancel');
    if (btnCancelModal && modal) {
      btnCancelModal.onclick = () => {
        modal.style.display = 'none';
      };
    }

    const btnConfirmModal = document.getElementById('cbt-modal-confirm');
    if (btnConfirmModal) {
      btnConfirmModal.onclick = () => {
        triggerSubmit();
      };
    }
  }

  function triggerSubmit() {
    if (jeeState.timerInterval) clearInterval(jeeState.timerInterval);

    // Evaluate
    const results = evaluateFinalResults();
    jeeState.isSubmitted = true;
    jeeState.active = false;
    jeeState.results = results;
    saveJEESession();

    navigate('jee-result');
  }

  renderCurrentCBTView();
}

/* ==========================================================================
   STAGE 4: RESULT DASHBOARD & STEP-BY-STEP SOLUTIONS REVIEW
   ========================================================================== */
export function renderJEEResult(navigate) {
  if (navigate) appNavigate = navigate;
  const appRoot = document.getElementById('app-root');
  if (!appRoot) return;

  const results = jeeState.results || evaluateFinalResults();
  let reviewFilter = 'all'; // 'all' | 'correct' | 'incorrect' | 'unattempted'

  function updateResultsDOM() {
    appRoot.innerHTML = `
      <div class="jee-results-wrap">
        
        <!-- Results Banner -->
        <div class="results-banner">
          <div class="jee-badge">EXAM REPORT CARD</div>
          <h1 style="font-size:2.4rem; margin:0 0 8px 0; color:#ffffff;">
            ${jeeState.examType === 'jee_main' ? 'JEE (Main) Mock Test Result' : 'JEE (Advanced) Mock Test Result'}
          </h1>
          <p style="color:var(--jee-text-sub); margin:0;">
            Comprehensive performance diagnosis, topic breakdown, and structured step-by-step solutions.
          </p>

          <!-- Score Tiles -->
          <div class="results-score-tiles">
            <div class="score-tile">
              <div class="score-tile-label">TOTAL SCORE</div>
              <div class="score-tile-val primary-highlight">${results.totalScore} <span style="font-size:1.1rem; color:var(--jee-text-muted);">/ ${results.maxPossibleScore}</span></div>
              <div style="font-size:0.85rem; color:var(--jee-text-sub);">${results.percentage}% Scored</div>
            </div>

            <div class="score-tile">
              <div class="score-tile-label">PERCENTILE BRACKET</div>
              <div class="score-tile-val" style="color:#c084fc; font-size:1.35rem; line-height:1.3;">${results.percentileEstimate}</div>
              <div style="font-size:0.85rem; color:var(--jee-text-sub);">Estimated JEE Rank Curve</div>
            </div>

            <div class="score-tile">
              <div class="score-tile-label">ACCURACY</div>
              <div class="score-tile-val success">${results.accuracy}%</div>
              <div style="font-size:0.85rem; color:var(--jee-text-sub);">${results.correctCount} Correct of ${results.attemptedCount} Attempted</div>
            </div>

            <div class="score-tile">
              <div class="score-tile-label">ATTEMPT RATE</div>
              <div class="score-tile-val">${results.attemptedCount} <span style="font-size:1.1rem; color:var(--jee-text-muted);">/ ${results.questionDetails.length}</span></div>
              <div style="font-size:0.85rem; color:var(--jee-text-sub);">${results.unattemptedCount} Unattempted</div>
            </div>
          </div>
        </div>

        <!-- SUBJECT CARDS -->
        <h2 style="font-size:1.4rem; margin:0 0 16px 0; color:#fff;">Subject Breakdown</h2>
        <div class="subject-cards-grid">
          ${['physics', 'chemistry', 'mathematics'].map(s => {
            const sc = results.subjectScores[s] || { score: 0, max: 0, attempted: 0, correct: 0, incorrect: 0 };
            const acc = sc.attempted > 0 ? ((sc.correct / sc.attempted) * 100).toFixed(0) : 0;
            return `
              <div class="subj-result-card">
                <div class="subj-result-header">
                  <h3 style="text-transform:capitalize; margin:0; color:#fff;">${s}</h3>
                  <span class="jee-badge" style="margin:0;">${sc.score} / ${sc.max} Marks</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; text-align:center; margin-top:16px;">
                  <div>
                    <div style="font-size:0.75rem; color:var(--jee-text-muted);">Attempted</div>
                    <div style="font-weight:700; font-size:1.1rem; color:#fff;">${sc.attempted}</div>
                  </div>
                  <div>
                    <div style="font-size:0.75rem; color:var(--jee-text-muted);">Correct</div>
                    <div style="font-weight:700; font-size:1.1rem; color:#4ade80;">${sc.correct}</div>
                  </div>
                  <div>
                    <div style="font-size:0.75rem; color:var(--jee-text-muted);">Incorrect</div>
                    <div style="font-weight:700; font-size:1.1rem; color:#f87171;">${sc.incorrect}</div>
                  </div>
                  <div>
                    <div style="font-size:0.75rem; color:var(--jee-text-muted);">Accuracy</div>
                    <div style="font-weight:700; font-size:1.1rem; color:#38bdf8;">${acc}%</div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- QUESTION-WISE SOLUTIONS -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin:40px 0 20px 0; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="font-size:1.5rem; margin:0 0 4px 0; color:#fff;">Question-Wise Solutions</h2>
            <p style="color:var(--jee-text-sub); margin:0; font-size:0.9rem;">Review each question, correct response, and structured derivation.</p>
          </div>

          <div style="display:flex; gap:8px;">
            <button class="btn-nav-cbt ${reviewFilter === 'all' ? 'btn-nav-save' : 'btn-nav-prev'}" data-rv-filter="all">All (${results.questionDetails.length})</button>
            <button class="btn-nav-cbt ${reviewFilter === 'correct' ? 'btn-nav-save' : 'btn-nav-prev'}" data-rv-filter="correct">Correct (${results.correctCount})</button>
            <button class="btn-nav-cbt ${reviewFilter === 'incorrect' ? 'btn-nav-save' : 'btn-nav-prev'}" data-rv-filter="incorrect">Incorrect (${results.incorrectCount})</button>
            <button class="btn-nav-cbt ${reviewFilter === 'unattempted' ? 'btn-nav-save' : 'btn-nav-prev'}" data-rv-filter="unattempted">Unattempted (${results.unattemptedCount})</button>
          </div>
        </div>

        <!-- Filtered Review List -->
        <div>
          ${getFilteredReviewList(results.questionDetails, reviewFilter).map(q => {
            let statusBadge = `<span style="color:#64748b; font-weight:700;">Unattempted (0 Marks)</span>`;
            let statusClass = 'unattempted';

            if (q.isAttempted) {
              if (q.isCorrect) {
                statusBadge = `<span style="color:#16a34a; font-weight:700;">✓ Correct (+${q.marksAwarded} Marks)</span>`;
                statusClass = 'correct';
              } else {
                statusBadge = `<span style="color:#dc2626; font-weight:700;">✗ Incorrect (${q.marksAwarded} Marks)</span>`;
                statusClass = 'incorrect';
              }
            }

            return `
              <div class="review-card-item ${statusClass}">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <div style="display:flex; gap:10px; align-items:center;">
                    <span class="jee-badge" style="margin:0;">Q${q.index}</span>
                    <span style="text-transform:capitalize; font-size:0.85rem; color:var(--jee-text-sub);">${q.subject} &bull; ${q.chapter}</span>
                  </div>
                  <div>${statusBadge}</div>
                </div>

                <div style="font-size:1rem; line-height:1.6; margin-bottom:16px; color:#f8fafc;">
                  ${renderMath(q.question)}
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; background:rgba(0,0,0,0.25); padding:12px 16px; border-radius:8px; margin-bottom:16px;">
                  <div>
                    <div style="font-size:0.75rem; color:var(--jee-text-muted); text-transform:uppercase; font-weight:700;">Your Answer:</div>
                    <div style="font-size:1.05rem; font-weight:700; color:${q.isCorrect ? '#4ade80' : (q.isAttempted ? '#f87171' : '#94a3b8')}; margin-top:2px;">
                      ${q.isAttempted ? q.userAnswer : 'None'}
                    </div>
                  </div>
                  <div>
                    <div style="font-size:0.75rem; color:var(--jee-text-muted); text-transform:uppercase; font-weight:700;">Official Correct Answer:</div>
                    <div style="font-size:1.05rem; font-weight:700; color:#4ade80; margin-top:2px;">
                      ${q.correctAnswer}
                    </div>
                  </div>
                </div>

                <!-- Structured Solution Box -->
                <div class="solution-box-structured">
                  <div style="font-size:0.88rem; font-weight:800; color:#38bdf8; margin-bottom:10px;">
                    📝 STEP-BY-STEP SOLUTION & DERIVATION:
                  </div>
                  <div class="sol-step-title">Given:</div>
                  <div>${renderMath(q.solution?.given || 'Problem statements.')}</div>

                  <div class="sol-step-title">Concept Used:</div>
                  <div>${renderMath(q.solution?.concept || q.concept || 'Standard JEE physical principle.')}</div>

                  <div class="sol-step-title">Formula:</div>
                  <div>${renderMath(q.solution?.formula || '')}</div>

                  <div class="sol-step-title">Calculation & Working:</div>
                  <div>${renderMath(q.solution?.calculation || '')}</div>

                  <div class="sol-step-title">Final Answer:</div>
                  <div style="color:#4ade80; font-weight:700;">${renderMath(q.solution?.finalAnswer || String(q.correctAnswer))}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Bottom Actions -->
        <div style="display:flex; justify-content:center; gap:16px; margin:40px 0;">
          <button class="jee-btn-cta" id="btn-result-retake" style="width:auto; padding:14px 28px;">
            🔄 Take Another Mock Test
          </button>
          <button class="btn-nav-cbt btn-nav-prev" id="btn-result-home" style="padding:14px 28px;">
            Return to Dashboard
          </button>
        </div>

      </div>
    `;

    // Bind event handlers
    document.querySelectorAll('[data-rv-filter]').forEach(btn => {
      btn.onclick = () => {
        reviewFilter = btn.getAttribute('data-rv-filter');
        updateResultsDOM();
      };
    });

    const btnRetake = document.getElementById('btn-result-retake');
    if (btnRetake) {
      btnRetake.onclick = () => {
        clearJEESession();
        navigate('jee');
      };
    }

    const btnHome = document.getElementById('btn-result-home');
    if (btnHome) {
      btnHome.onclick = () => {
        navigate('dashboard');
      };
    }
  }

  function getFilteredReviewList(details, filter) {
    if (filter === 'correct') return details.filter(q => q.isCorrect && q.isAttempted);
    if (filter === 'incorrect') return details.filter(q => !q.isCorrect && q.isAttempted);
    if (filter === 'unattempted') return details.filter(q => !q.isAttempted);
    return details;
  }

  updateResultsDOM();
}

// Alias renderJEEConfig to renderJEE for consistency
export const renderJEEConfig = renderJEE;
export const renderJEEExam = renderJEECBT;
