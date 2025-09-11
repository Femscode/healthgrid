#!/usr/bin/env node

/**
 * Simple Table Creation Script for HealthGrid AI Triage
 * Creates tables one by one with proper error handling
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'healthgrid_triage'
};

// Table creation statements
const tableStatements = [
  {
    name: 'sessions',
    sql: `CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(255) PRIMARY KEY,
      phone_number VARCHAR(20) NOT NULL,
      user_name VARCHAR(255),
      current_state VARCHAR(100) DEFAULT 'initial',
      language VARCHAR(10) DEFAULT 'en',
      context JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_phone_number (phone_number),
      INDEX idx_created_at (created_at)
    )`
  },
  {
    name: 'conversation_history',
    sql: `CREATE TABLE IF NOT EXISTS conversation_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      message_type ENUM('user', 'assistant', 'system') NOT NULL,
      content TEXT NOT NULL,
      metadata JSON,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      INDEX idx_session_id (session_id),
      INDEX idx_timestamp (timestamp)
    )`
  },
  {
    name: 'health_records',
    sql: `CREATE TABLE IF NOT EXISTS health_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      patient_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      age INT,
      gender ENUM('male', 'female', 'other'),
      symptoms TEXT,
      medical_history TEXT,
      current_medications TEXT,
      allergies TEXT,
      emergency_contact VARCHAR(20),
      blood_type VARCHAR(5),
      weight DECIMAL(5,2),
      height DECIMAL(5,2),
      vital_signs JSON,
      assessment_result TEXT,
      urgency_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      INDEX idx_phone_number (phone_number),
      INDEX idx_urgency_level (urgency_level),
      INDEX idx_created_at (created_at)
    )`
  },
  {
    name: 'prescriptions',
    sql: `CREATE TABLE IF NOT EXISTS prescriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      patient_name VARCHAR(255) NOT NULL,
      doctor_name VARCHAR(255),
      doctor_license VARCHAR(100),
      medications JSON NOT NULL,
      diagnosis TEXT,
      instructions TEXT,
      pharmacy_name VARCHAR(255),
      pharmacy_address TEXT,
      prescription_date DATE NOT NULL,
      expiry_date DATE,
      status ENUM('pending', 'filled', 'expired', 'cancelled') DEFAULT 'pending',
      digital_signature TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      INDEX idx_patient_name (patient_name),
      INDEX idx_status (status),
      INDEX idx_prescription_date (prescription_date)
    )`
  },
  {
    name: 'appointments',
    sql: `CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      patient_name VARCHAR(255) NOT NULL,
      patient_phone VARCHAR(20) NOT NULL,
      doctor_name VARCHAR(255),
      specialty VARCHAR(100),
      hospital_name VARCHAR(255),
      hospital_address TEXT,
      appointment_date DATE NOT NULL,
      appointment_time TIME NOT NULL,
      appointment_type ENUM('consultation', 'follow_up', 'emergency', 'telemedicine') DEFAULT 'consultation',
      status ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') DEFAULT 'scheduled',
      notes TEXT,
      reminder_sent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      INDEX idx_patient_phone (patient_phone),
      INDEX idx_appointment_date (appointment_date),
      INDEX idx_status (status)
    )`
  }
];

async function createTables() {
  let connection;
  
  try {
    console.log('🔧 Creating HealthGrid database tables...');
    console.log(`📍 Connecting to MySQL at ${dbConfig.host}:${dbConfig.port}`);
    
    // Connect to MySQL server with database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL server and database');
    
    // Create tables one by one
    for (const table of tableStatements) {
      try {
        console.log(`📋 Creating table: ${table.name}`);
        await connection.query(table.sql);
        console.log(`   ✅ Table '${table.name}' created successfully`);
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`   ⚠️ Table '${table.name}' already exists`);
        } else {
          console.error(`   ❌ Failed to create table '${table.name}': ${error.message}`);
          throw error;
        }
      }
    }
    
    // Insert sample data
    console.log('\n📝 Inserting sample data...');
    
    try {
      await connection.query(`
        INSERT IGNORE INTO sessions (id, phone_number, user_name, current_state, language) VALUES
        ('test_session_1', '+2348012345678', 'John Doe', 'initial', 'en'),
        ('test_session_2', '+2348087654321', 'Jane Smith', 'symptom_assessment', 'en')
      `);
      
      await connection.query(`
        INSERT IGNORE INTO conversation_history (session_id, message_type, content) VALUES
        ('test_session_1', 'user', 'Hello, I need medical help'),
        ('test_session_1', 'assistant', 'Hello! I am your AI health assistant. How can I help you today?')
      `);
      
      console.log('   ✅ Sample data inserted successfully');
    } catch (error) {
      console.log(`   ⚠️ Sample data insertion failed: ${error.message}`);
    }
    
    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    const [tables] = await connection.query('SHOW TABLES');
    
    console.log(`\n📊 Created ${tables.length} tables:`);
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });
    
    console.log('\n🎉 Database tables created successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Check phpMyAdmin to see the tables');
    console.log('   2. Run: npm run verify:db');
    console.log('   3. Configure Gupshup API credentials');
    
    return true;
    
  } catch (error) {
    console.error('❌ Table creation failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure XAMPP MySQL is running');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Check your MySQL credentials in .env file');
    }
    
    return false;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the table creation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTables().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { createTables };