require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const cors = require('cors'); 

const app = express();

// --- CONFIGURATION ---
const uri = process.env.MONGO_URI; 
const port = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use((req, res, next) => {
    // Logger
    console.log(`[${new Date().toISOString()}] ${req.method} request to ${req.url}`);
    next();
});

app.use(cors());
app.use(express.json());
app.use('/images', express.static(path.join(__dirname, 'images')));


// --- MONGODB CONNECTION ---
let db;
MongoClient.connect(uri)
    .then(client => {
        db = client.db('hubsy'); 
        console.log('Connected to MongoDB');
    })
    .catch(err => console.error(err));


// --- ROUTES ---

// 1. GET All Lessons
app.get('/api/lessons', async (req, res) => {
    try {
        const lessons = await db.collection('lessons').find({}).toArray();
        res.json(lessons);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. SEARCH Route
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q; 
        const results = await db.collection('lessons').find({
            $or: [
                { title: { $regex: query, $options: 'i' } },
                { location: { $regex: query, $options: 'i' } }
            ]
        }).toArray();
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. POST New Order
app.post('/api/orders', async (req, res) => {
    try {
        const order = req.body;
        const result = await db.collection('orders').insertOne(order);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. PUT Update Spaces (THE FIX IS HERE)
app.put('/api/lessons/:id', async (req, res) => {
    try {
        const { spaces } = req.body;
        const rawId = req.params.id;

        // Debug Log: See exactly what the server receives
        console.log(`Attempting to update lesson ${rawId} to ${spaces} spaces...`);

        let result;
        
        // Strategy A: Try with ObjectId (Standard MongoDB)
        try {
            const objectId = new ObjectId(rawId);
            result = await db.collection('lessons').updateOne(
                { _id: objectId },
                { $set: { spaces: parseInt(spaces) } } // Ensure number
            );
        } catch (e) {
            // Convert failed (ID is likely a string), ignore and try Strategy B
            result = { matchedCount: 0 };
        }

        // Strategy B: Try with String ID (Imported Data)
        if (result.matchedCount === 0) {
            console.log(`ObjectId failed. Trying String ID for ${rawId}...`);
            result = await db.collection('lessons').updateOne(
                { _id: rawId }, // Search as plain string
                { $set: { spaces: parseInt(spaces) } }
            );
        }

        console.log(`Update Result: Matched ${result.matchedCount}, Modified ${result.modifiedCount}`);

        res.json({ message: 'Spaces updated', result });
    } catch (err) {
        console.error("PUT Error:", err);
        res.status(500).json({ message: err.message });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});