/* ==========================================================================
   Interview AI — Complete AI Proctoring Engine v2.0
   Implements: Event detection, violation engine, warning system,
               session locking, camera/face monitoring, fullscreen,
               cooldowns, confidence thresholds, and proctoring log.
   ========================================================================== */

// ── Event Types ─────────────────────────────────────────────────────────────
export const EVENT_TYPES = {
  TAB_SWITCH:               'TAB_SWITCH',
  WINDOW_BLUR:              'WINDOW_BLUR',
  FULLSCREEN_EXIT:          'FULLSCREEN_EXIT',
  FACE_NOT_DETECTED:        'FACE_NOT_DETECTED',
  MULTIPLE_FACES:           'MULTIPLE_FACES',
  EXCESSIVE_HEAD_MOVEMENT:  'EXCESSIVE_HEAD_MOVEMENT',
  SECONDARY_DEVICE_SUSPECTED:'SECONDARY_DEVICE_SUSPECTED',
  UNAUTHORIZED_AUDIO:       'UNAUTHORIZED_AUDIO',
  SCREEN_SHARE_STOPPED:     'SCREEN_SHARE_STOPPED',
  OTHER_PERSON_DETECTED:    'OTHER_PERSON_DETECTED',
  CAMERA_BLOCKED:           'CAMERA_BLOCKED',
};

export const SEVERITY = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };

export const SESSION_STATUS = {
  NOT_STARTED:              'NOT_STARTED',
  IN_PROGRESS:              'IN_PROGRESS',
  COMPLETED:                'COMPLETED',
  AUTO_SUBMITTED:           'AUTO_SUBMITTED',
  TERMINATED_BY_PROCTORING: 'TERMINATED_BY_PROCTORING',
  ABANDONED:                'ABANDONED',
  TECHNICAL_FAILURE:        'TECHNICAL_FAILURE',
};

// ── Default Configuration ────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  enabled: true,
  maxWarnings: 3,
  autoTerminateOnMaxWarnings: true,
  cooldownMs: 8000,          // min ms between warnings for same event type
  rules: [
    EVENT_TYPES.TAB_SWITCH,
    EVENT_TYPES.WINDOW_BLUR,
    EVENT_TYPES.FULLSCREEN_EXIT,
    EVENT_TYPES.FACE_NOT_DETECTED,
    EVENT_TYPES.MULTIPLE_FACES,
  ],
};

// ── Storage Keys ─────────────────────────────────────────────────────────────
const PROCTOR_LOG_KEY    = (sid) => `proctor_log_${sid}`;
const TERMINATED_KEY     = 'proctor_terminated_sessions';
const SESSION_STATUS_KEY = (sid) => `proctor_session_status_${sid}`;

