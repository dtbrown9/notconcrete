# Supabase Setup Guide

## Step 1: Create Supabase Account
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with email (or GitHub/Google)
4. Verify your email

## Step 2: Create a New Project
1. In the dashboard, click "New Project"
2. Choose a project name (e.g., "NotConcrete")
3. Create a strong password (save this for later)
4. Select your preferred region (closest to you)
5. Click "Create new project"
6. Wait 2-3 minutes for the database to initialize

## Step 3: Get Connection String
1. Once the project is created, go to **Settings** → **Database**
2. Look for the connection string section
3. Choose **URI** tab (not Connection Pooler initially)
4. Copy the full connection string

## Step 4: Extract Database URL
The connection string looks like:
```
postgresql://postgres:[YOUR_PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres
```

Replace `[YOUR_PASSWORD]` with the password you created, and use the full string.

## Step 5: Update .env.local
Open `.env.local` in this project and replace the DATABASE_URL:
```
DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres
NODE_ENV=development
```

## Step 6: Test Connection
Run: `npx tsx test-supabase.ts`

If connection works, you'll see:
```
✅ Connected to Supabase!
✅ Database is responsive
```

## Step 7: Initialize Database Schema
The schema will be created automatically on the first API call.

## Troubleshooting

### Connection Refused or ENOTFOUND
- Check that `[YOUR_PASSWORD]` is correct (no special characters issue)
- Check that `[PROJECT_ID]` is correct from the URL
- Wait a few more minutes for project initialization

### "Too many connections"
- Use Connection Pooler instead of direct URI in settings

## Done! 🎉
Your app will now use Supabase for persistent data storage.
