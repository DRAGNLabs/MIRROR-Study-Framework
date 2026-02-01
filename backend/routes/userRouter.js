import express from "express";
import db from "../db.js"; 
 
const router = express.Router();


// create or login a user
router.post("/", async (req, res) => {
    try {
        const {userName, roomCode} = req.body;
        if (userName === undefined || roomCode === undefined) {
            return res.status(400).json({message: "userName and roomCode are required"});
        }

        const result = await db.query(`
            INSERT INTO users ("userName", "roomCode") 
            VALUES ($1, $2)
            RETURNING "userId", "userName", "roomCode"; 
            `,  //userId should generate automatically with postgres
            [userName, roomCode],
        );
    

        return res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }

});

// updates role for user
router.patch("/:userId/role", async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        if (userId === undefined || role === undefined) {
            return res.status(400).json({ error: "userId and role are required"});
        }

        const result = await db.query(
            'UPDATE users SET role = $1 WHERE "userId" = $2 RETURNING role, "userId";', 
            [role, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
            userId: result.rows[0].userId, 
            role: result.rows[0].role, 
            message: "role in users successfully updated!"
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }

});

// get user role with specified userId
router.get("/:userId/getRole", async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(400).json({ error: "userId is required"});
        }

        const result = await db.query(
            'SELECT "userId", role FROM users WHERE "userId" = $1;',
            [userId]
        )
        const row = result.rows[0];
        if (!row) return res.status(404).json
        ({ message: "User not found" });
        return res.status(200).json(row);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

});

// get user with specified userId
router.get("/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        if (userId === undefined) {
            return res.status(400).json({ error: "userId is required"});
        }

        const result = await db.query(
            'SELECT * FROM users WHERE "userId" = $1', 
            [userId]
        );

        const row = result.rows[0];
 
        if (row === undefined) return res.status(404).json({ message: "User not found" });

        return res.status(200).json(row);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }

});



router.get("/:userName/:roomCode", async (req, res) => {
    try {
        const userName = req.params.userName;
        const roomCode = req.params.roomCode;
        if (userName === undefined || roomCode === undefined) {
            return res.status(400).json({ error: "userName and roomCode are required" });
        }

        const result = await db.query(
            `
            SELECT * FROM users 
            WHERE "userName" = $1 AND "roomCode" = $2
            LIMIT 1;
            `, 
            [userName, roomCode] 
        );

        const row = result.rows[0];

        if (row === undefined) {
                return res.status(200).json(null);
        }
        res.status(200).json(row);


    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }

});

// get all users in table
router.get("/", async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM users ORDER BY "userId" ASC;')

        res.status(200).json(result.rows);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }

});

// delete user with specified userId from table
router.delete("/delete/:userId", async (req,res) => {
    try {
        const userId = req.params.userId;
        const result = await db.query(
            'DELETE FROM users WHERE "userId" = $1', 
            [userId]
        );

        res.status(200).json({ success: true, deleted: result.rowCount }); // this.changes says how many rows were deleted

    } catch (err) {
        console.error("Error deleting user:", err);
        return res.status(500).json({ success: false, message: "Error deleting user." });
    }

});

export default router;