/**
 * API Endpoints Test Script
 * 
 * This script tests all the required API endpoints for the HealthGrid application.
 * Update the BASE_URL to point to your API server before running.
 * 
 * Usage: node test-api-endpoints.js
 */

const BASE_URL = 'https://your-api-server.com'; // Update this URL

// Test configuration
const TEST_CONFIG = {
    timeout: 10000, // 10 seconds timeout
    retries: 3
};

// Helper function to make HTTP requests
async function makeRequest(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEST_CONFIG.timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        return {
            status: response.status,
            ok: response.ok,
            data
        };
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Test functions
async function testHealthCheck() {
    console.log('\n🔍 Testing Health Check Endpoint...');
    try {
        const result = await makeRequest(`${BASE_URL}/health`);
        
        if (result.ok && result.data.status === 'healthy') {
            console.log('✅ Health check passed');
            return true;
        } else {
            console.log('❌ Health check failed:', result.data);
            return false;
        }
    } catch (error) {
        console.log('❌ Health check error:', error.message);
        return false;
    }
}

async function testCreateSession() {
    console.log('\n🔍 Testing Create Chat Session...');
    try {
        const result = await makeRequest(`${BASE_URL}/api/chat/sessions`, {
            method: 'POST',
            body: JSON.stringify({ language: 'en' })
        });
        
        if (result.ok && result.data.success && result.data.sessionId) {
            console.log('✅ Session created:', result.data.sessionId);
            return result.data.sessionId;
        } else {
            console.log('❌ Session creation failed:', result.data);
            return null;
        }
    } catch (error) {
        console.log('❌ Session creation error:', error.message);
        return null;
    }
}

async function testGetMessages(sessionId) {
    console.log('\n🔍 Testing Get Messages...');
    try {
        const result = await makeRequest(`${BASE_URL}/api/chat/sessions/${sessionId}/messages`);
        
        if (result.ok && result.data.success && Array.isArray(result.data.messages)) {
            console.log('✅ Messages retrieved:', result.data.messages.length, 'messages');
            return true;
        } else {
            console.log('❌ Get messages failed:', result.data);
            return false;
        }
    } catch (error) {
        console.log('❌ Get messages error:', error.message);
        return false;
    }
}

async function testSendAIMessage(sessionId) {
    console.log('\n🔍 Testing Send AI Message...');
    try {
        const result = await makeRequest(`${BASE_URL}/api/chat/sessions/${sessionId}/ai-chat`, {
            method: 'POST',
            body: JSON.stringify({ 
                message: 'I have a headache and feel dizzy. What should I do?' 
            })
        });
        
        if (result.ok && result.data.success && result.data.aiResponse) {
            console.log('✅ AI message sent and response received');
            console.log('   Patient Message ID:', result.data.patientMessageId);
            console.log('   AI Message ID:', result.data.aiMessageId);
            console.log('   Urgency Level:', result.data.urgencyLevel);
            console.log('   Needs Doctor:', result.data.needsDoctor);
            return true;
        } else {
            console.log('❌ AI message failed:', result.data);
            return false;
        }
    } catch (error) {
        console.log('❌ AI message error:', error.message);
        return false;
    }
}

async function testQuickAction(sessionId) {
    console.log('\n🔍 Testing Quick Action...');
    try {
        const result = await makeRequest(`${BASE_URL}/api/chat/sessions/${sessionId}/quick-action`, {
            method: 'POST',
            body: JSON.stringify({ action: 'emergency' })
        });
        
        if (result.ok && result.data.success) {
            console.log('✅ Quick action processed');
            console.log('   Action Data:', result.data.actionData);
            return true;
        } else {
            console.log('❌ Quick action failed:', result.data);
            return false;
        }
    } catch (error) {
        console.log('❌ Quick action error:', error.message);
        return false;
    }
}

async function testRecentMessages(sessionId) {
    console.log('\n🔍 Testing Recent Messages...');
    try {
        const since = new Date(Date.now() - 60000).toISOString(); // Last minute
        const result = await makeRequest(`${BASE_URL}/api/chat/sessions/${sessionId}/messages/recent?since=${since}`);
        
        if (result.ok && result.data.success && Array.isArray(result.data.messages)) {
            console.log('✅ Recent messages retrieved:', result.data.messages.length, 'messages');
            return true;
        } else {
            console.log('❌ Recent messages failed:', result.data);
            return false;
        }
    } catch (error) {
        console.log('❌ Recent messages error:', error.message);
        return false;
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting API Endpoints Test Suite');
    console.log('📍 Base URL:', BASE_URL);
    
    if (BASE_URL === 'https://your-api-server.com') {
        console.log('\n⚠️  WARNING: Please update the BASE_URL in this script to point to your API server!');
        console.log('   Edit the BASE_URL constant at the top of this file.');
        return;
    }
    
    const results = {
        healthCheck: false,
        createSession: false,
        getMessages: false,
        sendAIMessage: false,
        quickAction: false,
        recentMessages: false
    };
    
    let sessionId = null;
    
    // Run tests in sequence
    results.healthCheck = await testHealthCheck();
    
    if (results.healthCheck) {
        sessionId = await testCreateSession();
        results.createSession = !!sessionId;
        
        if (sessionId) {
            results.getMessages = await testGetMessages(sessionId);
            results.sendAIMessage = await testSendAIMessage(sessionId);
            results.quickAction = await testQuickAction(sessionId);
            results.recentMessages = await testRecentMessages(sessionId);
        }
    }
    
    // Print summary
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const tests = [
        { name: 'Health Check', result: results.healthCheck },
        { name: 'Create Session', result: results.createSession },
        { name: 'Get Messages', result: results.getMessages },
        { name: 'Send AI Message', result: results.sendAIMessage },
        { name: 'Quick Action', result: results.quickAction },
        { name: 'Recent Messages', result: results.recentMessages }
    ];
    
    let passed = 0;
    tests.forEach(test => {
        const status = test.result ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${test.name}`);
        if (test.result) passed++;
    });
    
    console.log('\n📈 Overall Results:');
    console.log(`   Passed: ${passed}/${tests.length}`);
    console.log(`   Success Rate: ${Math.round((passed / tests.length) * 100)}%`);
    
    if (passed === tests.length) {
        console.log('\n🎉 All tests passed! Your API is ready for integration.');
    } else {
        console.log('\n⚠️  Some tests failed. Please check your API implementation.');
        console.log('   Refer to API_ENDPOINTS_DOCUMENTATION.md for detailed specifications.');
    }
    
    if (sessionId) {
        console.log(`\n💡 Test session created: ${sessionId}`);
        console.log('   You can use this session ID for manual testing.');
    }
}

// Handle Node.js vs Browser environment
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    const { fetch } = require('node-fetch');
    global.fetch = fetch;
    runAllTests().catch(console.error);
} else {
    // Browser environment
    window.runAPITests = runAllTests;
    console.log('API test functions loaded. Call runAPITests() to start testing.');
}