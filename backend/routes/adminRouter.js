import express from "express";
const router = express.Router();
import db from "../db.js"; 
import bcrypt from "bcrypt";

router.post("/login", async (req, res) => {
//   try {
//     const inputPassword = req.body.password;
//     const isAdmin = await bcrypt.compare(inputPassword, process.env.ADMIN_PASSWORD_HASH);

//     if (!isAdmin) {
//       return res.status(401).json({ ok: false, error: "Unauthorized" });
//     }

//     res.json({ ok: true, message: "Admin authenticated" });
  
//   } catch (err){
//     return res.status(500).json({ error: "Server error", details: err.message });
//   }
    if (req.body.password === "Drag0ns"){
        return res.json({ ok: true, message: "Admin authenticated" });
    }
    else {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
})

export default router;