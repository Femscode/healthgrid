// AI Service for multilingual medical chat using Groq API
interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Conversation stages
export enum ConversationStage {
  GREETING = 'greeting',
  NAME_COLLECTION = 'name_collection',
  PHONE_COLLECTION = 'phone_collection',
  SYMPTOM_INQUIRY = 'symptom_inquiry',
  SYMPTOM_CLARIFICATION = 'symptom_clarification',
  DIAGNOSIS = 'diagnosis',
  DOCTOR_CONFIRMATION = 'doctor_confirmation',
  FORM_MODAL = 'form_modal'
}

// Conversation state interface
export interface ConversationState {
  stage: ConversationStage;
  patientName?: string;
  phoneNumber?: string;
  symptoms: string[];
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  language: string;
  possibleAilments?: string[];
}

// Initialize conversation state
export function initializeConversationState(language: string = 'english'): ConversationState {
  return {
    stage: ConversationStage.GREETING,
    symptoms: [],
    conversationHistory: [],
    language
  };
}

const GROQ_API_KEY = c.env.GROQ_API_KEY || '';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// Language detection patterns
const LANGUAGE_PATTERNS = {
  pidgin: [
    /\b(wetin|dey|no|na|go|fit|sabi|abi|sha|oya|make|dem|una|dis|dat)\b/gi,
    /\b(how far|how body|i wan|e be say|no wahala|small small)\b/gi
  ],
  yoruba: [
    /\b(bawo|pele|emi|iwo|wa|ni|ti|se|ko|fun|ninu|lati|si|ati)\b/gi,
    /\b(mo fe|mo ni|o dara|alafia|ese|tutu|gbona|inu|ori|owo)\b/gi
  ],
  igbo: [
    /\b(kedu|ndewo|m|gi|ka|nke|ya|ndi|unu|aha|obi|isi|aka)\b/gi,
    /\b(achoro m|o di mma|nke oma|nnoo|daalu|aru|onya|mmiri)\b/gi
  ],
  hausa: [
    /\b(sannu|yaya|ina|ka|ki|mu|su|da|a|ba|ko|mai|wannan|wancan)\b/gi,
    /\b(lafiya|maraba|na gode|ina son|ba komai|jiki|kai|hannu|kafa)\b/gi
  ]
};

