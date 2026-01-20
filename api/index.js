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
app.use("/overview",async(req,res)=>{
    getJson({
  engine: "google_ai_overview",
  page_token: req.query.page_token,
  api_key: process.env.SERP_AI,
}, (json) => {
  console.log(json["ai_overview"]);
});
});
export default app;
