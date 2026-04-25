# Firebase & API Key Setup Checklist

## 🔑 Gather Your Values

Use this checklist to collect all the environment variables you need for Vercel.

---

## Step 1: Get OpenAI API Key (5 minutes)

- [ ] Go to https://platform.openai.com/api/keys
- [ ] Click **+ Create new secret key**
- [ ] Name it "Business AI Assistant"
- [ ] Copy the key (starts with `sk-`)
- [ ] Paste here: `NEXT_PUBLIC_OPENAI_API_KEY = ____________________________`

**Save this file - you'll need it for Vercel!**

---

## Step 2: Create Firebase Project (10 minutes)

### 2a. Create Project
- [ ] Go to https://firebase.google.com
- [ ] Click **Get Started**
- [ ] Click **Create a project**
- [ ] Enter name: `business-ai-assistant`
- [ ] Click **Continue**
- [ ] Disable Google Analytics (optional)
- [ ] Click **Create project**
- [ ] Wait for creation to finish (~1 min)

### 2b. Create Firestore Database
- [ ] Click **Build** (left sidebar)
- [ ] Click **Firestore Database**
- [ ] Click **Create database**
- [ ] Select **Start in test mode** (for development)
- [ ] Choose region closest to you
- [ ] Click **Create**

### 2c. Enable Authentication
- [ ] In **Build** menu, click **Authentication**
- [ ] Click **Get started**
- [ ] Find **Email/Password** provider
- [ ] Click it → Toggle ON
- [ ] Click **Save**

### 2d. Get Configuration

Now get your Firebase config values:

- [ ] Click **Project Settings** (⚙️ gear icon, top right)
- [ ] Scroll down to **Your apps** section
- [ ] Find the web app (looks like `</>`), click **Config**
- [ ] Copy all values below:

```
NEXT_PUBLIC_FIREBASE_API_KEY = ____________________________

NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = ____________________________

NEXT_PUBLIC_FIREBASE_PROJECT_ID = ____________________________

NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = ____________________________

NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = ____________________________

NEXT_PUBLIC_FIREBASE_APP_ID = ____________________________
```

---

## Step 3: Add to Vercel

Once you have all values above:

1. [ ] Go to https://vercel.com/dashboard
2. [ ] Click your project: **business-ai-assistant**
3. [ ] Click **Settings** tab
4. [ ] Click **Environment Variables** (left sidebar)
5. [ ] Add each variable:
   - [ ] `NEXT_PUBLIC_OPENAI_API_KEY`
   - [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
   - [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`

6. [ ] **Save** each one
7. [ ] Wait for Vercel to redeploy (watch **Deployments** tab)

---

## Step 4: Test It Works

Once redeployed:

- [ ] Visit your Vercel deployment URL
- [ ] Click **Sign Up**
- [ ] Create account with test email
- [ ] Type test message
- [ ] See AI response (takes 2-3 seconds)
- [ ] Reload page → message still there ✅
- [ ] Open in new tab → see same conversation ✅

---

## Troubleshooting

**"Firebase not initialized"**
→ Check all Firebase env variables are in Vercel
→ Restart deployment

**"API error"**
→ Verify API key is correct
→ Check it has credits/usage left

**"Messages not saving"**
→ Check Firestore database exists
→ Check authentication is enabled

---

**Done? You're all set!** 🎉