// Stage-specific medical prompts for each language
const STAGE_PROMPTS = {
  [ConversationStage.GREETING]: {
    pidgin: `You are a helpful medical assistant that responds in Nigerian Pidgin English. Greet the patient warmly and ask for their name. Be friendly and professional.`,
    yoruba: `You are a helpful medical assistant that responds in Yoruba language. Greet the patient warmly and ask for their name. Be friendly and professional.`,
    igbo: `You are a helpful medical assistant that responds in Igbo language. Greet the patient warmly and ask for their name. Be friendly and professional.`,
    hausa: `You are a helpful medical assistant that responds in Hausa language. Greet the patient warmly and ask for their name. Be friendly and professional.`,
    english: `You are a helpful medical assistant. Greet the patient warmly and ask for their name. Be friendly and professional.`
  },
  [ConversationStage.NAME_COLLECTION]: {
    pidgin: `You are a helpful medical assistant that responds in Nigerian Pidgin English. The patient has greeted you. Ask for their full name politely.`,
    yoruba: `You are a helpful medical assistant that responds in Yoruba language. The patient has greeted you. Ask for their full name politely.`,
    igbo: `You are a helpful medical assistant that responds in Igbo language. The patient has greeted you. Ask for their full name politely.`,
    hausa: `You are a helpful medical assistant that responds in Hausa language. The patient has greeted you. Ask for their full name politely.`,
    english: `You are a helpful medical assistant. The patient has greeted you. Ask for their full name politely.`
  },
  [ConversationStage.PHONE_COLLECTION]: {
    pidgin: `You are a helpful medical assistant that responds in Nigerian Pidgin English. You have the patient's name. Now ask for their phone number for contact purposes.`,
    yoruba: `You are a helpful medical assistant that responds in Yoruba language. You have the patient's name. Now ask for their phone number for contact purposes.`,
    igbo: `You are a helpful medical assistant that responds in Igbo language. You have the patient's name. Now ask for their phone number for contact purposes.`,
    hausa: `You are a helpful medical assistant that responds in Hausa language. You have the patient's name. Now ask for their phone number for contact purposes.`,
    english: `You are a helpful medical assistant. You have the patient's name. Now ask for their phone number for contact purposes.`
  },
  [ConversationStage.SYMPTOM_INQUIRY]: {
    pidgin: `You are a helpful medical assistant that responds in Nigerian Pidgin English. You have the patient's name and phone. Now ask what health problem or symptoms they are experiencing. Be empathetic.`,
    yoruba: `You are a helpful medical assistant that responds in Yoruba language. You have the patient's name and phone. Now ask what health problem or symptoms they are experiencing. Be empathetic.`,
    igbo: `You are a helpful medical assistant that responds in Igbo language. You have the patient's name and phone. Now ask what health problem or symptoms they are experiencing. Be empathetic.`,
    hausa: `You are a helpful medical assistant that responds in Hausa language. You have the patient's name and phone. Now ask what health problem or symptoms they are experiencing. Be empathetic.`,
    english: `You are a helpful medical assistant. You have the patient's name and phone. Now ask what health problem or symptoms they are experiencing. Be empathetic.`
  },
  [ConversationStage.SYMPTOM_CLARIFICATION]: {
    pidgin: `You are a helpful medical assistant that responds in Nigerian Pidgin English. Ask follow-up questions to better understand the patient's symptoms. Ask about duration, severity, and related symptoms.`,
    yoruba: `You are a helpful medical assistant that responds in Yoruba language. Ask follow-up questions to better understand the patient's symptoms. Ask about duration, severity, and related symptoms.`,
    igbo: `You are a helpful medical assistant that responds in Igbo language. Ask follow-up questions to better understand the patient's symptoms. Ask about duration, severity, and related symptoms.`,
    hausa: `You are a helpful medical assistant that responds in Hausa language. Ask follow-up questions to better understand the patient's symptoms. Ask about duration, severity, and related symptoms.`,
    english: `You are a helpful medical assistant. Ask follow-up questions to better understand the patient's symptoms. Ask about duration, severity, and related symptoms.`
  },
  [ConversationStage.DIAGNOSIS]: {
    pidgin: `You are a helpful medical assistant that responds in Nigerian Pidgin English. Based on the symptoms, provide 2-3 possible conditions the patient might have. Be clear that this is not a final diagnosis and they need to see a doctor.`,
    yoruba: `You are a helpful medical assistant that responds in Yoruba language. Based on the symptoms, provide 2-3 possible conditions the patient might have. Be clear that this is not a final diagnosis and they need to see a doctor.`,
    igbo: `You are a helpful medical assistant that responds in Igbo language. Based on the symptoms, provide 2-3 possible conditions the patient might have. Be clear that this is not a final diagnosis and they need to see a doctor.`,
    hausa: `You are a helpful medical assistant that responds in Hausa language. Based on the symptoms, provide 2-3 possible conditions the patient might have. Be clear that this is not a final diagnosis and they need to see a doctor.`,
    english: `You are a helpful medical assistant. Based on the symptoms, provide 2-3 possible conditions the patient might have. Be clear that this is not a final diagnosis and they need to see a doctor.`
  },
  [ConversationStage.DOCTOR_CONFIRMATION]: {
    pidgin: `You are a helpful medical assistant that responds in Nigerian Pidgin English. Ask the patient if they would like to book an appointment with a doctor for proper diagnosis and treatment.`,
    yoruba: `You are a helpful medical assistant that responds in Yoruba language. Ask the patient if they would like to book an appointment with a doctor for proper diagnosis and treatment.`,
    igbo: `You are a helpful medical assistant that responds in Igbo language. Ask the patient if they would like to book an appointment with a doctor for proper diagnosis and treatment.`,
    hausa: `You are a helpful medical assistant that responds in Hausa language. Ask the patient if they would like to book an appointment with a doctor for proper diagnosis and treatment.`,
    english: `You are a helpful medical assistant. Ask the patient if they would like to book an appointment with a doctor for proper diagnosis and treatment.`
  },
  [ConversationStage.FORM_MODAL]: {
    pidgin: `You are a helpful medical assistant that responds in Nigerian Pidgin English. Confirm that you will help them book an appointment and that a form will appear for them to fill.`,
    yoruba: `You are a helpful medical assistant that responds in Yoruba language. Confirm that you will help them book an appointment and that a form will appear for them to fill.`,
    igbo: `You are a helpful medical assistant that responds in Igbo language. Confirm that you will help them book an appointment and that a form will appear for them to fill.`,
    hausa: `You are a helpful medical assistant that responds in Hausa language. Confirm that you will help them book an appointment and that a form will appear for them to fill.`,
    english: `You are a helpful medical assistant. Confirm that you will help them book an appointment and that a form will appear for them to fill.`
  }
};

/**
 * Detect the language of the input text
 */
export function detectLanguage(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Count matches for each language
  const scores = {
    pidgin: 0,
    yoruba: 0,
    igbo: 0,
    hausa: 0
  };
  
  // Check patterns for each language
  Object.entries(LANGUAGE_PATTERNS).forEach(([lang, patterns]) => {
    patterns.forEach(pattern => {
      const matches = lowerText.match(pattern);
      if (matches) {
        scores[lang as keyof typeof scores] += matches.length;
      }
    });
  });
  
  // Find language with highest score
  const detectedLang = Object.entries(scores).reduce((a, b) => 
    scores[a[0] as keyof typeof scores] > scores[b[0] as keyof typeof scores] ? a : b
  )[0];
  
  // Return detected language or default to English if no clear match
  return scores[detectedLang as keyof typeof scores] > 0 ? detectedLang : 'english';
}

/**
 * Generate AI response using Groq API
 */
async function generateAIResponse(prompt: string, userMessage: string): Promise<string> {
  try {
    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: prompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: GroqResponse = await response.json();
    return data.choices[0]?.message?.content || 'I apologize, but I cannot provide a response at this time.';
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'I apologize, but I am experiencing technical difficulties. Please try again later.';
  }
}

