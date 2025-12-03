import express from "express";
import db from "../db.js"; 
 
const router = express.Router();


//get all users, hasnt been tested
//do we need this function? Are we ever going to use it?
router.get("/", (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows)=> {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ tables: rows });
    })
});


//create or login a user
router.post("/", (req, res) => {
    const {userName, roomCode} = req.body;
    // if (!userName || !roomCode) {
    //     return res.status(400).json({})
    // }
    db.run("INSERT INTO users (userName, roomCode) VALUES (?, ?)", [userName, roomCode],
    function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
            userId: this.lastID,
            userName,
            roomCode
        });
        }
    );

});

// updates role for when games are working
router.patch("/:userId/role", (req, res) => {
    const { userId, role } = req.body;
    // if (!userId || !role) {
    //     return res.status(400).json({ error: "userId and role are required"})
    // }
    db.run("UPDATE users SET role = ? WHERE userId = ?", [role, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({message: "role in users successfully updated!"});
    })
});

//get one user
router.get("/:userId", (req, res) => {
    const userId = req.params.userId;
    db.get("SELECT * FROM users WHERE userId = ?", [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: "User not found" });

        res.json(row);
    });
});

//idk if there is a need to delete a user yet?
// router.delete("/:id", (req,res) => {
// })

export default router;