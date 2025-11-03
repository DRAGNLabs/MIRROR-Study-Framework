import db from "./db.js";


db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userName TEXT NOT NULL,
      roomCode TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS survey (
      id INTEGER NOT NULL PRIMARY KEY,
      userName TEXT NOT NULL,
      data TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS llm (
      id INTEGER NOT NULL PRIMARY KEY, 
      userName TEXT NOT NULL,
      prompts TEXT NOT NULL, 
      responses TEXT NOT NULL
    )
  `)


});

console.log("✅ Tables checked/created");
