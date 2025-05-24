const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const { ObjectId } = require('mongodb'); 

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['https://room-mate-finderbd.web.app/'], // your frontend domain
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // if you use cookies/auth
}));

app.use(express.json());

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
let database, roomsCollection, usersCollection, likesCollection;

// JWT verification middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Initialize MongoDB connection
async function connectDB() {
  try {
    if (!database) {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      console.log("Connected to MongoDB!");
      
      // Initialize collections
      database = client.db("roomMateFinder");
      roomsCollection = database.collection("rooms");
      usersCollection = database.collection("users");
      likesCollection = database.collection("likes");
    }
    return true;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    return false;
  }
}

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Room Mate Finder API is running!' });
});

// Debug route
app.get('/debug', (req, res) => {
  res.json({ 
    message: 'Debug route working',
    env: {
      hasDBUser: !!process.env.DB_USER,
      hasDBPass: !!process.env.DB_PASS,
      nodeEnv: process.env.NODE_ENV
    }
  });
});

// POST route to add new room listing
app.post('/rooms', async (req, res) => {
  try {
    await connectDB();
    
    const roomData = {
      ...req.body,
      likeCount: 0,
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
app.get('/rooms', verifyToken, async (req, res) => {
  try {
    console.log('GET /rooms called');
    
    const connected = await connectDB();
    if (!connected) {
      return res.status(500).json({ message: 'Database connection failed' });
    }
    
    console.log('Database connected, fetching rooms...');
    
    const email = req.query.email;
    const filter = email ? { userEmail: email } : {};
    const rooms = await roomsCollection.find(filter).toArray();
    
    console.log(`Found ${rooms.length} rooms`);
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ 
      message: 'Internal Server Error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// DELETE room
app.delete('/rooms/:id', async (req, res) => {
  try {
    await connectDB();
    
    const id = req.params.id;
    
    await likesCollection.deleteMany({ roomId: id });
    const result = await roomsCollection.deleteOne({ _id: new ObjectId(id) });
    res.json(result);
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET available rooms
app.get('/rooms/available', async (req, res) => {
  try {
    await connectDB();
    
    const rooms = await roomsCollection.find({ availability: true }).limit(6).toArray();
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// UPDATE room
app.put('/rooms/:id', async (req, res) => {
  try {
    await connectDB();
    
    const id = req.params.id;
    const { _id, ...updatedData } = req.body;

    const result = await roomsCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: {
          ...updatedData,
          updatedAt: new Date()
        }
      }
    );
    res.json(result);
  } catch (error) {
    console.error('Update failed:', error);
    res.status(500).json({ message: 'Update failed' });
  }
});

// GET single room by ID
app.get('/rooms/:id', async (req, res) => {
  try {
    await connectDB();
    
    const id = req.params.id;
    const room = await roomsCollection.findOne({ _id: new ObjectId(id) });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json(room);
  } catch (error) {
    console.error('Error fetching room by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// LIKE a room (POST)
app.post('/rooms/:id/like', verifyToken, async (req, res) => {
  try {
    await connectDB();
    
    const roomId = req.params.id;
    const userId = req.user.id || req.user.email;
    const forceMultiple = req.query.force === 'true';
    
    const room = await roomsCollection.findOne({ _id: new ObjectId(roomId) });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    const isOwner = (
      userId === room.ownerId || 
      userId === room.userId || 
      userId === room.userUid || 
      userId === room.createdBy ||
      userId === room.owner?.uid ||
      userId === room.owner?.id ||
      userId === room.userEmail ||
      req.user.email === room.userEmail
    );
    
    if (isOwner) {
      return res.status(400).json({ message: 'You cannot like your own room posting' });
    }
    
    if (forceMultiple) {
      await likesCollection.insertOne({
        roomId: roomId,
        userId: userId,
        createdAt: new Date()
      });
      
      await roomsCollection.updateOne(
        { _id: new ObjectId(roomId) },
        { $inc: { likeCount: 1 } }
      );
      
      const updatedRoom = await roomsCollection.findOne({ _id: new ObjectId(roomId) });
      
      return res.json({ 
        message: 'Room liked successfully',
        likeCount: updatedRoom.likeCount,
        hasLiked: true
      });
    }
    
    const existingLike = await likesCollection.findOne({
      roomId: roomId,
      userId: userId
    });
    
    if (existingLike) {
      return res.status(400).json({ message: 'You have already liked this room' });
    }
    
    await likesCollection.insertOne({
      roomId: roomId,
      userId: userId,
      createdAt: new Date()
    });
    
    await roomsCollection.updateOne(
      { _id: new ObjectId(roomId) },
      { $inc: { likeCount: 1 } }
    );
    
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
    await connectDB();
    
    const roomId = req.params.id;
    const userId = req.user.id || req.user.email;
    
    const room = await roomsCollection.findOne({ _id: new ObjectId(roomId) });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    const isOwner = (
      userId === room.ownerId || 
      userId === room.userId || 
      userId === room.userUid || 
      userId === room.createdBy ||
      userId === room.owner?.uid ||
      userId === room.owner?.id ||
      userId === room.userEmail ||
      req.user.email === room.userEmail
    );
    
    if (isOwner) {
      return res.status(400).json({ message: 'You cannot unlike your own room posting' });
    }
    
    const existingLike = await likesCollection.findOne({
      roomId: roomId,
      userId: userId
    });
    
    if (!existingLike) {
      return res.status(400).json({ message: 'You have not liked this room' });
    }
    
    await likesCollection.deleteOne({
      roomId: roomId,
      userId: userId
    });
    
    await roomsCollection.updateOne(
      { _id: new ObjectId(roomId) },
      { $inc: { likeCount: -1 } }
    );
    
    const updatedRoom = await roomsCollection.findOne({ _id: new ObjectId(roomId) });
    res.json({ 
      message: 'Room unliked successfully',
      likeCount: Math.max(0, updatedRoom.likeCount),
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
    await connectDB();
    
    const roomId = req.params.id;
    const userId = req.user.id || req.user.email;
    
    const existingLike = await likesCollection.findOne({
      roomId: roomId,
      userId: userId
    });
    
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

// GET all users who liked a specific room
app.get('/rooms/:id/likes', verifyToken, async (req, res) => {
  try {
    await connectDB();
    
    const roomId = req.params.id;
    
    const likes = await likesCollection.aggregate([
      { $match: { roomId: roomId } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "email",
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

// For Vercel serverless function
module.exports = app;