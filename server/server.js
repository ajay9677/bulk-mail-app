require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const emailRoutes = require("./routes/emailRoutes");

const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const app = express();
const PORT = process.env.PORT || 5000;

if (
  !process.env.MONGO_URI ||
  !process.env.GMAIL_USER ||
  !process.env.GMAIL_APP_PASSWORD
) {
  console.error("Missing required environment variables in .env");
  process.exit(1);
}

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));

app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => {
  res.json({ message: "Bulk Mail API is running." });
});

// Start Google OAuth
app.get("/auth/google", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.send"
    ]
  });

  res.redirect(authUrl);
});

// Google OAuth callback
app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Authorization code missing.");
    }

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return res.status(400).send(
        "Refresh token missing. Re-authorize Google account."
      );
    }

    console.log("Refresh token received successfully.");

    res.send(
      "Google authorization successful! Refresh token received. Store it securely on the server."
    );

  } catch (error) {
    console.error("OAuth error:", error.message);
    res.status(500).send("Google authorization failed.");
  }
});


app.use("/api/emails", emailRoutes);

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully.");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

startServer();