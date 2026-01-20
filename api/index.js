import "dotenv/config";
import express from "express";
import { getJson } from "serpapi";

const app = express();

// Use .get for specific routes
app.get("/search.json", async (req, res) => {
    try {
        // 1. Initial Google Lens call
        getJson({
            q: `where's this location,preference=${req.query.preference || ''}`,
            engine: "google_lens",
            url: req.query.url,
            api_key: process.env.SERP_AI,
            no_cache: true // Necessary to get a valid token
        }, async (lensJson) => {
            res.json(lensJson);
        });
        
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
});

export default app;