import express from "express";
const router = express.Router();
import db from "../db.js"; 


//posts a survey associated with a survey id
router.post("/:surveyId", (req, res) => {
  const { surveyId } = req.params;
  const { userId, data } = req.body;
  db.run('INSERT INTO survey (surveyId, userId) VALUES (?, ?, ?)', [
    userId, 
    userName,
    JSON.stringify(surveyData)
  ], 
  function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.status(201).json({
        message: 'Survey saved successfully!'
      });
    }
  )
});

// honestly we might not need this function, it depends on if we save data to survey table before users have submitted the survey, but idk
router.patch("/:surveyId/data", (req, res) => {
    const { surveyId, data } = req.body;
    if (!surveyId || !data) {
        return res.status(400).json({ error: "surveyId and survey data are required"})
    }
    db.run("UPDATE survey SET data = ? WHERE surveyId = ?", [JSON.stringify(data), surveyId], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({message: "Survey data successfully updated!"});
    })
})


//returns all the data in the survey table, hasnt been tested
router.get("/", (req, res) => {
  db.all("SELECT * FROM survey", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ tables: rows });
  });
});


export default router;