# Cloudflare Pages Deployment Guide

## Overview
This guide explains how to deploy the HealthGrid webapp to Cloudflare Pages with proper API routing.

## Files Created for Cloudflare Pages

### 1. `public/_routes.json`
Configures routing for Cloudflare Pages:
- Includes `/api/*` routes for server-side functions
- Excludes `/static/*` for static file serving

### 2. `functions/api/[[path]].ts`
Cloudflare Pages Function that handles all API routes:
- Uses dynamic routing with `[[path]]` to catch all API requests
- Imports and uses the Hono app from `src/index`

### 3. `wrangler.toml`
Cloudflare configuration file:
- Sets Node.js compatibility
- Configures build command
- Sets up environment variables

## Deployment Steps

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
```

### 2. Login to Cloudflare
```bash
wrangler login
```

### 3. Create Cloudflare Pages Project
```bash
wrangler pages project create healthgrid-webapp
```

### 4. Deploy to Cloudflare Pages
```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=healthgrid-webapp
```

### 5. Set Environment Variables
In Cloudflare Dashboard > Pages > healthgrid-webapp > Settings > Environment Variables:

```
NODE_ENV=production
MYSQL_HOST=your-mysql-host
MYSQL_USER=your-mysql-user
MYSQL_PASSWORD=your-mysql-password
MYSQL_DATABASE=your-mysql-database
GUPSHUP_APP_NAME=your-gupshup-app
GUPSHUP_API_KEY=your-gupshup-key
FLUTTERWAVE_PUBLIC_KEY=your-flutterwave-public-key
FLUTTERWAVE_SECRET_KEY=your-flutterwave-secret-key
```

## Key Differences from Vercel

1. **Routing**: Uses `_routes.json` instead of `vercel.json`
2. **Functions**: Uses `functions/` directory instead of `api/`
3. **Dynamic Routes**: Uses `[[path]].ts` syntax for catch-all routes
4. **Configuration**: Uses `wrangler.toml` instead of `vercel.json`

## Troubleshooting

### API Routes Not Found (404)
- Ensure `public/_routes.json` includes `/api/*`
- Verify `functions/api/[[path]].ts` exists and exports `onRequest`
- Check that the build output includes the functions directory

### Environment Variables
- Set all required environment variables in Cloudflare Dashboard
- Ensure Node.js compatibility is enabled in `wrangler.toml`

### Build Issues
- Make sure `npm run build` works locally
- Check that `dist/` directory contains the built files
- Verify `wrangler.toml` has correct build configuration

## Testing

After deployment, test the API endpoints:
```bash
# Replace with your Cloudflare Pages URL
curl https://your-app.pages.dev/api/health
curl https://your-app.pages.dev/api/chat/sessions
```

## Notes

- Cloudflare Pages automatically builds and deploys when you push to your connected Git repository
- The `[[path]]` syntax captures all sub-paths under `/api/`
- Static files are served directly from the `dist/` directory
- Functions run in Cloudflare's edge runtime with Node.js compatibility