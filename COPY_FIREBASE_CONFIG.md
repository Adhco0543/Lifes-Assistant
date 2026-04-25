# Copy Firebase Config Values - Step by Step

**If you're stuck on getting Firebase config values, follow this exactly.**

---

## Where to Find Your Firebase Config

### You're in Firebase Console
You should already have your Firebase project open at:
```
https://console.firebase.google.com
```

If not, open it now.

---

## Finding the Config Values

### Step 1: Project Settings
1. Look at **top right corner**
2. Find the ⚙️ **gear icon** (settings)
3. Click it
4. You'll see a dropdown menu
5. Click **Project settings**

---

### Step 2: Find Your App Config
1. You're now in Project Settings page
2. Scroll **down** on this page (keep scrolling)
3. You'll see a section called **"Your apps"**
4. Look for an icon that looks like **`</>`** (code brackets)
5. Next to it says **"Web"** or **"businessassistant"**
6. Click the **Config** button next to it

---

### Step 3: See Your Config Values
You'll now see a code block that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDgVF...",
  authDomain: "business-ai-assistant.firebaseapp.com",
  projectId: "business-ai-assistant",
  storageBucket: "business-ai-assistant.appspot.com",
  messagingSenderId: "123456789123",
  appId: "1:123456789123:web:abc123def456"
};
```

---

## What to Copy

**Open a text file (Notepad) and write down these 6 values:**

### Value 1: apiKey
**Find this line in your config:**
```
apiKey: "AIzaSyDgVF..."
```

**Copy the part in quotes:** `AIzaSyDgVF...`

**Write in text file:**
```
NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSyDgVF...
```

---

### Value 2: authDomain
**Find this line:**
```
authDomain: "business-ai-assistant.firebaseapp.com"
```

**Copy:** `business-ai-assistant.firebaseapp.com`

**Write in text file:**
```
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = business-ai-assistant.firebaseapp.com
```

---

### Value 3: projectId
**Find this line:**
```
projectId: "business-ai-assistant"
```

**Copy:** `business-ai-assistant`

**Write in text file:**
```
NEXT_PUBLIC_FIREBASE_PROJECT_ID = business-ai-assistant
```

---

### Value 4: storageBucket
**Find this line:**
```
storageBucket: "business-ai-assistant.appspot.com"
```

**Copy:** `business-ai-assistant.appspot.com`

**Write in text file:**
```
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = business-ai-assistant.appspot.com
```

---

### Value 5: messagingSenderId
**Find this line:**
```
messagingSenderId: "123456789123"
```

**Copy:** `123456789123`

**Write in text file:**
```
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 123456789123
```

---

### Value 6: appId
**Find this line:**
```
appId: "1:123456789123:web:abc123def456"
```

**Copy:** `1:123456789123:web:abc123def456`

**Write in text file:**
```
NEXT_PUBLIC_FIREBASE_APP_ID = 1:123456789123:web:abc123def456
```

---

## Your Text File Should Now Look Like

```
NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSyDgVF...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = business-ai-assistant.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID = business-ai-assistant
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = business-ai-assistant.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 123456789123
NEXT_PUBLIC_FIREBASE_APP_ID = 1:123456789123:web:abc123def456
```

**Keep this text file open** - you'll paste these into Vercel next

---

## Next Step

Go to: https://vercel.com/dashboard

Follow the **Vercel Setup** section in `START_HERE.md`

Paste each value into Vercel Environment Variables.

---

## Stuck?

**Can't find Project Settings?**
→ Click the ⚙️ gear in top right corner of Firebase console

**Can't find "Your apps"?**
→ Scroll down on the Project Settings page

**Can't find the Config button?**
→ Look for `</>` icon, click **Config** next to it

**Values look different?**
→ That's normal - each project has unique values
→ Copy whatever you see (the values will be different for you)

---

**Got all 6 values?** → Go to Vercel and add them!
