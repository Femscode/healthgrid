#!/usr/bin/env node

/**
 * Database Setup Script for HealthGrid AI Triage
 * This script creates the MySQL database and tables required for the application
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

const databaseName = process.env.DB_DATABASE || 'healthgrid_triage';

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🚀 Starting HealthGrid database setup...');
    console.log(`📍 Connecting to MySQL at ${dbConfig.host}:${dbConfig.port}`);
    
    // Connect to MySQL server (without specifying database)
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL server');
    
    // Read the SQL setup file
    const sqlFilePath = path.join(__dirname, '..', 'database', 'setup.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL setup file not found at: ${sqlFilePath}`);
    }
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('📄 SQL setup file loaded');
    
    // First, create the database
    console.log('🔧 Creating database...');
    try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS ${databaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      console.log(`✅ Database '${databaseName}' created successfully`);
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
    
    // Switch to the database
    await connection.query(`USE ${databaseName}`);
    console.log(`📍 Using database '${databaseName}'`);
    
    // Split SQL content and filter out database creation and USE statements
    console.log('🔧 Creating tables...');
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => 
        stmt.length > 0 && 
        !stmt.startsWith('--') && 
        !stmt.startsWith('/*') &&
        !stmt.toUpperCase().includes('CREATE DATABASE') &&
        !stmt.toUpperCase().includes('USE ')
      );
    
    // Execute each statement individually
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.query(statement);
        } catch (error) {
          // Skip harmless errors like "table exists"
          if (!error.message.includes('already exists')) {
            console.warn(`⚠️ Warning executing statement: ${error.message}`);
          }
        }
      }
    }
    
    console.log('✅ Database setup completed successfully!');
    console.log(`📊 Database '${databaseName}' is ready for use`);
    
    // Show created tables
    const [tables] = await connection.query('SHOW TABLES');
    
    console.log('\n📋 Created tables:');
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${Object.values(table)[0]}`);
    });
    
    console.log('\n🎉 HealthGrid database is ready!');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure your Gupshup WhatsApp API credentials in .env');
    console.log('   2. Run: npm run dev');
    console.log('   3. Test the WhatsApp integration');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Troubleshooting tips:');
      console.error('   - Make sure MySQL server is running');
      console.error('   - Check your database connection settings in .env');
      console.error('   - Verify MySQL is listening on the correct port');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Troubleshooting tips:');
      console.error('   - Check your MySQL username and password in .env');
      console.error('   - Make sure the user has CREATE DATABASE privileges');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase();
}

export { setupDatabase };