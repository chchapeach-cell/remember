import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import fs from "fs";
import webpush from "web-push";

// Load firebase config
let firebaseConfig: any = {};
try {
  const configRaw = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
  firebaseConfig = JSON.parse(configRaw);
} catch (e) {
  console.warn("Could not load firebase config", e);
}

// Fixed VAPID Keys for this applet (generated once)
const vapidKeys = {
  publicKey: 'BI34U_bCSxQ6M8lxrlutHEzb26YuO-mI-bkT5d_CpCeUFW7AbA2mSfAW_QwETVl46bpnbgEMm1XvSwJYFi5ONwE',
  privateKey: 'OSitgAiR8uJoY3gcuharxqwQ4gPrq_FvYVUiNFfPQ00'
};

webpush.setVapidDetails(
  'mailto:support@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Web Push VAPID Public Key
  app.get("/api/vapidPublicKey", (req, res) => {
    res.send(vapidKeys.publicKey);
  });

  // Web Push Notification API
  app.post("/api/notify", async (req, res) => {
    try {
      const { message, title, body, targetUserId } = req.body;
      const displayTitle = title || "ภารกิจผู้บริหาร";
      const displayBody = message || body;
      
      if (!displayBody) {
        return res.status(400).json({ error: "Message or body is required" });
      }

      if (!firebaseConfig.projectId || !firebaseConfig.firestoreDatabaseId) {
        return res.status(500).json({ error: "Firebase config missing" });
      }

      // Fetch users from Firestore
      let users = [];
      try {
        const apiKeyParam = firebaseConfig.apiKey ? `?key=${firebaseConfig.apiKey}` : "";
        const headers: Record<string, string> = {};
        if (req.headers.authorization) {
          headers["Authorization"] = req.headers.authorization;
        }
        const firestoreRes = await axios.get(
          `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users${apiKeyParam}`,
          { headers }
        );
        if (firestoreRes.data && firestoreRes.data.documents) {
          users = firestoreRes.data.documents;
        }
      } catch (e) {
        console.warn("Could not fetch users from Firestore", e);
      }

      const payload = JSON.stringify({
        title: displayTitle,
        body: displayBody,
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
              // Note: Normally we'd remove expired subscriptions here
            }
          }
        }
      }

      res.status(200).json({ success: true, sent: sentCount, errors: errorCount });
    } catch (error: any) {
      console.error("Error sending push notifications:", error);
      res.status(500).json({ success: false, error: "Failed to send notifications" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
