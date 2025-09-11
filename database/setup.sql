-- HealthGrid AI Triage Database Setup
-- MySQL Database Schema for Healthcare Management System

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS healthgrid_triage CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE healthgrid_triage;

-- Sessions table for managing user conversations
CREATE TABLE IF NOT EXISTS sessions (
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
);

-- Conversation history for storing chat messages
CREATE TABLE IF NOT EXISTS conversation_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    message_type ENUM('user', 'assistant', 'system') NOT NULL,
    content TEXT NOT NULL,
    metadata JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_timestamp (timestamp)
);

-- Health records for storing patient health information
CREATE TABLE IF NOT EXISTS health_records (
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
);

-- Prescriptions table for managing digital prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
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
);

-- Appointments table for managing medical appointments
CREATE TABLE IF NOT EXISTS appointments (
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
);

-- Insurance records for managing patient insurance information
CREATE TABLE IF NOT EXISTS insurance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    insurance_provider VARCHAR(255) NOT NULL,
    policy_number VARCHAR(100) NOT NULL,
    group_number VARCHAR(100),
    member_id VARCHAR(100),
    coverage_type VARCHAR(100),
    coverage_details JSON,
    expiry_date DATE,
    status ENUM('active', 'inactive', 'pending', 'expired') DEFAULT 'active',
    verification_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_policy_number (policy_number),
    INDEX idx_insurance_provider (insurance_provider),
    INDEX idx_status (status)
);

-- HMO records for Health Maintenance Organization management
CREATE TABLE IF NOT EXISTS hmo_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    hmo_provider VARCHAR(255) NOT NULL,
    hmo_number VARCHAR(100) NOT NULL,
    plan_type VARCHAR(100),
    primary_care_physician VARCHAR(255),
    hospital_network TEXT,
    coverage_limits JSON,
    copay_amounts JSON,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    enrollment_date DATE,
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_hmo_number (hmo_number),
    INDEX idx_hmo_provider (hmo_provider),
    INDEX idx_status (status)
);

-- Diagnostic lab records for managing lab tests and results
CREATE TABLE IF NOT EXISTS diagnostic_lab_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    lab_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(255) NOT NULL,
    test_code VARCHAR(50),
    ordered_by VARCHAR(255),
    test_date DATE,
    sample_collection_date DATE,
    results JSON,
    reference_ranges JSON,
    status ENUM('ordered', 'collected', 'processing', 'completed', 'cancelled') DEFAULT 'ordered',
    urgency ENUM('routine', 'urgent', 'stat') DEFAULT 'routine',
    lab_address TEXT,
    cost DECIMAL(10,2),
    insurance_covered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_patient_name (patient_name),
    INDEX idx_test_type (test_type),
    INDEX idx_status (status),
    INDEX idx_test_date (test_date)
);

-- Telemedicine sessions for virtual consultations
CREATE TABLE IF NOT EXISTS telemedicine_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    doctor_name VARCHAR(255) NOT NULL,
    session_url VARCHAR(500),
    session_token VARCHAR(255),
    scheduled_time TIMESTAMP NOT NULL,
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    duration_minutes INT,
    session_type ENUM('video', 'audio', 'chat') DEFAULT 'video',
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show') DEFAULT 'scheduled',
    consultation_notes TEXT,
    prescription_issued BOOLEAN DEFAULT FALSE,
    follow_up_required BOOLEAN DEFAULT FALSE,
    recording_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_patient_name (patient_name),
    INDEX idx_doctor_name (doctor_name),
    INDEX idx_scheduled_time (scheduled_time),
    INDEX idx_status (status)
);

-- System logs for tracking application events
CREATE TABLE IF NOT EXISTS system_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255),
    log_level ENUM('info', 'warning', 'error', 'debug') NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    metadata JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_log_level (log_level),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
);

-- Create indexes for better performance
CREATE INDEX idx_sessions_phone_state ON sessions(phone_number, current_state);
CREATE INDEX idx_health_records_urgency_date ON health_records(urgency_level, created_at);
CREATE INDEX idx_appointments_date_status ON appointments(appointment_date, status);
CREATE INDEX idx_prescriptions_date_status ON prescriptions(prescription_date, status);

