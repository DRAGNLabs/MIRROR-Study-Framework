import db from "./db.js";


async function init() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      "userId" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      "userName" TEXT NOT NULL,
      "roomCode" INTEGER NOT NULL,
      role INTEGER NOT NULL DEFAULT 0 
    )
  `); //make default of role 0

/*
 * =====================================
 *  Survey Table
 * =====================================
 * Below is the descriptions for the format
 * of data
 *
 * data is {"question1": "answer1", "question2": "answer2",...}
 */
  await db.query(`
    CREATE TABLE IF NOT EXISTS survey (
      "surveyId" INTEGER NOT NULL,
      "userId" INTEGER NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY ("surveyId", "userId")
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
  await db.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      "roomCode" INTEGER NOT NULL PRIMARY KEY,
      "gameType" INTEGER NOT NULL, 
      "numRounds" INTEGER NOT NULL,
      "usersNeeded" INTEGER NOT NULL,
      "modelType" TEXT NOT NULL DEFAULT 'default',
      started BOOLEAN NOT NULL DEFAULT FALSE,
      "userIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "userMessages" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "llmInstructions" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "llmResponse" jsonb NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'waiting',
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      "resourceAllocations" jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `)
  console.log("✅ Tables checked/created");
};

init().catch((err) => {
  console.error("initDB error:", err);
  process.exit(1);
})


