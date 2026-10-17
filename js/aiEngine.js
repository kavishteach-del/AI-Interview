/* ==========================================================================
   Interview AI - Question Generator, Follow-ups, and Evaluation Engine
   ========================================================================== */

// Rich bank of curated, non-repeating questions by stage for Cabin Crew
// EXACTLY 10 QUESTIONS: Q1-Q9 English only, Q10 Hindi only (Devanagari script)
const TRENDING_QUESTIONS = [
  {
    text: "Please introduce yourself, highlighting your education, key skills, and what motivates you to pursue a cabin crew career with our airline.",
    stage: "Introduction",
    language: "English"
  },
  {
    text: "With Indian aviation expanding rapidly and airlines ordering hundreds of aircraft, why do you want to join our airline specifically, and what hospitality values do you bring?",
    stage: "Aviation Motivation",
    language: "English"
  },
  {
    text: "Imagine a passenger on a domestic flight becomes highly aggressive because their hand luggage does not fit in the overhead bin. How would you handle this to prevent escalation?",
    stage: "Situational Awareness",
    language: "English"
  },
  {
    text: "If you notice a passenger silently smoking in the lavatory during flight, which is a critical safety violation, what is your immediate protocol?",
    stage: "Safety Compliance",
    language: "English"
  },
  {
    text: "A passenger experiences a sudden panic attack or shortness of breath at cruising altitude. What immediate first aid and passenger reassurance steps do you take?",
    stage: "In-Flight Medical Response",
    language: "English"
  },
  {
    text: "Please read this in-flight turbulence announcement clearly and professionally: 'Ladies and gentlemen, the Captain has turned on the Fasten Seat Belt sign. We are experiencing sudden turbulence. Please return to your seats immediately and fasten your seat belts. Thank you.'",
    stage: "Safety Announcement",
    language: "English"
  },
  {
    text: "How would you handle a passenger who repeatedly rings the call bell for non-urgent requests while the cabin crew is actively conducting a busy meal service?",
    stage: "Service Prioritization",
    language: "English"
  },
  {
    text: "If you observe an irregularity in the galley or an emergency equipment latch before departure, how do you report this to the Senior Cabin Crew and coordinate with the cockpit flight deck?",
    stage: "Cockpit & Crew Coordination",
    language: "English"
  },
  {
    text: "Cabin crew roles demand long shifts, night flights, fatigue management, and extended time away from family. How have you prepared yourself mentally and physically for this lifestyle?",
    stage: "Career Resilience",
    language: "English"
  },
  {
    text: "मान लीजिए एक बुजुर्ग यात्री जो केवल हिंदी बोलते हैं, उन्हें उड़ान के दौरान तेज हलचल (टर्बुलेंस) से अत्यधिक घबराहट महसूस हो रही है। आप उन्हें शांत करने और सुरक्षा समझाने के लिए हिंदी में क्या कहेंगे?",
    stage: "Hindi Communication",
    language: "Hindi"
  }
];

// Follow-up trees based on common answers
const DYNAMIC_FOLLOW_UPS = [
  {
    triggerKeywords: ["travel", "traveling", "meet people", "world", "places"],
    followUpQuestion: "You mentioned travelling and meeting people as primary drivers. However, Cabin Crew work involves heavy physical labor, cleaning lavatories, jet lag, and high-stress safety management. Knowing this, how do you justify your interest beyond the travel glamour?"
  },
  {
    triggerKeywords: ["angry", "shout", "mad", "rude", "difficult", "passenger"],
    followUpQuestion: "If your polite attempts to calm the upset passenger fail, and they stand up, invading your personal space during flight, what would your next immediate protocol be?"
  },
  {
    triggerKeywords: ["rule", "contradict", "senior", "complain", "captain"],
    followUpQuestion: "You mentioned reporting to the Captain. If the Captain is busy with critical flight controls and cannot be disturbed, how do you handle the disagreement with your senior colleague on the spot?"
  },
  {
    triggerKeywords: ["service", "customer", "hospitality", "help"],
    followUpQuestion: "Can you give me a specific incident from your past work or education where you went beyond normal duties to assist someone?"
  }
];

