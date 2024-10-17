// REST API Server (rest-api-server.js)
import express from "express";
import pkg from "pg";
import { google } from "googleapis"; // Import the Google API client
const { Client } = pkg;
import WebSocket from "ws"; // Import the WebSocket library

const app = express();
const PORT = 3001;

// Middleware to parse JSON requests
app.use(express.json());

// PostgreSQL client setup
const pgClient = new Client({
  connectionString:
    "postgres://default:Jg3NV6QuMzfq@ep-restless-hill-14773517-pooler.us-east-1.aws.neon.tech:5432/verceldb?sslmode=require",
});

// Connect to PostgreSQL
pgClient
  .connect()
  .then(() => {
    console.log("Connected to PostgreSQL");
  })
  .catch((err) => {
    console.error("Error connecting to PostgreSQL:", err);
  });

// const websocketURL = "ws://localhost:3002"; // Replace with your WebSocket server URL
const websocketURL = "wss://websocket-server-14gk.onrender.com"; // Replace with your WebSocket server URL
const websocketClient = new WebSocket(websocketURL);

websocketClient.on("open", () => {
  console.log("Connected to WebSocket server");
});

websocketClient.on("error", (error) => {
  console.error("WebSocket error:", error);
});

// Google Drive API setup
const drive = google.drive({
  version: "v3",
  auth: "AIzaSyBK_OP36g4Qn-EtfTfyXJgeMC_N7-aj7Xo", // Replace with your actual API key or OAuth credentials
});

// Function to extract folder ID from the URL
function extractFolderId(url) {
  const regex = /\/folders\/([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Function to get the first image from Google Drive folder
async function getFirstImageUrl(folderId) {
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/'`,
      orderBy: "createdTime", // Order by creation time in ascending order
      pageSize: 1, // Get the first image
      fields: "files(id, name, mimeType)",
    });

    const files = res.data.files;
    if (files.length > 0) {
      const file = files[0];
      let imageUrl = `https://drive.usercontent.google.com/download?id=${file.id}&export=view&authuser=0`;
      // Remove any trailing backslashes or spaces
      imageUrl = imageUrl.replace(/\\$/, ""); // Remove trailing backslash

      return imageUrl;
    }

    return null;
  } catch (error) {
    console.error("Error fetching first image from Google Drive:", error);
    return null;
  }
}

// Express endpoint to add an incident
app.post("/api/sms", async (req, res) => {
  const data = req.body;
  const house_no = String(data.house_no);
  const folderUrl = String(data.image_url);
  const date = new Date();

  const folderId = extractFolderId(folderUrl);
  if (!folderId) {
    return res.status(400).json({ message: "Invalid Google Drive folder URL" });
  }

  try {
    // Fetch account information based on the house number (use parameterized query)
    const result = await pgClient.query(
      `SELECT coordinates, owner FROM accounts WHERE house_no = $1`,
      [house_no]
    );

    // Check if any account was found
    if (result.rows.length === 0) {
      return res.status(400).json({
        message: `There is no existing account with house id ${house_no}`,
      });
    }

    const { coordinates, owner } = result.rows[0];

    // Fetch the latest image from the Google Drive folder
    const image_url = await getFirstImageUrl(folderId);
    if (!image_url) {
      return res.status(500).json({
        message: "Failed to retrieve the latest image from Google Drive",
      });
    }

    // const image_url =
    //   "https://www.dkiservices.com/wp-content/uploads/2020/02/Is-Food-Safe-to-Eat-After-a-Fire_.jpg";
    // Insert data into the notifications table
    await pgClient.query(
      `INSERT INTO reports (house_no, owner, coordinates, image_url, date_and_time_recorded) 
             VALUES ($1, $2, $3, $4, ${date.toUTCString()})`,
      [house_no, owner, coordinates, image_url]
    );

    // Insert data into the notifications table
    await pgClient.query(
      `INSERT INTO notifications (house_no, owner, coordinates, image_url, date_and_time_recorded)
         VALUES ($1, $2, $3, $4,  ${date.toUTCString()})`,
      [house_no, owner, coordinates, image_url]
    );

    //   // Send notification to WebSocket server
    const message = JSON.stringify({
      house_no,
      coordinates,
      owner,
      image_url,
    });

    //   await axios.post("https://websocket-server-14gk.onrender.com/notify", {
    //     message,
    //   });

    // Send message over WebSocket connection
    if (websocketClient.readyState === WebSocket.OPEN) {
      websocketClient.send(
        JSON.stringify({ type: "data_inserted", data: message })
      );
    } else {
      console.error("WebSocket is not open. Message not sent.");
    }

    res.status(200).json({
      message: "Data inserted successfully",
      data: message,
      image_url,
    });
  } catch (error) {
    console.error("Error inserting data:", error);
    res.status(500).json({ message: "Reports creation failed", error });
  }
});

app.listen(PORT, () => {
  console.log(`REST API server running on port ${PORT}`);
});
