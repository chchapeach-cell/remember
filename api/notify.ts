import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const vapidKeys = {
  publicKey: 'BI34U_bCSxQ6M8lxrlutHEzb26YuO-mI-bkT5d_CpCeUFW7AbA2mSfAW_QwETVl46bpnbgEMm1XvSwJYFi5ONwE',
  privateKey: 'OSitgAiR8uJoY3gcuharxqwQ4gPrq_FvYVUiNFfPQ00'
};

webpush.setVapidDetails(
  'mailto:support@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, title, body, targetUserId } = req.body;
    const displayTitle = title || "ภารกิจผู้บริหาร";
    const displayBody = message || body;
    
    if (!displayBody) {
      return res.status(400).json({ error: "Message or body is required" });
    }

    // Load firebase config
    let firebaseConfig: any = {};
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const configRaw = fs.readFileSync(configPath, "utf8");
        firebaseConfig = JSON.parse(configRaw);
      } else {
        console.warn("firebase-applet-config.json not found in", configPath);
      }
    } catch (e) {
      console.warn("Could not load firebase config in vercel function", e);
    }

    if (!firebaseConfig.projectId || !firebaseConfig.firestoreDatabaseId) {
      return res.status(500).json({ error: "Firebase config missing" });
    }

    // Initialize Firebase client SDK
    let dbFirebase: any = null;
    try {
      let app;
      if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApp();
      }
      dbFirebase = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    } catch (e) {
      console.warn("Could not initialize Firebase client SDK in vercel function", e);
    }

    // Fetch users from Firestore using client SDK
    let users: any[] = [];
    if (dbFirebase) {
      try {
        const snap = await getDocs(collection(dbFirebase, "users"));
        snap.forEach(doc => {
          users.push({ id: doc.id, ...doc.data() });
        });
      } catch (e) {
        console.warn("Could not fetch users from Firestore using client SDK", e);
      }
    }

    const payload = JSON.stringify({
      title: displayTitle,
      body: displayBody,
      icon: "https://krustation.com/wp-content/uploads/2026/03/logo-obec-1.jpg"
    });

    let sentCount = 0;
    let errorCount = 0;

    // Broadcast to all users' subscriptions
    for (const user of users) {
      // If targetUserId is provided, only send to that user
      if (targetUserId && user.id !== targetUserId) {
        continue;
      }

      const subs = user.pushSubscriptions;
      if (Array.isArray(subs)) {
        for (const sub of subs) {
          try {
            if (sub) {
              const subscription = typeof sub === "string" ? JSON.parse(sub) : sub;
              await webpush.sendNotification(subscription, payload);
              sentCount++;
            }
          } catch (error: any) {
            console.error("Error sending push notification to a device", error.statusCode);
            errorCount++;
          }
        }
      }
    }

    res.status(200).json({ success: true, sent: sentCount, errors: errorCount });
  } catch (error: any) {
    console.error("Error sending push notifications:", error);
    res.status(500).json({ success: false, error: "Failed to send notifications" });
  }
}
