import db from "./db.js";


db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      userId INTEGER PRIMARY KEY AUTOINCREMENT,
      userName TEXT NOT NULL,
      roomCode INTEGER NOT NULL,
      role INTEGER NOT NULL DEFAULT 0
    )
  `);

/*
 * =====================================
 *  Survey Table
 * =====================================
 * Below is the descriptions for the format
 * of data
 *
 * data is {"question1": "answer1", "question2": "answer2",...}
 */
  db.run(`
    CREATE TABLE IF NOT EXISTS survey (
      surveyId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (surveyId, userId)
    )
  `);

 /*
 * =====================================
 *  Rooms Table
 * =====================================
 * Below are the descriptions for the format
 * of most values in the table 
 * (the ones that aren't obvious)
 *
 * started is boolean value (0 or 1)
 * usersNeeded currently Integer, but might consider making it a list of a range of users
 * userIds is list of userIds in room
 * userMessages: {round#1: [[userId, userMessage], [userId2, userMessage2],...], round#2: [[userId, userMessage], [userId2, userMessage2],...],...} I changed it to lists since JSON doesn't support tuples
 * llmInstructions: {round#1: "llmInstructions1", round#2: "llmInstructions2",...}
 * llmResponse: {round#1: "llmResponse1", round#2: "llmResponse2",...}
 * status is a string that will be either waiting | instructions | interaction | survey
 * completed is boolean value (0 or 1) used to know what rooms to show on admin page 
 */
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      roomCode INTEGER NOT NULL PRIMARY KEY,
      gameType INTEGER NOT NULL, 
      numRounds INTEGER NOT NULL,
      usersNeeded INTEGER NOT NULL,
      modelType TEXT NOT NULL,
      started INTEGER NOT NULL DEFAULT 0,
      userIds TEXT NOT NULL DEFAULT '[]',
      userMessages TEXT NOT NULL DEFAULT '{}',
      llmInstructions TEXT NOT NULL DEFAULT '{}',
      llmResponse TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT '',
      completed INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Add resourceAllocations column for storing per-round fish splits, if it doesn't exist yet.
  db.run(
    `
    ALTER TABLE rooms
    ADD COLUMN resourceAllocations TEXT NOT NULL DEFAULT '{}'
    `,
    (err) => {
      if (err && !String(err.message).includes("duplicate column name")) {
        console.error(
          "Error adding resourceAllocations column to rooms:",
          err.message
        );
      }
    }
  );

});

console.log("✅ Tables checked/created");
