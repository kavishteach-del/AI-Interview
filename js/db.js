/* ==========================================================================
   Interview AI - Simulated PostgreSQL Database Layer (localStorage / WebDB)
   ========================================================================== */

const DB_PREFIX = "interview_ai_db_";

// Helper to generate UUIDs
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Low-level storage utilities
const storage = {
  get: (table) => {
    const data = localStorage.getItem(DB_PREFIX + table);
    return data ? JSON.parse(data) : [];
  },
  set: (table, data) => {
    localStorage.setItem(DB_PREFIX + table, JSON.stringify(data));
  }
};

// Seed data
const defaultBlueprints = [
  {
    id: "cabin-crew",
    name: "Cabin Crew Interview Simulator",
    category: "Cabin Crew",
    totalQuestions: 10,
    difficulty: "adaptive",
    mode: "voice",
    allowPause: false,
    allowSkip: false,
    autoSubmit: true,
    stages: [
      { name: "Introduction", questionCount: 2, focus: "Self-introduction, background, and motivation" },
      { name: "Situational Awareness", questionCount: 3, focus: "In-flight passenger problems, safety issues" },
      { name: "Communication & English", questionCount: 3, focus: "Voice modulation, English phrasing, emergency announcements" },
      { name: "Stress / Surprise Round", questionCount: 2, focus: "High-pressure client demands or unexpected situations" }
    ],
    evaluationCriteria: [
      { name: "Communication", description: "Clarity of speech, tone, and professional posture" },
      { name: "Answer Quality", description: "Structured answers containing problem-solving skills" },
      { name: "English Fluency", description: "Grammar, vocabulary, and cabin announcements suitability" },
      { name: "Situational Skills", description: "Handling passengers, empathy, and hospitality logic" },
      { name: "Time Management", description: "Answering clearly within the response timeframe" },
      { name: "Follow-up Handling", description: "Ad-libbing and adapting to interviewer callbacks" }
    ],
    interviewerPersona: {
      name: "Pari",
      title: "Lead Cabin Crew Assessor",
      avatarStyle: "professional-female-crew",
      tone: "professional, calm, realistic, and formal",
      greeting: "Welcome to your Cabin Crew assessment. I am Pari, your lead assessor today. Let's begin."
    },
    rules: [
      { code: "NO_FEEDBACK_DURING", value: true, mode: "real" },
      { code: "NO_PAUSE_OR_SKIP", value: true, mode: "real" },
      { code: "COACHING_TIPS", value: true, mode: "practice" },
      { code: "ALLOW_HINTS", value: true, mode: "practice" }
    ],
    sources: [
      { title: "Aviation India Cabin Crew Guidelines", url: "https://dgca.gov.in" },
      { title: "Documented airline recruitment interview patterns", url: "public-knowledge" }
    ],
    isActive: true,
    proctoring: {
      enabled: true,
      cameraRequired: true,
      microphoneRequired: true,
      fullscreenRequired: true,
      maxWarnings: 3,
      autoTerminateOnMaxWarnings: true,
      cooldownMs: 8000,
      rules: [
        'TAB_SWITCH',
        'WINDOW_BLUR',
        'FULLSCREEN_EXIT',
        'FACE_NOT_DETECTED',
        'MULTIPLE_FACES'
      ]
    }
  },
  {
    id: "rbi-grade-b",
    name: "RBI Grade B Officer",
    category: "Banking",
    totalQuestions: 8,
    difficulty: "hard",
    mode: "voice",
    allowPause: true,
    allowSkip: true,
    autoSubmit: true,
    stages: [],
    evaluationCriteria: [],
    interviewerPersona: {},
    rules: [],
    sources: [],
    isActive: false // Coming Soon
  },
  {
    id: "upsc-cse",
    name: "UPSC Civil Services Personality Test",
    category: "Civil Services",
    totalQuestions: 12,
    difficulty: "hard",
    mode: "voice",
    allowPause: false,
    allowSkip: false,
    autoSubmit: true,
    stages: [],
    evaluationCriteria: [],
    interviewerPersona: {},
    rules: [],
    sources: [],
    isActive: false // Coming Soon
  }
];

