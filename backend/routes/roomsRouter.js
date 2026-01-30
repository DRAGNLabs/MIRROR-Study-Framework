import express from "express";
const router = express.Router();
import db from "../db.js"; 
// import dotenv from "dotenv";
// dotenv.config();

// Creates room, puts roomCode, gameType, numRounds, usersNeeded, and modelType into table (rest of info will be updated later)
router.post('/', async (req, res) => {
  try{
  const { roomCode, gameType, numRounds, usersNeeded } = req.body;
  if (roomCode === undefined || gameType === undefined || numRounds === undefined || usersNeeded === undefined) {
    return res.status(400).json({message: "roomCode, gameType, numRounds, and usersNeeded are required"});
  }
  const modelType = process.env.OPENAI_MODEL;

  const sql = `
    INSERT INTO rooms ("roomCode", "gameType", "numRounds", "usersNeeded", "modelType") 
    VALUES ($1, $2, $3, $4, $5)
    RETURNING  "roomCode", "gameType", "numRounds", "usersNeeded", "modelType";
  `;

  const result = await db.query(sql, [roomCode, gameType, numRounds, usersNeeded, modelType])
  
  return res.status(201).json(result.rows[0]);
  // You can choose whichever return statement works best
  // return res.status(201).json({
  //       roomCode,
  //       gameType,
  //       numRounds,
  //       usersNeeded,
  //       modelType
  //     });
} catch (err) {
  console.error(err);
  return res.status(500).json({ error: err.message });
}
});


// updates userIds and started to true, this will be used when admin directs users to interactions page
router.patch("/:roomCode/userIds", async (req, res) => {
  try{
    const { userIds } = req.body;
    const { roomCode } = req.params;
    if (userIds === undefined) {
        return res.status(400).json({ error: "userIds is required"})
    }
    const result = await db.query(
      'UPDATE rooms SET "userIds" = $1::jsonb WHERE "roomCode" = $2 RETURNING "roomCode", "userIds";', [JSON.stringify(userIds), roomCode]);
     if (result.rowCount === 0){
      return res.status(404).json({error: "Room not found"})
     }  
    return res.status(200).json({
        roomCode: result.rows[0].roomCode,
        userIds: result.rows[0].userIds,
        message: "Room userIds successfully updated!"
      });
        
  } catch (err){
    console.log(err);
    return res.status(500).json({ error: err.message });

  }
});

// updates started when admin clicks start room
router.patch("/:roomCode/started", async (req, res) => {
  try {
    // const { userIds } = req.body;
    const { roomCode } = req.params;
    // if (userIds === undefined) {
    //     return res.status(400).json({ error: "userIds is required"})
    // }
    const result = await db.query(
      'UPDATE rooms SET started = TRUE WHERE "roomCode" = $1 RETURNING "roomCode", started;', 
      [roomCode]);
    
      if (result.rowCount === 0){
        return res.status(404).json({error: "Room not found"});
      }

    return res.status(200).json({
      roomCode: result.rows[0].roomCode,
      started: result.rows[0].started,
      message: "Started successfully updated to true!"
    });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });

    }})


// updates llmInstructions for specified room. This will be updated every round when LLM sends instructions
router.patch("/:roomCode/llmInstructions", async (req, res) => {
  try {
    const { llmInstructions } = req.body;
    const { roomCode } = req.params;
    if (llmInstructions === undefined) {
        return res.status(400).json({ error: "llmInstructions is required"})
    }

    const result = await db.query(
      'UPDATE rooms SET "llmInstructions" = $1::jsonb WHERE "roomCode" = $2 RETURNING "roomCode", "llmInstructions";', 
      [JSON.stringify(llmInstructions), roomCode]
    );

    if (result.rowCount === 0){
      return res.status(404).json({error: "Room not found"});
    }
        
    return res.status(200).json({
          roomCode: result.rows[0].roomCode,
          llmInstructions: result.rows[0].llmInstructions,
          message: "llmInstructions successfully updated!"});
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }


});

// updates userMessages for specified room. This will be updated every round once every user sends a message
router.patch("/:roomCode/userMessages", async (req, res) => {
  try {
    const { userMessages } = req.body;
    const { roomCode } = req.params;
    if (userMessages === undefined) {
        return res.status(400).json({ error: "userMessages is required"})
    }

    const result = await db.query(
      'UPDATE rooms SET "userMessages" = $1 WHERE "roomCode" = $2 RETURNING "userMessages", "roomCode";', 
      [userMessages, roomCode]
    );

    if (result.rowCount === 0){
      return res.status(404).json({error: "Room not found"});
    }
    
    return res.status(200).json({
          roomCode: result.rows[0].roomCode,
          userMessages: result.rows[0].userMessages,
          message: "userMessages successfully updated!"
        });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  }

});

