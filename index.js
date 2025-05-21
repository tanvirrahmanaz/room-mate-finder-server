const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Debug environment variables
console.log("DB_USER:", process.env.DB_USER);
// Don't log DB_PASS in production for security reasons

// MongoDB Connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xlzkxri.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // Add these options to handle SSL/TLS issues
  ssl: true,
  tls: true,
  tlsAllowInvalidCertificates: true, // For development only, remove in production
  // This option may help with older Node.js versions
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Database collections
const database = client.db("roomMateFinder");
const roomsCollection = database.collection("rooms");
const usersCollection = database.collection("users");

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
    // Set up API routes that use the database
    setupRoutes();
    
  } catch (error) {
    console.error("MongoDB connection error:", error);
    // Don't close the client on error, just log it
  }
}

function setupRoutes() {
  // Base route
  app.get('/', (req, res) => {
    res.send('Room Mate Finder API is running!');
  });
  
  
}

// Start the MongoDB connection and server
run().catch(console.dir);

// Start the Express server
app.listen(port, () => {
  console.log(`Room Mate Finder server is running on http://localhost:${port}`);
});