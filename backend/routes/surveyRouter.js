import express from "express";
const router = express.Router();
import db from "../db.js"; 


// posts roomCode and userId into table (notice data is missing, we might not need this depending on how we want to update the survey table)
router.post("/noData", async (req, res) => {

  try {

    const { roomCode, userId } = req.body;
    if (roomCode === undefined || userId === undefined) {
      return res.status(400).json({ message: "roomCode and userId are required" });
    }

    await db.query(
      'INSERT INTO survey ("roomCode", "userId") VALUES ($1, $2) ON CONFLICT ("roomCode", "userId") DO NOTHING;',
      [roomCode, userId]
    );

    return res.status(201).json({roomCode, userId});

  } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error, noData" });
  }

});

// posts roomCode, userId, and data into table
router.post("/", async (req, res) => {
  try {
    const { roomCode, userId, data } = req.body;
    if (roomCode === undefined || userId === undefined || data === undefined) {
      return res.status(400).json({ message: "roomCode, userId and data are required" });
    }

    const result = await db.query(`INSERT INTO survey ("roomCode", "userId", data) 
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT ("roomCode", "userId")
      DO UPDATE SET data = EXCLUDED.data
      RETURNING "roomCode", "userId", data;
      `, 
      [roomCode, userId, data]
    );

    return res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error' });
  }

});



// returns all survey data
router.get("/", async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM survey ORDER BY "roomCode", "userId";');

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

});

// checking if a user has finished a survey, returns 0 or 1
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(`SELECT EXISTS (
      SELECT 1
      FROM survey
      WHERE "userId" = $1
    ) AS completed;
    `,
    [userId]
  );

  const completed = result.rows[0].completed;

  return res.status(200).json({ completed });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

});

//get a users survey based on userId
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(
      `
      SELECT "roomCode", "userId", data
      FROM survey
      WHERE "userId" = $1
      ORDER BY "roomCode" DESC
      LIMIT 1;
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No survey found for that user" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

});

//deletes a rooms surveys based on the roomCode
router.delete("/delete/:roomCode", async (req, res) => {
  const { roomCode } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM survey WHERE "roomCode" = $1 RETURNING *;',
      [roomCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No survey found for that roomCode" });
    }

    return res.status(200).json({
      message: "Survey deleted successfully",
      deletedSurvey: result.rows
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});



export default router;