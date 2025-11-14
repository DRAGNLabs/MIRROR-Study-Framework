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
  //userData = {userId, userName, prompt} store it in a list, items with this structure, return length of list
  //responses = 1{response} in line with the appropriate userData
  db.run(`
    CREATE TABLE IF NOT EXISTS llm (
      roomCode INTEGER NOT NULL PRIMARY KEY, 
      userData TEXT NOT NULL, 
      responses TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      roomCode INTEGER NOT NULL PRIMARY KEY, 
      count INTEGER NOT NULL,
      gamesSelected TEXT NOT NULL,
      users TEXT NOT NULL
    )
  `)


});

console.log("✅ Tables checked/created");
