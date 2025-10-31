import express from "express";
import db from "../db.js"; 
 
const router = express.Router();


//get all user
router.get("/", (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows)=> {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ tables: rows });
    })
});


//create or login a user
router.post("/", (req, res) => {
    const {userName, roomCode} = req.body;
    db.run("INSERT INTO users (userName, roomCode) VALUES (?, ?)", [userName, roomCode],
    function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
            id: this.lastID,
            userName,
            roomCode
        });
        }
    );

})

//get one user
router.get("/:id", (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: "User not found" });

        res.json(row);
    });
});

//idk if there is a need to delete a user yet?
// router.delete("/:id", (req,res) => {
// })

export default router;