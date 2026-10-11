const express = require("express");
const mongoose = require("mongoose");
const { google } = require("googleapis");
const Email = require("../models/Email");

const router = express.Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({
  version: "v1",
  auth: oauth2Client,
});

function encodeEmail(to, subject, body) {
  const message = [
    `From: ${process.env.GMAIL_USER}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64url");
}

// Send bulk email
router.post("/send", async (req, res) => {
  const { subject, body, recipients } = req.body;

  if (
    typeof subject !== "string" ||
    !subject.trim() ||
    typeof body !== "string" ||
    !body.trim() ||
    !Array.isArray(recipients) ||
    recipients.length === 0
  ) {
    return res.status(400).json({
      message: "Subject, body and recipients are required.",
    });
  }

  const cleanRecipients = recipients.map((email) =>
    typeof email === "string"
      ? email.trim().toLowerCase()
      : ""
  );

  if (
    cleanRecipients.length > 50 ||
    cleanRecipients.some((email) => !emailPattern.test(email))
  ) {
    return res.status(400).json({
      message: "Enter valid email addresses (maximum 50).",
    });
  }

  const uniqueRecipients = [...new Set(cleanRecipients)];

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: "Database is not connected.",
    });
  }

  let record;

  try {
    record = await Email.create({
      subject: subject.trim(),
      body: body.trim(),
      recipients: uniqueRecipients,
      status: "pending",
    });
  } catch (error) {
    console.error("Database error:", error.message);

    return res.status(500).json({
      message: "Could not save email history.",
    });
  }

  let sentCount = 0;
  const errors = [];

  for (const recipient of uniqueRecipients) {
    try {
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodeEmail(
            recipient,
            subject.trim(),
            body.trim()
          ),
        },
      });

      sentCount++;
    } catch (error) {
      console.error(
        "Gmail API send failed:",
        error.message
      );

      errors.push(`Failed to send to ${recipient}.`);
    }
  }

  const failedCount = uniqueRecipients.length - sentCount;

  record.sentCount = sentCount;
  record.failedCount = failedCount;
  record.errors = errors;

  record.status =
    failedCount === 0
      ? "sent"
      : sentCount === 0
        ? "failed"
        : "partial";

  try {
    await record.save();
  } catch (error) {
    console.error("History update failed:", error.message);

    return res.status(500).json({
      message: "Email attempts finished, but history update failed.",
      sentCount,
      failedCount,
    });
  }

  return res.json({
    message: "Email sending process completed.",
    status: record.status,
    total: uniqueRecipients.length,
    sentCount,
    failedCount,
    historyId: record._id,
  });
});

// Get email history
router.get("/history", async (req, res) => {
  try {
    const history = await Email.find()
      .select("-body -errors")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json(history);
  } catch (error) {
    console.error("History error:", error.message);

    return res.status(500).json({
      message: "Could not fetch email history.",
    });
  }
});

module.exports = router;