/**
 * Generate stage-specific AI response
 */
async function generateStageResponse(userMessage: string, conversationState: ConversationState): Promise<string> {
  const stagePrompts = STAGE_PROMPTS[conversationState.stage];
  const prompt = (stagePrompts as any)[conversationState.language] || (stagePrompts as any).english;
  
  // Add context based on conversation stage
  let contextualPrompt = prompt;
  
  switch (conversationState.stage) {
    case ConversationStage.NAME_COLLECTION:
      contextualPrompt += ` Please ask for their name politely.`;
      break;
    case ConversationStage.PHONE_COLLECTION:
      contextualPrompt += ` The patient's name is ${conversationState.patientName}. Now ask for their phone number.`;
      break;
    case ConversationStage.SYMPTOM_INQUIRY:
      contextualPrompt += ` The patient's name is ${conversationState.patientName}. Ask what health issues they are experiencing.`;
      break;
    case ConversationStage.SYMPTOM_CLARIFICATION:
      contextualPrompt += ` The patient has mentioned: ${conversationState.symptoms.join(', ')}. Ask for more specific details about their symptoms.`;
      break;
    case ConversationStage.DIAGNOSIS:
      contextualPrompt += ` Based on the symptoms: ${conversationState.symptoms.join(', ')}, provide possible diagnoses and suggest they may need to see a doctor.`;
      break;
    case ConversationStage.DOCTOR_CONFIRMATION:
      contextualPrompt += ` Ask if they would like to book an appointment with a doctor.`;
      break;
    case ConversationStage.FORM_MODAL:
      contextualPrompt += ` Confirm that you will help them book an appointment and that a form will appear.`;
      break;
  }
  
  return await generateAIResponse(contextualPrompt, userMessage);
}

/**
 * Process conversation with stage management
 */
export async function processConversation(
  userMessage: string, 
  conversationState: ConversationState
): Promise<{ 
  response: string; 
  newState: ConversationState; 
  shouldShowModal?: boolean 
}> {
  // Detect language from user message and update conversation state
  const detectedLanguage = detectLanguage(userMessage);
  conversationState.language = detectedLanguage;
  
  // Add user message to conversation history
  conversationState.conversationHistory.push({
    role: 'user',
    content: userMessage
  });
  
  // Process based on current stage
  const response = await generateStageResponse(userMessage, conversationState);
  
  // Add AI response to conversation history
  conversationState.conversationHistory.push({
    role: 'assistant',
    content: response
  });
  
  // Update conversation state based on current stage and user input
  const newState = updateConversationState(conversationState, userMessage, response);
  
  return {
    response,
    newState,
    shouldShowModal: newState.stage === ConversationStage.FORM_MODAL
  };
}

/**
 * Update conversation state based on user input and current stage
 */
function updateConversationState(
  state: ConversationState, 
  userMessage: string, 
  aiResponse: string
): ConversationState {
  const newState = { ...state };
  
  switch (state.stage) {
    case ConversationStage.GREETING:
      newState.stage = ConversationStage.NAME_COLLECTION;
      break;
      
    case ConversationStage.NAME_COLLECTION:
      // Extract name from user message (simple extraction)
      newState.patientName = userMessage.trim();
      newState.stage = ConversationStage.PHONE_COLLECTION;
      break;
      
    case ConversationStage.PHONE_COLLECTION:
      // Extract phone number (simple extraction)
      newState.phoneNumber = userMessage.trim();
      newState.stage = ConversationStage.SYMPTOM_INQUIRY;
      break;
      
    case ConversationStage.SYMPTOM_INQUIRY:
      // Add symptoms
      newState.symptoms.push(userMessage);
      newState.stage = ConversationStage.SYMPTOM_CLARIFICATION;
      break;
      
    case ConversationStage.SYMPTOM_CLARIFICATION:
      // Check if we have enough information for diagnosis
      newState.symptoms.push(userMessage);
      if (newState.symptoms.length >= 2) {
        newState.stage = ConversationStage.DIAGNOSIS;
      }
      break;
      
    case ConversationStage.DIAGNOSIS:
      newState.stage = ConversationStage.DOCTOR_CONFIRMATION;
      break;
      
    case ConversationStage.DOCTOR_CONFIRMATION:
      // Check if user wants to see a doctor
      const wantsDoctor = /yes|yeah|ok|sure|i need|i want|book|appointment/i.test(userMessage) ||
                         /yes|ehen|okay|sure/i.test(userMessage); // Add local language patterns
      if (wantsDoctor) {
        newState.stage = ConversationStage.FORM_MODAL;
      }
      break;
  }
  
  return newState;
}

/**
 * Legacy function for backward compatibility
 */
export async function processMedicalQuery(userMessage: string): Promise<{ language: string; response: string }> {
  const detectedLanguage = detectLanguage(userMessage);
  const conversationState = initializeConversationState(detectedLanguage);
  const result = await processConversation(userMessage, conversationState);
  
  return {
    language: detectedLanguage,
    response: result.response
  };
}