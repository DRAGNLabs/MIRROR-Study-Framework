import express from "express";
const router = express.Router();
import db from "../db.js"; 
import { respondToUser } from "../llm.js";

router.post("/:userId", (req, res) =>{
    db.run()

})

router.post("/", async (req, res) => { //should call whats in the llm.js
    const userPrompts = req.body.userPrompts;
    try {
        const result = await respondToUser(userPrompts);
        console.log(`result: ${result}`);
        res.json(result);
    } catch (error) {
        console.error("Error getting academic event:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

export default router;

    

//add routers from apiRouter