#!/usr/bin/env node
const https = require('https');

// These values must match your Firebase config EXACTLY
const envVars = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyACd1FEPB7AlmbPPhs4qG_nn-naEZqSKtIM",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "business-ai-assistant-bc6b6.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "business-ai-assistant-bc6b6",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "business-ai-assistant-bc6b6.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1061030245654",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1061030245654:web:ab62529168c791d69bcc37"
};

const projectId = "adhco0543s-projects/business-ai-assistant";

// Use Vercel token from environment or prompt user
const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error("ERROR: Set VERCEL_TOKEN environment variable first");
  console.error("Get it from: https://vercel.com/account/tokens");
  process.exit(1);
}

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vercel.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    if (body) {
      const json = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(json);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function fixEnvVars() {
  console.log('Fixing Firebase env variables in Vercel...\n');

  for (const [name, value] of Object.entries(envVars)) {
    try {
      // Delete existing var if it exists
      console.log(`Deleting old ${name}...`);
      const listRes = await request('GET', `/v9/projects/${projectId}/env`);
      const existing = listRes.body.envs?.find(e => e.key === name && e.target === 'production');
      
      if (existing) {
        await request('DELETE', `/v10/projects/${projectId}/env/${existing.id}?target=production`);
      }

      // Add fresh var without newlines
      console.log(`Adding clean ${name}...`);
      const res = await request('POST', `/v10/projects/${projectId}/env`, {
        key: name,
        value: value,
        target: ['production']
      });

      if (res.status === 200 || res.status === 201) {
        console.log(`✓ ${name} set successfully\n`);
      } else {
        console.log(`✗ Failed to set ${name}: ${res.status}`);
        console.log(res.body);
        console.log();
      }
    } catch (err) {
      console.error(`Error handling ${name}:`, err);
    }
  }

  console.log('\n✓ All env vars updated! Now run: vercel --prod');
}

fixEnvVars().catch(console.error);
