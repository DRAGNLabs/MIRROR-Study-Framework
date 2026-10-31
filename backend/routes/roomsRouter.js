import express from "express";
const router = express.Router();
import db from "../db.js"; 
import {getModelIds, updateModel} from "../llm.js"
import { syncFolderRooms } from "./foldersRouter.js";
import { loadGames } from "../services/gameLoader.js";
import { loadTestScripts } from "../services/testScriptLoader.js";

const games = loadGames();
const testScripts = loadTestScripts();

function computeTonsNeeded(game, numPlayers) {
  const total = game?.tons_needed_total;
  if (!total || !numPlayers) return null;
  return Math.ceil(total / numPlayers);
}

// The prompt templates (placeholders unfilled) that gameHandler will use for this game.
// Saved on automated test rooms only, so different prompt versions can be compared.
function promptSnapshotFor(gameType) {
  const game = games.find((g) => parseInt(g.id) === Number(gameType));
  const prompts = game?.prompts?.[0];
  if (!prompts) return null;
  return {
    gameTitle: game.title,
    system_prompt: prompts.system_prompt ?? null,
    instruction_prompt: prompts.instruction_prompt ?? null,
    response_prompt: prompts.response_prompt ?? null,
    extraction_prompt: prompts.extraction_prompt ?? null,
  };
}
// import dotenv from "dotenv";
// dotenv.config();

