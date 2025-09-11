import { Hono } from 'hono';
import { ChatService } from '../services/chatService';
import { MySQLService } from '../services/mysqlService';
import { processConversation, initializeConversationState, ConversationState } from '../services/aiService';

const chatRoutes = new Hono();

// Initialize chat service with MySQL service
let chatService: ChatService;

export function initializeChatRoutes(mysqlService: MySQLService) {
  chatService = new ChatService(mysqlService);
}

export function getChatService(): ChatService | null {
  return chatService;
}

// Middleware to ensure services are initialized
chatRoutes.use('*', async (c, next) => {
  // Wait a bit for initialization if chatService is not ready
  let retries = 0;
  while (!chatService && retries < 10) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }
  
  if (!chatService) {
    return c.json({ error: 'Services not initialized after waiting' }, 503);
  }
  await next();
});

// Get all active doctors
chatRoutes.get('/doctors', async (c) => {
  try {
    if (!chatService) {
      return c.json({ success: false, error: 'Chat service not initialized' }, 500);
    }
    const doctors = await chatService.getActiveDoctors();
    return c.json({ success: true, data: doctors });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return c.json({ success: false, error: 'Failed to fetch doctors' }, 500);
  }
});

// Get all chat sessions
chatRoutes.get('/sessions', async (c) => {
  try {
    if (!chatService) {
      return c.json({ success: false, error: 'Chat service not initialized' }, 500);
    }
    const sessions = await chatService.getAllSessions();
    return c.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return c.json({ success: false, error: 'Failed to fetch sessions' }, 500);
  }
});

// Get doctor by ID
chatRoutes.get('/doctors/:id', async (c) => {
  try {
    if (!chatService) {
      return c.json({ success: false, error: 'Chat service not initialized' }, 500);
    }
    const doctorId = parseInt(c.req.param('id'));
    const doctor = await chatService.getDoctorById(doctorId);
    
    if (!doctor) {
      return c.json({ success: false, error: 'Doctor not found' }, 404);
    }
    
    return c.json({ success: true, data: doctor });
  } catch (error) {
    console.error('Error fetching doctor:', error);
    return c.json({ success: false, error: 'Failed to fetch doctor' }, 500);
  }
});

// Create a new chat session
chatRoutes.post('/sessions', async (c) => {
  try {
    if (!chatService) {
      return c.json({ success: false, error: 'Chat service not initialized' }, 500);
    }
    const sessionData = await c.req.json();
    const sessionId = await chatService.createChatSession(sessionData);
    
    return c.json({ success: true, data: { sessionId } });
  } catch (error) {
    console.error('Error creating chat session:', error);
    return c.json({ success: false, error: 'Failed to create chat session' }, 500);
  }
});

// Get chat session by ID
chatRoutes.get('/sessions/:id', async (c) => {
  try {
    if (!chatService) {
      return c.json({ success: false, error: 'Chat service not initialized' }, 500);
    }
    const sessionId = c.req.param('id');
    const session = await chatService.getChatSession(sessionId);
    
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    
    return c.json({ success: true, data: session });
  } catch (error) {
    console.error('Error fetching session:', error);
    return c.json({ success: false, error: 'Failed to fetch session' }, 500);
  }
});

// Get chat sessions by phone (placeholder - method not implemented yet)
chatRoutes.get('/sessions/phone/:phone', async (c) => {
  try {
    // TODO: Implement getChatSessionsByPhone method in ChatService
    return c.json({ success: false, error: 'Method not implemented yet' }, 501);
  } catch (error) {
    console.error('Error fetching sessions by phone:', error);
    return c.json({ success: false, error: 'Failed to fetch sessions' }, 500);
  }
});

// Update session status
chatRoutes.put('/sessions/:id/status', async (c) => {
  try {
    const sessionId = c.req.param('id');
    const { status } = await c.req.json();
    
    await chatService.updateChatSessionStatus(sessionId, status);
    
    return c.json({ success: true, message: 'Session status updated' });
  } catch (error) {
    console.error('Error updating session status:', error);
    return c.json({ success: false, error: 'Failed to update session status' }, 500);
  }
});

// Assign doctor to session
chatRoutes.put('/sessions/:id/assign-doctor', async (c) => {
  try {
    const sessionId = c.req.param('id');
    const { doctorId } = await c.req.json();
    
    await chatService.assignDoctorToSession(sessionId, doctorId);
    
    return c.json({ success: true, message: 'Doctor assigned to session' });
  } catch (error) {
    console.error('Error assigning doctor:', error);
    return c.json({ success: false, error: 'Failed to assign doctor' }, 500);
  }
});

