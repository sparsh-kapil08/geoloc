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

            // 2. Check for the page_token immediately
            const token = lensJson.ai_overview?.page_token;

            if (token) {
                // 3. INTERNAL SECOND CALL (Beating the 60s clock)
                getJson({
                    engine: "google_ai_overview",
                    page_token: token,
                    api_key: process.env.SERP_AI,
                    no_cache: true
                }, (aiResult) => {
                    // Send everything back in one go
                    res.json({
                        ...lensJson,
                        ai_overview: aiResult.ai_overview
                    });
                });
            } else {
                // No token? Just send the Lens results
                res.json(lensJson);
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Server Error" });
    }
});

export default app;