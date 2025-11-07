import express from "express";
const router = express.Router();
import db from "../db.js"; 

router.post("/:id", (req, res) =>{
    db.run()

})

router.post("/", (req, res) => {

})

export default router;