// Send a message
chatRoutes.post('/sessions/:id/messages', async (c) => {
  try {
    if (!chatService) {
      return c.json({ success: false, error: 'Chat service not initialized' }, 500);
    }
    const sessionId = c.req.param('id');
    const messageData = await c.req.json();
    
    const messageId = await chatService.sendMessage({
      chat_session_id: sessionId,
      ...messageData
    });
    
    return c.json({ success: true, data: { messageId } });
  } catch (error) {
    console.error('Error sending message:', error);
    return c.json({ success: false, error: 'Failed to send message' }, 500);
  }
});

// Get messages for a session
chatRoutes.get('/sessions/:id/messages', async (c) => {
  try {
    const sessionId = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const messages = await chatService.getChatMessages(sessionId, limit, offset);
    
    return c.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return c.json({ success: false, error: 'Failed to fetch messages' }, 500);
  }
});

// Get recent messages (for real-time updates)
chatRoutes.get('/sessions/:id/messages/recent', async (c) => {
  try {
    const sessionId = c.req.param('id');
    const since = c.req.query('since') || new Date().toISOString();
    
    const messages = await chatService.getRecentMessages(sessionId, since);
    
    return c.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching recent messages:', error);
    return c.json({ success: false, error: 'Failed to fetch recent messages' }, 500);
  }
});

// Mark messages as read
chatRoutes.put('/sessions/:id/messages/read', async (c) => {
  try {
    const sessionId = c.req.param('id');
    const { messageIds } = await c.req.json();
    
    await chatService.markMessagesAsRead(sessionId, messageIds);
    
    return c.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return c.json({ success: false, error: 'Failed to mark messages as read' }, 500);
  }
});

// Handle quick actions
chatRoutes.post('/sessions/:id/quick-action', async (c) => {
  try {
    if (!chatService) {
      return c.json({ success: false, error: 'Chat service not initialized' }, 500);
    }
    
    const sessionId = c.req.param('id');
    const { actionType } = await c.req.json();
    
    // Define quick action messages and admin responses
    const quickActions = {
      'emergency': {
        patientMessage: 'Emergency - I need immediate medical attention',
        adminResponse: 'Emergency alert received. A doctor will contact you immediately. If this is a life-threatening emergency, please call 911 or go to the nearest emergency room.'
      },
      'appointment': {
        patientMessage: 'Book Appointment - I would like to schedule an appointment',
        adminResponse: 'Thank you for your appointment request. Our scheduling team will contact you within 30 minutes to arrange a suitable time slot.'
      },
      'prescriptions': {
        patientMessage: 'Prescriptions - I need help with my prescriptions',
        adminResponse: 'We have received your prescription request. Our pharmacy team will review your request and contact you within 1 hour with available options.'
      },
      'health-records': {
        patientMessage: 'Health Records - I need access to my health records',
        adminResponse: 'Your health records request has been received. Our medical records team will prepare your documents and contact you within 24 hours.'
      }
    };
    
    const action = quickActions[actionType as keyof typeof quickActions];
    if (!action) {
      return c.json({ success: false, error: 'Invalid action type' }, 400);
    }
    
    // Send patient message first
    const patientMessageId = await chatService.sendMessage({
      chat_session_id: sessionId,
      sender_type: 'patient',
      message_text: action.patientMessage,
      message_type: 'text'
    });
    
    // Send admin response immediately
    const adminMessageId = await chatService.sendMessage({
      chat_session_id: sessionId,
      sender_type: 'system',
      message_text: action.adminResponse,
      message_type: 'text'
    });

    return c.json({ 
      success: true, 
      data: { 
        patientMessageId: patientMessageId,
        adminMessageId: adminMessageId
      } 
    });
  } catch (error) {
    console.error('Error processing quick action:', error);
    return c.json({ success: false, error: 'Failed to process quick action' }, 500);
  }
});

// Get doctor's active sessions
chatRoutes.get('/doctors/:id/sessions', async (c) => {
  try {
    const doctorId = parseInt(c.req.param('id'));
    const sessions = await chatService.getDoctorActiveSessions(doctorId);
    
    return c.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Error fetching doctor sessions:', error);
    return c.json({ success: false, error: 'Failed to fetch doctor sessions' }, 500);
  }
});

// Get waiting sessions
chatRoutes.get('/sessions/waiting', async (c) => {
  try {
    const sessions = await chatService.getWaitingSessions();
    
    return c.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Error fetching waiting sessions:', error);
    return c.json({ success: false, error: 'Failed to fetch waiting sessions' }, 500);
  }
});

