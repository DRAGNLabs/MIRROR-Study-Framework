import express from "express";
const router = express.Router();
import db from "../db.js"; 

//creates a room based off of the roomCode and count of people allowed in the room
      // roomCode INTEGER NOT NULL PRIMARY KEY,
      // gameType INTEGER NOT NULL, 
      // numRounds INTEGER NOT NULL,
      // usersNeeded INTEGER NOT NULL,
      // modelType TEXT NOT NULL,
      // started INTEGER NOT NULL,
      // userIds TEXT NOT NULL,
      // userMessages TEXT NOT NULL,
      // llmInstructions TEXT NOT NULL,
      // llmResponse TEXT NOT NULL
router.post('/create', (req, res) => {
  const { roomCode, gameType, numRounds, usersNeeded, modelType } = req.body;
  db.run('INSERT INTO rooms (roomCode, gameType, numRounds, usersNeeded, modelType) VALUES (?, ?, ?, ?)', [
      roomCode,
      gameType,
      numRounds,
      usersNeeded,
      modelType
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
});
// router.post("/create", (req, res) => {
//   const { roomCode, count, gamesSelected, users } = req.body;
//   db.run('INSERT INTO rooms (roomCode, count, gamesSelected, users) VALUES (?, ?, ?, ?)', [
//     roomCode,
//     count, 
//     JSON.stringify(gamesSelected),
//     JSON.stringify(users ?? [])
//   ], 
//   function (err) {
//       if (err) {
//         console.error(err);
//         return res.status(500).json({ error: 'Database error' });
//       }

//       res.status(201).json({
//         message: 'Room successfully created!'
//       });
//     }
//   )
// });


router.get("/", (req, res) => {
  db.all("SELECT * FROM rooms", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post("/valid", (req, res) => { //return false if found in database because its already taken and not valid
  const roomCode = req.body.roomCode;
  db.get("SELECT * FROM rooms WHERE roomCode = ?", [roomCode], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Error validating room in database"});
    }
    if(row){
      return res.json(false);
    }

    return res.json(true);

  });

})


//deletes a room based off of roomCode
router.delete("/delete/:roomCode", (req,res) => {
  const roomCode = req.params.roomCode;
  db.run("DELETE FROM rooms WHERE roomCode = ?", [roomCode], function(err){
    if (err) {
      console.error("Error deleting room:", err);
      return res.status(500).json({ success: false, message: "Error deleting room." });
    }
    res.json({ success: true, deleted: this.changes }); // this.changes says how many rows were deleted
  });
});

router.get("/:roomCode", (req, res) => {
  const roomCode = req.params.roomCode;
  db.get("SELECT * FROM rooms WHERE roomCode = ?", [roomCode], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: "Room not found" });

        res.json(row);
    });
})





export default router;