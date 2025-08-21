/**
 * Session Manager for Cloudflare D1
 * Manages user sessions, conversation history, and persistent data
 */
export class SessionManager {
  private db?: D1Database

  constructor(db?: D1Database) {
    this.db = db
  }

  async init() {
    if (!this.db) {
      console.log('Session Manager initialized without database - using mock data')
      return
    }

    // Initialize database tables
    await this.initializeTables()
    console.log('Session Manager initialized with D1 database')
  }

  private async initializeTables() {
    if (!this.db) return

    // Create sessions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        phoneNumber TEXT UNIQUE NOT NULL,
        conversationState TEXT DEFAULT 'INITIAL',
        preferredLanguage TEXT DEFAULT 'en',
        userData TEXT, -- JSON string
        triageData TEXT, -- JSON string
        location TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create conversation history table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversationHistory (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        direction TEXT NOT NULL, -- 'incoming' or 'outgoing'
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT, -- JSON string
        FOREIGN KEY (sessionId) REFERENCES sessions(id)
      )
    `)

    // Create indexes
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_phone ON sessions(phoneNumber)`)
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_history_session ON conversationHistory(sessionId, timestamp)`)
  }

  async getOrCreateSession(phoneNumber: string): Promise<any> {
    if (!this.db) {
      // Mock session for development
      return {
        id: `session_${phoneNumber}`,
        phoneNumber,
        conversationState: 'INITIAL',
        preferredLanguage: 'en',
        userData: {},
        triageData: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }

    // Try to get existing session
    const existingSession = await this.db.prepare(
      'SELECT * FROM sessions WHERE phoneNumber = ?'
    ).bind(phoneNumber).first()

    if (existingSession) {
      return {
        ...existingSession,
        userData: existingSession.userData ? JSON.parse(existingSession.userData) : {},
        triageData: existingSession.triageData ? JSON.parse(existingSession.triageData) : {}
      }
    }

    // Create new session
    const sessionId = this.generateSessionId()
    await this.db.prepare(`
      INSERT INTO sessions (id, phoneNumber) VALUES (?, ?)
    `).bind(sessionId, phoneNumber).run()

    return {
      id: sessionId,
      phoneNumber,
      conversationState: 'INITIAL',
      preferredLanguage: 'en',
      userData: {},
      triageData: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  async getSession(sessionId: string): Promise<any> {
    if (!this.db) {
      return {
        id: sessionId,
        phoneNumber: '+1234567890',
        conversationState: 'INITIAL',
        preferredLanguage: 'en',
        userData: {},
        triageData: {}
      }
    }

    const session = await this.db.prepare(
      'SELECT * FROM sessions WHERE id = ?'
    ).bind(sessionId).first()

    if (!session) return null

    return {
      ...session,
      userData: session.userData ? JSON.parse(session.userData) : {},
      triageData: session.triageData ? JSON.parse(session.triageData) : {}
    }
  }

  async updateSession(sessionId: string, updates: any): Promise<void> {
    if (!this.db) {
      console.log('Session update (mock):', sessionId, updates)
      return
    }

    const updateFields = []
    const values = []

    if (updates.conversationState) {
      updateFields.push('conversationState = ?')
      values.push(updates.conversationState)
    }

    if (updates.preferredLanguage) {
      updateFields.push('preferredLanguage = ?')
      values.push(updates.preferredLanguage)
    }

    if (updates.userData) {
      updateFields.push('userData = ?')
      values.push(JSON.stringify(updates.userData))
    }

    if (updates.triageData) {
      updateFields.push('triageData = ?')
      values.push(JSON.stringify(updates.triageData))
    }

    if (updates.location) {
      updateFields.push('location = ?')
      values.push(updates.location)
    }

    if (updateFields.length > 0) {
      updateFields.push('updatedAt = CURRENT_TIMESTAMP')
      values.push(sessionId)

      const query = `UPDATE sessions SET ${updateFields.join(', ')} WHERE id = ?`
      await this.db.prepare(query).bind(...values).run()
    }
  }

  async addToHistory(sessionId: string, message: any, direction: 'incoming' | 'outgoing'): Promise<void> {
    if (!this.db) {
      console.log('History add (mock):', sessionId, message, direction)
      return
    }

    const historyId = this.generateHistoryId()
    await this.db.prepare(`
      INSERT INTO conversationHistory (id, sessionId, content, type, direction, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      historyId,
      sessionId,
      message.content || '',
      message.type || 'text',
      direction,
      JSON.stringify(message.metadata || {})
    ).run()
  }

  async getConversationHistory(sessionId: string, limit: number = 50): Promise<any[]> {
    if (!this.db) {
      return []
    }

    const result = await this.db.prepare(`
      SELECT * FROM conversationHistory 
      WHERE sessionId = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).bind(sessionId, limit).all()

    return result.results.map(record => ({
      ...record,
      metadata: record.metadata ? JSON.parse(record.metadata) : {}
    }))
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }

  private generateHistoryId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).substring(7)}`
  }
}