// Creates room, puts roomCode, gameType, numRounds, usersNeeded, and modelType into table (rest of info will be updated later)
router.post('/', async (req, res) => {
  try{
    const { roomCode, gameType, numRounds, usersNeeded, modelType, isTest, folderId, passReasoning, testScript } = req.body;

    if (roomCode === undefined || gameType === undefined || numRounds === undefined || usersNeeded === undefined) {
      return res.status(400).json({message: "roomCode, gameType, numRounds, and usersNeeded are required"});
    }

    const parsedRounds = Number(numRounds);
    if (!Number.isInteger(parsedRounds) || parsedRounds < 1) {
      return res.status(400).json({ message: "numRounds must be an integer greater than or equal to 1" });
    }

    let finalModelType = typeof modelType === "string" ? modelType.trim() : "";
    if (!finalModelType) {
      finalModelType = (process.env.OPENAI_MODEL || "").trim();
    }
    if (!finalModelType) {
      finalModelType = "default";
    }

    const sql = `
      INSERT INTO rooms ("roomCode", "gameType", "numRounds", "usersNeeded", "modelType", "isTest", "folderId", "promptSnapshot", "passReasoning", "testScript")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING  "roomCode", "gameType", "numRounds", "usersNeeded", "modelType", "createdAt", "isTest", "folderId", "passReasoning", "testScript";
    `;

    const promptSnapshot = isTest ? promptSnapshotFor(gameType) : null;
    const result = await db.query(sql, [roomCode, gameType, numRounds, usersNeeded, finalModelType, !!isTest, folderId ?? null, promptSnapshot, !!passReasoning, isTest && testScript ? String(testScript) : null]);
    await syncFolderRooms([result.rows[0].folderId]);

    return res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// lists the automated test scripts (fixed bot messages) available for each game
router.get("/testScripts", (req, res) => {
  return res.status(200).json(testScripts.map((s) => ({
    id: s.id,
    title: s.title,
    gameId: s.gameId,
    userCount: s.users?.length ?? 0,
    rounds: Object.keys(s.rounds ?? {}).length,
  })));
});

router.get("/models", async (req, res) => {
  try {
    const models = await getModelIds();
    res.json(models);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error getting models" });
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
      'UPDATE rooms SET "userIds" = $1::jsonb WHERE "roomCode" = $2 RETURNING "roomCode", "userIds", "gameType", tons_needed;', [JSON.stringify(userIds), roomCode]);
     if (result.rowCount === 0){
      return res.status(404).json({error: "Room not found"})
     }


    let tonsNeeded = result.rows[0].tons_needed;
    const game = games.find(g => parseInt(g.id) === result.rows[0].gameType);
    const computed = computeTonsNeeded(game, userIds.length);
    if (computed != null) {
      await db.query('UPDATE rooms SET tons_needed = $1 WHERE "roomCode" = $2', [computed, roomCode]);
      tonsNeeded = computed;
    }

    return res.status(200).json({
        roomCode: result.rows[0].roomCode,
        userIds: result.rows[0].userIds,
        tonsNeeded,
        message: "Room userIds successfully updated!"
      });
        
  } catch (err){
    console.log(err);
    return res.status(500).json({ error: err.message });

  }
});

// moves a room into a folder (folderId null takes it out of any folder)
router.patch("/:roomCode/folder", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { folderId } = req.body;
    if (folderId === undefined) {
      return res.status(400).json({ error: "folderId is required (null to remove from folder)" });
    }

    // need the old folder so its rooms list can drop this room
    const before = await db.query('SELECT "folderId" FROM rooms WHERE "roomCode" = $1', [roomCode]);
    if (before.rowCount === 0) {
      return res.status(404).json({ error: "Room not found" });
    }
    const oldFolderId = before.rows[0].folderId;

    const result = await db.query(
      'UPDATE rooms SET "folderId" = $1 WHERE "roomCode" = $2 RETURNING "roomCode", "folderId";',
      [folderId, roomCode]
    );
    await syncFolderRooms([oldFolderId, folderId]);

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// updates started when admin clicks start room
router.patch("/:roomCode/started", async (req, res) => {
  try {
    const { roomCode } = req.params;
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
      'UPDATE rooms SET "userMessages" = $1::jsonb WHERE "roomCode" = $2 RETURNING "userMessages", "roomCode";', 
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
      'UPDATE rooms SET "llmResponse" = $1::jsonb WHERE "roomCode" = $2 RETURNING "llmResponse", "roomCode";', 
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

// updates resourceAllocations for specified room. This will store per-round fish splits.
// saves one round's reasoning ({ output, reasoningText, reasoningTokens, hasEncrypted })
// into llmReasoning under that round, without touching other rounds
router.patch("/:roomCode/llmReasoning", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { round, reasoning } = req.body;
    if (!Number.isInteger(Number(round)) || reasoning == null || typeof reasoning !== "object") {
      return res.status(400).json({ message: "round and reasoning are required" });
    }
    const result = await db.query(
      `UPDATE rooms
       SET "llmReasoning" = COALESCE("llmReasoning", '{}'::jsonb) || jsonb_build_object($1::text, $2::jsonb)
       WHERE "roomCode" = $3
       RETURNING "roomCode"`,
      [String(round), JSON.stringify(reasoning), roomCode]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Room not found" });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.patch("/:roomCode/resourceAllocations", async (req, res) => {
  try {
    const { resourceAllocations } = req.body;
    const { roomCode } = req.params;
    if(resourceAllocations == undefined) {
      return res.status(400).json({ error: "resourceAllocations is required" });
    }

    const result = await db.query(
      'UPDATE rooms SET "resourceAllocations" = $1::jsonb WHERE "roomCode" = $2 RETURNING "resourceAllocations", "roomCode";',
      [resourceAllocations, roomCode]
    );

    if (result.rowCount == 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.status(200).json({
      roomCode: result.rows[0].roomCode,
      resourceAllocations: result.rows[0].resourceAllocations,
      message: "resourceAllocations successfully updated!"
    });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});


// updates fish_amount for specified room. This will store per-round fish splits.
router.patch("/:roomCode/fishAmount", async (req, res) => {
  try {
    const { fishAmount } = req.body;
    const { roomCode } = req.params;
    if(fishAmount == undefined) {
      return res.status(400).json({ error: "fishAmount is required" });
    }

    const result = await db.query(
      'UPDATE rooms SET fish_amount = $1::jsonb WHERE "roomCode" = $2 RETURNING fish_amount, "roomCode";',
      [fishAmount, roomCode]
    );

    if (result.rowCount == 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.status(200).json({
      roomCode: result.rows[0].roomCode,
      fishAmount: result.rows[0].fish_amount,
      message: "fish_amount successfully updated!"
    });
  } catch(err) {
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
      // llmReasoning is left out of room lists since it can be large; it's on GET /:roomCode
      `SELECT to_jsonb(r) - 'llmReasoning' AS room FROM rooms r ORDER BY "createdAt" DESC;`
    );
    return res.status(200).json(result.rows.map((row) => row.room));

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// gets all rooms that aren't completed in table. These rooms will be shown on /admin page
router.get("/nonCompleted", async (req, res) => {

  try {
    const result = await db.query(
      `SELECT to_jsonb(r) - 'llmReasoning' AS room FROM rooms r WHERE completed = FALSE ORDER BY "createdAt" DESC;`
    );
    return res.status(200).json(result.rows.map((row) => row.room));

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

});


// gets all rooms that are completed in table. These rooms will be shown on /admin page
router.get("/isCompleted", async (req, res) => {

  try {
    const result = await db.query(
      `SELECT to_jsonb(r) - 'llmReasoning' AS room FROM rooms r WHERE completed = TRUE ORDER BY "createdAt" DESC;`
    );
    return res.status(200).json(result.rows.map((row) => row.room));

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

});

// Lets us know if roomCode is valid or not
// this should be a GET method I think....
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

// what is this route method
router.get("/:roomCode/login", async (req, res) => {
  try {
    const roomCode = parseInt(req.params.roomCode);
    if (isNaN(roomCode)) {
      return res.status(400).json({error: "Invalid room code format"});
    }

    const result = await db.query(
      'SELECT * FROM rooms WHERE "roomCode" = $1', 
      [roomCode]
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
    'DELETE FROM rooms WHERE "roomCode" = $1 RETURNING "folderId"', [roomCode]
   );
   // take the deleted room out of its folder's rooms list
   await syncFolderRooms(result.rows.map((r) => r.folderId));
   res.status(200).json({ 
    success: true, 
    deleted: result.rowCount }); // says how many rows were deleted
 
  } catch (err) {
    console.error("Error deleting room:", err);
    return res.status(500).json({ success: false, message: "Error deleting room." });
  }

});

// gets the practice flag for a room
router.get("/:roomCode/practice", async (req, res) => {
  try {
    const { roomCode } = req.params;

    const result = await db.query(
      'SELECT "roomCode", practice FROM rooms WHERE "roomCode" = $1;',
      [roomCode]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// updates the practice flag for a room
router.patch("/:roomCode/practice", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { practice } = req.body;

    if (typeof practice !== "boolean") {
      return res.status(400).json({ error: "practice must be a boolean" });
    }

    const result = await db.query(
      'UPDATE rooms SET practice = $1 WHERE "roomCode" = $2 RETURNING "roomCode", practice;',
      [practice, roomCode]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    return res.status(200).json({
      ...result.rows[0],
      message: "Practice setting successfully updated!"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// merges the given keys into practiceData (keys not sent are kept), so two
// updates landing close together can't wipe out each other's fields
router.patch("/:roomCode/practiceData", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { practiceData } = req.body;

    if (!practiceData || typeof practiceData !== "object" || Array.isArray(practiceData)) {
      return res.status(400).json({ error: "practiceData must be an object" });
    }

    const result = await db.query(
      `UPDATE rooms SET "practiceData" = COALESCE("practiceData", '{}'::jsonb) || $1::jsonb
       WHERE "roomCode" = $2 RETURNING "roomCode", "practiceData";`,
      [JSON.stringify(practiceData), roomCode]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// appends one user's practice message in a single statement, so users submitting
// at the same time can't overwrite each other. Only appends while the practice
// round is in progress and the user hasn't already sent one.
router.post("/:roomCode/practiceData/messages", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId, text } = req.body;

    if (userId === undefined || typeof text !== "string") {
      return res.status(400).json({ error: "userId and text are required" });
    }

    const result = await db.query(
      `UPDATE rooms
       SET "practiceData" = jsonb_set(
         "practiceData",
         '{messages}',
         COALESCE("practiceData"->'messages', '[]'::jsonb) || jsonb_build_array(jsonb_build_array($1::jsonb, $2::text))
       )
       WHERE "roomCode" = $3
         AND "practiceData"->>'status' = 'in_progress'
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(COALESCE("practiceData"->'messages', '[]'::jsonb)) AS m
           WHERE m->>0 = $1::jsonb#>>'{}'
         )
       RETURNING "practiceData";`,
      [JSON.stringify(userId), text, roomCode]
    );

    if (result.rowCount === 0) {
      return res.status(200).json({ appended: false });
    }

    return res.status(200).json({ appended: true, practiceData: result.rows[0].practiceData });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// gets room
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
      `SELECT u.* FROM users u WHERE u."userId" = ANY(
        SELECT jsonb_array_elements_text("userIds")::INTEGER
        FROM rooms 
        WHERE "roomCode" = $1
      )
      ORDER BY u."userId" ASC;`,
      [roomCode]
    )
  
    if (result.rowCount === 0) return res.status(404).json({ message: "users not found with corresponding roomCode" });

    res.status(200).json(result.rows);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// updates status for room whenever admin navigates to a new page
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

//changes a rooms state from incomplete to complete
router.put("/complete/:roomCode", async (req, res) => {
  const { roomCode } = req.params;

  try {
    const result = await db.query(
      `
      UPDATE rooms
      SET completed = TRUE
      WHERE "roomCode" = $1
      RETURNING *;
      `,
      [roomCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

//incase this is needed later to reopen a room, a rooms state is going from complete to incomplete
//changes a rooms state from incomplete to complete
router.put("/incomplete/:roomCode", async (req, res) => {
  const { roomCode } = req.params;

  try {
    const result = await db.query(
      `
      UPDATE rooms
      SET completed = FALSE
      WHERE "roomCode" = $1
      RETURNING *;
      `,
      [roomCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// updates currRound whenever a round ends
router.patch("/:roomCode/currRound", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { currRound } = req.body;

    const result = await db.query(
      'UPDATE rooms SET curr_round = $1 WHERE "roomCode" = $2 RETURNING "roomCode", curr_round',
      [currRound, roomCode]
    );

    if (result.rowCount === 0){
      return res.status(404).json({ error: "Room not found" });
    }

    return res.status(200).json({
      roomCode: result.rows[0].roomCode,
      status: result.rows[0].curr_round,
      message: "currRound successfully updated!"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });

  }

})

//updatin the room with the model chosen 
router.put("/:roomCode/updateModel", async (req, res) => {
  try {
    const { model } = req.body;

    await updateModel(model);

    res.json({ message: "Model updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error updating model" });
  }
});

export default router;
