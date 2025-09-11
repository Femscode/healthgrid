/**
 * Session Manager with MySQL Integration
 * Manages user sessions, conversation history, and persistent data
 */
import { MySQLService } from './mysqlService'

export class SessionManager {
  private mysqlService?: MySQLService

  constructor(mysqlService?: MySQLService) {
    this.mysqlService = mysqlService
  }

  async init() {
    if (!this.mysqlService) {
      console.log('Session Manager initialized without database - using mock data')
      return
    }

    // Initialize MySQL service
    await this.mysqlService.init()
    console.log('Session Manager initialized with MySQL database')
  }

  // Database initialization is now handled by MySQLService

  async getOrCreateSession(phoneNumber: string): Promise<any> {
    if (!this.mysqlService) {
      // Mock session for development
      return {
        id: this.generateSessionId(),
        phoneNumber,
        conversationState: 'INITIAL',
        preferredLanguage: 'en',
        userData: {},
        triageData: {},
        location: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }

    // Check if session exists
    const existingSession = await this.mysqlService.getSessionByPhone(phoneNumber)

    if (existingSession) {
      return existingSession
    }

    // Create new session
    const sessionId = this.generateSessionId()
    const newSession = {
      id: sessionId,
      phoneNumber,
      conversationState: 'INITIAL',
      preferredLanguage: 'en',
      userData: {},
      triageData: {},
      location: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await this.mysqlService.createSession(newSession)
    return newSession
  }

  async getSession(sessionId: string): Promise<any> {
    if (!this.mysqlService) {
      console.log('No database connection - returning mock session')
      return {
        id: sessionId,
        phoneNumber: '+1234567890',
        conversationState: 'INITIAL',
        preferredLanguage: 'en',
        userData: {},
        triageData: {},
        location: null
      }
    }

    return await this.mysqlService.getSession(sessionId)
  }

  async updateSession(sessionId: string, updates: any): Promise<void> {
    if (!this.mysqlService) {
      console.log('No database connection - skipping session update')
      return
    }

    await this.mysqlService.updateSession(sessionId, updates)
  }

  async addToHistory(sessionId: string, message: any, direction: 'incoming' | 'outgoing'): Promise<void> {
    if (!this.mysqlService) {
      console.log('No database connection - skipping history update')
      return
    }

    await this.mysqlService.addToHistory(sessionId, message, direction)
  }

  async getConversationHistory(sessionId: string, limit: number = 50): Promise<any[]> {
    if (!this.mysqlService) {
      console.log('No database connection - returning empty history')
      return []
    }

    return await this.mysqlService.getConversationHistory(sessionId, limit)
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  private generateHistoryId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }
}