# Add Environment Variables to Vercel - Step by Step

**Follow this exactly to add your Firebase and OpenAI keys to Vercel.**

---

## Before You Start

**Have these ready in a text file:**

```
NEXT_PUBLIC_OPENAI_API_KEY = sk-...
NEXT_PUBLIC_FIREBASE_API_KEY = AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = business-ai-assistant.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID = business-ai-assistant
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = business-ai-assistant.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 123456789
NEXT_PUBLIC_FIREBASE_APP_ID = 1:123456789:web:abc123
```

(If you don't have these, go back to Firebase/OpenAI and copy them)

---

## Go to Vercel

1. Open: https://vercel.com/dashboard
2. You should see your projects list
3. **Click on:** `business-ai-assistant` (your project)

---

## Open Settings

Once you're in the project:

1. Look at the **top navigation bar**
2. Find: **Settings** tab
3. Click it

---

## Find Environment Variables

In Settings page:

1. Look at the **left sidebar**
2. Find: **Environment Variables**
3. Click it

You should now see a section that says:
```
Environment Variables
Add new variable
```

---

## Add Each Variable (One at a Time)

### Variable 1: NEXT_PUBLIC_OPENAI_API_KEY

1. Click **"Add"** or **"Add new variable"** button
2. **Name field:** Type exactly:
   ```
   NEXT_PUBLIC_OPENAI_API_KEY
   ```
3. **Value field:** Paste your OpenAI key (starts with `sk-`)
   ```
   sk-proj-abc123...
   ```
4. Click **"Save"** or **"Add"**

---

### Variable 2: NEXT_PUBLIC_FIREBASE_API_KEY

1. Click **"Add"** again
2. **Name:** `NEXT_PUBLIC_FIREBASE_API_KEY`
3. **Value:** `AIza...` (from Firebase config)
4. Click **"Save"**

---

### Variable 3: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN

1. Click **"Add"** again
2. **Name:** `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
3. **Value:** `business-ai-assistant.firebaseapp.com` (from Firebase config)
4. Click **"Save"**

---

### Variable 4: NEXT_PUBLIC_FIREBASE_PROJECT_ID

1. Click **"Add"** again
2. **Name:** `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
3. **Value:** `business-ai-assistant` (from Firebase config)
4. Click **"Save"**

---

### Variable 5: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET

1. Click **"Add"** again
2. **Name:** `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
3. **Value:** `business-ai-assistant.appspot.com` (from Firebase config)
4. Click **"Save"**

---

### Variable 6: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID

1. Click **"Add"** again
2. **Name:** `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
3. **Value:** `123456789` (from Firebase config - the messagingSenderId number)
4. Click **"Save"**

---

### Variable 7: NEXT_PUBLIC_FIREBASE_APP_ID

1. Click **"Add"** again
2. **Name:** `NEXT_PUBLIC_FIREBASE_APP_ID`
3. **Value:** `1:123456789:web:abc123` (from Firebase config - the appId)
4. Click **"Save"**

---

## Verify All 7 Added

After adding all 7, you should see a list:

```
✓ NEXT_PUBLIC_OPENAI_API_KEY
✓ NEXT_PUBLIC_FIREBASE_API_KEY
✓ NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
✓ NEXT_PUBLIC_FIREBASE_PROJECT_ID
✓ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
✓ NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
✓ NEXT_PUBLIC_FIREBASE_APP_ID
```

**If you see all 7 → Vercel is now redeploying!** ✅

---

## Wait for Redeploy

1. Go to **Deployments** tab (in your project)
2. Watch for a new deployment to start
3. It should show progress (building... → ready)
4. Takes 2-5 minutes

Once it shows **✅ Ready** → Your app is live with the new variables!

---

## Test Your Deployment

Once redeployed:

1. Visit your Vercel deployment URL (top of dashboard)
2. You should see your app loading
3. Click **Sign Up**
4. Create account with test email + password
5. Type: "Hello, can you help me?"
6. Wait 2-3 seconds...
7. See AI response ✅

**If you see an AI response → Everything works!**

---

## Troubleshooting

**"Environment variable not found" error**
→ Verify all 7 variables were added
→ Check spelling is EXACT (copy-paste from this guide)
→ Wait 2 more minutes for redeploy to complete

**"Firebase not initialized" error**
→ Check all 6 Firebase variables are correct
→ Verify you copied them from Firebase config exactly
→ Wait for redeploy to complete

**"API error"**
→ Check OpenAI API key starts with `sk-`
→ Verify key is correct (compare with OpenAI dashboard)
→ Check your OpenAI account has free credits left

**App still shows old version**
→ Hard refresh: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)
→ Clear browser cache
→ Wait 1 more minute for cache to clear

---

## That's It!

Your app is now:
- ✅ Deployed on Vercel
- ✅ Connected to Firebase
- ✅ Connected to OpenAI
- ✅ Running with real AI

**Next:** Tell your users to sign up and start using it! 🎉

---

## Questions?

Refer to:
- `START_HERE.md` - Full deployment guide
- `FREE_SETUP_NO_COST.md` - Pricing info
- `COPY_FIREBASE_CONFIG.md` - Firebase config values