// AI-powered medical chat endpoint with conversation flow
chatRoutes.post('/sessions/:id/ai-chat', async (c) => {
  try {
    if (!chatService) {
      return c.json({ success: false, error: 'Chat service not initialized' }, 500);
    }
    
    const sessionId = c.req.param('id');
    const { message } = await c.req.json();
    
    if (!message || typeof message !== 'string') {
      return c.json({ success: false, error: 'Message is required' }, 400);
    }
    
    // Get or initialize conversation state for this session
    let conversationState = await getConversationState(sessionId);
    if (!conversationState) {
      // Initialize new conversation state
      conversationState = initializeConversationState('english'); // Default to English, will be detected
      await saveConversationState(sessionId, conversationState);
    }
    
    // Process the conversation with AI
    const aiResult = await processConversation(message, conversationState);
    
    // Send the patient's message first
    const patientMessageId = await chatService.sendMessage({
      chat_session_id: sessionId,
      sender_type: 'patient',
      message_text: message,
      message_type: 'text'
    });

    // Update conversation state
    await saveConversationState(sessionId, aiResult.newState);

    let paymentLink = null;
    let needsDoctor = false;

    // Check if we should show the form modal
    if (aiResult.shouldShowModal) {
      needsDoctor = true;
      paymentLink = generatePaymentLink(sessionId);
    }

    // Send AI response as system message
    const aiMessageId = await chatService.sendMessage({
      chat_session_id: sessionId,
      sender_type: 'system',
      message_text: aiResult.response,
      message_type: 'text'
    });
    
    return c.json({
      success: true,
      patientMessageId,
      aiMessageId,
      detectedLanguage: aiResult.newState.language,
      needsDoctor,
      paymentLink,
      conversationStage: aiResult.newState.stage
    });
    
  } catch (error) {
    console.error('Error processing AI chat:', error);
    return c.json({ success: false, error: 'Failed to process AI chat' }, 500);
  }
});

// Helper functions for conversation state management
const conversationStates = new Map<string, ConversationState>();

async function getConversationState(sessionId: string): Promise<ConversationState | null> {
  // For now, store in memory. In production, this should be stored in database
  return conversationStates.get(sessionId) || null;
}

async function saveConversationState(sessionId: string, state: ConversationState): Promise<void> {
  // For now, store in memory. In production, this should be stored in database
  conversationStates.set(sessionId, state);
}

// Helper function to check if doctor referral is needed
function checkIfNeedsDoctorReferral(userMessage: string, aiResponse: string): boolean {
  const criticalKeywords = [
    'prescription', 'medicine', 'drug', 'tablet', 'injection', 'surgery',
    'severe', 'emergency', 'blood', 'chest pain', 'difficulty breathing',
    'unconscious', 'seizure', 'stroke', 'heart attack', 'broken bone'
  ];
  
  const combinedText = (userMessage + ' ' + aiResponse).toLowerCase();
  const keywordMatches = criticalKeywords.filter(keyword => 
    combinedText.includes(keyword)
  ).length;
  
  // If 2 or more critical keywords are present, suggest doctor
  return keywordMatches >= 2;
}

// Helper function to get doctor suggestion message in different languages
function getDoctorSuggestionMessage(language: string): string {
  const suggestions = {
    pidgin: 'Based on wetin you talk, I think say you need to see doctor. You fit pay small money to talk to our doctor online.',
    yoruba: 'Nitori ohun ti o so, mo ro pe o nilo lati ri dokita. O le san owo kekere lati ba dokita wa soro lori ayelujara.',
    igbo: 'Site na ihe i kwuru, echere m na ị kwesịrị ịhụ dọkịta. Ị nwere ike ịkwụ obere ego iji gwa dọkịta anyị okwu na ịntanetị.',
    hausa: 'Dangane da abin da kuka ce, ina tsammanin kuna bukatar ganin likita. Kuna iya biyan kadan don yin hira da likitanmu a yanar gizo.',
    english: 'Based on your symptoms, I recommend consulting with a doctor. You can pay a small fee to chat with our online doctor.'
  };
  
  return suggestions[language as keyof typeof suggestions] || suggestions.english;
}

// Helper function to generate payment link
function generatePaymentLink(sessionId: string): string {
  const baseUrl = 'https://pay.gupshup-health.com';
  const amount = '2000'; // 2000 Naira consultation fee
  return `${baseUrl}/pay?session=${sessionId}&amount=${amount}&service=consultation&currency=NGN`;
}

export { chatRoutes };