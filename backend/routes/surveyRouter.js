import express from "express";
const router = express.Router();
import db from "../db.js"; 


// posts surveyId and userId into table (notice data is missing, we might not need this depending on how we want to update the survey table)
router.post("/noData", async (req, res) => {

  try {

    const { surveyId, userId } = req.body;
    if (surveyId === undefined || userId === undefined) {
      return res.status(400).json({ message: "surveyId and userId are required" });
    }

    await db.query(
      'INSERT INTO survey ("surveyId", "userId") VALUES ($1, $2) ON CONFLICT ("surveyId", "userId") DO NOTHING;',
      [surveyId, userId]
    );

    return res.status(201).json({surveyId, userId});

  } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error, noData" });
  }

});

// posts surveyId, userId, and data into table
router.post("/", async (req, res) => {
  try {
    const { surveyId, userId, data } = req.body;
    if (surveyId === undefined || userId === undefined || data == undefined) {
      return res.status(400).json({ message: "surveyId, userId and data are required" });
    }

    const result = await db.query(`INSERT INTO survey ("surveyId", "userId", data) 
      VALUES ($1, $2, $3)
      ON CONFLICT ("surveyId", "userId")
      DO UPDATE SET data = EXCLUDED.data
      RETURNING "surveyId", "userId", data;
      `, 
      [surveyId, userId, data]
    );

    return res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error' });
  }

});

// honestly we might not need this function, it depends on if we save data to survey table before users have submitted the survey, but idk
// this updates survey value with the data from user

//ngl I am confused on what this endpoint does so it might need to be edited.
router.patch("/:surveyId/data", async (req, res) => {
  try{
    const { data } = req.body;
    const { surveyId } = req.params.surveyId;
    const { userId } = req.params.userId;

    if (data === undefined) {
        return res.status(400).json({ error: "Survey data is required"})
    }

    const result = await db.query(
      'UPDATE survey SET data = $1 WHERE "surveyId" = $2 AND "userId" = $3 RETURNING "surveyId", "userId", data;',
      [data, surveyId, userId]
    )

    return res.status(200).json({
          surveyId: result.rows[0].surveyId,
          userId: result.rows[0].userId,
          data: result.rows[0].data,
          message: "Survey data successfully updated!"});

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

})

// returns all survey data
router.get("/", async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM survey');

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


export default router;