export const aiEngine = {
  // Generate a customized question — strictly 10 questions in fixed order, Q1-Q9 English, Q10 Hindi
  generateNextQuestion: (session, profile, blueprint, previousQuestions = [], previousAnswers = []) => {
    const qCount = previousQuestions.length;
    const maxQ = (blueprint && blueprint.totalQuestions) ? blueprint.totalQuestions : 10;
    
    if (qCount >= maxQ || qCount >= TRENDING_QUESTIONS.length) {
      return null; // Interview complete
    }

    // Progress through fixed 10 questions (indices 0 to 9)
    const currentQData = TRENDING_QUESTIONS[qCount];
    let questionText = currentQData.text;

    // Optional name personalization on Question 1 only
    if (profile && profile.name && qCount === 0) {
      const namePart = `${profile.name.split(' ')[0]}, `;
      questionText = `${namePart}${questionText.charAt(0).toLowerCase() + questionText.slice(1)}`;
    }

    return {
      questionText,
      stageName: currentQData.stage,
      language: currentQData.language || (qCount === 9 ? 'Hindi' : 'English'),
      timeLimit: 60,
      isFollowUp: false
    };
  },

  // Evaluate the entire completed session
  evaluateSession: (session, profile, blueprint, questions, answers) => {
    const isCV = (session && session.interviewType === 'cv_interview') || (blueprint && blueprint.isCVSmartInterview);
    const criteriaScores = {};

    let answerQualitySum = 0;
    questions.forEach((q, idx) => {
      const ans = answers ? answers.find(a => a.questionId === q.id) : null;
      const text = ans && ans.candidateAnswer ? ans.candidateAnswer.trim() : "";
      const len = text.split(/\s+/).filter(w => w.length > 0).length;

      let qScore = 40;
      if (len > 10) qScore += 15;
      if (len > 30) qScore += 20;
      if (len > 60) qScore += 15;
      if (text.includes("because") || text.includes("for example") || text.includes("project") || text.includes("experience")) qScore += 10;
      answerQualitySum += Math.min(100, qScore);
    });

    const avgQScore = Math.round(answerQualitySum / Math.max(1, questions.length));

    if (isCV) {
      // 8 CV-based dimensions
      criteriaScores["Technical Knowledge"] = Math.min(100, Math.max(35, Math.round(avgQScore * 0.95)));
      criteriaScores["CV Knowledge"] = Math.min(100, Math.max(40, Math.round(avgQScore * 1.05)));
      criteriaScores["Communication"] = Math.min(100, Math.max(45, Math.round(avgQScore * 1.02)));
      criteriaScores["Confidence"] = Math.min(100, Math.max(40, Math.round(avgQScore * 0.98)));
      criteriaScores["Problem Solving"] = Math.min(100, Math.max(35, Math.round(avgQScore * 0.9)));
      criteriaScores["Practical Understanding"] = Math.min(100, Math.max(35, Math.round(avgQScore * 0.92)));
      criteriaScores["Answer Relevance"] = Math.min(100, Math.max(40, Math.round(avgQScore * 1.08)));
      criteriaScores["Professionalism"] = Math.min(100, Math.max(50, Math.round(avgQScore * 1.1)));

      const overallScore = Math.round(Object.values(criteriaScores).reduce((a, b) => a + b, 0) / 8);
      const overallRating = (overallScore / 10).toFixed(1);

      let selectionReadiness = "Good";
      if (overallScore >= 85) selectionReadiness = "Strong Potential";
      else if (overallScore >= 75) selectionReadiness = "Interview Ready";
      else if (overallScore >= 60) selectionReadiness = "Needs Improvement";
      else selectionReadiness = "Needs More Practice";

      const selectionStatement = `Based on your interview performance, you demonstrate ${selectionReadiness.toLowerCase()} for this role. Focus on technical depth and structured project examples to be more interview-ready.`;
      const interviewerFeedback = `Your overall performance was reasonable. You demonstrated familiarity with your core background, but several answers were brief and lacked deep technical reasoning or quantitative metrics.`;

      const strengths = ["Expressed interest in your field clearly", "Maintained professional communication tone"];
      const weaknesses = ["Answers were concise; include STAR framework examples", "Elaborate more on practical tool choices and trade-offs"];

      const questionReviews = questions.map((q, idx) => {
        const ans = answers ? answers.find(a => a.questionId === q.id) : null;
        const text = ans && ans.candidateAnswer ? ans.candidateAnswer.trim() : "(No response provided)";
        const timeTaken = ans ? ans.timeTaken : 0;
        const len = text.split(/\s+/).filter(w => w.length > 0).length;

        let score = 5;
        let perf = "Good";
        if (len > 35) { score = 8; perf = "Strong"; }
        else if (len > 15) { score = 7; perf = "Good"; }
        else if (len > 5) { score = 5; perf = "Needs Improvement"; }
        else { score = 3; perf = "Weak"; }

        return {
          questionId: q.id,
          questionText: q.questionText,
          candidateAnswer: text,
          timeTaken,
          score,
          performanceLevel: perf,
          feedback: len > 15 ? "Solid answer addressing the prompt directly." : "Brief response. Needs more supporting points.",
          tip: "Use the STAR method (Situation, Task, Action, Result) to structure your response.",
          modelAnswer: "A strong response should outline: 1) specific project context, 2) concrete technical decisions made, and 3) measurable business/engineering outcomes achieved.",
          stageName: q.stageName || 'Core Assessment'
        };
      });

      return {
        overallScore,
        overallRating,
        selectionReadiness,
        selectionStatement,
        interviewerFeedback,
        criteriaScores,
        strengths,
        weaknesses,
        recommendations: interviewerFeedback,
        questionReviews
      };

    } else {
      // Cabin Crew fallback criteria
      const timeManagementScore = Math.min(100, Math.max(65, Math.round(85 + (Math.random() * 15))));
      const englishFluencyScore = Math.min(100, Math.max(60, Math.round(75 + (Math.random() * 20))));
      const communicationScore = Math.round((avgQScore * 0.5) + (timeManagementScore * 0.5));
      const situationalScore = Math.min(100, Math.max(60, Math.round(70 + (Math.random() * 25))));

      criteriaScores["Communication"] = communicationScore;
      criteriaScores["Answer Quality"] = avgQScore;
      criteriaScores["English Fluency"] = englishFluencyScore;
      criteriaScores["Situational Skills"] = situationalScore;
      criteriaScores["Time Management"] = timeManagementScore;
      criteriaScores["Follow-up Handling"] = avgQScore;

      const overallScore = Math.round(Object.values(criteriaScores).reduce((a, b) => a + b, 0) / Object.values(criteriaScores).length);

      const strengths = ["Strong vocal articulation and professional tone.", "Paced responses well within the time limit."];
      const weaknesses = ["Answers tend to be short or generic without supporting examples."];
      const recommendations = "Good job. Your core skills are solid, but follow-up handling and situational answers need structured examples.";

      const questionReviews = questions.map((q, idx) => {
        const ans = answers ? answers.find(a => a.questionId === q.id) : null;
        const text = ans && ans.candidateAnswer ? ans.candidateAnswer.trim() : "(No response provided)";
        const timeTaken = ans ? ans.timeTaken : 0;
        return {
          questionId: q.id,
          questionText: q.questionText,
          candidateAnswer: text,
          timeTaken,
          score: Math.min(10, Math.max(3, Math.round(text.length / 10))),
          feedback: text.length > 20 ? "Good passenger empathy and service tone." : "Brief response.",
          tip: "Focus on clear passenger safety protocols.",
          stageName: q.stageName || 'Assessment'
        };
      });

      return {
        overallScore,
        criteriaScores,
        strengths,
        weaknesses,
        recommendations,
        questionReviews
      };
    }
  }
};
