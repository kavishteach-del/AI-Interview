/* ==========================================================================
   Firebase SDK - Safe wrapper (app works even if Firebase is not configured)
   Interview AI | Firebase Auth + Firestore — OPTIONAL cloud sync
   ========================================================================== */

// ─── No-op stubs used when Firebase isn't configured / fails ────────────────
const _noopAuth = {
  signUp:        async () => null,
  signIn:        async () => null,
  signOut:       async () => null,
  onAuthChanged: ()       => {},
  currentUser:   ()       => null
};

const _noopFirestore = {
  saveProfile:       async () => false,
  getProfile:        async () => null,
  saveSession:       async () => false,
  getSession:        async () => null,
  getUserSessions:   async () => [],
  saveEvaluation:    async () => false,
  getEvaluation:     async () => null,
  getUserEvaluations:async () => [],
  saveProctoringLog: async () => false,
  getProctoringLog:  async () => []
};

// Start with stubs — will be upgraded if Firebase loads successfully
export let firebaseAuth = { ..._noopAuth };
export let firestore    = { ..._noopFirestore };

// ─── Async Firebase initialisation (never blocks / never crashes the app) ────
(async () => {
  try {
    const { initializeApp } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"
    );
    const {
      getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
      signOut, onAuthStateChanged, updateProfile
    } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"
    );
    const {
      getFirestore, doc, setDoc, getDoc, collection,
      query, orderBy, getDocs, serverTimestamp, limit
    } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
    );

    const firebaseConfig = {
      apiKey:            "AIzaSyAtSmkt5NlElh6kmANyyQqkRErOpHXLR58",
      authDomain:        "interview-ai-270ed.firebaseapp.com",
      projectId:         "interview-ai-270ed",
      storageBucket:     "interview-ai-270ed.firebasestorage.app",
      messagingSenderId: "1081129748275",
      appId:             "1:1081129748275:web:4aacac2e9888ce417ca046",
      measurementId:     "G-X6D8MPCN40"
    };

    const app  = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const fsdb = getFirestore(app);

    // ── Upgrade firebaseAuth with real implementation ────────────────────────
    Object.assign(firebaseAuth, {
      signUp: async (name, email, password) => {
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(cred.user, { displayName: name });
          return cred.user;
        } catch (e) { console.warn('[Firebase] signUp:', e.message); return null; }
      },
      signIn: async (email, password) => {
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          return cred.user;
        } catch (e) { console.warn('[Firebase] signIn:', e.message); return null; }
      },
      signOut:       () => signOut(auth).catch(() => {}),
      onAuthChanged: (cb) => onAuthStateChanged(auth, cb),
      currentUser:   () => auth.currentUser
    });

    // ── Upgrade firestore with real implementation ───────────────────────────
    Object.assign(firestore, {
      saveProfile: async (uid, data) => {
        try {
          await setDoc(doc(fsdb, 'users', uid, 'data', 'profile'),
            { ...data, uid, updatedAt: serverTimestamp() }, { merge: true });
          return true;
        } catch (e) { console.warn('[Firestore] saveProfile:', e.message); return false; }
      },
      getProfile: async (uid) => {
        try {
          const snap = await getDoc(doc(fsdb, 'users', uid, 'data', 'profile'));
          return snap.exists() ? snap.data() : null;
        } catch (e) { console.warn('[Firestore] getProfile:', e.message); return null; }
      },
      saveSession: async (uid, sessionId, data) => {
        try {
          await setDoc(doc(fsdb, 'users', uid, 'sessions', sessionId),
            { ...data, updatedAt: serverTimestamp() }, { merge: true });
          return true;
        } catch (e) { console.warn('[Firestore] saveSession:', e.message); return false; }
      },
      getSession: async (uid, sessionId) => {
        try {
          const snap = await getDoc(doc(fsdb, 'users', uid, 'sessions', sessionId));
          return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } catch (e) { console.warn('[Firestore] getSession:', e.message); return null; }
      },
      getUserSessions: async (uid, max = 20) => {
        try {
          const q = query(collection(fsdb, 'users', uid, 'sessions'),
            orderBy('createdAt', 'desc'), limit(max));
          const snap = await getDocs(q);
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.warn('[Firestore] getUserSessions:', e.message); return []; }
      },
      saveEvaluation: async (uid, sessionId, data) => {
        try {
          await setDoc(doc(fsdb, 'users', uid, 'evaluations', sessionId),
            { ...data, sessionId, savedAt: serverTimestamp() }, { merge: true });
          return true;
        } catch (e) { console.warn('[Firestore] saveEvaluation:', e.message); return false; }
      },
      getEvaluation: async (uid, sessionId) => {
        try {
          const snap = await getDoc(doc(fsdb, 'users', uid, 'evaluations', sessionId));
          return snap.exists() ? snap.data() : null;
        } catch (e) { console.warn('[Firestore] getEvaluation:', e.message); return null; }
      },
      getUserEvaluations: async (uid) => {
        try {
          const q = query(collection(fsdb, 'users', uid, 'evaluations'),
            orderBy('savedAt', 'desc'), limit(50));
          const snap = await getDocs(q);
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.warn('[Firestore] getUserEvaluations:', e.message); return []; }
      },
      saveProctoringLog: async (uid, sessionId, events) => {
        try {
          await setDoc(doc(fsdb, 'users', uid, 'proctoring', sessionId),
            { sessionId, events: events || [], updatedAt: serverTimestamp() }, { merge: true });
          return true;
        } catch (e) { console.warn('[Firestore] saveProctoringLog:', e.message); return false; }
      },
      getProctoringLog: async (uid, sessionId) => {
        try {
          const snap = await getDoc(doc(fsdb, 'users', uid, 'proctoring', sessionId));
          return snap.exists() ? (snap.data().events || []) : [];
        } catch (e) { console.warn('[Firestore] getProctoringLog:', e.message); return []; }
      }
    });

    console.log('[Firebase] Initialized successfully (optional cloud sync active)');

  } catch (err) {
    // Firebase failed to load — app continues with localStorage only
    console.warn('[Firebase] Could not initialize — running in offline/local mode:', err.message);
  }
})();
