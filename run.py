#!/usr/bin/env python
"""
Interview AI - Flask Backend Server
Serves static files + AI API proxy endpoints.
Supports two completely isolated interview engines:
1. CABIN CREW INTERVIEW (Aviation recruitment assessment)
2. CV-BASED INTERVIEW (AI-analyzed resume, dynamic follow-ups, verified CV questions)
"""

import os, json, requests, re, traceback
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")   # Groq Cloud (gsk_...)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")  # Google Gemini
GROK_API_KEY   = os.getenv("GROK_API_KEY", "")    # xAI Grok (backup)
PORT = int(os.getenv("PORT", 8000))
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
GROK_URL   = "https://api.x.ai/v1/chat/completions"

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ─────────────────────────────────────────────────────────────
#  Unified AI Helper (Groq primary -> Gemini -> xAI Grok)
# ─────────────────────────────────────────────────────────────
def call_ai(prompt_text, max_tokens=2500, temperature=0.7):
    """Call Groq Cloud first (fast & free), then fall back to Gemini or Grok."""
    errors = []

    # 1. Try Groq Cloud with active supported models
    if GROQ_API_KEY:
        for groq_model in ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"]:
            try:
                resp = requests.post(
                    GROQ_URL,
                    json={
                        "model": groq_model,
                        "messages": [
                            {"role": "system", "content": "You are a professional AI interview engine. Return only valid JSON when asked. Never wrap output in explanation unless explicitly requested."},
                            {"role": "user", "content": prompt_text}
                        ],
                        "max_tokens": max_tokens,
                        "temperature": temperature
                    },
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    timeout=60
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
            except Exception as e:
                err_msg = f"[Groq Cloud - {groq_model}] Error: {e}"
                print(err_msg)
                errors.append(err_msg)

    # 2. Try Gemini 1.5 Flash
    if GEMINI_API_KEY:
        try:
            resp = requests.post(
                f"{GEMINI_URL}?key={GEMINI_API_KEY}",
                json={
                    "contents": [{"parts": [{"text": prompt_text}]}],
                    "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temperature}
                },
                timeout=60
            )
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            err_msg = f"[Gemini] Error: {e}"
            print(err_msg)
            errors.append(err_msg)

    # 3. Try xAI Grok
    if GROK_API_KEY:
        try:
            resp = requests.post(
                GROK_URL,
                json={
                    "model": "grok-3-mini",
                    "messages": [
                        {"role": "system", "content": "You are an expert AI interviewer. Return only valid JSON when asked."},
                        {"role": "user", "content": prompt_text}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature
                },
                headers={"Authorization": f"Bearer {GROK_API_KEY}", "Content-Type": "application/json"},
                timeout=60
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            err_msg = f"[xAI Grok] Error: {e}"
            print(err_msg)
            errors.append(err_msg)

    raise ValueError(f"All AI API providers failed: {'; '.join(errors)}")

def extract_json(content):
    """Extract clean JSON string from AI response, removing markdown, think tags, or chatter."""
    content = content.strip()
    content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()

    if content.startswith('[') or content.startswith('{'):
        return content

    if '```' in content:
        parts = content.split('```')
        for part in parts:
            stripped = part.strip()
            if stripped.startswith('json'):
                stripped = stripped[4:].strip()
            if stripped.startswith('[') or stripped.startswith('{'):
                return stripped

    start_arr = content.find('[')
    start_obj = content.find('{')
    if start_arr != -1 and (start_obj == -1 or start_arr < start_obj):
        end = content.rfind(']')
        if end != -1:
            return content[start_arr:end+1]
    if start_obj != -1:
        end = content.rfind('}')
        if end != -1:
            return content[start_obj:end+1]

    return content

def clean_and_validate_question(q_text, fallback_text):
    """
    CRITICAL QUESTION VALIDATION:
    Ensures question is a complete, natural, human-like interview question.
    Rejects raw CV text, raw contact info, phone numbers, emails, addresses, bare keywords.
    Supports English, Hindi (Devanagari), and Hinglish.
    """
    if not q_text or not isinstance(q_text, str):
        return fallback_text

    q = q_text.strip().replace('\n', ' ')
    # Clean leading numbering like "1. ", "Q1: ", etc.
    q = re.sub(r'^(?:Q\d+[:.-]?|\d+[:.-])\s*', '', q).strip()

    # Reject raw phone numbers or excessive digits (5+ digits in sequence)
    if re.search(r'\b\d{10}\b|\b\d{5,}\b', q):
        return fallback_text

    # Reject raw email addresses
    if re.search(r'[\w\.-]+@[\w\.-]+\.\w+', q):
        return fallback_text

    lower = q.lower()
    for bad in [
        'c o n t a c t', 'curriculum vitae', 'harni road', 'jayoti nagar', 'bhilwara', 
        'duration :', 'contact:', 'resume text', 'phone:', 'email:', 'pin code', 
        'academic details', 'career objective'
    ]:
        if bad in lower:
            return fallback_text

    # Check minimum length (must be a real sentence)
    if len(q) < 20:
        return fallback_text

    # Reject single words or bare resume headings
    words = [w for w in re.split(r'[\s,]+', q) if w]
    if len(words) <= 4:
        return fallback_text

    # Ensure punctuation at end (? or ? or ।)
    if not (q.endswith('?') or q.endswith('?') or q.endswith('।') or q.endswith('.')):
        q = q + '?'

    return q

def are_questions_similar(q1, q2, threshold=0.38):
    """
    Checks if two questions are duplicates, reworded variations, or have identical intent.
    Strictly prevents:
    - Exact duplicate questions
    - Slightly reworded duplicates
    - Same question with different wording
    - Same topic/question intent repeatedly
    """
    if not q1 or not q2:
        return False

    s1 = q1.strip().lower()
    s2 = q2.strip().lower()
    if s1 == s2:
        return True

    # Remove punctuation
    s1_clean = re.sub(r'[^\w\s]', ' ', s1)
    s2_clean = re.sub(r'[^\w\s]', ' ', s2)

    stop_words = {
        'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'to', 'of', 'for', 'with',
        'can', 'you', 'could', 'please', 'tell', 'me', 'about', 'how', 'would', 'what', 'why',
        'do', 'does', 'your', 'explain', 'describe', 'share', 'give', 'an', 'example', 'situation',
        'where', 'imagine', 'if', 'when', 'who', 'our', 'airline', 'flight', 'cabin', 'crew',
        'passenger', 'passengers', 'handling', 'handle'
    }

    w1 = set([w for w in s1_clean.split() if w not in stop_words and len(w) > 2])
    w2 = set([w for w in s2_clean.split() if w not in stop_words and len(w) > 2])

    if not w1 or not w2:
        return False

    intersection = w1.intersection(w2)
    union = w1.union(w2)
    jaccard = len(intersection) / len(union) if union else 0.0

    if jaccard >= threshold:
        return True

    # Check key intent clusters (e.g. self intro, why cabin crew, announcement, etc.)
    intent_clusters = [
        {'introduce', 'introduction', 'background', 'yourself', 'strengths', 'education'},
        {'why', 'airline', 'join', 'motivation', 'career', 'pursue', 'apply'},
        {'seatbelt', 'seat', 'belt', 'turbulence', 'fasten', 'sign'},
        {'lavatory', 'smoke', 'smoking', 'cigarette', 'toilet'},
        {'nauseous', 'sick', 'vomit', 'dizzy', 'unwell', 'faint', 'medical'},
        {'announcement', 'announce', 'read', 'ladies', 'gentlemen'},
        {'teamwork', 'colleague', 'senior', 'cockpit', 'pilot', 'captain'},
        {'delay', 'delayed', 'waiting', 'gate', 'cancelled', 'diversion'},
        {'shift', 'night', 'hours', 'roster', 'lifestyle', 'family', 'stamina'}
    ]

    for cluster in intent_clusters:
        if len(w1.intersection(cluster)) >= 2 and len(w2.intersection(cluster)) >= 2:
            return True

    return False

# Curated non-repeating questions for Cabin Crew: Exactly 10 questions per difficulty (Q1-Q9 English, Q10 Hindi)
CABIN_CREW_RESERVE_BANK = {
    'Easy': [
        {"questionText": "Could you introduce yourself, highlighting your educational background and the qualities that make you well suited for customer service as cabin crew?", "stageName": "Introduction", "language": "English"},
        {"questionText": "What does genuine customer hospitality mean to you, and how would you make a nervous first-time flyer feel comfortable on board?", "stageName": "Customer Hospitality", "language": "English"},
        {"questionText": "Before departure, how do you verify that all passengers have complied with standard safety instructions like fastening seat belts and switching off large electronic devices?", "stageName": "Safety Compliance", "language": "English"},
        {"questionText": "If a passenger informs you that they are feeling motion sickness or mild nausea during cruise flight, what immediate comfort measures would you provide?", "stageName": "Medical Care & Comfort", "language": "English"},
        {"questionText": "How would you politely assist two passengers who both claim to have been assigned the same window seat during passenger boarding?", "stageName": "Passenger Assistance", "language": "English"},
        {"questionText": "Please read this standard in-flight announcement clearly: 'Ladies and gentlemen, welcome aboard Flight 302 with direct service to Mumbai. Please stow your larger cabin bags in the overhead bins and keep the center aisle clear. Thank you.'", "stageName": "Announcement Reading", "language": "English"},
        {"questionText": "Cabin crew must work seamlessly with crew members they are meeting for the first time on a flight roster. How do you quickly establish positive, respectful teamwork?", "stageName": "Team Coordination", "language": "English"},
        {"questionText": "If a flight is held at the departure gate for 45 minutes due to air traffic control clearance, how do you keep passengers relaxed and informed?", "stageName": "Delay Management", "language": "English"},
        {"questionText": "Aviation involves early morning sign-ins, weekend rosters, and irregular hours. How do you personally maintain high energy and punctuality?", "stageName": "Adaptability & Lifestyle", "language": "English"},
        {"questionText": "मान लीजिए एक बुजुर्ग महिला यात्री जो पहली बार विमान में यात्रा कर रही हैं, सीटबेल्ट लगाने और सामान रखने में घबरा रही हैं। आप विनम्रतापूर्वक हिंदी में उनसे क्या कहेंगे और कैसे मदद करेंगे?", "stageName": "Hindi Communication", "language": "Hindi"}
    ],
    'Medium': [
        {"questionText": "Please walk us through your education, key personal strengths, and how your past experiences equip you to deliver high-standard hospitality as cabin crew.", "stageName": "Introduction", "language": "English"},
        {"questionText": "Describe a real situation from your background where you anticipated a customer's unspoken needs and turned a potentially stressful situation into a positive impression.", "stageName": "Hospitality Excellence", "language": "English"},
        {"questionText": "During cruise flight, unexpected moderate turbulence occurs and the Captain illuminates the Fasten Seat Belt sign, but an impatient passenger insists on walking to the lavatory. How do you handle this firmly while maintaining courtesy?", "stageName": "Turbulence & Safety", "language": "English"},
        {"questionText": "A passenger appears hyperventilating and complains of sudden chest tightness 30 minutes into a domestic flight. What step-by-step first aid and cabin crew protocol will you initiate?", "stageName": "In-Flight Medical Response", "language": "English"},
        {"questionText": "An irritated passenger loudly complains that their pre-booked meal preference is unavailable and begins arguing heatedly with another crew member. How do you step in and de-escalate the conflict?", "stageName": "Conflict Resolution", "language": "English"},
        {"questionText": "Please articulate this in-flight turbulence announcement with professional modulation and authority: 'Ladies and gentlemen, the Captain has illuminated the Fasten Seat Belt sign due to turbulent air ahead. For your safety, return to your seats immediately and ensure your seat belts are securely fastened. Lavatories are now locked.'", "stageName": "Safety Announcement", "language": "English"},
        {"questionText": "How do you handle a scenario where you observe a fellow crew member inadvertently overlooking a pre-flight emergency equipment check before passenger boarding begins?", "stageName": "Crew Safety Coordination", "language": "English"},
        {"questionText": "Due to dense fog at your destination, the Captain announces a sudden flight diversion to an alternate airport, causing widespread passenger anxiety and frustration. How do you manage cabin composure and communication?", "stageName": "Diversion & Stress Handling", "language": "English"},
        {"questionText": "Commercial aviation requires operating across changing time zones, standby duty callouts, and spending major holidays away from family. What personal coping strategies have you developed?", "stageName": "Career Resilience", "language": "English"},
        {"questionText": "मान लीजिए एक बुजुर्ग यात्री जो केवल हिंदी बोलते हैं, उड़ान के दौरान तेज हलचल (टर्बुलेंस) से बेहद डर जाते हैं और अपनी सीट से उठने की कोशिश करते हैं। आप उन्हें शांत करने और सुरक्षा समझाने के लिए हिंदी में क्या कहेंगे?", "stageName": "Hindi Communication", "language": "Hindi"}
    ],
    'Hard': [
        {"questionText": "Airline recruitment committees evaluate situational maturity beyond rehearsed answers. Critically evaluate what unique psychological resilience, situational judgment, and aviation ethics you bring to this airline.", "stageName": "Aviation Competency & Ethics", "language": "English"},
        {"questionText": "In aviation, safety protocols and passenger hospitality often compete during high-workload flight phases. How do you resolve tension between strict regulatory safety compliance and a demanding VIP passenger's expectations?", "stageName": "Safety vs Hospitality Trade-offs", "language": "English"},
        {"questionText": "During initial descent, you observe faint electrical smoke and an acrid burning smell emanating from an overhead stowage bin in row 14. Detail your exact immediate communication, firefighting protocol, and passenger protection steps.", "stageName": "Cabin Fire & Smoke Emergency", "language": "English"},
        {"questionText": "A passenger collapses unconscious in the aisle over open water with no pulse detected. Detail your exact procedure including CPR initiation, automated external defibrillator (AED) protocol, medical volunteer paging, and flight deck communication.", "stageName": "Critical Medical Emergency", "language": "English"},
        {"questionText": "An intoxicated passenger becomes verbally abusive, refuses direct safety instructions, and physically touches a crew member aggressively. What are the legal levels of passenger interference, restraint procedures, and handover protocols?", "stageName": "Unruly Passenger Restraint Protocol", "language": "English"},
        {"questionText": "Deliver this critical precautionary emergency landing briefing with unwavering clarity, command authority, and composure: 'Attention all passengers: This is a crew briefing. We are preparing for a precautionary emergency landing. Remove all high heels, eyeglasses, and sharp objects. Review the safety card in front of you. When instructed to brace, adopt the brace position immediately. Remain seated until the aircraft comes to a complete stop.'", "stageName": "Emergency Briefing Delivery", "language": "English"},
        {"questionText": "Explain the sterile flight deck rule below 10,000 feet and describe the precise emergency criteria that would justify you breaching cockpit security interphone protocols during a critical approach phase.", "stageName": "Sterile Cockpit Protocol", "language": "English"},
        {"questionText": "During an emergency evacuation on land where the port side exit is blocked by fire, how do you re-direct panicked passengers toward operative exits while commanding authority amid chaos?", "stageName": "Evacuation Crowd Control", "language": "English"},
        {"questionText": "Describe how you maintain sharp cognitive focus and peak physical safety alertness on the final sector of a consecutive multi-leg night flight roster when extreme fatigue sets in.", "stageName": "Fatigue & Cognitive Focus", "language": "English"},
        {"questionText": "आपातकालीन स्थिति में जब केबिन में ऑक्सीजन मास्क गिर जाते हैं, एक घबराए हुए हिंदी भाषी यात्री मास्क लगाने से इनकार करते हैं और आपातकालीन द्वार खोलने की जिद करते हैं। आप तुरंत हिंदी में उन्हें कैसे आदेश देंगे और स्थिति को नियंत्रित करेंगे?", "stageName": "Hindi Emergency Communication", "language": "Hindi"}
    ]
}

# ─────────────────────────────────────────────
#  API: Generate Questions (Strict Mode Isolation)
# ─────────────────────────────────────────────
@app.route('/api/generate-questions', methods=['POST'])
def generate_questions():
    try:
        data = request.get_json(force=True)
        interview_type = data.get('interview_type', '')
        cv_text = data.get('cv_text', '').strip()
        job_role = data.get('job_role', 'Candidate')
        candidate_name = data.get('candidate_name', 'Candidate')

        # Configuration parameters from CV Interview Setup Screen
        question_count = int(data.get('question_count', 10))
        question_count = max(1, min(question_count, 30))  # bounds 1 to 30

        language = data.get('language', 'English')
        hindi_count = int(data.get('hindi_count', 0))
        english_count = int(data.get('english_count', 0))

        difficulty = data.get('difficulty', 'Medium')
        difficulty_dist = data.get('difficulty_dist', {})

        is_cv_interview = (
            interview_type in ['cv_interview', 'cv_smart'] or 
            (job_role != 'Cabin Crew' and cv_text)
        )

        if is_cv_interview:
            # =========================================================================
            # MODE 2: CV-BASED INTERVIEW
            # Deep understanding of CV -> Natural, human-like questions testing CV depth
            # =========================================================================
            cv_snippet = cv_text[:4500]

            # Formulate Language instructions
            if language == 'Hindi':
                lang_instruction = "Generate ALL questions strictly in natural, professional Hindi using Devanagari script (e.g. 'अपने सीवी में उल्लिखित...'). Every question must be in Hindi."
            elif language == 'Hinglish':
                lang_instruction = "Generate ALL questions in natural Hinglish (conversational Hindi grammar mixed with standard English technical terms in Latin script, e.g. 'Aapne apne CV mein Python aur Machine Learning mention kiya hai. Kya aap bata sakte hain ki aapne is project mein data preprocessing kaise implement kiya tha?')."
            elif language == 'Mixed':
                if hindi_count <= 0 and english_count <= 0:
                    hindi_count = question_count // 2
                    english_count = question_count - hindi_count
                lang_instruction = (
                    f"Generate a mixed language interview with EXACTLY {hindi_count} questions in natural Hindi (Devanagari script) "
                    f"and {english_count} questions in professional English. Total questions must equal {question_count}."
                )
            else:
                lang_instruction = "Generate ALL questions strictly in clear, professional English."

            # Formulate Difficulty instructions
            if difficulty == 'Easy':
                diff_instruction = "Difficulty: EASY. Focus on fundamental concepts, straightforward explanation of skills and tools listed on the CV, and basic CV verification."
            elif difficulty == 'Hard':
                diff_instruction = "Difficulty: HARD. Focus on deep technical depth, complex system architecture, practical edge-cases, trade-offs, debugging under pressure, and performance optimization."
            elif difficulty == 'Mixed':
                diff_instruction = f"Difficulty: MIXED. Provide a balanced progression across questions (Easy foundation, Medium project scenarios, and Hard edge-case / trade-off questions)."
            else:
                diff_instruction = "Difficulty: MEDIUM. Focus on practical application of skills, project implementation details, challenges faced, and real-world reasoning."

            prompt = (
                f"You are a Lead Hiring Manager & Senior Technical Interviewer conducting an in-depth interview for a {job_role} position.\n"
                f"Candidate Name: {candidate_name}\n"
                f"Total Questions Required: EXACTLY {question_count}\n\n"
                f"CANDIDATE CV / RESUME TEXT:\n"
                f"----------------------------------------\n"
                f"{cv_snippet}\n"
                f"----------------------------------------\n\n"
                f"LANGUAGE REQUIREMENT:\n"
                f"{lang_instruction}\n\n"
                f"DIFFICULTY REQUIREMENT:\n"
                f"{diff_instruction}\n\n"
                f"CRITICAL RULES (VIOLATIONS WILL BE REJECTED):\n"
                f"1. The CV text is INTERNAL DATA ONLY. DO NOT dump raw CV text, raw contact numbers, email addresses, postal addresses, or resume headings into the questions.\n"
                f"2. DO NOT output bare keywords or resume titles like 'Python', 'SQL', 'Machine Learning', 'JECRC University', 'Internship'.\n"
                f"3. Every single question MUST be a complete, natural, conversational interview question ending with '?' (or '?' / '।').\n"
                f"4. Base the questions on the candidate's actual projects, technical skills, degree, and work experience mentioned in their CV. Ask them to explain their implementation decisions, challenges, problem solving, and practical experience.\n"
                f"5. Questions must verify whether the candidate genuinely understands and has practical experience with what is written in the CV.\n"
                f"6. Generate EXACTLY {question_count} distinct, non-duplicate questions.\n\n"
                f"Return ONLY a valid JSON array of objects (no markdown fences, no explanatory text):\n"
                f"[\n"
                f'  {{"questionText": "...", "stageName": "Project Architecture / Core Skill / etc.", "difficulty": "Easy/Medium/Hard", "language": "English/Hindi/Hinglish", "timeLimit": 60, "isFollowUp": false}}\n'
                f"]"
            )

            try:
                raw = call_ai(prompt, max_tokens=3500, temperature=0.5)
                content = extract_json(raw)
                questions_data = json.loads(content)
            except Exception as ai_err:
                print(f"[generate_questions] AI call failed: {ai_err}, using smart fallback pool")
                questions_data = []

            # Build intelligent fallbacks in case AI generates fewer questions
            english_fallbacks = [
                f"{candidate_name}, could you introduce yourself and explain how your background has prepared you for this {job_role} role?",
                f"Looking at your education and training, which core subjects or practical coursework have been most relevant to your work as a {job_role}?",
                "Can you walk me through one of the most technically challenging projects from your resume and explain your specific contribution?",
                "You listed several key competencies on your CV. Can you describe a real situation where you had to apply one of these under strict deadlines?",
                "When implementing projects or solutions in your field, how do you verify quality and ensure all specifications are met?",
                f"Imagine you face a critical operational breakdown or sudden requirement shift in a {job_role} project. What is your step-by-step approach to resolve it?",
                "Could you highlight a significant achievement from your internship or past work experience and the measurable impact it produced?",
                "How do you evaluate trade-offs between speed of delivery and thorough technical precision when working under pressure?",
                "Can you share an experience where you had a disagreement with a team member or stakeholder on a technical decision, and how you resolved it professionally?",
                f"What motivated you to specialize in {job_role}, and how do you plan to continue expanding your expertise over the next two years?",
                "How do you handle unexpected bugs or errors in production that require immediate troubleshooting?",
                "Could you explain your methodology for documenting technical workflows and communicating updates to cross-functional teams?",
                "What tools or frameworks do you rely on most heavily in your day-to-day work, and why do you prefer them over alternatives?",
                "Describe a project where you had to learn a completely new tool or technology in a short period of time.",
                "How do you prioritize multiple competing tasks when project deadlines overlap?"
            ]

            hindi_fallbacks = [
                f"{candidate_name}, कृपया अपना परिचय दें और बताएं कि आपकी पृष्ठभूमि आपको इस {job_role} भूमिका के लिए कैसे तैयार करती है?",
                f"अपनी शिक्षा और प्रशिक्षण को देखते हुए, आपके क्षेत्र में कौन से मुख्य विषय इस {job_role} भूमिका के लिए सबसे अधिक प्रासंगिक रहे हैं?",
                "क्या आप अपने सीवी में उल्लिखित सबसे चुनौतीपूर्ण प्रोजेक्ट्स में से एक के बारे में बता सकते हैं और उसमें आपका मुख्य योगदान क्या था?",
                "आपने अपने सीवी में कई मुख्य कौशल सूचीबद्ध किए हैं। क्या आप एक वास्तविक स्थिति का वर्णन कर सकते हैं जहाँ आपने इन्हें समय सीमा के भीतर लागू किया था?",
                "जब आप अपने क्षेत्र में किसी प्रोजेक्ट पर काम करते हैं, तो आप गुणवत्ता और मानकों को कैसे सुनिश्चित करते हैं?",
                f"यदि इस {job_role} प्रोजेक्ट में कोई अप्रत्याशित समस्या उत्पन्न होती है, तो उसे हल करने के लिए आपका कदम-दर-कदम दृष्टिकोण क्या होगा?",
                "क्या आप अपने पिछले कार्य अनुभव या इंटर्नशिप की किसी प्रमुख उपलब्धि और उसके प्रभाव को साझा कर सकते हैं?",
                "दबाव में काम करते समय आप गति और तकनीकी सटीकता के बीच संतुलन कैसे बनाते हैं?",
                "क्या आप ऐसा अनुभव साझा कर सकते हैं जहाँ किसी तकनीकी निर्णय पर टीम के साथ असहमति हुई हो और आपने उसे कैसे सुलझाया?",
                f"आपको {job_role} में विशेषज्ञता प्राप्त करने के लिए किस बात ने प्रेरित किया, और आगे आपकी क्या योजना है?"
            ]

            hinglish_fallbacks = [
                f"{candidate_name}, please apna introduction dein aur batayein ki aapka background is {job_role} role ke liye aapko kaise prepare karta hai?",
                f"Aapki education aur technical training ke hisab se, kaun se core subjects is {job_role} profile mein sabse zyada help karte hain?",
                "Kya aap apne CV ke kisi challenging project ke baare mein explain kar sakte hain aur usme aapka specific contribution kya tha?",
                "Aapne CV mein key skills mention kiye hain. Kya aap koi real-world scenario share kar sakte hain jahan aapne in skills ko successfully use kiya ho?",
                "Apne field mein projects deliver karte waqt aap quality aur performance standards ko kaise verify karte hain?",
                f"Agar {job_role} ke kisi live project mein sudden technical issue aa jaye, toh aapka step-by-step resolution process kya hoga?",
                "Apne past work experience ya internship ka koi aisa major achievement share karein jahan aapne measurable value add ki ho?",
                "Tight deadlines ke pressure mein speed aur quality ke beech aap kaise balance maintain karte hain?",
                "Kisi technical decision pe jab team members ke saath difference of opinion hua ho, toh aapne use professionally kaise resolve kiya?",
                f"{job_role} field choose karne ka aapka main motivation kya tha aur aage aapki growth strategy kya hai?"
            ]

            if language == 'Hindi':
                pool = hindi_fallbacks
            elif language == 'Hinglish':
                pool = hinglish_fallbacks
            else:
                pool = english_fallbacks

            validated_questions = []
            for i in range(question_count):
                raw_q = questions_data[i] if i < len(questions_data) else {}
                raw_text = raw_q.get('questionText', '')
                fb = pool[i % len(pool)]
                cleaned = clean_and_validate_question(raw_text, fb)

                # Determine question language label
                q_lang = raw_q.get('language')
                if not q_lang:
                    if language == 'Mixed':
                        q_lang = 'Hindi' if i < hindi_count else 'English'
                    else:
                        q_lang = language

                # Determine question difficulty label
                q_diff = raw_q.get('difficulty')
                if not q_diff:
                    if difficulty == 'Mixed':
                        q_diff = 'Easy' if i % 3 == 0 else ('Medium' if i % 3 == 1 else 'Hard')
                    else:
                        q_diff = difficulty

                validated_questions.append({
                    "id": f"cv_q_{i+1}_{os.urandom(4).hex()}",
                    "questionText": cleaned,
                    "stageName": raw_q.get('stageName', f'Technical Assessment {i+1}'),
                    "difficulty": q_diff,
                    "language": q_lang,
                    "timeLimit": raw_q.get('timeLimit', 60),
                    "isFollowUp": False
                })

            return jsonify({
                "success": True, 
                "questions": validated_questions, 
                "interview_type": "cv_interview",
                "totalQuestions": len(validated_questions)
            })

        else:

            # =========================================================================
            # MODE 1: CABIN CREW INTERVIEW
            # Pure aviation assessment - NEVER uses CV text
            # EXACTLY 10 QUESTIONS:
            # Questions 1 to 9: STRICTLY ENGLISH
            # Question 10: STRICTLY HINDI (Devanagari script)
            # STRICT DEDUPLICATION & USER-SELECTED DIFFICULTY (Easy / Medium / Hard)
            # =========================================================================
            diff_level = difficulty if difficulty in ['Easy', 'Hard'] else 'Medium'

            if diff_level == 'Easy':
                diff_prompt_desc = (
                    "DIFFICULTY: EASY.\n"
                    "Questions must test foundational cabin crew competencies: warm self-introduction, genuine motivation for aviation, basic polite passenger interaction, simple safety compliance checks, gentle reassurance for nervous flyers, and clear standard boarding announcement reading.\n"
                    "Questions should be clear, welcoming, and accessible."
                )
            elif diff_level == 'Hard':
                diff_prompt_desc = (
                    "DIFFICULTY: HARD.\n"
                    "Questions must test high-intensity aviation emergencies and complex interpersonal conflict: emergency decompression, sudden in-flight medical collapse at 35,000 feet, aggressive/abusive passenger restraint protocol, dealing with smoke in cabin, rapid evacuation command delivery, and psychological resilience under severe crisis."
                )
            else: # Medium
                diff_prompt_desc = (
                    "DIFFICULTY: MEDIUM.\n"
                    "Questions must test realistic in-flight scenarios: passenger seat disputes, handling anxious flyers during moderate turbulence, medical first aid prioritization, de-escalating angry passengers without senior escalation, professional voice modulation in turbulence announcements, and crew resource coordination."
                )

            prompt = (
                f"You are a Lead Cabin Crew Assessor conducting a realistic airline recruitment interview for an Indian commercial airline.\n"
                f"Candidate Name: {candidate_name}\n"
                f"Assessment Difficulty: {diff_level.upper()}\n\n"
                f"{diff_prompt_desc}\n\n"
                f"Generate EXACTLY 10 non-repeating, realistic Cabin Crew interview questions in this PRECISE order:\n"
                f"Q1 [English]: Professional introduction, candidate background, and aviation motivation.\n"
                f"Q2 [English]: Customer hospitality philosophy and passenger empathy.\n"
                f"Q3 [English]: In-flight safety rules, cabin preparation, or turbulence management.\n"
                f"Q4 [English]: In-flight medical first aid response (fainting, panic, nausea, chest pain).\n"
                f"Q5 [English]: Conflict de-escalation with an unruly, argumentative, or demanding passenger.\n"
                f"Q6 [English]: In-flight passenger announcement reading (candidate must read a realistic airline PA announcement clearly).\n"
                f"Q7 [English]: Teamwork with cabin colleagues and coordination with flight deck / cockpit crew.\n"
                f"Q8 [English]: Sudden irregularity, long gate delay, flight diversion, or high-pressure surprise round.\n"
                f"Q9 [English]: Long shifts, irregular flight rosters, fatigue management, and cultural adaptability.\n"
                f"Q10 [HINDI ONLY]: An anxious or elderly Hindi-speaking domestic passenger scenario. This question MUST be written 100% in natural, polite Hindi using Devanagari script (e.g. 'मान लीजिए...').\n\n"
                f"CRITICAL RULES (ANY VIOLATION WILL CAUSE REJECTION):\n"
                f"1. Questions 1 to 9 MUST be 100% in English. Do NOT use any Hindi words in Q1 to Q9.\n"
                f"2. Question 10 MUST be 100% in natural Hindi (Devanagari script). Question 10 is the ONLY Hindi question.\n"
                f"3. All 10 questions must be genuinely distinct. NEVER ask duplicates or reworded versions of earlier questions.\n"
                f"4. If a question describes a scenario or choices, do not repeat the same choices across questions.\n"
                f"5. Return EXACTLY 10 objects in a JSON array.\n\n"
                f"Return ONLY valid JSON (no markdown formatting):\n"
                f"[\n"
                f'  {{"questionText": "...", "stageName": "Introduction", "language": "English", "timeLimit": 60}},\n'
                f'  {{"questionText": "...", "stageName": "Customer Hospitality", "language": "English", "timeLimit": 60}},\n'
                f'  {{"questionText": "...", "stageName": "Safety Compliance", "language": "English", "timeLimit": 60}},\n'
                f'  {{"questionText": "...", "stageName": "Medical Care & Comfort", "language": "English", "timeLimit": 60}},\n'
                f'  {{"questionText": "...", "stageName": "Conflict Resolution", "language": "English", "timeLimit": 60}},\n'
                f'  {{"questionText": "...", "stageName": "Announcement Reading", "language": "English", "timeLimit": 60}},\n'
                f'  {{"questionText": "...", "stageName": "Team Coordination", "language": "English", "timeLimit": 60}},\n'
                f'  {{"questionText": "...", "stageName": "Stress & Irregularities", "language": "English", "timeLimit": 60}},\n'
                f'  {{"questionText": "...", "stageName": "Adaptability & Lifestyle", "language": "English", "timeLimit": 60}},\n'
                f'  {{"questionText": "...(Hindi question in Devanagari)...", "stageName": "Hindi Communication", "language": "Hindi", "timeLimit": 60}}\n'
                f"]"
            )

            raw = call_ai(prompt, max_tokens=3000, temperature=0.6)
            content = extract_json(raw)
            try:
                questions_data = json.loads(content)
                if not isinstance(questions_data, list):
                    questions_data = []
            except Exception:
                questions_data = []

            # Get reserve questions matching selected difficulty
            reserve_list = CABIN_CREW_RESERVE_BANK.get(diff_level, CABIN_CREW_RESERVE_BANK['Medium'])
            validated_questions = []

            for i in range(10):
                stage_req = reserve_list[i]['stageName']
                is_hindi_expected = (i == 9)
                fallback_q = reserve_list[i]['questionText']

                chosen_text = None
                if i < len(questions_data) and isinstance(questions_data[i], dict):
                    raw_text = questions_data[i].get('questionText', '')
                    cleaned = clean_and_validate_question(raw_text, None)
                    if cleaned:
                        has_hindi = bool(re.search(r'[\u0900-\u097F]', cleaned))
                        lang_valid = (has_hindi if is_hindi_expected else not has_hindi)
                        if lang_valid:
                            is_dup = any(are_questions_similar(cleaned, prev_q['questionText']) for prev_q in validated_questions)
                            if not is_dup:
                                chosen_text = cleaned

                # If AI output failed validation, language check, or duplication, fall back to reserve
                if not chosen_text:
                    # Also verify fallback isn't duplicated with previously accepted questions
                    if not any(are_questions_similar(fallback_q, prev_q['questionText']) for prev_q in validated_questions):
                        chosen_text = fallback_q
                    else:
                        chosen_text = fallback_q

                validated_questions.append({
                    "id": f"cc_q_{i+1}_{os.urandom(4).hex()}",
                    "questionIndex": i,
                    "questionText": chosen_text,
                    "stageName": stage_req,
                    "difficulty": diff_level,
                    "language": "Hindi" if is_hindi_expected else "English",
                    "timeLimit": 60,
                    "isFollowUp": False
                })

            return jsonify({
                "success": True, 
                "questions": validated_questions, 
                "interview_type": "cabin_crew",
                "difficulty": diff_level,
                "totalQuestions": 10
            })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e), "questions": []}), 500

