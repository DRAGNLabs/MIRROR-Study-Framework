import express from "express";
const router = express.Router();
import db from "../db.js"; 
import { streamLLM } from "../llm.js";

router.post("/:userId", (req, res) =>{
    db.run()

})

// router.post("/", async (req, res) => { //should call whats in the llm.js
//     const userPrompts = req.body.userPrompts;
//     try {
//         const result = await respondToUser(userPrompts);
//         console.log(`result: ${result}`);
//         res.json(result);
//     } catch (error) {
//         console.error("Error getting academic event:", error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// })
router.post("/", async (req, res) => {
    const { prompt } = req.body;

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    try {
        const stream = await streamLLM(userPrompts);

        for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
                res.write(event.delta); // send chunk to frontend
            }
        }

        res.end();
    } catch (error) {
        console.error("Error getting LLM message:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

    

//add routers from apiRouter