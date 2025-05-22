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

// MongoDB Connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xlzkxri.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  ssl: true,
  tls: true,
  tlsAllowInvalidCertificates: true,
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Database collections
const database = client.db("roomMateFinder");
const roomsCollection = database.collection("rooms");
const usersCollection = database.collection("users");
const likesCollection = database.collection("likes"); // New collection for likes

// JWT verification middleware (basic - you might want to use jsonwebtoken library)
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  // For now, we'll just decode the token manually (you should use proper JWT verification)
  try {
    // This is a simplified version - in production, use proper JWT verification
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    setupRoutes();
  } catch (error) {
    console.error("MongoDB connection error:", error);
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
      const roomData = {
        ...req.body,
        likeCount: 0, // Initialize like count
        createdAt: new Date()
      };

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

  // GET all rooms
  app.get('/rooms', async (req, res) => {
    try {
      const email = req.query.email;
      const filter = email ? { userEmail: email } : {};
      const rooms = await roomsCollection.find(filter).toArray();
      res.send(rooms);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // DELETE room
  app.delete('/rooms/:id', async (req, res) => {
    try {
      const id = req.params.id;
      
      // Also delete all likes for this room
      await likesCollection.deleteMany({ roomId: id });
      
      const result = await roomsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    } catch (error) {
      console.error('Error deleting room:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // GET available rooms
  app.get('/rooms/available', async (req, res) => {
    try {
      const rooms = await roomsCollection.find({ availability: true }).limit(6).toArray();
      res.send(rooms);
    } catch (error) {
      console.error('Error fetching available rooms:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // UPDATE room
  app.put('/rooms/:id', async (req, res) => {
    const id = req.params.id;
    const { _id, ...updatedData } = req.body;

    try {
      const result = await roomsCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: {
            ...updatedData,
            updatedAt: new Date()
          }
        }
      );
      res.send(result);
    } catch (error) {
      console.error('Update failed:', error);
      res.status(500).send({ message: 'Update failed' });
    }
  });

  // GET single room by ID
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

  // LIKE a room (POST)
  app.post('/rooms/:id/like', verifyToken, async (req, res) => {
    try {
      const roomId = req.params.id;
      const userId = req.user.id || req.user.email; // Use user ID or email from token

      // Check if user already liked this room
      const existingLike = await likesCollection.findOne({
        roomId: roomId,
        userId: userId
      });

      if (existingLike) {
        return res.status(400).json({ message: 'You have already liked this room' });
      }

      // Add like to likes collection
      await likesCollection.insertOne({
        roomId: roomId,
        userId: userId,
        createdAt: new Date()
      });

      // Update room's like count
      const result = await roomsCollection.updateOne(
        { _id: new ObjectId(roomId) },
        { $inc: { likeCount: 1 } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Room not found' });
      }

      // Get updated room data
      const updatedRoom = await roomsCollection.findOne({ _id: new ObjectId(roomId) });

      res.json({ 
        message: 'Room liked successfully',
        likeCount: updatedRoom.likeCount,
        hasLiked: true
      });

    } catch (error) {
      console.error('Error liking room:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // UNLIKE a room (DELETE)
  app.delete('/rooms/:id/like', verifyToken, async (req, res) => {
    try {
      const roomId = req.params.id;
      const userId = req.user.id || req.user.email;

      // Check if user has liked this room
      const existingLike = await likesCollection.findOne({
        roomId: roomId,
        userId: userId
      });

      if (!existingLike) {
        return res.status(400).json({ message: 'You have not liked this room' });
      }

      // Remove like from likes collection
      await likesCollection.deleteOne({
        roomId: roomId,
        userId: userId
      });

      // Update room's like count
      const result = await roomsCollection.updateOne(
        { _id: new ObjectId(roomId) },
        { $inc: { likeCount: -1 } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Room not found' });
      }

      // Get updated room data
      const updatedRoom = await roomsCollection.findOne({ _id: new ObjectId(roomId) });

      res.json({ 
        message: 'Room unliked successfully',
        likeCount: Math.max(0, updatedRoom.likeCount), // Ensure count doesn't go below 0
        hasLiked: false
      });

    } catch (error) {
      console.error('Error unliking room:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // CHECK if user has liked a room
  app.get('/rooms/:id/like-status', verifyToken, async (req, res) => {
    try {
      const roomId = req.params.id;
      const userId = req.user.id || req.user.email;

      const existingLike = await likesCollection.findOne({
        roomId: roomId,
        userId: userId
      });

      // Get room's current like count
      const room = await roomsCollection.findOne({ _id: new ObjectId(roomId) });

      res.json({
        hasLiked: !!existingLike,
        likeCount: room ? room.likeCount || 0 : 0
      });

    } catch (error) {
      console.error('Error checking like status:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // GET all users who liked a specific room (for room owner)
  app.get('/rooms/:id/likes', verifyToken, async (req, res) => {
    try {
      const roomId = req.params.id;

      // Get all likes for this room with user details
      const likes = await likesCollection.aggregate([
        { $match: { roomId: roomId } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "email", // or "_id" depending on your user ID structure
            as: "userDetails"
          }
        },
        {
          $project: {
            userId: 1,
            createdAt: 1,
            userDetails: { $arrayElemAt: ["$userDetails", 0] }
          }
        }
      ]).toArray();

      res.json(likes);

    } catch (error) {
      console.error('Error fetching likes:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
}

// Start the MongoDB connection and server
run().catch(console.dir);

// Start the Express server
app.listen(port, () => {
  console.log(`Room Mate Finder server is running on http://localhost:${port}`);
});