# ─────────────────────────────────────────────
#  API: Dynamic Follow-Up Question Generator
# ─────────────────────────────────────────────
@app.route('/api/generate-follow-up', methods=['POST'])
def generate_follow_up():
    try:
        data = request.get_json(force=True)
        question = data.get('question', '')
        answer = data.get('answer', '').strip()
        job_role = data.get('job_role', 'Professional')
        interview_type = data.get('interview_type', 'cv_interview')

        words = [w for w in answer.split() if w]
        word_count = len(words)

        # Do not generate follow-up if candidate barely spoke (< 6 words) or already gave a comprehensive answer (> 90 words)
        if word_count < 6 or word_count > 90:
            return jsonify({"needsFollowUp": False})

        prompt = (
            f"You are an active interviewer conducting an interview for {job_role}.\n"
            f"The previous question was:\n"
            f'"{question}"\n\n'
            f"The candidate answered:\n"
            f'"{answer}"\n\n'
            f"Determine if this answer warrants an immediate, intelligent follow-up question.\n"
            f"A follow-up is warranted if:\n"
            f"- The candidate mentions a specific project, tool, or methodology without explaining how they used it.\n"
            f"- The answer is brief and lacks concrete examples.\n"
            f"- The candidate made a claim that an interviewer would naturally probe further.\n\n"
            f"If YES, generate ONE concise, sharp follow-up question (15-25 words) that asks for specific clarification or practical detail.\n"
            f'If NO, output "NO".\n\n'
            f"Return JSON only:\n"
            f'{{\n'
            f'  "needsFollowUp": true,\n'
            f'  "followUpQuestion": "...",\n'
            f'  "reason": "..."\n'
            f'}}'
        )

        raw = call_ai(prompt, max_tokens=300, temperature=0.6)
        content = extract_json(raw)
        result = json.loads(content)

        if result.get("needsFollowUp") and result.get("followUpQuestion"):
            clean_q = clean_and_validate_question(result["followUpQuestion"], None)
            if clean_q:
                return jsonify({
                    "needsFollowUp": True,
                    "followUpQuestion": clean_q,
                    "reason": result.get("reason", "Clarification requested")
                })

        return jsonify({"needsFollowUp": False})

    except Exception as e:
        print(f"[Follow-Up Error]: {e}")
        return jsonify({"needsFollowUp": False})

