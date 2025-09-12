/**
 * MySQL Database Service for HealthGrid AI Triage
 * Replaces Cloudflare D1 with MySQL database integration
 * Handles all database operations for sessions, conversations, and healthcare data
 */
import mysql from 'mysql2/promise'

export interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
}

export class MySQLService {
  private pool: mysql.Pool
  private config: DatabaseConfig

  constructor(config: DatabaseConfig) {
    this.config = config
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    })
  }

  async init(): Promise<void> {
    try {
      // Test connection
      const connection = await this.pool.getConnection()
      console.log('✅ MySQL connection established successfully')
      connection.release()
      
      // Initialize database schema
      await this.initializeSchema()
      console.log('✅ MySQL database schema initialized')
    } catch (error: any) {
      console.error('❌ MySQL connection failed:', error)
      throw error
    }
  }

  private async initializeSchema(): Promise<void> {
    const connection = await this.pool.getConnection()
    
    try {
      // Create sessions table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(255) PRIMARY KEY,
          phoneNumber VARCHAR(20) UNIQUE NOT NULL,
          conversationState VARCHAR(50) DEFAULT 'INITIAL',
          preferredLanguage VARCHAR(10) DEFAULT 'en',
          userData JSON,
          triageData JSON,
          location VARCHAR(255),
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_phone (phoneNumber),
          INDEX idx_state (conversationState),
          INDEX idx_created (createdAt)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      // Create conversation history table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS conversationHistory (
          id VARCHAR(255) PRIMARY KEY,
          sessionId VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          direction ENUM('incoming', 'outgoing') NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSON,
          FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
          INDEX idx_session (sessionId),
          INDEX idx_timestamp (timestamp),
          INDEX idx_direction (direction)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      // Create health records table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS healthRecords (
          id VARCHAR(255) PRIMARY KEY,
          sessionId VARCHAR(255) NOT NULL,
          patientId VARCHAR(255),
          recordType VARCHAR(50) NOT NULL,
          recordData JSON NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
          INDEX idx_session (sessionId),
          INDEX idx_patient (patientId),
          INDEX idx_type (recordType)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      // Create prescriptions table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS prescriptions (
          id VARCHAR(255) PRIMARY KEY,
          sessionId VARCHAR(255) NOT NULL,
          patientId VARCHAR(255),
          providerId VARCHAR(255),
          medications JSON NOT NULL,
          instructions TEXT,
          status ENUM('pending', 'filled', 'cancelled') DEFAULT 'pending',
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
          INDEX idx_session (sessionId),
          INDEX idx_patient (patientId),
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      // Create appointments table
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS appointments (
          id VARCHAR(255) PRIMARY KEY,
          sessionId VARCHAR(255) NOT NULL,
          patientId VARCHAR(255),
          providerId VARCHAR(255),
          appointmentType VARCHAR(50),
          scheduledAt TIMESTAMP,
          status ENUM('scheduled', 'completed', 'cancelled', 'no-show') DEFAULT 'scheduled',
          meetingUrl VARCHAR(500),
          notes TEXT,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
          INDEX idx_session (sessionId),
          INDEX idx_patient (patientId),
          INDEX idx_scheduled (scheduledAt),
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

    } finally {
      connection.release()
    }
  }

  // Session Management Methods
  async createSession(sessionData: any): Promise<void> {
    const connection = await this.pool.getConnection()
    try {
      await connection.execute(
        'INSERT INTO sessions (id, phoneNumber, conversationState, preferredLanguage, userData, triageData, location) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          sessionData.id,
          sessionData.phoneNumber,
          sessionData.conversationState || 'INITIAL',
          sessionData.preferredLanguage || 'en',
          JSON.stringify(sessionData.userData || {}),
          JSON.stringify(sessionData.triageData || {}),
          sessionData.location || null
        ]
      )
    } finally {
      connection.release()
    }
  }

  async getSession(sessionId: string): Promise<any> {
    const connection = await this.pool.getConnection()
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM sessions WHERE id = ?',
        [sessionId]
      )
      
      if (Array.isArray(rows) && rows.length > 0) {
        const session = rows[0] as any
        return {
          ...session,
          userData: session.userData ? JSON.parse(session.userData) : {},
          triageData: session.triageData ? JSON.parse(session.triageData) : {}
        }
      }
      return null
    } finally {
      connection.release()
    }
  }

  async getSessionByPhone(phoneNumber: string): Promise<any> {
    const connection = await this.pool.getConnection()
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM sessions WHERE phoneNumber = ?',
        [phoneNumber]
      )
      
      if (Array.isArray(rows) && rows.length > 0) {
        const session = rows[0] as any
        return {
          ...session,
          userData: session.userData ? JSON.parse(session.userData) : {},
          triageData: session.triageData ? JSON.parse(session.triageData) : {}
        }
      }
      return null
    } finally {
      connection.release()
    }
  }

  async updateSession(sessionId: string, updates: any): Promise<void> {
    const connection = await this.pool.getConnection()
    try {
      const setClause = []
      const values = []
      
      if (updates.conversationState !== undefined) {
        setClause.push('conversationState = ?')
        values.push(updates.conversationState)
      }
      if (updates.preferredLanguage !== undefined) {
        setClause.push('preferredLanguage = ?')
        values.push(updates.preferredLanguage)
      }
      if (updates.userData !== undefined) {
        setClause.push('userData = ?')
        values.push(JSON.stringify(updates.userData))
      }
      if (updates.triageData !== undefined) {
        setClause.push('triageData = ?')
        values.push(JSON.stringify(updates.triageData))
      }
      if (updates.location !== undefined) {
        setClause.push('location = ?')
        values.push(updates.location)
      }
      
      if (setClause.length > 0) {
        values.push(sessionId)
        await connection.execute(
          `UPDATE sessions SET ${setClause.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
          values
        )
      }
    } finally {
      connection.release()
    }
  }

  // Conversation History Methods
  async addToHistory(sessionId: string, message: any, direction: 'incoming' | 'outgoing'): Promise<void> {
    const connection = await this.pool.getConnection()
    try {
      const historyId = this.generateId()
      await connection.execute(
        'INSERT INTO conversationHistory (id, sessionId, content, type, direction, metadata) VALUES (?, ?, ?, ?, ?, ?)',
        [
          historyId,
          sessionId,
          message.content || message.text || '',
          message.type || 'text',
          direction,
          JSON.stringify(message.metadata || {})
        ]
      )
    } finally {
      connection.release()
    }
  }

  async getConversationHistory(sessionId: string, limit: number = 50): Promise<any[]> {
    const connection = await this.pool.getConnection()
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM conversationHistory WHERE sessionId = ? ORDER BY timestamp DESC LIMIT ?',
        [sessionId, limit]
      )
      
      if (Array.isArray(rows)) {
        return rows.map((row: any) => ({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : {}
        }))
      }
      return []
    } finally {
      connection.release()
    }
  }

  // Health Records Methods
  async createHealthRecord(recordData: any): Promise<void> {
    const connection = await this.pool.getConnection()
    try {
      await connection.execute(
        'INSERT INTO healthRecords (id, sessionId, patientId, recordType, recordData) VALUES (?, ?, ?, ?, ?)',
        [
          recordData.id || this.generateId(),
          recordData.sessionId,
          recordData.patientId,
          recordData.recordType,
          JSON.stringify(recordData.recordData)
        ]
      )
    } finally {
      connection.release()
    }
  }

  // Prescription Methods
  async createPrescription(prescriptionData: any): Promise<void> {
    const connection = await this.pool.getConnection()
    try {
      await connection.execute(
        'INSERT INTO prescriptions (id, sessionId, patientId, providerId, medications, instructions, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          prescriptionData.id || this.generateId(),
          prescriptionData.sessionId,
          prescriptionData.patientId,
          prescriptionData.providerId,
          JSON.stringify(prescriptionData.medications),
          prescriptionData.instructions,
          prescriptionData.status || 'pending'
        ]
      )
    } finally {
      connection.release()
    }
  }

  // Appointment Methods
  async createAppointment(appointmentData: any): Promise<void> {
    const connection = await this.pool.getConnection()
    try {
      await connection.execute(
        'INSERT INTO appointments (id, sessionId, patientId, providerId, appointmentType, scheduledAt, status, meetingUrl, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          appointmentData.id || this.generateId(),
          appointmentData.sessionId,
          appointmentData.patientId,
          appointmentData.providerId,
          appointmentData.appointmentType,
          appointmentData.scheduledAt,
          appointmentData.status || 'scheduled',
          appointmentData.meetingUrl,
          appointmentData.notes
        ]
      )
    } finally {
      connection.release()
    }
  }

  // Utility Methods
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  // Generic query method for custom SQL queries
  async query(sql: string, params: any[] = []): Promise<any> {
    const connection = await this.pool.getConnection()
    try {
      const [rows] = await connection.execute(sql, params)
      return rows
    } finally {
      connection.release()
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const connection = await this.pool.getConnection()
      await connection.execute('SELECT 1')
      connection.release()
      return true
    } catch (error) {
      console.error('MySQL health check failed:', error)
      return false
    }
  }
}