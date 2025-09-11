import { MySQLService } from './mysqlService';

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
}

export interface ChatMessageWithDoctor extends ChatMessage {
  doctor_name?: string;
}

export class ChatService {
  private mysqlService?: MySQLService;

  constructor(mysqlService?: MySQLService) {
    this.mysqlService = mysqlService;
  }
  // Get all active doctors
  async getActiveDoctors(): Promise<Doctor[]> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      SELECT id, name, specialty, rating, total_reviews, status, bio, consultation_fee
      FROM doctors 
      WHERE status IN ('active', 'busy')
      ORDER BY rating DESC, total_reviews DESC
    `;
    
    const result = await this.mysqlService.query(query);
    return result as Doctor[];
  }

  // Get doctor by ID
  async getDoctorById(doctorId: number): Promise<Doctor | null> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      SELECT id, name, specialty, rating, total_reviews, status, bio, consultation_fee
      FROM doctors 
      WHERE id = ?
    `;
    
    const result = await this.mysqlService.query(query, [doctorId]);
    return result.length > 0 ? result[0] as Doctor : null;
  }

  // Create a new chat session
  async createChatSession(sessionData: {
    patient_name?: string;
    patient_phone?: string;
    doctor_id?: number;
    session_type?: 'triage' | 'consultation' | 'follow_up';
    language?: string;
    priority?: 'low' | 'medium' | 'high' | 'emergency';
  }): Promise<string> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const query = `
      INSERT INTO chat_sessions (
        id, patient_name, patient_phone, doctor_id, session_type, 
        status, language, priority
      ) VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?)
    `;
    
    await this.mysqlService.query(query, [
      sessionId,
      sessionData.patient_name || null,
      sessionData.patient_phone || null,
      sessionData.doctor_id || null,
      sessionData.session_type || 'triage',
      sessionData.language || 'en',
      sessionData.priority || 'medium'
    ]);
    
    return sessionId;
  }

  // Get chat session by ID
  async getChatSession(sessionId: string): Promise<ChatSession | null> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      SELECT * FROM chat_sessions WHERE id = ?
    `;
    
    const result = await this.mysqlService.query(query, [sessionId]);
    return result.length > 0 ? result[0] as ChatSession : null;
  }

  // Update chat session status
  async updateChatSessionStatus(sessionId: string, status: 'waiting' | 'active' | 'completed' | 'cancelled'): Promise<void> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      UPDATE chat_sessions 
      SET status = ?, last_activity = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await this.mysqlService.query(query, [status, sessionId]);
  }

  // Assign doctor to chat session
  async assignDoctorToSession(sessionId: string, doctorId: number): Promise<void> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      UPDATE chat_sessions 
      SET doctor_id = ?, status = 'active', last_activity = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await this.mysqlService.query(query, [doctorId, sessionId]);
  }

  // Send a message
  async sendMessage(messageData: {
    chat_session_id: string;
    sender_type: 'patient' | 'doctor' | 'system';
    sender_id?: number;
    message_text: string;
    message_type?: 'text' | 'image' | 'file' | 'system_notification';
    file_url?: string;
  }): Promise<number> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      INSERT INTO chat_messages (
        chat_session_id, sender_type, sender_id, message_text, 
        message_type, file_url
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await this.mysqlService.query(query, [
      messageData.chat_session_id,
      messageData.sender_type,
      messageData.sender_id || null,
      messageData.message_text,
      messageData.message_type || 'text',
      messageData.file_url || null
    ]);
    
    // Update session last activity
    await this.updateChatSessionStatus(messageData.chat_session_id, 'active');
    
    return result.insertId;
  }

  // Get messages for a chat session
  async getChatMessages(sessionId: string, limit: number = 50, offset: number = 0): Promise<ChatMessageWithDoctor[]> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      SELECT 
        cm.*,
        d.name as doctor_name
      FROM chat_messages cm
      LEFT JOIN doctors d ON cm.sender_id = d.id AND cm.sender_type = 'doctor'
      WHERE cm.chat_session_id = ?
      ORDER BY cm.created_at ASC
      LIMIT ? OFFSET ?
    `;
    
    const result = await this.mysqlService.query(query, [sessionId, limit, offset]);
    return result as ChatMessageWithDoctor[];
  }

  // Get recent messages (for real-time updates)
  async getRecentMessages(sessionId: string, since: string): Promise<ChatMessageWithDoctor[]> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      SELECT 
        cm.*,
        d.name as doctor_name
      FROM chat_messages cm
      LEFT JOIN doctors d ON cm.sender_id = d.id AND cm.sender_type = 'doctor'
      WHERE cm.chat_session_id = ? AND cm.created_at > ?
      ORDER BY cm.created_at ASC
    `;
    
    const result = await this.mysqlService.query(query, [sessionId, since]);
    return result as ChatMessageWithDoctor[];
  }

  // Mark messages as read
  async markMessagesAsRead(sessionId: string, messageIds: number[]): Promise<void> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    if (messageIds.length === 0) return;
    
    const placeholders = messageIds.map(() => '?').join(',');
    const query = `
      UPDATE chat_messages 
      SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
      WHERE chat_session_id = ? AND id IN (${placeholders})
    `;
    
    await this.mysqlService.query(query, [sessionId, ...messageIds]);
  }

  // Check if a webhook message has already been processed
  async isMessageProcessed(messageId: string, phoneNumber: string): Promise<boolean> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      SELECT COUNT(*) as count
      FROM conversation_history ch
      JOIN sessions s ON ch.session_id = s.id
      WHERE s.phone_number = ? AND JSON_EXTRACT(ch.metadata, '$.messageId') = ?
    `;
    
    const result = await this.mysqlService.query(query, [phoneNumber, messageId]);
    return result[0].count > 0;
  }

  // Mark a webhook message as processed
  async markWebhookMessageProcessed(messageId: string, phoneNumber: string, sessionId: string, messageData: any): Promise<void> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    // Add the processed message to conversation history with messageId in metadata
    const query = `
      INSERT INTO conversation_history (session_id, message_type, content, metadata, timestamp)
      VALUES (?, 'user', ?, ?, NOW())
    `;
    
    const metadata = {
      ...messageData,
      messageId: messageId,
      processed: true,
      processedAt: new Date().toISOString()
    };
    
    await this.mysqlService.query(query, [sessionId, messageData.content, JSON.stringify(metadata)]);
  }

  // Get active chat sessions for a doctor
  async getDoctorActiveSessions(doctorId: number): Promise<ChatSession[]> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      SELECT * FROM chat_sessions 
      WHERE doctor_id = ? AND status IN ('waiting', 'active')
      ORDER BY priority DESC, started_at ASC
    `;
    
    const result = await this.mysqlService.query(query, [doctorId]);
    return result as ChatSession[];
  }

  // Get waiting sessions (for assignment)
  async getWaitingSessions(): Promise<ChatSession[]> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      SELECT * FROM chat_sessions 
      WHERE status = 'waiting' 
      ORDER BY priority DESC, started_at ASC
    `;
    
    const result = await this.mysqlService.query(query);
    return result as ChatSession[];
  }

  async getAllSessions(): Promise<ChatSession[]> {
    if (!this.mysqlService) {
      throw new Error('MySQL service not initialized');
    }

    const query = `
      SELECT * FROM chat_sessions 
      ORDER BY started_at DESC
    `;
    
    const result = await this.mysqlService.query(query);
    return result as ChatSession[];
  }
}

export const chatService = new ChatService();