# ─────────────────────────────────────────────
#  API: AI Evaluate Completed Session
# ─────────────────────────────────────────────
@app.route('/api/evaluate-session', methods=['POST'])
def evaluate_session():
    try:
        data = request.get_json(force=True)
        questions = data.get('questions', [])
        answers = data.get('answers', [])
        cv_text = data.get('cv_text', '')[:2500]
        job_role = data.get('job_role', 'Candidate')
        interview_type = data.get('interview_type', '')

        is_cv_interview = (
            interview_type in ['cv_interview', 'cv_smart'] or 
            job_role != 'Cabin Crew'
        )

        qa_pairs = ""
        for i, q in enumerate(questions):
            ans = next((a for a in answers if a.get('questionId') == q.get('id')), None)
            answer_text = (ans.get('candidateAnswer') or '(No speech recorded)').strip() if ans else '(No speech recorded)'
            time_taken = ans.get('timeTaken', 0) if ans else 0
            qa_pairs += f"\nQ{i+1} [{q.get('stageName','Assessment')}]:\nQuestion: {q.get('questionText','')}\nAnswer: {answer_text}\nTime used: {time_taken}s out of 60s\n{'─'*40}"

        mode = data.get('mode', 'real')

        if is_cv_interview:
            # =========================================================================
            # CV-BASED EVALUATION (Strict, realistic scoring based strictly on actual answers)
            # =========================================================================
            prompt = (
                f"You are a Lead Hiring Committee Chair & Senior Technical Evaluator assessing a candidate for: {job_role}.\n"
                f"Interview Mode: {mode.upper()} {'(STRICT ASSESSMENT - NO INFLATED SCORES)' if mode == 'real' else '(PRACTICE MODE)'}\n\n"
                f"CANDIDATE CV CONTEXT:\n{cv_text}\n\n"
                f"INTERVIEW TRANSCRIPT:\n{qa_pairs}\n\n"
                f"SCORING GUIDELINES (STRICT & REALISTIC - DO NOT GIVE AUTOMATIC HIGH SCORES):\n"
                f"- If candidate gave short, vague, shallow, or evasive answers: score 30-55 on those dimensions.\n"
                f"- If candidate gave incomplete answers: score 55-70.\n"
                f"- If candidate gave solid, clear answers with concrete project examples and technical reasoning: score 75-88.\n"
                f"- If candidate had excellent depth, precise terminology, and strong metrics: score 89-95.\n"
                f"- If candidate was silent, said 'I don't know', or gave irrelevant answers: score 10-35.\n"
                f"- Never award 90%+ unless the candidate gave exceptionally detailed, accurate, and structured answers.\n\n"
                f"EVALUATE CANDIDATE HONESTLY AND STRICTLY ON THESE DIMENSIONS (Each out of 100):\n"
                f"1. Technical Knowledge\n"
                f"2. CV Knowledge\n"
                f"3. Communication\n"
                f"4. Confidence\n"
                f"5. Problem Solving\n"
                f"6. Practical Understanding\n"
                f"7. Answer Relevance\n"
                f"8. Professionalism\n\n"
                f"Provide Selection Readiness:\n"
                f'Must be one of: "Excellent" | "Strong" | "Good" | "Needs Improvement" | "Needs More Practice"\n'
                f'Never say "You are selected" or guarantee hiring. Use professional advisory tone: "Your current performance shows [readiness], but improving [area] will make you more interview-ready."\n\n'
                f"Return ONLY valid JSON (no markdown fences, no explanatory text):\n"
                f"{{\n"
                f'  "overallScore": 72,\n'
                f'  "overallRating": 7.2,\n'
                f'  "selectionReadiness": "Good",\n'
                f'  "selectionStatement": "Your current performance shows good potential, but improving technical depth and answer structure would make you more interview-ready.",\n'
                f'  "interviewerFeedback": "Your overall performance was good. You demonstrated a reasonable understanding of the concepts mentioned in your CV, but some answers lacked depth and practical examples. Your communication was clear, although a few responses were too brief.",\n'
                f'  "criteriaScores": {{\n'
                f'    "Technical Knowledge": 68,\n'
                f'    "CV Knowledge": 78,\n'
                f'    "Communication": 75,\n'
                f'    "Confidence": 70,\n'
                f'    "Problem Solving": 65,\n'
                f'    "Practical Understanding": 70,\n'
                f'    "Answer Relevance": 80,\n'
                f'    "Professionalism": 82\n'
                f"  }},\n"
                f'  "strengths": ["You explained your project clearly and were able to describe your personal contribution.", "Demonstrated good confidence in introducing your background."],\n'
                f'  "weaknesses": ["Your technical answers were generally correct, but several answers lacked practical examples.", "Could elaborate more on architectural trade-offs."],\n'
                f'  "questionsStruggled": ["Question 3: Struggled to explain practical implementation details"],\n'
                f'  "topicsToRevise": ["Core topic 1 candidate struggled with", "Topic 2 from CV to brush up on"],\n'
                f'  "recommendations": "3-4 sentences of realistic, constructive coaching advice referencing their actual answers and CV background",\n'
                f'  "questionReviews": [\n'
                f"    {{\n"
                f'      "questionText": "exact question",\n'
                f'      "candidateAnswer": "exact answer given",\n'
                f'      "score": 7,\n'
                f'      "performanceLevel": "Good",\n'
                f'      "feedback": "honest constructive assessment of what they said",\n'
                f'      "tip": "concrete actionable improvement for this specific question",\n'
                f'      "modelAnswer": "A strong answer should have highlighted: 1) clear project context, 2) exact technical tools used, and 3) measurable outcomes.",\n'
                f'      "stageName": "stage name",\n'
                f'      "timeTaken": 45\n'
                f"    }}\n"
                f"  ]\n"
                f"}}"
            )

        else:
            # =========================================================================
            # CABIN CREW EVALUATION (Aviation recruitment criteria)
            # =========================================================================
            prompt = (
                f"You are Pari, Lead Aviation Assessor evaluating a Cabin Crew candidate for an Indian carrier.\n\n"
                f"INTERVIEW TRANSCRIPT:\n{qa_pairs}\n\n"
                f"Evaluate strictly on Cabin Crew standards (Passenger safety, empathy, voice modulation, Hindi communication, turbulence handling).\n\n"
                f"Return ONLY valid JSON:\n"
                f"{{\n"
                f'  "overallScore": 80,\n'
                f'  "criteriaScores": {{\n'
                f'    "Communication": 80,\n'
                f'    "Answer Quality": 75,\n'
                f'    "English Fluency": 85,\n'
                f'    "Situational Skills": 82,\n'
                f'    "Time Management": 78,\n'
                f'    "Confidence & Presence": 80\n'
                f'  }},\n'
                f'  "strengths": ["aviation strength 1", "aviation strength 2", "aviation strength 3"],\n'
                f'  "weaknesses": ["aviation weakness 1", "aviation weakness 2"],\n'
                f'  "recommendations": "3-4 sentences of airline interview advice",\n'
                f'  "interviewerVerdict": "HIRE",\n'
                f'  "questionReviews": [\n'
                f"    {{\n"
                f'      "questionText": "exact question",\n'
                f'      "candidateAnswer": "exact answer given",\n'
                f'      "score": 8,\n'
                f'      "feedback": "specific feedback on cabin crew protocols",\n'
                f'      "tip": "actionable improvement",\n'
                f'      "modelAnswer": "ideal in-flight response",\n'
                f'      "stageName": "stage name",\n'
                f'      "timeTaken": 45\n'
                f"    }}\n"
                f"  ]\n"
                f"}}"
            )

        raw = call_ai(prompt, max_tokens=3500, temperature=0.5)
        content = extract_json(raw)
        evaluation = json.loads(content)
        evaluation['aiGenerated'] = True
        evaluation['interview_type'] = 'cv_interview' if is_cv_interview else 'cabin_crew'
        if is_cv_interview and 'overallRating' not in evaluation:
            evaluation['overallRating'] = round(evaluation.get('overallScore', 70) / 10, 1)
        return jsonify(evaluation)


    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────────
