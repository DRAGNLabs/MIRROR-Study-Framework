import express from "express";
const router = express.Router();
import db from "../db.js"; 

// Creates room, puts roomCode, gameType, numRounds, usersNeeded, and modelType into table (rest of info will be updated later)
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

// updates userIds and started to true, this will be used when admin directs users to interactions page
router.patch("/:roomCode/userIds", (req, res) => {
    const { userIds } = req.body;
    const { roomCode } = req.params;
    if (!userIds) {
        return res.status(400).json({ error: "userIds is required"})
    }
    db.run("UPDATE rooms SET userIds = ? WHERE roomCode = ?", [JSON.stringify(userIds), roomCode], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.status(200).json({
          roomCode,
          userIds,
          message: "Room userIds successfully updated!"
        });
    })
});

// updates started when admin clicks start room
router.patch("/:roomCode/started", (req, res) => {
    // const { userIds } = req.body;
    const { roomCode } = req.params;
    // if (!userIds) {
    //     return res.status(400).json({ error: "userIds is required"})
    // }
    db.run("UPDATE rooms SET started = 1 WHERE roomCode = ?", [roomCode], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.status(200).json({
          roomCode,
          message: "Started successfully updated to 1!"
        });
    })
});

// updates llmInstructions for specified room. This will be updated every round when LLM sends instructions
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

// updates userMessages for specified room. This will be updated every round once every user sends a message
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

// updates llmResponse for specified room. This will be udpated every round once LLM sends response
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

// updates completed for specified room. Once admin directs users to survey page it will set the room as completed and those rooms won't show up on admin page anymore
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

// gets all rooms in table
router.get("/", (req, res) => {
  db.all("SELECT * FROM rooms", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
});

// gets all rooms that aren't completed in table. These rooms will be shown on /admin page
router.get("/nonCompleted", (req, res) => {
  db.all("SELECT * FROM rooms WHERE completed = 0", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
});

// Lets us know if roomCode is valid or not
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

router.get("/:roomCode/login", (req, res) => {
  const roomCode = req.params.roomCode;
  db.get("SELECT * FROM rooms WHERE roomCode = ?", [parseInt(roomCode)], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Error validating room in database" });
    }
    if (row && row.started==1) {
      return res.json(true);
    }

    return res.json(false);
  })
})


// deletes a room based off of roomCode
router.delete("/delete/:roomCode", (req,res) => {
  const roomCode = req.params.roomCode;
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
});


router.get("/:roomCode/users", async (req, res) => {
  const { roomCode } = req.params;
  if(!roomCode) {
    return res.status(400).json({ message: "roomCode is required" });
  }

  const users = await db.all(
    `SELECT * FROM users WHERE roomCode = ?`, [roomCode], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: "users not found with corresponding roomCode" });

        res.status(200).json(row);
    });
});


// router.get("/:roomCode/survey-status/:surveyId", async (req, res) => {
//     console.log("in users survey status endpoint", req.params);
//     const { roomCode, surveyId } = req.params;
//     console.log("roomcode type", typeof(roomCode));
//     console.log("surveyId type", typeof(surveyId));
//     try {
//       const rawUsers = await db.all(
//           `
//           SELECT
//             u.userId,
//             u.userName,
//             u.role,
//             CASE 
//               WHEN EXISTS (
//                 SELECT 1
//                 FROM survey s
//                 WHERE s.userId = u.userId
//                   AND s.surveyId = ?
//               ) 
//               THEN 1
//               ELSE 0
//             END AS completedSurvey
//           FROM users u
//           WHERE u.roomCode = ?
//           `,
//           [surveyId, roomCode]
//       );

//       const users = Array.isArray(rawUsers) ? rawUsers : Object.values(rawUsers);
//       console.log("users:", users);
//       res.json(users);
//   } catch (err) {
//     console.error("Error fetching survey status:", err);
//     res.status(500).json({ error: "Error getting survey status for users" });
//   }
  
// });


          // SELECT
          //   u.userId,
          //   u.userName,
          //   u.role,
          //   CASE WHEN s.userId IS NOT NULL THEN 1 ELSE 0 END AS completedSurvey
          // FROM users u
          // LEFT JOIN survey s
          //   ON u.userId = s.userId
          //   AND s.surveyId = ?
          // WHERE u.roomCode = ?



export default router;