-- Insert sample data for testing (optional)
INSERT IGNORE INTO sessions (id, phone_number, user_name, current_state, language) VALUES
('test_session_1', '+2348012345678', 'John Doe', 'initial', 'en'),
('test_session_2', '+2348087654321', 'Jane Smith', 'symptom_assessment', 'en');

INSERT IGNORE INTO conversation_history (session_id, message_type, content) VALUES
('test_session_1', 'user', 'Hello, I need medical help'),
('test_session_1', 'assistant', 'Hello! I\'m your AI health assistant. How can I help you today?');

-- Doctors table for managing healthcare providers
CREATE TABLE IF NOT EXISTS doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    specialty VARCHAR(100),
    license_number VARCHAR(100) UNIQUE,
    hospital_affiliation VARCHAR(255),
    years_experience INT,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    status ENUM('active', 'inactive', 'busy', 'offline') DEFAULT 'offline',
    profile_image VARCHAR(500),
    bio TEXT,
    consultation_fee DECIMAL(10,2),
    available_hours JSON,
    languages_spoken JSON,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_specialty (specialty),
    INDEX idx_status (status),
    INDEX idx_rating (rating),
    INDEX idx_last_active (last_active)
);

-- Chat sessions table for managing live chat conversations
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(255) PRIMARY KEY,
    patient_name VARCHAR(255),
    patient_phone VARCHAR(20),
    doctor_id INT,
    session_type ENUM('triage', 'consultation', 'follow_up') DEFAULT 'triage',
    status ENUM('waiting', 'active', 'completed', 'cancelled') DEFAULT 'waiting',
    language VARCHAR(10) DEFAULT 'en',
    priority ENUM('low', 'medium', 'high', 'emergency') DEFAULT 'medium',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    metadata JSON,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_doctor_id (doctor_id),
    INDEX idx_priority (priority),
    INDEX idx_last_activity (last_activity)
);

-- Chat messages table for storing real-time chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chat_session_id VARCHAR(255) NOT NULL,
    sender_type ENUM('patient', 'doctor', 'system') NOT NULL,
    sender_id INT NULL, -- doctor_id if sender_type is 'doctor'
    message_text TEXT NOT NULL,
    message_type ENUM('text', 'image', 'file', 'system_notification') DEFAULT 'text',
    file_url VARCHAR(500) NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES doctors(id) ON DELETE SET NULL,
    INDEX idx_chat_session_id (chat_session_id),
    INDEX idx_sender_type (sender_type),
    INDEX idx_created_at (created_at),
    INDEX idx_is_read (is_read)
);

-- Insert sample doctors for testing
INSERT IGNORE INTO doctors (id, name, specialty, license_number, status, rating, total_reviews, consultation_fee, bio) VALUES
(1, 'Dr. Sarah Johnson', 'General Practitioner', 'MD001234', 'active', 4.9, 127, 5000.00, 'Experienced general practitioner with 10+ years in family medicine'),
(2, 'Dr. Michael Adebayo', 'Cardiologist', 'MD005678', 'active', 4.8, 89, 8000.00, 'Specialist in cardiovascular diseases and heart conditions'),
(3, 'Dr. Fatima Ibrahim', 'Pediatrician', 'MD009012', 'active', 4.95, 156, 6000.00, 'Child healthcare specialist with expertise in pediatric medicine');

-- Insert sample chat session for testing
INSERT IGNORE INTO chat_sessions (id, patient_name, patient_phone, doctor_id, status, language) VALUES
('chat_session_1', 'John Doe', '+2348012345678', 1, 'active', 'en');

-- Insert sample chat messages for testing
INSERT IGNORE INTO chat_messages (chat_session_id, sender_type, sender_id, message_text, created_at) VALUES
('chat_session_1', 'doctor', 1, 'Hello! I\'m Dr. Sarah. How can I help you today?', DATE_SUB(NOW(), INTERVAL 2 MINUTE)),
('chat_session_1', 'patient', NULL, 'I\'ve been having chest pain for the past hour', DATE_SUB(NOW(), INTERVAL 1 MINUTE));

-- Show table creation summary
SELECT 
    TABLE_NAME as 'Table',
    TABLE_ROWS as 'Rows',
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as 'Size (MB)'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'healthgrid_triage'
ORDER BY TABLE_NAME;

SELECT 'Database setup completed successfully!' as Status;