// updates llmResponse for specified room. This will be udpated every round once LLM sends response
router.patch("/:roomCode/llmResponse", async (req, res) => {
  try {
    const { llmResponse } = req.body;
    const { roomCode } = req.params;
    if (llmResponse === undefined) {
        return res.status(400).json({ error: "llmResponse is required"})
    }

    const result = await db.query(
      'UPDATE rooms SET "llmResponse" = $1 WHERE "roomCode" = $2 RETURNING "llmResponse", "roomCode";', 
      [llmResponse, roomCode]
    );

    if (result.rowCount === 0){
      return res.status(404).json({error: "Room not found"});
    }

    return res.status(200).json({
      roomCode: result.rows[0].roomCode,
      llmResponse: result.rows[0].llmResponse,
      message: "llmResponse successfully updated!"
    });

  } catch (err){
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

});

// updates completed for specified room. Once admin directs users to survey page it will set the room as completed and those rooms won't show up on admin page anymore
router.patch("/:roomCode/completed", async (req, res) => {
  try {
    const { roomCode } = req.params;

    const result = await db.query(
      'UPDATE rooms SET completed = TRUE WHERE "roomCode" = $1 RETURNING "roomCode", completed;', 
      [roomCode]
    );

    if (result.rowCount === 0){
      return res.status(404).json({ error: "Room not found" });
    }

    return res.status(200).json({
      roomCode: result.rows[0].roomCode,
      completed: result.rows[0].completed,
      message: "Room is completed!"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

});

// gets all rooms in table
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM rooms ORDER BY "roomCode" ASC;'
    );
    return res.status(200).json(result.rows);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// gets all rooms that aren't completed in table. These rooms will be shown on /admin page
router.get("/nonCompleted", async (req, res) => {

  try {
    const result = await db.query(
      'SELECT * FROM rooms WHERE completed = FALSE ORDER BY "roomCode" ASC;'
    );
    return res.status(200).json(result.rows);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

});

// Lets us know if roomCode is valid or not
router.post("/valid", async (req, res) => { //return false if found in database because its already taken and not valid
  try {
    const roomCode = req.body.roomCode;
    if(!roomCode) {
      return res.status(400).json({ message: "roomCode is required" });
    }

    const result = await db.query(
      'SELECT 1 FROM rooms WHERE "roomCode" = $1 LIMIT 1', 
      [roomCode]
    );

    if(result.rowCount > 0){ //this means it is taken
      return res.json(false);
    }
    return res.json(true);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error validating room in database"});
  }
});


router.get("/:roomCode/login", async (req, res) => {
  try {
    const roomCode = req.params.roomCode;
    const result = await db.query(
      'SELECT * FROM rooms WHERE "roomCode" = $1', 
      [parseInt(roomCode)]
    );

    const room = result.rows[0];

    if (room && room.started === true) {
      return res.json(true);
    }

    return res.json(false);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error validating room in database" });
  }

})


// deletes a room based off of roomCode
router.delete("/delete/:roomCode", async (req,res) => {
  try {
   const roomCode = req.params.roomCode;
   const result = await db.query(
    'DELETE FROM rooms WHERE "roomCode" = $1', [roomCode]
   );
   res.status(200).json({ 
    success: true, 
    deleted: result.rowCount }); // says how many rows were deleted
 
  } catch (err) {
    console.error("Error deleting room:", err);
    return res.status(500).json({ success: false, message: "Error deleting room." });
  }

});

router.get("/:roomCode", async (req, res) => {
  try {

    const { roomCode } = req.params;

    if(!roomCode) {
      return res.status(400).json({ message: "roomCode is required" });
    }

    const result = await db.query(
      'SELECT * FROM rooms WHERE "roomCode" = $1', 
      [roomCode]
    );

    const row = result.rows[0];

    if (!row) return res.status(404).json({ message: "Room not found" });

    return res.status(200).json(row);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

});

// getting all users that are in room
router.get("/:roomCode/users", async (req, res) => {
  try {
    const { roomCode } = req.params;

    if(!roomCode) {
      return res.status(400).json({ message: "roomCode is required" });
    }

    const result = await db.query(
      'SELECT * FROM users WHERE "roomCode" = $1 ORDER BY "userId" ASC;', 
      [roomCode]
    );
  
    if (result.rowCount === 0) return res.status(404).json({ message: "users not found with corresponding roomCode" });

    res.status(200).json(result.rows);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});


router.patch("/:roomCode/status", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { status } = req.body;

    const result = await db.query(
      'UPDATE rooms SET status = $1 WHERE "roomCode" = $2 RETURNING "roomCode", status',
      [status, roomCode]
    );

    if (result.rowCount === 0){
      return res.status(404).json({ error: "Room not found" });
    }

    return res.status(200).json({
      roomCode: result.rows[0].roomCode,
      status: result.rows[0].status,
      message: "status successfully updated!"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });

  }

})

export default router;