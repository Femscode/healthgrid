# HealthGrid API Endpoints Documentation

## Overview
This document outlines all the external API endpoints that need to be implemented to support the HealthGrid frontend application. The frontend has been converted from a full-stack Hono application to a simple HTML/JavaScript client that connects to external API endpoints.

## Base Configuration
The frontend expects these endpoints to be available at a configurable base URL. Update the `API_CONFIG.BASE_URL` in `src/index.html` to point to your API server.

```javascript
const API_CONFIG = {
    BASE_URL: 'https://your-api-server.com', // Replace with your API server URL
    // ... endpoints
};
```

## Required API Endpoints

### 1. Health Check Endpoint
**Endpoint:** `GET /health`

**Purpose:** System health monitoring

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "services": {
        "database": "connected",
        "ai_service": "operational"
    }
}
```

---

### 2. Create Chat Session
**Endpoint:** `POST /api/chat/sessions`

**Purpose:** Initialize a new chat session for a patient

**Request Body:**
```json
{
    "language": "en" // Language code: en, yo, ha, ig, pcm
}
```

**Response:**
```json
{
    "success": true,
    "sessionId": "chat_1234567890_abc123",
    "message": "Chat session created successfully"
}
```

**Error Response:**
```json
{
    "success": false,
    "error": "Failed to create session",
    "details": "Database connection error"
}
```

---

### 3. Get Chat Messages
**Endpoint:** `GET /api/chat/sessions/{sessionId}/messages`

**Purpose:** Retrieve all messages for a specific chat session

**URL Parameters:**
- `sessionId`: The unique session identifier

**Response:**
```json
{
    "success": true,
    "messages": [
        {
            "id": "msg_001",
            "content": "Hello! How can I help you today?",
            "sender": "doctor", // "doctor" or "patient"
            "timestamp": "2024-01-15T10:30:00Z",
            "language": "en"
        },
        {
            "id": "msg_002",
            "content": "I have a headache",
            "sender": "patient",
            "timestamp": "2024-01-15T10:31:00Z",
            "language": "en"
        }
    ]
}
```

---

### 4. Get Recent Messages (Polling)
**Endpoint:** `GET /api/chat/sessions/{sessionId}/messages/recent?since={timestamp}`

**Purpose:** Get new messages since a specific timestamp (for real-time updates)

**URL Parameters:**
- `sessionId`: The unique session identifier
- `since`: ISO timestamp to get messages after this time

**Response:**
```json
{
    "success": true,
    "messages": [
        {
            "id": "msg_003",
            "content": "Based on your symptoms, I recommend...",
            "sender": "doctor",
            "timestamp": "2024-01-15T10:32:00Z",
            "language": "en"
        }
    ]
}
```

---

### 5. Send AI Chat Message
**Endpoint:** `POST /api/chat/sessions/{sessionId}/ai-chat`

**Purpose:** Send a patient message and get AI-powered medical triage response

**URL Parameters:**
- `sessionId`: The unique session identifier

**Request Body:**
```json
{
    "message": "I have been experiencing chest pain for 2 hours"
}
```

**Response:**
```json
{
    "success": true,
    "patientMessageId": "msg_004",
    "aiResponse": "I understand you're experiencing chest pain. This could be serious...",
    "aiMessageId": "msg_005",
    "needsDoctor": true,
    "urgencyLevel": "high", // "low", "medium", "high", "emergency"
    "paymentLink": "https://payment.flutterwave.com/pay/abc123",
    "detectedLanguage": "en"
}
```

**Error Response:**
```json
{
    "success": false,
    "error": "AI service unavailable",
    "details": "Temporary service outage"
}
```

---

### 6. Quick Actions
**Endpoint:** `POST /api/chat/sessions/{sessionId}/quick-action`

**Purpose:** Handle quick action buttons (emergency, appointment, prescriptions, health records)

**URL Parameters:**
- `sessionId`: The unique session identifier

**Request Body:**
```json
{
    "action": "emergency" // "emergency", "appointment", "prescriptions", "health-records"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Emergency protocol initiated",
    "actionData": {
        "emergencyNumber": "+234-911",
        "nearestHospital": "Lagos University Teaching Hospital",
        "estimatedArrival": "15 minutes"
    }
}
```

## Implementation Notes

### Authentication
The current frontend doesn't implement authentication, but you may want to add:
- API key authentication
- JWT tokens
- Session-based authentication

### CORS Configuration
Ensure your API server allows CORS requests from the frontend domain:
```javascript
// Example CORS headers
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Rate Limiting
Implement rate limiting to prevent abuse:
- Chat messages: 10 requests per minute per session
- Session creation: 5 requests per minute per IP
- Quick actions: 20 requests per minute per session

### Error Handling
All endpoints should return consistent error responses:
```json
{
    "success": false,
    "error": "Brief error description",
    "details": "Detailed error information",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
}
```

### Language Support
The system supports multiple Nigerian languages:
- `en`: English
- `yo`: Yoruba
- `ha`: Hausa
- `ig`: Igbo
- `pcm`: Nigerian Pidgin

### Real-time Updates
The frontend polls for new messages every 2 seconds. Consider implementing:
- WebSocket connections for real-time updates
- Server-Sent Events (SSE)
- Webhook notifications

## Database Schema Requirements

### Sessions Table
```sql
CREATE TABLE chat_sessions (
    id VARCHAR(255) PRIMARY KEY,
    language VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'completed', 'abandoned') DEFAULT 'active'
);
```

### Messages Table
```sql
CREATE TABLE chat_messages (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    sender ENUM('patient', 'doctor', 'ai') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    language VARCHAR(10),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
);
```

## Testing the API

Use the provided test script to verify your API implementation:

```bash
# Update the base URL in test-production.js
node test-production.js
```

## Security Considerations

1. **Input Validation**: Sanitize all user inputs
2. **SQL Injection**: Use parameterized queries
3. **XSS Protection**: Escape HTML content
4. **Rate Limiting**: Implement per-IP and per-session limits
5. **HTTPS**: Use SSL/TLS for all communications
6. **Data Privacy**: Comply with healthcare data regulations

## Monitoring and Logging

Implement comprehensive logging for:
- API request/response times
- Error rates and types
- Session creation and completion rates
- AI service performance metrics
- Database query performance

---

**Next Steps:**
1. Set up your API server with these endpoints
2. Update the `API_CONFIG.BASE_URL` in `src/index.html`
3. Test the integration using the provided test scripts
4. Deploy both frontend and backend services
5. Monitor and optimize performance