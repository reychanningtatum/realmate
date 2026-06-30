const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();
const PORT = 8080;
const DB_FILE = './database.json';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 🤖 DATA PERSISTENCE HELPERS
function loadData() {
    try {
        if (!fs.existsSync(DB_FILE)) return [];
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error loading database:", e);
        return [];
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error saving database:", e);
    }
}

let allListings = loadData();

// 🤖 ELASTIC AI ENGINE
function analyzeListing(text) {
    const locations = ["bgc", "makati", "pasig", "alabang", "ortigas", "nuvali", "cavite", "taguig"];
    const lowerText = text.toLowerCase();
    
    let foundUnit = null;
    if (lowerText.match(/1\s?br|1\s?bedroom|one\s?bedroom/)) foundUnit = "1BR";
    else if (lowerText.match(/2\s?br|2\s?bedroom|two\s?bedroom/)) foundUnit = "2BR";
    else if (lowerText.match(/3\s?br|3\s?bedroom|three\s?bedroom/)) foundUnit = "3BR";
    else if (lowerText.includes("studio")) foundUnit = "STUDIO";

    let price = null;
    const priceMatch = lowerText.match(/(\d+\.?\d*)\s?m/); 
    if (priceMatch) {
        price = parseFloat(priceMatch[1]) * 1000000;
    } else {
        const rawPrice = lowerText.replace(/,/g, '').match(/\d{6,}/); 
        if (rawPrice) price = parseFloat(rawPrice[0]);
    }

    let foundLoc = locations.find(loc => lowerText.includes(loc)) || null;

    return {
        location: foundLoc,
        unit: foundUnit,
        price: price
    };
}

app.post('/api/posts', (req, res) => {
    const newPost = req.body;
    if (!newPost.id) newPost.id = Date.now();

    const newAnalysis = analyzeListing(newPost.text);
    
    const matches = allListings.filter(oldPost => {
        const partnerMap = {
            "FOR SALE": "WILLING TO BUY", 
            "WILLING TO BUY": "FOR SALE",
            "FOR LEASE": "WILLING TO LEASE", 
            "WILLING TO LEASE": "FOR LEASE",
            "FOR RENT": "WILLING TO RENT", 
            "WILLING TO RENT": "FOR RENT"
        };

        const oldAnalysis = analyzeListing(oldPost.text);
        const isPartner = oldPost.category === partnerMap[newPost.category];
        const locationMatch = newAnalysis.location && oldAnalysis.location === newAnalysis.location;
        const unitMatch = newAnalysis.unit && oldAnalysis.unit === newAnalysis.unit;
        
        let priceMatch = true; 
        if (newAnalysis.price && oldAnalysis.price) {
            const ratio = Math.max(newAnalysis.price, oldAnalysis.price) / Math.min(newAnalysis.price, oldAnalysis.price);
            priceMatch = ratio <= 1.25; 
        }

        return isPartner && locationMatch && unitMatch && priceMatch && oldPost.userName !== newPost.userName;
    });

    console.log(`\n🤖 AI ENGINE ANALYSIS:`);
    console.log(`👤 User: ${newPost.userName} | ✅ Matches Found: ${matches.length}`);

    allListings.unshift(newPost);
    saveData(allListings); // Save to database.json
    
    res.status(201).json({ 
        message: "Analysis Complete", 
        matchCount: matches.length,
        matches: matches 
    });
});

app.get('/api/posts', (req, res) => {
    res.json(allListings);
});

app.delete('/api/posts/:id', (req, res) => {
    const targetId = Number(req.params.id);
    const initialLength = allListings.length;
    
    allListings = allListings.filter(p => Number(p.id) !== targetId);
    saveData(allListings); // Purge from database.json
    
    if (allListings.length < initialLength) {
        console.log(`🗑️ GLOBAL PURGE: Removed Post ID ${targetId}.`);
        res.json({ message: "Deleted from global memory and file" });
    } else {
        res.status(404).json({ message: "Post not found" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Persistent AI Server active on http://localhost:${PORT}`);
});