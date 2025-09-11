# Gupshup WhatsApp Business API Setup Guide

This guide will walk you through setting up the Gupshup WhatsApp Business API for the HealthGrid AI Triage system.

## Prerequisites

1. **WhatsApp Business Account**: You need a verified WhatsApp Business account
2. **Facebook Business Manager**: Access to Facebook Business Manager
3. **Phone Number**: A dedicated phone number for your WhatsApp Business account
4. **Business Verification**: Your business should be verified by Meta/Facebook

## Step 1: Create Gupshup Account

1. Visit [Gupshup.io](https://www.gupshup.io/)
2. Click "Sign Up" and create your account
3. Verify your email address
4. Complete your business profile information

## Step 2: WhatsApp Business API Setup

### 2.1 Apply for WhatsApp Business API

1. Log into your Gupshup dashboard
2. Navigate to "WhatsApp" section
3. Click "Get Started" or "Apply for WhatsApp Business API"
4. Fill out the application form with:
   - Business name
   - Business category (Healthcare/Medical)
   - Business description
   - Website URL
   - Business registration documents

### 2.2 Phone Number Registration

1. Provide your dedicated business phone number
2. Verify the phone number via SMS/call
3. **Important**: This number will be permanently associated with WhatsApp Business API
4. You cannot use this number for regular WhatsApp after registration

### 2.3 Business Verification

1. Upload required business documents:
   - Business registration certificate
   - Tax identification documents
   - Proof of address
2. Wait for Meta's business verification (can take 1-7 days)

## Step 3: Get API Credentials

Once approved:

1. Go to your Gupshup dashboard
2. Navigate to "WhatsApp" → "Settings"
3. Copy your credentials:
   - **API Key**: Your unique API key
   - **Source Number**: Your WhatsApp Business number
   - **App Name**: Your application identifier

## Step 4: Configure Webhook

### 4.1 Set Webhook URL

1. In Gupshup dashboard, go to "WhatsApp" → "Settings"
2. Set webhook URL to: `https://your-domain.com/api/webhook`
3. For local development: `https://your-ngrok-url.ngrok.io/api/webhook`

### 4.2 Webhook Events

Enable these webhook events:
- `message` - Incoming messages
- `message-event` - Message status updates
- `user-event` - User interactions

## Step 5: Environment Configuration

Update your `.env` file:

```env
# Gupshup Configuration
GUPSHUP_API_KEY=your_actual_api_key_here
GUPSHUP_SOURCE_NUMBER=your_whatsapp_business_number
GUPSHUP_WEBHOOK_URL=https://your-domain.com/api/webhook
```

## Step 6: Message Templates

### 6.1 Create Message Templates

WhatsApp requires pre-approved templates for business-initiated conversations:

1. Go to Gupshup dashboard → "Templates"
2. Create templates for:
   - Welcome message
   - Appointment confirmations
   - Prescription notifications
   - Health reminders

### 6.2 Template Examples

**Welcome Template:**
```
Welcome to HealthGrid AI Triage! 🏥

I'm your AI health assistant. I can help you with:
✅ Health symptom assessment
✅ Find nearby hospitals
✅ Book appointments
✅ Prescription management

Type 'help' to get started!
```

**Appointment Confirmation:**
```
🏥 Appointment Confirmed

Doctor: {{1}}
Date: {{2}}
Time: {{3}}
Location: {{4}}

Please arrive 15 minutes early.
Reply CANCEL to cancel this appointment.
```

## Step 7: Testing Setup

### 7.1 Local Development with ngrok

1. Install ngrok: `npm install -g ngrok`
2. Start your local server: `npm run dev`
3. In another terminal: `ngrok http 5173`
4. Copy the HTTPS URL and update webhook in Gupshup

### 7.2 Test Messages

1. Send a test message to your WhatsApp Business number
2. Check your application logs for incoming webhook
3. Verify response is sent back to WhatsApp

## Step 8: Production Deployment

### 8.1 Domain Setup

1. Deploy your application to a production server
2. Ensure HTTPS is enabled
3. Update webhook URL in Gupshup dashboard

### 8.2 Rate Limits

Be aware of WhatsApp Business API limits:
- **Messaging**: 1000 business-initiated conversations per day (initially)
- **Rate Limiting**: 80 messages per second
- **Template Messages**: Limited based on quality rating

## Step 9: Compliance & Best Practices

### 9.1 Healthcare Compliance

- **HIPAA Compliance**: Ensure patient data protection
- **Data Encryption**: Use HTTPS for all communications
- **Consent**: Get explicit consent before storing health data
- **Privacy Policy**: Update privacy policy to include WhatsApp data usage

### 9.2 WhatsApp Policies

- Follow WhatsApp Business Policy
- Don't send spam or promotional messages
- Respond to user messages within 24 hours
- Use approved message templates for business-initiated conversations

## Troubleshooting

### Common Issues

1. **Webhook not receiving messages**:
   - Check webhook URL is accessible
   - Verify HTTPS certificate
   - Check firewall settings

2. **Messages not sending**:
   - Verify API credentials
   - Check message format
   - Ensure templates are approved

3. **Business verification rejected**:
   - Ensure all documents are clear and valid
   - Business name should match registration documents
   - Provide additional documentation if requested

### Support Resources

- [Gupshup Documentation](https://docs.gupshup.io/)
- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- [Gupshup Support](https://help.gupshup.io/)

## Cost Considerations

- **Conversation-based pricing**: ~$0.005-0.009 per conversation
- **Template messages**: Additional charges may apply
- **Free tier**: Usually includes limited conversations per month

## Next Steps

After completing this setup:

1. Test the integration thoroughly
2. Create additional message templates
3. Implement error handling and logging
4. Set up monitoring and analytics
5. Plan for scaling based on user adoption

---

**Note**: This process can take 1-2 weeks due to business verification requirements. Plan accordingly for your project timeline.