// ── Main Engine ──────────────────────────────────────────────────────────────
const proctoringEngine = (() => {
  let _config        = { ...DEFAULT_CONFIG };
  let _sessionId     = null;
  let _warningCount  = 0;
  let _isActive      = false;
  let _log           = [];
  let _lastWarnTs    = {};   // eventType → timestamp of last warning
  let _onWarning     = null;
  let _onTerminate   = null;

  // Camera
  let _cameraStream  = null;
  let _faceInterval  = null;
  let _faceDetector  = null;
  let _faceSupported = false;

  // ── Utility ───────────────────────────────────────────────────────────────
  function _ts() {
    return new Date().toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function _now() { return Date.now(); }

  function _saveLog() {
    try {
      localStorage.setItem(PROCTOR_LOG_KEY(_sessionId), JSON.stringify(_log));
    } catch(e) {}
  }

  function _setSessionStatus(status) {
    try {
      localStorage.setItem(SESSION_STATUS_KEY(_sessionId), status);
    } catch(e) {}
  }

  // ── Session Termination Lock (survives refresh) ───────────────────────────
  function _lockSession() {
    try {
      const t = JSON.parse(localStorage.getItem(TERMINATED_KEY) || '[]');
      if (!t.includes(_sessionId)) {
        t.push(_sessionId);
        localStorage.setItem(TERMINATED_KEY, JSON.stringify(t));
      }
    } catch(e) {}
    _setSessionStatus(SESSION_STATUS.TERMINATED_BY_PROCTORING);
  }

  // ── Public: check termination status ─────────────────────────────────────
  function isSessionTerminated(sessionId) {
    try {
      const t = JSON.parse(localStorage.getItem(TERMINATED_KEY) || '[]');
      return t.includes(sessionId);
    } catch(e) { return false; }
  }

  function getSessionStatus(sessionId) {
    return localStorage.getItem(SESSION_STATUS_KEY(sessionId)) || SESSION_STATUS.NOT_STARTED;
  }

  // ── Event Recording ───────────────────────────────────────────────────────
  function _recordEvent(eventType, severity, description, confidence, action) {
    const entry = {
      sessionId:   _sessionId,
      eventType,
      timestamp:   new Date().toISOString(),
      displayTime: _ts(),
      severity,
      confidence:  confidence ?? null,
      description,
      action,
      warningNumber: _warningCount,
    };
    _log.push(entry);
    _saveLog();
    return entry;
  }

  // ── Cooldown Check ────────────────────────────────────────────────────────
  function _canTrigger(eventType) {
    const last = _lastWarnTs[eventType] || 0;
    return (_now() - last) > _config.cooldownMs;
  }

  function _markTriggered(eventType) {
    _lastWarnTs[eventType] = _now();
  }

  // ── Core Violation Handler ────────────────────────────────────────────────
  function _handleViolation(eventType, severity, description, confidence = 1.0) {
    if (!_isActive) return;
    if (!_config.rules.includes(eventType)) {
      // Log only — not a warning rule
      _recordEvent(eventType, SEVERITY.LOW, description, confidence, 'LOG_ONLY');
      return;
    }
    if (!_canTrigger(eventType)) return;  // cooldown active

    _markTriggered(eventType);
    _warningCount++;

    const isTerminal = _warningCount >= _config.maxWarnings;
    const action = isTerminal ? 'TERMINATE' : 'WARN';
    const entry  = _recordEvent(eventType, severity, description, confidence, action);

    if (_onWarning) _onWarning(_warningCount, entry);

    if (isTerminal && _config.autoTerminateOnMaxWarnings) {
      _lockSession();
      _stop();
      if (_onTerminate) _onTerminate(_log);
    }
  }

  // ── Tab / Visibility Detection ────────────────────────────────────────────
  function _onVisibilityChange() {
    if (!_isActive) return;
    if (document.hidden) {
      _handleViolation(
        EVENT_TYPES.TAB_SWITCH, SEVERITY.HIGH,
        'Candidate switched browser tab or hid the assessment page.',
        1.0
      );
    }
  }

  function _onWindowBlur() {
    if (!_isActive) return;
    setTimeout(() => {
      if (!document.hasFocus() && _isActive) {
        _handleViolation(
          EVENT_TYPES.WINDOW_BLUR, SEVERITY.MEDIUM,
          'Assessment window lost focus — possible switch to another application.',
          0.85
        );
      }
    }, 500);
  }

  // ── Fullscreen Detection ──────────────────────────────────────────────────
  function _onFullscreenChange() {
    if (!_isActive) return;
    const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!inFS) {
      _handleViolation(
        EVENT_TYPES.FULLSCREEN_EXIT, SEVERITY.MEDIUM,
        'Candidate exited fullscreen mode during the assessment.',
        1.0
      );
      // Attempt to re-enter fullscreen after a brief delay
      setTimeout(() => {
        if (_isActive && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }, 2000);
    }
  }

  // ── Camera & Face Detection ───────────────────────────────────────────────
  async function _startCamera(videoEl) {
    try {
      _cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      if (videoEl) {
        videoEl.srcObject = _cameraStream;
        videoEl.play().catch(() => {});
      }

      // Check for native FaceDetector API (Chrome 70+)
      if ('FaceDetector' in window) {
        _faceDetector  = new window.FaceDetector({ maxDetectedFaces: 5, fastMode: false });
        _faceSupported = true;
        _startFaceMonitoring(videoEl);
      }
      return true;
    } catch(err) {
      _handleViolation(
        EVENT_TYPES.CAMERA_BLOCKED, SEVERITY.HIGH,
        'Camera access was denied or unavailable.',
        1.0
      );
      return false;
    }
  }

  function _startFaceMonitoring(videoEl) {
    if (!_faceDetector || !videoEl) return;
    let noFaceCount = 0;
    const THRESHOLD = 3; // consecutive checks before warning

    _faceInterval = setInterval(async () => {
      if (!_isActive || !videoEl) return;
      try {
        const faces = await _faceDetector.detect(videoEl);

        if (faces.length === 0) {
          noFaceCount++;
          if (noFaceCount >= THRESHOLD) {
            noFaceCount = 0;
            _handleViolation(
              EVENT_TYPES.FACE_NOT_DETECTED, SEVERITY.MEDIUM,
              'No face detected in camera frame. Candidate may have moved away from screen.',
              0.75
            );
          }
        } else {
          noFaceCount = 0;
          if (faces.length > 1) {
            _handleViolation(
              EVENT_TYPES.MULTIPLE_FACES, SEVERITY.HIGH,
              `${faces.length} faces detected. Only 1 candidate is permitted in the assessment room.`,
              0.9
            );
          }
        }
      } catch(e) { /* face detection error, skip */ }
    }, 3000); // check every 3 seconds
  }

  function _stopCamera() {
    if (_faceInterval) { clearInterval(_faceInterval); _faceInterval = null; }
    if (_cameraStream) {
      _cameraStream.getTracks().forEach(t => t.stop());
      _cameraStream = null;
    }
  }

  // ── Fullscreen Request ────────────────────────────────────────────────────
  async function requestFullscreen() {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch(e) {}
  }

  // ── Public API ────────────────────────────────────────────────────────────
  async function start({ sessionId, config = {}, cameraVideoEl = null, onWarning, onTerminate }) {
    _sessionId    = sessionId;
    _config       = { ...DEFAULT_CONFIG, ...config };
    _warningCount = 0;
    _isActive     = true;
    _log          = [];
    _lastWarnTs   = {};
    _onWarning    = onWarning;
    _onTerminate  = onTerminate;

    _setSessionStatus(SESSION_STATUS.IN_PROGRESS);
    _recordEvent('SESSION_START', SEVERITY.LOW, 'Proctoring session started.', null, 'LOG_ONLY');

    // Attach event listeners
    document.addEventListener('visibilitychange', _onVisibilityChange);
    window.addEventListener('blur', _onWindowBlur);
    document.addEventListener('fullscreenchange', _onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', _onFullscreenChange);

    // Start camera if configured
    if (_config.cameraRequired && cameraVideoEl) {
      await _startCamera(cameraVideoEl);
    }

    // Request fullscreen
    if (_config.fullscreenRequired) {
      await requestFullscreen();
    }
  }

  function _stop() {
    _isActive = false;
    document.removeEventListener('visibilitychange', _onVisibilityChange);
    window.removeEventListener('blur', _onWindowBlur);
    document.removeEventListener('fullscreenchange', _onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', _onFullscreenChange);
    _stopCamera();
  }

  function stop(status = SESSION_STATUS.COMPLETED) {
    _stop();
    _setSessionStatus(status);
    _recordEvent('SESSION_END', SEVERITY.LOW, `Session ended with status: ${status}`, null, 'LOG_ONLY');
    _saveLog();
  }

  function getLog(sessionId) {
    try {
      const sid = sessionId || _sessionId;
      return JSON.parse(localStorage.getItem(PROCTOR_LOG_KEY(sid))) || [];
    } catch(e) { return []; }
  }

  function getAllLogs() {
    // Return all proctoring logs from localStorage
    const logs = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('proctor_log_')) {
        const sid = key.replace('proctor_log_', '');
        try { logs[sid] = JSON.parse(localStorage.getItem(key)) || []; } catch(e) {}
      }
    }
    return logs;
  }

  function getWarningCount() { return _warningCount; }

  function manualViolation(eventType, description) {
    _handleViolation(eventType, SEVERITY.MEDIUM, description, 0.9);
  }

  return {
    start, stop, getLog, getAllLogs,
    getWarningCount, isSessionTerminated, getSessionStatus,
    requestFullscreen, manualViolation,
    EVENT_TYPES, SEVERITY, SESSION_STATUS,
  };
})();

export default proctoringEngine;
