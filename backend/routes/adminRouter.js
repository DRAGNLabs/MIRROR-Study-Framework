import express from "express";
const router = express.Router();
import db from "../db.js"; 

//creates a room based off of the roomCode and count of people allowed in the room
router.post("/create", (req, res) => {
  const { roomCode, count, gamesSelected, users } = req.body;
  db.run('INSERT INTO rooms (roomCode, count, gamesSelected, users) VALUES (?, ?, ?, ?)', [
    roomCode,
    count, 
    JSON.stringify(gamesSelected),
    JSON.stringify(users ?? [])
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

//returns all the data in the rooms table, hasnt been tested
router.get("/", (req, res) => {
  db.all("SELECT * FROM rooms", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ tables: rows });
  });
});



export default router;