#  API: Deep CV Parsing & Role Detection
# ─────────────────────────────────────────────
@app.route('/api/analyze-cv', methods=['POST'])
def analyze_cv():
    try:
        data = request.get_json(force=True)
        cv_text = data.get('cv_text', '')[:5000]

        prompt = (
            f"Extract detailed, structured profile information AND identify the most accurate target job role from this CV/resume.\n\n"
            f"CV TEXT:\n{cv_text}\n\n"
            f"Return ONLY valid JSON (no markdown fences, no explanation):\n"
            f"{{\n"
            f'  "name": "Full candidate name from CV (or empty string if not found)",\n'
            f'  "education": "Degree name, major, and college/university",\n'
            f'  "degree": "Degree (e.g. B.Tech, B.Sc, MBA, BBA)",\n'
            f'  "college": "University or College name",\n'
            f'  "skills": "Comma-separated list of core skills",\n'
            f'  "technicalSkills": "Comma-separated list of technical tools, programming languages, or operational machinery",\n'
            f'  "projects": "Concise 1-2 sentence description of key projects mentioned in CV",\n'
            f'  "experience": "Internship or work experience (company name, role, duration)",\n'
            f'  "certifications": "Certifications or training programs",\n'
            f'  "detectedRole": "The precise professional role this person is best qualified for based on their CV (e.g. Software Engineer, Data Analyst, Textile Production Manager, Marketing Specialist, HR Executive, Operations Coordinator, etc.)",\n'
            f'  "summary": "2-sentence professional executive summary based strictly on this CV actual contents"\n'
            f"}}\n\n"
            f"Rules:\n"
            f"- NEVER invent information. If an item is missing, use empty string.\n"
            f"- For detectedRole, analyze actual work/education domain and provide the most accurate professional title."
        )

        raw = call_ai(prompt, max_tokens=900, temperature=0.2)
        content = extract_json(raw)
        profile = json.loads(content)

        # Smart fallback if AI missed detectedRole
        if not profile.get('detectedRole'):
            combined = (cv_text + " " + profile.get('skills', '')).lower()
            role_map = [
                (['textile', 'weaving', 'fabric', 'loom', 'spinning'], 'Textile Production Manager'),
                (['software', 'developer', 'python', 'java', 'react', 'full stack', 'coding', 'frontend', 'backend'], 'Software Engineer'),
                (['data analyst', 'data science', 'machine learning', 'sql', 'power bi', 'tableau'], 'Data Analyst'),
                (['marketing', 'seo', 'social media', 'content', 'campaign'], 'Marketing Specialist'),
                (['human resources', 'recruiter', 'recruitment', 'payroll', 'talent'], 'HR Executive'),
                (['finance', 'accounting', 'audit', 'tax', 'cpa', 'ca'], 'Financial Analyst'),
                (['cabin crew', 'flight attendant', 'air hostess', 'aviation hospitality'], 'Cabin Crew'),
                (['nurse', 'nursing', 'medical', 'hospital', 'clinical', 'doctor'], 'Healthcare Professional'),
                (['civil', 'structural', 'construction', 'site engineer'], 'Civil Engineer'),
                (['mechanical', 'cad', 'solidworks', 'thermodynamics'], 'Mechanical Engineer'),
                (['sales', 'business development', 'client acquisition', 'b2b'], 'Business Development Executive'),
                (['operations', 'production', 'manufacturing', 'supply chain', 'logistics'], 'Operations Manager')
            ]
            for keywords, role in role_map:
                if any(kw in combined for kw in keywords):
                    profile['detectedRole'] = role
                    break
            if not profile.get('detectedRole'):
                profile['detectedRole'] = 'Professional Candidate'

        return jsonify({"success": True, "profile": profile})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# ─────────────────────────────────────────────
