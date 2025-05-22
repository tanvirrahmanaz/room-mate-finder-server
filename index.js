const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const { ObjectId } = require('mongodb'); 

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


  // POST route to add new room listing
  app.post('/rooms', async (req, res) => {
    try {
      const roomData = req.body;

      // Basic validation (optional)
      if (!roomData.title || !roomData.location || !roomData.rentAmount) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const result = await roomsCollection.insertOne(roomData);
      res.status(201).json({ message: 'Room listing added', insertedId: result.insertedId });
    } catch (error) {
      console.error('Error adding room:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });


  app.get('/rooms', async (req, res) => {
    const email = req.query.email;
    const filter = email ? { userEmail: email } : {};
    const rooms = await roomsCollection.find(filter).toArray();
    res.send(rooms);
  });

  app.delete('/rooms/:id', async (req, res) => {
    const id = req.params.id;
    const result = await roomsCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  });



  app.get('/rooms/available', async (req, res) => {
    const rooms = await roomsCollection.find({ availability: true }).limit(6).toArray();
    res.send(rooms);
  });

  app.put('/rooms/:id', async (req, res) => {
  const id = req.params.id;
  const { _id, ...updatedData } = req.body; // Prevent _id from being updated

  try {
    const result = await roomsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );
    res.send(result);
  } catch (error) {
    console.error('Update failed:', error);
    res.status(500).send({ message: 'Update failed' });
  }
});

  app.get('/rooms/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const room = await roomsCollection.findOne({ _id: new ObjectId(id) });

    if (!room) {
      return res.status(404).send({ message: 'Room not found' });
    }

    res.send(room);
  } catch (error) {
    console.error('Error fetching room by ID:', error);
    res.status(500).send({ message: 'Server error' });
  }
});

}

// Start the MongoDB connection and server
run().catch(console.dir);

// Start the Express server
app.listen(port, () => {
  console.log(`Room Mate Finder server is running on http://localhost:${port}`);
});