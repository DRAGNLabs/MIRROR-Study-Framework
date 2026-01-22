import pg from "pg";
const { Pool } = pg;

const pool = new Pool();

export default pool;

// const db = new sqlite3.Database("./mydatabase.db", (err) => {
//   if (err) {
//     console.error("Error opening database:", err.message);
//   } else {
//     console.log("✅ Connected to SQLite database");
//   }
// });

// export default db;
