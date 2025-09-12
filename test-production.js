// Test the production API endpoints
async function testProductionAPI() {
    // Replace with your actual Vercel deployment URL
    const baseUrl = 'https://your-app-name.vercel.app';
    
    try {
        console.log('Testing Production API endpoints...');
        console.log('Base URL:', baseUrl);
        
        // Test health endpoint
        console.log('\n1. Testing /health endpoint:');
        const healthResponse = await fetch(`${baseUrl}/health`);
        console.log('Status:', healthResponse.status);
        if (healthResponse.ok) {
            const healthData = await healthResponse.text();
            console.log('✅ Health check passed');
        } else {
            console.log('❌ Health check failed');
            const errorText = await healthResponse.text();
            console.log('Error:', errorText.substring(0, 500));
        }
        
        // Test sessions endpoint (GET)
        console.log('\n2. Testing /api/chat/sessions endpoint (GET):');
        const sessionsResponse = await fetch(`${baseUrl}/api/chat/sessions`);
        console.log('Status:', sessionsResponse.status);
        
        if (sessionsResponse.ok) {
            const sessionsData = await sessionsResponse.json();
            console.log('✅ Sessions GET successful');
            console.log('Sessions count:', sessionsData.data?.length || 0);
        } else {
            console.log('❌ Sessions GET failed');
            const errorData = await sessionsResponse.json().catch(() => sessionsResponse.text());
            console.log('Error:', JSON.stringify(errorData, null, 2));
        }
        
        // Test sessions endpoint (POST)
        console.log('\n3. Testing /api/chat/sessions endpoint (POST):');
        const postResponse = await fetch(`${baseUrl}/api/chat/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: '+1234567890',
                language: 'en'
            })
        });
        console.log('Status:', postResponse.status);
        
        if (postResponse.ok) {
            const postData = await postResponse.json();
            console.log('✅ Sessions POST successful');
            console.log('New session ID:', postData.data?.sessionId);
        } else {
            console.log('❌ Sessions POST failed');
            const errorData = await postResponse.json().catch(() => postResponse.text());
            console.log('Error:', JSON.stringify(errorData, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Error testing production API:', error.message);
    }
}

// Instructions
console.log('🚀 Production API Test Script');
console.log('📝 Instructions:');
console.log('1. Update the baseUrl variable with your actual Vercel deployment URL');
console.log('2. Run: node test-production.js');
console.log('\n' + '='.repeat(50) + '\n');

// Uncomment the line below after updating the baseUrl
// testProductionAPI();

console.log('⚠️  Please update the baseUrl in this script before running the test.');