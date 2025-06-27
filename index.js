const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors({
    origin: ['http://localhost:5173', 'https://room-mate-finderbd.web.app'],
    credentials: true
}));
app.use(express.json());

// --- MongoDB Connection ---
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xlzkxri.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

// --- Database Connection and Collection Initialization ---
// This pattern connects once and reuses the connection, which is efficient.
const db = client.db("roomMateFinder");
const roomsCollection = db.collection("rooms");
const likesCollection = db.collection("likes");


// --- INSECURE "verifyToken" Middleware ---
// This middleware is for development and does not verify the token signature.
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = {}; // Provide an empty user object
        return next();
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        req.user = payload;
        next();
    } catch (error) {
        req.user = {};
        next();
    }
};


// --- API Routes ---
app.get('/', (req, res) => res.json({ message: 'Room Mate Finder API is running!' }));

// GET all rooms for public Browse
app.get('/rooms/all', async (req, res) => {
    try {
        const rooms = await roomsCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.json(rooms);
    } catch (error) {
        console.error('Error in /rooms/all:', error);
        res.status(500).json({ message: 'Error fetching all rooms' });
    }
});

// GET available rooms (public)
app.get('/rooms/available', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 8;
        const rooms = await roomsCollection.find({ availability: true }).limit(limit).toArray();
        res.json(rooms);
    } catch (error) {
        console.error('Error in /rooms/available:', error);
        res.status(500).json({ message: 'Error fetching available rooms' });
    }
});

// GET rooms by user email (for dashboard)
app.get('/rooms', verifyToken, async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ message: "Email query parameter is required." });
        if (req.user.email !== email) return res.status(403).json({ message: "Forbidden" });

        const rooms = await roomsCollection.find({ userEmail: email }).toArray();
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET a single room by ID
app.get('/rooms/:id', async (req, res) => {
    try {
      const room = await roomsCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!room) return res.status(404).json({ message: 'Room not found' });
      res.json(room);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
});

// POST a new room listing
app.post('/rooms', verifyToken, async (req, res) => {
    try {
        const roomData = { ...req.body, userEmail: req.user.email, likeCount: 0, createdAt: new Date() };
        if (!roomData.title || !roomData.location) return res.status(400).json({ message: 'Missing required fields' });
        const result = await roomsCollection.insertOne(roomData);
        res.status(201).json({ message: 'Room listing added', insertedId: result.insertedId });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// UPDATE a room listing
app.put('/rooms/:id', verifyToken, async (req, res) => {
    try {
        const { _id, ...updatedData } = req.body;
        const result = await roomsCollection.updateOne(
            { _id: new ObjectId(req.params.id), userEmail: req.user.email },
            { $set: { ...updatedData, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ message: 'Room not found or you are not the owner.' });
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Update failed' });
    }
});

// DELETE a room listing
app.delete('/rooms/:id', verifyToken, async (req, res) => {
    try {
        const id = req.params.id;
        const result = await roomsCollection.deleteOne({ _id: new ObjectId(id), userEmail: req.user.email });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Room not found or you are not the owner.' });
        await likesCollection.deleteMany({ roomId: id });
        res.json({ message: 'Room deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Like/Unlike Routes ---
app.post('/rooms/:id/like', verifyToken, async (req, res) => {
    try {
        const roomId = req.params.id;
        const userId = req.user.email;
        if (!userId) return res.status(401).json({ message: "User not authenticated." });
        await likesCollection.insertOne({ roomId, userId, createdAt: new Date() });
        const updateResult = await roomsCollection.findOneAndUpdate({ _id: new ObjectId(roomId) }, { $inc: { likeCount: 1 } }, { returnDocument: 'after' });
        res.json({ message: 'Room liked', likeCount: updateResult.likeCount, hasLiked: true });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.delete('/rooms/:id/like', verifyToken, async (req, res) => {
    try {
        const roomId = req.params.id;
        const userId = req.user.email;
        if (!userId) return res.status(401).json({ message: "User not authenticated." });
        await likesCollection.deleteOne({ roomId, userId });
        const updateResult = await roomsCollection.findOneAndUpdate({ _id: new ObjectId(roomId) }, { $inc: { likeCount: -1 } }, { returnDocument: 'after' });
        res.json({ message: 'Room unliked', likeCount: Math.max(0, updateResult.likeCount), hasLiked: false });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/rooms/:id/like-status', verifyToken, async (req, res) => {
    try {
        const roomId = req.params.id;
        const userId = req.user.email;
        if (!userId) return res.json({ hasLiked: false, likeCount: 0 });
        const existingLike = await likesCollection.findOne({ roomId, userId });
        const room = await roomsCollection.findOne({ _id: new ObjectId(roomId) });
        res.json({ hasLiked: !!existingLike, likeCount: room?.likeCount || 0 });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/user/likes/:email', verifyToken, async (req, res) => {
    try {
        const userEmail = req.params.email;
        if (req.user.email !== userEmail) return res.status(403).json({ message: 'Forbidden' });
        const likedEntries = await likesCollection.find({ userId: userEmail }).sort({ createdAt: -1 }).toArray();
        const roomIds = likedEntries.map(like => { try { return new ObjectId(like.roomId) } catch { return null } }).filter(Boolean);
        if (roomIds.length === 0) return res.json([]);
        const likedRooms = await roomsCollection.find({ _id: { $in: roomIds } }).toArray();
        const sortedLikedRooms = likedEntries.map(like => likedRooms.find(room => room._id.toString() === like.roomId)).filter(Boolean);
        res.json(sortedLikedRooms);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- Server Start Function ---
async function startServer() {
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB!");
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error("Failed to connect to MongoDB and start server:", error);
    }
}

startServer();

module.exports = app;