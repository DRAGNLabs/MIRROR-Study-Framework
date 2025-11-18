import express from "express";
const router = express.Router();
import db from "../db.js"; 


//posts a survey associated with a users id
router.post("/:userId", (req, res) => {
  const { userId } = req.params;
  const { userName, surveyData } = req.body;
  db.run('INSERT INTO survey (userId, userName, data) VALUES (?, ?, ?)', [
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
})


//returns all the data in the survey table, hasnt been tested
router.get("/", (req, res) => {
  db.all("SELECT * FROM survey", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ tables: rows });
  });
});


export default router;