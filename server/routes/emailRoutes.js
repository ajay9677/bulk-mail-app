const express = require("express");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const Email = require("../models/Email");

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      message: "Subject, body and recipients are required."
    });
  }

  const cleanRecipients = recipients.map((email) =>
    typeof email === "string" ? email.trim().toLowerCase() : ""
  );

  if (
    cleanRecipients.length > 50 ||
    cleanRecipients.some((email) => !emailPattern.test(email))
  ) {
    return res.status(400).json({
      message: "Enter valid email addresses (maximum 50 recipients)."
    });
  }

  const uniqueRecipients = [...new Set(cleanRecipients)];

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: "Database is not connected."
    });
  }

  let record;

  try {
    record = await Email.create({
      subject: subject.trim(),
      body: body.trim(),
      recipients: uniqueRecipients,
      status: "pending"
    });
  } catch (error) {
    console.error("Could not save email record:", error.message);
    return res.status(500).json({
      message: "Could not save the email record."
    });
  }

  let sentCount = 0;
  const errors = [];

  // Send separately so recipients do not see each other's addresses.
  for (const recipient of uniqueRecipients) {
    try {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: recipient,
        subject: subject.trim(),
        text: body.trim()
      });

      sentCount++;
    } catch (error) {
      console.error(`Email attempt failed for ${recipient}:`, error.message);
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
    console.error("Could not update email history:", error.message);

    return res.status(500).json({
      message: "Sending attempts finished, but history could not be updated.",
      sentCount,
      failedCount
    });
  }

  return res.status(200).json({
    message:
      failedCount === 0
        ? "All email sending requests completed successfully."
        : sentCount === 0
          ? "All email sending requests failed."
          : "Some email sending requests succeeded and others failed.",
    status: record.status,
    total: uniqueRecipients.length,
    sentCount,
    failedCount,
    historyId: record._id
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

    res.json(history);
  } catch (error) {
    console.error("History error:", error.message);

    res.status(500).json({
      message: "Could not fetch email history."
    });
  }
});

module.exports = router;