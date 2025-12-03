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
router.post('/', (req, res) => {
  const { roomCode, gameType, numRounds, usersNeeded, modelType } = req.body;
  const sql = 'INSERT INTO rooms (roomCode, gameType, numRounds, usersNeeded, modelType) VALUES (?, ?, ?, ?)';
  db.run(sql, [
      roomCode,
      gameType,
      numRounds,
      usersNeeded,
      modelType
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }

      res.status(201).json({
        message: 'Room successfully created!'
      });
    }
  )
});

router.patch("/:roomCode/started", (req, res) => {
    const { userIds } = req.body;
    const { roomCode } = req.params;
    // if (!userIds) {
    //     return res.status(400).json({ error: "userIds are required"})
    // }
    db.run("UPDATE rooms SET userIds = ?, started = 1 WHERE roomCode = ?", [JSON.stringify(userIds), roomCode], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({message: "Room userIds and started successfully updated!"});
    })
});

router.patch("/:roomCode/llmInstructions", (req, res) => {
    const { llmInstructions } = req.body;
    const { roomCode } = req.params;
    // if (!userIds) {
    //     return res.status(400).json({ error: "userIds are required"})
    // }
    db.run("UPDATE rooms SET llmInstructions = ? WHERE roomCode = ?", [JSON.stringify(llmInstructions), roomCode], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({message: "llmInstructions successfully updated!"});
    })
});

router.patch("/:roomCode/userMessages", (req, res) => {
    const { userMessages } = req.body;
    const { roomCode } = req.params;
    // if (!userIds) {
    //     return res.status(400).json({ error: "userIds are required"})
    // }
    db.run("UPDATE rooms SET userMessages = ? WHERE roomCode = ?", [JSON.stringify(userMessages), roomCode], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({message: "userMessages successfully updated!"});
    })
});

router.patch("/:roomCode/llmResponse", (req, res) => {
    const { llmResponse } = req.body;
    const { roomCode } = req.params;
    // if (!userIds) {
    //     return res.status(400).json({ error: "userIds are required"})
    // }
    db.run("UPDATE rooms SET llmResponse = ? WHERE roomCode = ?", [JSON.stringify(llmResponse), roomCode], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({message: "llmResponse successfully updated!"});
    })
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
  db.run("DELETE FROM rooms WHERE roomCode = ?", [roomCode], function(err) {
    if (err) {
      console.error("Error deleting room:", err);
      return res.status(500).json({ success: false, message: "Error deleting room." });
    }
    res.json({ success: true, deleted: this.changes }); // this.changes says how many rows were deleted
  });
});

router.get("/:roomCode", (req, res) => {
  const { roomCode } = req.params;
  db.get("SELECT * FROM rooms WHERE roomCode = ?", [roomCode], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: "Room not found" });

        res.json(row);
    });
})





export default router;