// Seed Admin User and default records if empty
function initializeDB() {
  if (!localStorage.getItem(DB_PREFIX + "users")) {
    const adminId = generateUUID();
    const mockUserId = generateUUID();
    
    // Seed Users
    storage.set("users", [
      {
        id: adminId,
        email: "admin@interviewai.in",
        passwordHash: "admin123", // Plain text simulator logic
        role: "admin",
        createdAt: new Date().toISOString()
      },
      {
        id: mockUserId,
        email: "candidate@interviewai.in",
        passwordHash: "candidate123",
        role: "candidate",
        createdAt: new Date().toISOString()
      }
    ]);

    // Seed Profile
    storage.set("profiles", [
      {
        id: generateUUID(),
        userId: mockUserId,
        name: "Rahul Sharma",
        education: "Bachelor of Business Administration (BBA)",
        degree: "BBA",
        branch: "Aviation & Hospitality",
        skills: "Customer service, English communication, Empathy, Calm under pressure",
        projects: "Hospitality Management System Project, Guest Relations Case Study",
        internship: "6-month Guest Relations Intern at Taj Hotels",
        achievements: "Winner of Inter-college Public Speaking Competition",
        interests: "Travelling, Learning cultures, Reading travelogues",
        resumeText: "",
        createdAt: new Date().toISOString()
      }
    ]);

    // Seed Blueprints
    storage.set("blueprints", defaultBlueprints);

    // Seed Attempts for graphs
    storage.set("attempts", [
      {
        id: generateUUID(),
        userId: mockUserId,
        blueprintId: "cabin-crew",
        score: 65,
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
      },
      {
        id: generateUUID(),
        userId: mockUserId,
        blueprintId: "cabin-crew",
        score: 72,
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
      },
      {
        id: generateUUID(),
        userId: mockUserId,
        blueprintId: "cabin-crew",
        score: 78,
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
      }
    ]);
  } else {
    // Make sure we have blueprints seeded in case we update definitions
    const blueprints = storage.get("blueprints");
    if (blueprints.length === 0) {
      storage.set("blueprints", defaultBlueprints);
    } else {
      // Force update Cabin Crew blueprint in case assessor name or default configurations changed
      const ccIndex = blueprints.findIndex(b => b.id === "cabin-crew");
      if (ccIndex >= 0) {
        blueprints[ccIndex] = defaultBlueprints[0];
        storage.set("blueprints", blueprints);
      }
    }
  }
}

// Initialize on import
initializeDB();

