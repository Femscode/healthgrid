#!/usr/bin/env node

/**
 * Database Verification Script for HealthGrid AI Triage
 * This script verifies the database and tables were created successfully
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration from environment variables
const dbConfig = {
  host: c.env.DB_HOST || '127.0.0.1',
  port: parseInt(c.env.DB_PORT || '3306'),
  user: c.env.DB_USERNAME || 'root',
  password: c.env.DB_PASSWORD || '',
  database: c.env.DB_DATABASE || 'healthgrid_triage'
};

async function verifyDatabase() {
  let connection;
  
  try {
    console.log('🔍 Verifying HealthGrid database setup...');
    console.log(`📍 Connecting to MySQL at ${dbConfig.host}:${dbConfig.port}`);
    
    // Connect to MySQL server with database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL server and database');
    
    // Check if database exists
    const [databases] = await connection.query('SHOW DATABASES LIKE ?', [dbConfig.database]);
    if (databases.length === 0) {
      console.error(`❌ Database '${dbConfig.database}' does not exist`);
      return false;
    }
    console.log(`✅ Database '${dbConfig.database}' exists`);
    
    // Show all tables
    const [tables] = await connection.query('SHOW TABLES');
    
    if (tables.length === 0) {
      console.log('⚠️ No tables found in the database');
      console.log('\n💡 This might mean:');
      console.log('   - The database setup script didn\'t run completely');
      console.log('   - There were errors during table creation');
      console.log('   - The SQL file has syntax issues');
      return false;
    }
    
    console.log('\n📋 Found tables:');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });
    
    // Check table structures for key tables
    const keyTables = ['sessions', 'conversation_history', 'health_records', 'prescriptions', 'appointments'];
    console.log('\n🔍 Verifying key table structures:');
    
    for (const tableName of keyTables) {
      try {
        const [columns] = await connection.query('DESCRIBE ??', [tableName]);
        console.log(`   ✅ ${tableName} (${columns.length} columns)`);
      } catch (error) {
        console.log(`   ❌ ${tableName} - Table not found or has issues`);
      }
    }
    
    // Test a simple insert and select
    console.log('\n🧪 Testing database operations:');
    
    try {
      // Test session creation
      const testSessionId = 'test_' + Date.now();
      await connection.query(
        'INSERT INTO sessions (id, phone_number, user_name, current_state) VALUES (?, ?, ?, ?)',
        [testSessionId, '+1234567890', 'Test User', 'initial']
      );
      console.log('   ✅ INSERT operation successful');
      
      // Test session retrieval
      const [rows] = await connection.query('SELECT * FROM sessions WHERE id = ?', [testSessionId]);
      if (rows.length > 0) {
        console.log('   ✅ SELECT operation successful');
      }
      
      // Clean up test data
      await connection.query('DELETE FROM sessions WHERE id = ?', [testSessionId]);
      console.log('   ✅ DELETE operation successful');
      
    } catch (error) {
      console.log(`   ❌ Database operations failed: ${error.message}`);
      return false;
    }
    
    console.log('\n🎉 Database verification completed successfully!');
    console.log('\n📊 Database Summary:');
    console.log(`   - Database: ${dbConfig.database}`);
    console.log(`   - Tables: ${tables.length}`);
    console.log(`   - Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   - Status: ✅ Ready for use`);
    
    console.log('\n📝 You can now:');
    console.log('   1. Check phpMyAdmin to see the database and tables');
    console.log('   2. Configure Gupshup WhatsApp API credentials');
    console.log('   3. Start the development server with: npm run dev');
    
    return true;
    
  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Troubleshooting tips:');
      console.error('   - Make sure XAMPP MySQL is running');
      console.error('   - Check XAMPP Control Panel');
      console.error('   - Verify MySQL is listening on port 3306');
      console.error('   - Try restarting XAMPP MySQL service');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Troubleshooting tips:');
      console.error('   - Check your MySQL username and password in .env');
      console.error('   - Default XAMPP MySQL root password is usually empty');
      console.error('   - Try connecting through phpMyAdmin first');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Database not found:');
      console.error('   - Run the database setup script: npm run setup:db');
      console.error('   - Check if the database was created in phpMyAdmin');
    }
    
    return false;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the verification if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyDatabase().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { verifyDatabase };