#  API: AI Interview Coach Chatbot
# ─────────────────────────────────────────────
@app.route('/api/chat-coach', methods=['POST'])
def chat_coach():
    try:
        data = request.get_json(force=True)
        message = data.get('message', '')
        context = data.get('context', '')
        coach = data.get('coach', 'aria')
        interview_type = data.get('interview_type', 'cv_interview')

        if coach == 'pari' or interview_type == 'cabin_crew':
            persona = "Pari, an expert Cabin Crew assessor and airline coach"
            domain = "airline recruitment, passenger safety protocols, and in-flight communication"
        else:
            persona = "Aria, an executive AI interview coach and senior technical hiring specialist"
            domain = "career preparation, technical depth, project explanations, and interview delivery"

        prompt = (
            f"You are {persona}. You are helping a candidate prepare and improve.\n"
            f"Domain: {domain}.\n\n"
            f"Interview context (transcript excerpt):\n"
            f"{context[:2000]}\n\n"
            f"Candidate's question:\n"
            f'"{message}"\n\n'
            f"Respond with warm, encouraging, highly specific, and actionable advice in 3-4 sentences.\n"
            f"Reference their actual answers when applicable. Use clear, constructive language."
        )

        reply = call_ai(prompt, max_tokens=400, temperature=0.7).strip()
        return jsonify({"success": True, "reply": reply})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "reply": "I am having trouble connecting right now. Please try again."}), 500

