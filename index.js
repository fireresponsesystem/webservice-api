// REST API Server (rest-api-server.js)
import express from "express";
import pkg from "pg";
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
    // Fetch account information and insert into database
    // ...

    // Send notification to WebSocket server
    const message = JSON.stringify({ house_no, coordinates, owner, image_url });
    await axios.post("http://localhost:80/notify", { message });

    res.status(200).json({ message: "Data inserted successfully" });
  } catch (error) {
    console.error("Error inserting data:", error);
    res.status(500).json({ message: "Reports creation failed" });
  }
});

app.listen(PORT, () => {
  console.log(`REST API server running on port ${PORT}`);
});
