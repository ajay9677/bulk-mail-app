require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const emailRoutes = require("./routes/emailRoutes");

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