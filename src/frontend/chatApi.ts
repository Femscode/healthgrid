// Frontend Chat API Service
export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  rating: number;
  total_reviews: number;
  status: 'active' | 'inactive' | 'busy' | 'offline';
  bio?: string;
  consultation_fee?: number;
}

export interface ChatSession {
  id: string;
  patient_name?: string;
  patient_phone?: string;
  doctor_id?: number;
  session_type: 'triage' | 'consultation' | 'follow_up';
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  language: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  started_at: string;
  ended_at?: string;
  last_activity: string;
}

export interface ChatMessage {
  id: number;
  chat_session_id: string;
  sender_type: 'patient' | 'doctor' | 'system';
  sender_id?: number;
  message_text: string;
  message_type: 'text' | 'image' | 'file' | 'system_notification';
  file_url?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at: string;
  doctor_name?: string;
}

class ChatAPI {
  private baseUrl: string;
  private currentSessionId: string | null = null;
  private pollingInterval: number | null = null;
  private messageCallbacks: ((messages: ChatMessage[]) => void)[] = [];

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  // Get all active doctors
  async getDoctors(): Promise<Doctor[]> {
    const response = await fetch(`${this.baseUrl}/api/chat/doctors`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch doctors');
    }
    
    return result.data;
  }

  // Create a new chat session
  async createSession(sessionData: {
    patient_name?: string;
    patient_phone?: string;
    session_type?: 'triage' | 'consultation' | 'follow_up';
    language?: string;
    priority?: 'low' | 'medium' | 'high' | 'emergency';
  }): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionData),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create session');
    }
    
    this.currentSessionId = result.data.sessionId;
    return result.data.sessionId;
  }

  // Get session details
  async getSession(sessionId: string): Promise<ChatSession> {
    const response = await fetch(`${this.baseUrl}/api/chat/sessions/${sessionId}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch session');
    }
    
    return result.data;
  }

  // Send a message
  async sendMessage(sessionId: string, messageData: {
    sender_type: 'patient' | 'doctor' | 'system';
    sender_id?: number;
    message_text: string;
    message_type?: 'text' | 'image' | 'file' | 'system_notification';
    file_url?: string;
  }): Promise<number> {
    const response = await fetch(`${this.baseUrl}/api/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to send message');
    }
    
    return result.data.messageId;
  }

  // Get messages for a session
  async getMessages(sessionId: string, limit: number = 50, offset: number = 0): Promise<ChatMessage[]> {
    const response = await fetch(`${this.baseUrl}/api/chat/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch messages');
    }
    
    return result.data;
  }

  // Get recent messages (for real-time updates)
  async getRecentMessages(sessionId: string, since: string): Promise<ChatMessage[]> {
    const response = await fetch(`${this.baseUrl}/api/chat/sessions/${sessionId}/messages/recent?since=${encodeURIComponent(since)}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch recent messages');
    }
    
    return result.data;
  }

  // Start polling for new messages
  startPolling(sessionId: string, callback: (messages: ChatMessage[]) => void, intervalMs: number = 2000) {
    this.messageCallbacks.push(callback);
    
    if (this.pollingInterval) {
      return; // Already polling
    }

    let lastCheck = new Date().toISOString();
    
    this.pollingInterval = window.setInterval(async () => {
      try {
        const messages = await this.getRecentMessages(sessionId, lastCheck);
        
        if (messages.length > 0) {
          // Update lastCheck to the timestamp of the most recent message
          const latestMessage = messages[messages.length - 1];
          lastCheck = latestMessage.created_at;
          this.messageCallbacks.forEach(cb => cb(messages));
        }
      } catch (error) {
        console.error('Error polling for messages:', error);
      }
    }, intervalMs);
  }

  // Stop polling for messages
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.messageCallbacks = [];
  }

  // Mark messages as read
  async markMessagesAsRead(sessionId: string, messageIds: number[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/chat/sessions/${sessionId}/messages/read`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messageIds }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to mark messages as read');
    }
  }

  // Get current session ID
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  // Set current session ID
  setCurrentSessionId(sessionId: string | null) {
    this.currentSessionId = sessionId;
  }
}

// Export singleton instance
export const chatAPI = new ChatAPI();
export default chatAPI;