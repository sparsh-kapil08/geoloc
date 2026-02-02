import "dotenv/config";
import express from "express";
import { getJson } from "serpapi";

const app = express();

// Use .get for specific routes
app.get("/search.json", async (req, res) => {
    try {
        // 1. Initial Google Lens call
        getJson({
            q: `what is this place,preference=${req.query.preference || ''}`,
            engine: "google_lens",
            url: req.query.url,
            api_key: process.env.SERP_AI,
            no_cache: true, // Necessary to get a valid token
            timeout: 60000 
        }, async (lensJson) => {
            const token=lensJson.ai_overview?.page_token;
            getJson({
                engine: "google_ai_overview",
                page_token: token,
                api_key: process.env.SERP_AI,
                no_cache: true,
                timeout: 20000 // 20-second timeout in milliseconds
            }, (overviewJson) => {
                res.json({...lensJson, ai_overview: overviewJson.ai_overview});
            })

        });
        
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
});

export default app;