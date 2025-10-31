import sqlite3 from "sqlite3";
sqlite3.verbose();

const db = new sqlite3.Database("./mydatabase.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("✅ Connected to SQLite database");
  }
});

export default db;
