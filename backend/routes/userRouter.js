import express from "express";
import db from "../db.js"; 
 
const router = express.Router();

// create or login a user
router.post("/", (req, res) => {
    const {userName, roomCode} = req.body;
    if (!userName || !roomCode) {
        return res.status(400).json({message: "userName and roomCode are required"});
    }
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

// updates role for user
router.patch("/:userId/role", (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;
    if (!userId || !role) {
        return res.status(400).json({ error: "userId and role are required"});
    }
    db.run("UPDATE users SET role = ? WHERE userId = ?", [role, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });

        res.status(200).json({
            userId, 
            role, 
            message: "role in users successfully updated!"
        });
    })
});

// get user with specified userId
router.get("/:userId", (req, res) => {
    const userId = req.params.userId;
    if (!userId) {
        return res.status(400).json({ error: "userId is required"});
    }
    db.get("SELECT * FROM users WHERE userId = ?", [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ message: "User not found" });

        res.status(200).json(row);
    });
});

// get all users in table
router.get("/", (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows)=> {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json(rows);
    })
});

// delete user with specified userId from table
router.delete("/delete/:userId", (req,res) => {
  const userId = req.params.userId;
  db.run("DELETE FROM users WHERE userId = ?", [userId], function(err) {
    if (err) {
      console.error("Error deleting user:", err);
      return res.status(500).json({ success: false, message: "Error deleting user." });
    }
    res.status(200).json({ success: true, deleted: this.changes }); // this.changes says how many rows were deleted
  });
});

export default router;