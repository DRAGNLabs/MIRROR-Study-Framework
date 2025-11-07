import express from "express";
const router = express.Router();
import db from "../db.js"; 

//creates a room based off of the roomCode and count of people allowed in the room
router.post("/create", (req, res) => {
  const { roomCode, count } = req.body;
  db.run('INSERT INTO rooms (roomCode, count) VALUES (?, ?)', [
    roomCode,
    count
  ], 
  function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.status(201).json({
        message: 'Room successfully created!'
      });
    }
  )
})

export default router;