import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import fs from "fs";

// Load firebase config
let firebaseConfig: any = {};
try {
  const configRaw = fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8");
  firebaseConfig = JSON.parse(configRaw);
} catch (e) {
  console.warn("Could not load firebase config", e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // LINE OA Notification API
  app.post("/api/notify", async (req, res) => {
    try {
      const { message, lineUserId } = req.body;
      
      let token = process.env.LINE_OA_ACCESS_TOKEN?.trim();

      // Fetch from Firestore if not in env
      if (!token && firebaseConfig.projectId && firebaseConfig.firestoreDatabaseId) {
        try {
          const firestoreRes = await axios.get(`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/settings/line_oa`);
          if (firestoreRes.data && firestoreRes.data.fields && firestoreRes.data.fields.token) {
            token = firestoreRes.data.fields.token.stringValue.trim();
          }
        } catch (e) {
          console.warn("Could not fetch token from Firestore", e);
        }
      }

      if (!token) {
        console.warn("LINE_OA_ACCESS_TOKEN is not configured.");
        return res.status(200).json({ success: true, message: "LINE token not configured, skipping notification." });
      }

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // If lineUserId is provided, push to specific user, else broadcast
      // For simplicity, we'll use broadcast if no user is provided.
      // Note: Broadcasting uses a different endpoint than pushing to a specific user.
      const endpoint = lineUserId 
        ? "https://api.line.me/v2/bot/message/push"
        : "https://api.line.me/v2/bot/message/broadcast";

      const payload: any = {
        messages: [{ type: "text", text: message }]
      };

      if (lineUserId) {
        payload.to = lineUserId;
      }

      const response = await axios.post(endpoint, payload, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      res.status(200).json({ success: true, data: response.data });
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error("LINE Notification Error: Authentication failed. Please check if your LINE Channel Access Token is valid in the Settings page.");
      } else {
        console.error("Error sending LINE notification:", error.response?.data || error.message);
      }
      res.status(200).json({ success: false, error: "Failed to send LINE notification due to invalid token or API error" });
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
