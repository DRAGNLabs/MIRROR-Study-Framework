import db from "./db.js";


db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      userId INTEGER PRIMARY KEY AUTOINCREMENT,
      userName TEXT NOT NULL,
      roomCode INTEGER NOT NULL,
      role TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS survey (
      surveyId INTEGER NOT NULL PRIMARY KEY,
      userId INTEGER NOT NULL,
      data TEXT NOT NULL
    )
  `);
  //userData = {userId, userName, prompt} store it in a list, items with this structure, return length of list
  //responses = 1{response} in line with the appropriate userData
  //started is boolean value (0 or 1)
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      roomCode INTEGER NOT NULL PRIMARY KEY,
      gameType INTEGER NOT NULL, 
      numRounds INTEGER NOT NULL,
      usersNeeded INTEGER NOT NULL,
      modelType TEXT NOT NULL,
      started INTEGER NOT NULL,
      userIds TEXT NOT NULL,
      userMessages TEXT NOT NULL,
      llmInstructions TEXT NOT NULL,
      llmResponse TEXT NOT NULL
    )
  `)
  // db.run(`
  //   CREATE TABLE IF NOT EXISTS llm (
  //     roomCode INTEGER NOT NULL PRIMARY KEY, 
  //     userData TEXT NOT NULL, 
  //     responses TEXT NOT NULL
  //   )
  // `);
  // db.run(`
  //   CREATE TABLE IF NOT EXISTS rooms (
  //     roomCode INTEGER NOT NULL PRIMARY KEY, 
  //     count INTEGER NOT NULL,
  //     gamesSelected TEXT NOT NULL,
  //     users TEXT NOT NULL
  //   )
  // `)


});

console.log("✅ Tables checked/created");
