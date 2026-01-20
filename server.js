import "dotenv/config";
import express from "express";
import Viteexpress from "vite-express";
import {getJson} from "serpapi";
const app=express();
app.use("/search.json"  ,async(req,res)=>{
    getJson({
        q:`closest visual matches to this location,preference=${req.query.preference}`,
        engine:"google_lens",
        url:req.query.url,
        api_key:process.env.SERP_AI,
    },(json)=>{
        res.json(json);
    }
);
});
export default app;
Viteexpress.listen(app,3000);