export const db = {
  // Authentication & Users
  users: {
    create: (email, password) => {
      const users = storage.get("users");
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("Email already exists");
      }
      const newUser = {
        id: generateUUID(),
        email: email.toLowerCase(),
        passwordHash: password, // MD5 or simple comparison for local simulator
        role: "candidate",
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      storage.set("users", users);
      
      // Auto create empty profile
      db.profiles.save(newUser.id, {
        name: email.split('@')[0],
        education: "",
        degree: "",
        branch: "",
        skills: "",
        projects: "",
        internship: "",
        achievements: "",
        interests: "",
        resumeText: ""
      });

      return newUser;
    },
    login: (email, password) => {
      const users = storage.get("users");
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password);
      if (!user) {
        throw new Error("Invalid email or password");
      }
      return user;
    }
  },

  // Profiles
  profiles: {
    getByUserId: (userId) => {
      const profiles = storage.get("profiles");
      let profile = profiles.find(p => p.userId === userId);
      if (!profile) {
        profile = {
          id: generateUUID(),
          userId: userId,
          name: "",
          education: "",
          degree: "",
          branch: "",
          skills: "",
          projects: "",
          internship: "",
          achievements: "",
          interests: "",
          resumeText: "",
          createdAt: new Date().toISOString()
        };
      }
      return profile;
    },
    save: (userId, profileData) => {
      const profiles = storage.get("profiles");
      const index = profiles.findIndex(p => p.userId === userId);
      const updatedProfile = {
        ...(index >= 0 ? profiles[index] : { id: generateUUID(), userId, createdAt: new Date().toISOString() }),
        ...profileData,
        updatedAt: new Date().toISOString()
      };

      if (index >= 0) {
        profiles[index] = updatedProfile;
      } else {
        profiles.push(updatedProfile);
      }
      storage.set("profiles", profiles);
      return updatedProfile;
    }
  },

  // Blueprints
  blueprints: {
    getAll: () => storage.get("blueprints"),
    getById: (id) => storage.get("blueprints").find(b => b.id === id),
    save: (blueprint) => {
      const blueprints = storage.get("blueprints");
      const index = blueprints.findIndex(b => b.id === blueprint.id);
      
      const newBp = { ...blueprint, updatedAt: new Date().toISOString() };
      
      if (index >= 0) {
        blueprints[index] = newBp;
      } else {
        newBp.createdAt = new Date().toISOString();
        blueprints.push(newBp);
      }
      storage.set("blueprints", blueprints);
      return newBp;
    },
    delete: (id) => {
      let blueprints = storage.get("blueprints");
      blueprints = blueprints.filter(b => b.id !== id);
      storage.set("blueprints", blueprints);
    }
  },

  // Sessions
  sessions: {
    create: (userId, blueprintId, mode, extra = {}) => {
      const sessions = storage.get("sessions");
      if (typeof userId === 'object' && userId !== null) {
        const customSession = {
          id: userId.id || generateUUID(),
          userId: userId.userId || 'guest',
          blueprintId: userId.blueprintId || 'cv-smart',
          mode: userId.mode || 'real',
          status: userId.status || "IN_PROGRESS",
          warningCount: userId.warningCount || 0,
          proctorEvents: userId.proctorEvents || [],
          currentQuestionIndex: userId.currentQuestionIndex || 0,
          createdAt: userId.startedAt || new Date().toISOString(),
          completedAt: null,
          ...userId
        };
        const existingIdx = sessions.findIndex(s => s.id === customSession.id);
        if (existingIdx >= 0) {
          sessions[existingIdx] = customSession;
        } else {
          sessions.push(customSession);
        }
        storage.set("sessions", sessions);
        return customSession;
      }

      const newSession = {
        id: generateUUID(),
        userId,
        blueprintId,
        mode,
        status: "IN_PROGRESS",
        warningCount: 0,
        proctorEvents: [],
        currentQuestionIndex: 0,
        createdAt: new Date().toISOString(),
        completedAt: null,
        ...extra
      };
      sessions.push(newSession);
      storage.set("sessions", sessions);
      return newSession;
    },
    getById: (id) => storage.get("sessions").find(s => s.id === id),
    isTerminated: (id) => {
      const s = storage.get("sessions").find(s => s.id === id);
      return s && s.status === 'TERMINATED_BY_PROCTORING';
    },
    updateStatus: (id, status) => {
      const sessions = storage.get("sessions");
      const index = sessions.findIndex(s => s.id === id);
      if (index >= 0) {
        sessions[index].status = status;
        if (['COMPLETED','AUTO_SUBMITTED','TERMINATED_BY_PROCTORING','ABANDONED'].includes(status)) {
          sessions[index].completedAt = new Date().toISOString();
        }
        storage.set("sessions", sessions);
        return sessions[index];
      }
      return null;
    },
    updateWarnings: (id, count) => {
      const sessions = storage.get("sessions");
      const index = sessions.findIndex(s => s.id === id);
      if (index >= 0) {
        sessions[index].warningCount = count;
        storage.set("sessions", sessions);
      }
    },
    advanceQuestion: (id, nextIndex) => {
      const sessions = storage.get("sessions");
      const index = sessions.findIndex(s => s.id === id);
      if (index >= 0) {
        sessions[index].currentQuestionIndex = nextIndex;
        storage.set("sessions", sessions);
        return sessions[index];
      }
      return null;
    }
  },

  // Questions
  questions: {
    create: (sessionId, questionText, stageName, questionIndex, timeLimit = 60) => {
      const questions = storage.get("questions");
      const newQ = {
        id: generateUUID(),
        sessionId,
        questionText,
        stageName,
        questionIndex,
        timeLimit,
        createdAt: new Date().toISOString()
      };
      questions.push(newQ);
      storage.set("questions", questions);
      return newQ;
    },
    getBySessionId: (sessionId) => {
      return storage.get("questions").filter(q => q.sessionId === sessionId).sort((a, b) => a.questionIndex - b.questionIndex);
    }
  },

  // Answers
  answers: {
    save: (questionId, candidateAnswer, timeTaken) => {
      const answers = storage.get("answers");
      const index = answers.findIndex(a => a.questionId === questionId);
      const newAnswer = {
        id: index >= 0 ? answers[index].id : generateUUID(),
        questionId,
        candidateAnswer,
        timeTaken,
        submittedAt: new Date().toISOString()
      };

      if (index >= 0) {
        answers[index] = newAnswer;
      } else {
        answers.push(newAnswer);
      }
      storage.set("answers", answers);
      return newAnswer;
    },
    getByQuestionId: (questionId) => {
      return storage.get("answers").find(a => a.questionId === questionId);
    }
  },

  // Evaluations
  evaluations: {
    save: (sessionId, score, criteriaScores, strengths, weaknesses, recommendations, questionReviews, extra = {}) => {
      const evaluations = storage.get("evaluations");
      const newEval = {
        id: generateUUID(),
        sessionId,
        overallScore: score,
        criteriaScores,
        strengths,
        weaknesses,
        recommendations,
        questionReviews,
        createdAt: new Date().toISOString(),
        ...(typeof extra === 'object' ? extra : {})
      };
      evaluations.push(newEval);
      storage.set("evaluations", evaluations);
      return newEval;
    },
    getBySessionId: (sessionId) => {
      return storage.get("evaluations").find(e => e.sessionId === sessionId);
    }
  },

  // Attempts
  attempts: {
    create: (userId, sessionId, blueprintId, score) => {
      const attempts = storage.get("attempts");
      const newAttempt = {
        id: generateUUID(),
        userId,
        sessionId,
        blueprintId,
        score,
        completedAt: new Date().toISOString()
      };
      attempts.push(newAttempt);
      storage.set("attempts", attempts);
      return newAttempt;
    },
    getByUserId: (userId) => {
      return storage.get("attempts").filter(a => a.userId === userId).sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
    },
    getStats: (userId) => {
      const attempts = db.attempts.getByUserId(userId);
      if (attempts.length === 0) {
        return {
          avgScore: 0,
          attemptsCount: 0,
          recentScores: [],
          weakAreas: [],
          readiness: 0
        };
      }

      const totalScore = attempts.reduce((acc, curr) => acc + curr.score, 0);
      const avgScore = Math.round(totalScore / attempts.length);
      const recentScores = attempts.map(a => a.score).slice(-5);
      
      // Calculate weak areas based on past mock evaluations
      const sessions = storage.get("sessions").filter(s => s.userId === userId);
      const sessionIds = sessions.map(s => s.id);
      const evals = storage.get("evaluations").filter(e => sessionIds.includes(e.sessionId));
      
      const categoryTotals = {};
      const categoryCounts = {};
      
      evals.forEach(ev => {
        Object.entries(ev.criteriaScores).forEach(([cat, val]) => {
          categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
      });

      const weakAreas = [];
      Object.entries(categoryTotals).forEach(([cat, total]) => {
        const avg = Math.round(total / categoryCounts[cat]);
        if (avg < 75) {
          weakAreas.push({ category: cat, avgScore: avg });
        }
      });
      
      weakAreas.sort((a, b) => a.avgScore - b.avgScore);

      // Default weak areas if no evaluations exist yet
      const finalWeakAreas = weakAreas.length > 0 
        ? weakAreas.map(w => w.category) 
        : ["Follow-up Handling", "Situational Skills"];

      // Interview Readiness is equal to the weighted recent attempt scores (e.g. 70% last score + 30% average)
      const lastScore = attempts[attempts.length - 1].score;
      const readiness = Math.round((lastScore * 0.7) + (avgScore * 0.3));

      return {
        avgScore,
        attemptsCount: attempts.length,
        recentScores,
        weakAreas: finalWeakAreas,
        readiness
      };
    }
  },

  // Proctoring Logs
  proctoring: {
    saveLog: (sessionId, events) => {
      const logs = storage.get("proctor_logs");
      const index = logs.findIndex(l => l.sessionId === sessionId);
      const entry = { sessionId, events, updatedAt: new Date().toISOString() };
      if (index >= 0) { logs[index] = entry; } else { logs.push(entry); }
      storage.set("proctor_logs", logs);
    },
    getBySession: (sessionId) => {
      const logs = storage.get("proctor_logs");
      return (logs.find(l => l.sessionId === sessionId) || {}).events || [];
    },
    getAll: () => storage.get("proctor_logs"),
    getStats: (sessionId) => {
      const log = storage.get("proctor_logs").find(l => l.sessionId === sessionId);
      const events = (log || {}).events || [];
      const warnings = events.filter(e => e.action === 'WARN' || e.action === 'TERMINATE');
      const terminated = events.some(e => e.action === 'TERMINATE');
      return { totalEvents: events.length, warnings: warnings.length, terminated };
    }
  }
};
