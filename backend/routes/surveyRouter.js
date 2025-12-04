import express from "express";
const router = express.Router();
import db from "../db.js"; 


// posts surveyId and userId into table (notice data is missing, we might not need this depending on how we want to update the survey table)
router.post("/noData", (req, res) => {
  const { surveyId, userId } = req.body;
  if (!surveyId || !userId) {
    return res.status(400).json({ message: "surveyId and userId are required" });
  }
  db.run('INSERT INTO survey (surveyId, userId) VALUES (?, ?)', [
    surveyId, 
    userId
  ], 
  function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      res.status(201).json({
        surveyId,
        userId
      });
    }
  )
});

// posts surveyId, userId, and data into table
router.post("/", (req, res) => {
  const { surveyId, userId, data } = req.body;
  if (!surveyId || !userId) {
    return res.status(400).json({ message: "surveyId, userId and data are required" });
  }
  db.run('INSERT INTO survey (surveyId, userId, data) VALUES (?, ?, ?)', [
    surveyId, 
    userId,
    JSON.stringify(data)
  ], 
  function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.status(201).json({
        surveyId,
        userId,
        data
      });
    }
  )
});

// honestly we might not need this function, it depends on if we save data to survey table before users have submitted the survey, but idk
// this updates survey value with the data from user
router.patch("/:surveyId/data", (req, res) => {
    const { data } = req.body;
    const { surveyId } = req.params;
    if (!data) {
        return res.status(400).json({ error: "Survey data is required"})
    }
    db.run("UPDATE survey SET data = ? WHERE surveyId = ?", [JSON.stringify(data), surveyId], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.status(200).json({
          surveyId,
          data,
          message: "Survey data successfully updated!"});
    })
})

// returns all survey data
router.get("/", (req, res) => {
  db.all("SELECT * FROM survey", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
});


export default router;