# ─────────────────────────────────────────────
#  API: Skill Gap Analysis
# ─────────────────────────────────────────────
@app.route('/api/skill-gap', methods=['POST'])
def skill_gap():
    try:
        data = request.get_json(force=True)
        cv_text = data.get('cv_text', '')[:3000]
        job_role = data.get('job_role', 'Professional')

        prompt = (
            f"Analyze this CV against key requirements for {job_role}:\n"
            f"{cv_text}\n\n"
            f"Return ONLY valid JSON:\n"
            f"{{\n"
            f'  "matchScore": 75,\n'
            f'  "matchedSkills": ["skill 1", "skill 2", "skill 3"],\n'
            f'  "missingSkills": ["skill 1", "skill 2"],\n'
            f'  "recommendations": ["step 1", "step 2", "step 3"]\n'
            f"}}"
        )

        raw = call_ai(prompt, max_tokens=600, temperature=0.3)
        content = extract_json(raw)
        return jsonify(json.loads(content))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─────────────────────────────────────────────
#  JEE CBT MOCK TEST AI ENGINE ENDPOINT
# ─────────────────────────────────────────────
@app.route('/api/jee/generate-questions', methods=['POST'])
def generate_jee_questions():
    try:
        data = request.json or {}
        exam_type = data.get('exam_type', 'jee_main')
        paper = data.get('paper', 1)
        difficulty = data.get('difficulty', 'medium')
        language = data.get('language', 'en')
        subject = data.get('subject', 'physics')
        chapter = data.get('chapter', '')
        count = min(int(data.get('count', 5)), 10)

        if exam_type == 'jee_advanced':
            rigor_guidance = (
                "JEE ADVANCED LEVEL RIGOR: Highly conceptual, multi-concept problems testing deep analytical reasoning. "
                "For 'hard' difficulty, include advanced calculus, rotational dynamics, coordinate geometry, or complex organic reaction mechanisms. "
                "Include both single_choice, multi_choice (with more than one correct option), and numerical questions."
            )
        else:
            rigor_guidance = (
                "JEE MAIN LEVEL RIGOR: Standard NTA format testing clear conceptual understanding, formula application, and speed. "
                "Include standard single_choice MCQs and numerical integer/decimal value questions."
            )

        prompt = (
            f"You are a premier IIT JEE examination author and professor.\n"
            f"Generate {count} authentic, non-trivial, syllabus-accurate {exam_type.upper().replace('_', ' ')} questions for:\n"
            f"Subject: {subject.capitalize()}\n"
            f"Chapter / Topic: {chapter if chapter else 'Comprehensive Syllabus'}\n"
            f"Difficulty: {difficulty.upper()}\n"
            f"Language: {'Hindi and English bilingual' if language == 'hi' else 'English'}\n\n"
            f"{rigor_guidance}\n\n"
            f"Return ONLY valid JSON formatted as an array of question objects:\n"
            f"[\n"
            f"  {{\n"
            f'    "id": "{subject[:3]}_{difficulty[:1]}_1",\n'
            f'    "subject": "{subject}",\n'
            f'    "chapter": "{chapter if chapter else "General"}",\n'
            f'    "difficulty": "{difficulty}",\n'
            f'    "type": "single_choice",\n'
            f'    "question": "Question text using LaTeX math like $x^2$",\n'
            f'    "question_hi": "प्रश्न का हिंदी अनुवाद",\n'
            f'    "options": ["(A) ...", "(B) ...", "(C) ...", "(D) ..."],\n'
            f'    "options_hi": ["(A) ...", "(B) ...", "(C) ...", "(D) ..."],\n'
            f'    "correctAnswer": "A",\n'
            f'    "explanation": "Step-by-step complete solution and derivation.",\n'
            f'    "explanation_hi": "चरणबद्ध हिंदी समाधान।"\n'
            f"  }}\n"
            f"]"
        )

        raw = call_ai(prompt, max_tokens=3000, temperature=0.5)
        content = extract_json(raw)
        parsed = json.loads(content)
        if isinstance(parsed, dict) and "questions" in parsed:
            parsed = parsed["questions"]
        return jsonify({"success": True, "questions": parsed})
    except Exception as e:
        print(f"[JEE Question Gen Error]: {e}")
        return jsonify({"success": False, "error": str(e), "questions": []}), 200

# ─────────────────────────────────────────────
#  Static File Serving
# ─────────────────────────────────────────────
@app.route('/')
def index():
    return send_file(os.path.join(STATIC_DIR, 'index.html'))

@app.route('/<path:path>')
def static_proxy(path):
    file_path = os.path.join(STATIC_DIR, path)
    if os.path.isfile(file_path):
        return send_from_directory(STATIC_DIR, path)
    return send_file(os.path.join(STATIC_DIR, 'index.html'))

if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print("=" * 70)
    print("   INTERVIEW AI - Powered by Groq Cloud + Dual Interview Engines")
    print("=" * 70)
    print(f"   URL          : http://localhost:{PORT}")
    print(f"   Groq Cloud   : {'[OK] Connected' if GROQ_API_KEY else '[!!] MISSING'}")
    print(f"   Mode 1       : Cabin Crew Interview (Aviation HUD & Scenarios)")
    print(f"   Mode 2       : CV-Based AI Interview (Analyzed Resume & Dynamic Follow-ups)")
    print("   Press Ctrl+C to stop.")
    print("-" * 70)
    app.run(host='0.0.0.0', port=PORT, debug=False)
