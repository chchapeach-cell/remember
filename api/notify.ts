import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, targetUserId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
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

    // Fetch users from Firestore REST API
    let users = [];
    try {
      const firestoreRes = await axios.get(
        `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users`
      );
      if (firestoreRes.data && firestoreRes.data.documents) {
        users = firestoreRes.data.documents;
      }
    } catch (e) {
      console.warn("Could not fetch users from Firestore", e);
    }

    const payload = JSON.stringify({
      title: "ภารกิจผู้บริหาร",
      body: message,
      icon: "https://krustation.com/wp-content/uploads/2026/03/logo-obec-1.jpg"
    });

    let sentCount = 0;
    let errorCount = 0;

    // Broadcast to all users' subscriptions
    for (const userDoc of users) {
      const fields = userDoc.fields;
      if (fields && fields.pushSubscriptions && fields.pushSubscriptions.arrayValue && fields.pushSubscriptions.arrayValue.values) {
        
        // If targetUserId is provided, only send to that user
        const userIdParts = userDoc.name.split('/');
        const docUserId = userIdParts[userIdParts.length - 1];
        if (targetUserId && docUserId !== targetUserId) {
          continue;
        }

        const subs = fields.pushSubscriptions.arrayValue.values;
        for (const sub of subs) {
          try {
            if (sub.stringValue) {
              const subscription = JSON.parse(sub.stringValue);
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
