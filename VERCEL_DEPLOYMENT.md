# Vercel Deployment Guide for HealthGrid AI Triage

This guide will help you deploy your HealthGrid AI Triage application to Vercel with MySQL database support.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, or Bitbucket)
3. **MySQL Database**: Ensure your MySQL database is accessible from the internet

## Step-by-Step Deployment

### 1. Prepare Your Repository

Ensure your project has the following files (already configured):
- `vercel.json` - Vercel configuration
- `tsconfig.json` - TypeScript configuration for Node.js
- `.env.vercel` - Environment variables template

### 2. Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### 3. Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Configure the project:
   - **Framework Preset**: Other
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

#### Option B: Deploy via CLI

```bash
# Login to Vercel
vercel login

# Deploy from your project directory
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (select your account)
# - Link to existing project? No
# - Project name: healthgrid-ai-triage
# - Directory: ./
```

### 4. Configure Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add the following variables (use values from `.env.vercel`):

```
DB_CONNECTION=mysql
DB_HOST=77.37.35.61
DB_PORT=3306
DB_DATABASE=u280643084_healthgrid
DB_USERNAME=u280643084_healthgrid
DB_PASSWORD=HealthGrid@123
GUPSHUP_API_KEY=your_gupshup_api_key_here
GUPSHUP_SOURCE_NUMBER=your_whatsapp_number_here
GUPSHUP_WEBHOOK_URL=https://your-vercel-app.vercel.app/api/webhook
GROQ_API_KEY=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
NODE_ENV=production
PORT=3000
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-d9fa83f2df36d966fb105c796d131c27-X
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-b7923bccb00fd6598a02e3f38c9df846-X
BASE_URL=https://your-vercel-app.vercel.app
```

**Important**: Replace `your-vercel-app` with your actual Vercel app name.

### 5. Update Webhook URLs

After deployment, update your webhook URLs:

1. **Gupshup Webhook**: Update `GUPSHUP_WEBHOOK_URL` to your Vercel app URL
2. **Flutterwave Webhook**: Configure in Flutterwave dashboard

### 6. Database Setup

Ensure your MySQL database:
1. **Is accessible from the internet** (not localhost)
2. **Allows connections from Vercel's IP ranges**
3. **Has the required tables** (run your setup scripts)

### 7. Test Your Deployment

1. Visit your Vercel app URL
2. Test the API endpoints:
   - `GET /` - Health check
   - `POST /api/ai-chat` - AI chat functionality
   - `POST /api/webhook` - Webhook handler

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify database credentials in environment variables
   - Ensure database allows external connections
   - Check firewall settings

2. **Build Errors**
   - Check TypeScript compilation errors
   - Verify all dependencies are installed
   - Review build logs in Vercel dashboard

3. **Environment Variables Not Working**
   - Ensure variables are set in Vercel dashboard
   - Redeploy after adding new variables
   - Check variable names match exactly

### Logs and Monitoring

- **Build Logs**: Available in Vercel dashboard during deployment
- **Function Logs**: Real-time logs in Vercel dashboard
- **Error Tracking**: Monitor errors in Vercel's Functions tab

## Production Considerations

1. **Database Security**
   - Use strong passwords
   - Restrict database access to necessary IPs
   - Enable SSL connections if available

2. **API Keys**
   - Keep API keys secure
   - Rotate keys regularly
   - Use production keys for live deployment

3. **Monitoring**
   - Set up alerts for database connectivity
   - Monitor API response times
   - Track error rates

## Support

If you encounter issues:
1. Check Vercel function logs
2. Verify database connectivity
3. Test API endpoints individually
4. Review environment variable configuration

---

**Your HealthGrid AI Triage application is now ready for production on Vercel!**