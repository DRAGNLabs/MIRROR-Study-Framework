import express from "express";
const router = express.Router();
import db from "../db.js"; 

router.post('/', (req, res) => {
  const { roomCode, gameType, numRounds, usersNeeded, modelType } = req.body;
  if (!roomCode || !gameType || !numRounds || !usersNeeded || !modelType) {
    return res.status(400).json({message: "roomCode, gameType, numRounds, usersNeeded, and modelType are required"});
  }
  const sql = 'INSERT INTO rooms (roomCode, gameType, numRounds, usersNeeded, modelType) VALUES (?, ?, ?, ?, ?)';
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
        roomCode,
        gameType,
        numRounds,
        usersNeeded,
        modelType
      });
    }
  )
});

router.patch("/:roomCode/started", (req, res) => {
    const { userIds } = req.body;
    const { roomCode } = req.params;
    if (!userIds) {
        return res.status(400).json({ error: "userIds is required"})
    }
    db.run("UPDATE rooms SET userIds = ?, started = 1 WHERE roomCode = ?", [JSON.stringify(userIds), roomCode], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.status(200).json({
          roomCode,
          userIds,
          message: "Room userIds and started successfully updated!"
        });
    })
});

router.patch("/:roomCode/llmInstructions", (req, res) => {
    const { llmInstructions } = req.body;
    const { roomCode } = req.params;
    if (!llmInstructions) {
        return res.status(400).json({ error: "llmInstructions is required"})
    }
    db.run("UPDATE rooms SET llmInstructions = ? WHERE roomCode = ?", [JSON.stringify(llmInstructions), roomCode], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.status(200).json({
          roomCode,
          llmInstructions,
          message: "llmInstructions successfully updated!"});
    })
});

router.patch("/:roomCode/userMessages", (req, res) => {
    const { userMessages } = req.body;
    const { roomCode } = req.params;
    if (!userMessages) {
        return res.status(400).json({ error: "userMessages is required"})
    }
    db.run("UPDATE rooms SET userMessages = ? WHERE roomCode = ?", [JSON.stringify(userMessages), roomCode], function (err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Database error" });
        }

        res.status(200).json({
          roomCode,
          userMessages,
          message: "userMessages successfully updated!"
        });
    })
});

router.patch("/:roomCode/llmResponse", (req, res) => {
    const { llmResponse } = req.body;
    const { roomCode } = req.params;
    if (!llmResponse) {
        return res.status(400).json({ error: "llmResponse is required"})
    }
    db.run("UPDATE rooms SET llmResponse = ? WHERE roomCode = ?", [JSON.stringify(llmResponse), roomCode], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.status(200).json({
          roomCode,
          llmResponse,
          message: "llmResponse successfully updated!"
        });
    })
});


router.patch("/:roomCode/completed", (req, res) => {
    const { roomCode } = req.params;

    db.run("UPDATE rooms SET completed = 1 WHERE roomCode = ?", [roomCode], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.status(200).json({
          roomCode,
          message: "Room is completed!"
        });
    })
});



router.get("/", (req, res) => {
  db.all("SELECT * FROM rooms", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
});

router.get("/nonCompleted", (req, res) => {
  db.all("SELECT * FROM rooms WHERE completed = 0", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
});

router.post("/valid", (req, res) => { //return false if found in database because its already taken and not valid
  const roomCode = req.body.roomCode;
  if(!roomCode) {
    return res.status(400).json({ message: "roomCode is required" });
  }
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
  if(!roomCode) {
    return res.status(400).json({ message: "roomCode is required" });
  }
  db.run("DELETE FROM rooms WHERE roomCode = ?", [roomCode], function(err) {
    if (err) {
      console.error("Error deleting room:", err);
      return res.status(500).json({ success: false, message: "Error deleting room." });
    }
    res.status(200).json({ success: true, deleted: this.changes }); // this.changes says how many rows were deleted
  });
});

router.get("/:roomCode", (req, res) => {
  const { roomCode } = req.params;
  if(!roomCode) {
    return res.status(400).json({ message: "roomCode is required" });
  }
  db.get("SELECT * FROM rooms WHERE roomCode = ?", [roomCode], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: "Room not found" });

        res.status(200).json(row);
    });
})





export default router;