// REST API Server (rest-api-server.js)
import express from "express";
import pkg from "pg";
import axios from "axios";
const { Client } = pkg;
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

// Express endpoint to add an incident
app.post("/api/sms", async (req, res) => {
  const data = req.body;
  const house_no = String(data.house_no);

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

    const image_url =
      "https://www.dkiservices.com/wp-content/uploads/2020/02/Is-Food-Safe-to-Eat-After-a-Fire_.jpg";

    // Insert data into the notifications table
    await pgClient.query(
      `INSERT INTO reports (house_no, owner, coordinates, image_url, date_and_time_recorded) 
             VALUES ($1, $2, $3, $4, NOW())`,
      [house_no, owner, coordinates, image_url]
    );

    // Insert data into the notifications table
    await pgClient.query(
      `INSERT INTO notifications (house_no, owner, coordinates, image_url, date_and_time_recorded) 
         VALUES ($1, $2, $3, $4, NOW())`,
      [house_no, owner, coordinates, image_url]
    );

    // Send notification to WebSocket server
    const message = JSON.stringify({ house_no, coordinates, owner, image_url });
    console.log({message})
    await axios.post("https://websocket-server-14gk.onrender.com/notify", {
      message,
    });
   
    res.status(200).json({ message: "Data inserted successfully" });
  } catch (error) {
    // console.error("Error inserting data:", error);
    res.status(500).json({ message: "Reports creation failed", error });
  }
});

app.listen(PORT, () => {
  console.log(`REST API server running on port ${PORT}`);
});
