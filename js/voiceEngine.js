/* ==========================================================================
   Interview AI - Speech Recognition (STT) & Speech Synthesis (TTS) Engine
   ========================================================================== */

class VoiceEngine {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.voices = [];
    this.activeUtterance = null;
    this.isListening = false;
    
    // Bind methods
    this.initVoices = this.initVoices.bind(this);
    
    // Initial voice load
    if (this.synthesis) {
      this.initVoices();
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = this.initVoices;
      }
    }
  }

  initVoices() {
    if (!this.synthesis) return;
    this.voices = this.synthesis.getVoices();
  }

  // Speak a prompt to the user
  speak(text, onStart, onEnd, onError) {
    if (!this.synthesis) {
      if (onError) onError(new Error("Text-to-speech not supported in this browser"));
      return;
    }

    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text);
    this.activeUtterance = utterance;
    
    // Check if the text contains Hindi characters
    const isHindi = /[\u0900-\u097F]/.test(text);
    let selectedVoice = null;

    if (isHindi) {
      // Find a Hindi voice
      selectedVoice = this.voices.find(v => v.lang.includes('hi-IN'));
      utterance.lang = 'hi-IN';
    } else {
      // Try to find a premium English/Indian English professional voice
      // Female voice is preferred for Pari
      selectedVoice = this.voices.find(v => v.lang.includes('en-IN') && v.name.toLowerCase().includes('google'));
      if (!selectedVoice) {
        selectedVoice = this.voices.find(v => v.lang.includes('en-GB') && v.name.toLowerCase().includes('google'));
      }
      if (!selectedVoice) {
        selectedVoice = this.voices.find(v => v.lang.includes('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('natural')));
      }
      utterance.lang = 'en-IN';
    }

    if (!selectedVoice && this.voices.length > 0) {
      selectedVoice = this.voices.find(v => v.lang.startsWith(isHindi ? 'hi' : 'en')) || this.voices[0];
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    // Adjust pace and pitch
    utterance.rate = 1.0; 
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.activeUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (event) => {
      this.activeUtterance = null;
      if (onError) onError(event);
    };

    this.synthesis.speak(utterance);
  }

  // Stop current spoken audio
  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    this.activeUtterance = null;
  }

  // Start transcribing candidate's answers
  startListening(onResult, onEnd, onError, language = 'en-IN') {
    if (this.isListening) {
      this.stopListening();
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (onError) onError(new Error("Speech recognition not supported in this browser"));
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = language;

      this.isListening = true;
      let finalTranscript = "";

      this.recognition.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        // Pass both final transcript and live interim transcript to display on screen
        if (onResult) {
          onResult(finalTranscript.trim(), interimTranscript.trim());
        }
      };

      this.recognition.onerror = (event) => {
        // Ignore noise/silence/aborted errors, bubble others
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          if (onError) onError(event);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (onEnd) onEnd(finalTranscript.trim());
      };

      this.recognition.start();
    } catch (e) {
      if (onError) onError(e);
    }
  }

  // Stop listening
  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    this.isListening = false;
  }

  // Verify hardware permissions
  async checkPermissions() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Media devices interface not supported by browser");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Clean up stream immediately
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      throw new Error("Microphone access denied: " + err.message);
    }
  }
}

export const voiceEngine = new VoiceEngine();
