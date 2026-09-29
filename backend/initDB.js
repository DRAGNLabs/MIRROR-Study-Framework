import db from "./db.js";


async function init() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      "userId" INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      "userName" TEXT NOT NULL,
      "roomCode" INTEGER NOT NULL,
      role INTEGER NOT NULL DEFAULT 0,
      user_status jsonb NOT NULL DEFAULT '{"1": 0}'::jsonb
    )
  `); //make default of role 0

  // Same issue as the rooms migration below: CREATE TABLE IF NOT EXISTS skips
  // altering a users table that already existed before role/user_status were
  // added to this definition.
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role INTEGER NOT NULL DEFAULT 0
  `);
  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS user_status jsonb NOT NULL DEFAULT '{"1": 0}'::jsonb
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
  await db.query(`
    CREATE TABLE IF NOT EXISTS survey (
      "roomCode" INTEGER NOT NULL,
      "userId" INTEGER NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY ("roomCode", "userId")
    )
  `);

/*
 * =====================================
 *  Room Folders Table
 * =====================================
 * Folders for grouping completed rooms (e.g. "Version 1" of an automated
 * test batch). Created before rooms because rooms."folderId" references it.
 *
 * description is free text the researcher writes about what changed before the batch was run
 * rooms: [roomCode, roomCode, ...] in the folder, oldest first. Redundant with
 *   rooms."folderId" (which stays the source of truth) but handy when looking at
 *   the table directly. The routes keep it up to date by calling syncFolderRooms()
 *   in folderRooms.js whenever a room changes folders.
 */
  await db.query(`
    CREATE TABLE IF NOT EXISTS room_folders (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      rooms jsonb NOT NULL DEFAULT '[]'::jsonb
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
 * usersNeeded is the minimum number of users required to start a room (not a max)
 * userIds is list of userIds in room
 * userMessages: {round#1: [[userId, userMessage], [userId2, userMessage2],...], round#2: [[userId, userMessage], [userId2, userMessage2],...],...} I changed it to lists since JSON doesn't support tuples
 * llmInstructions: {round#1: "llmInstructions1", round#2: "llmInstructions2",...}
 * llmResponse: {round#1: "llmResponse1", round#2: "llmResponse2",...}
 * status is a string that will be either waiting | instructions | interaction | survey
 * completed is boolean value (0 or 1) used to know what rooms to show on admin page
 * I believe resoureAllocations is {"round_num": {"userName": "Allocation", "userName": "Allocation"}} -- Khaleel if you could update this
 * fish_amount: {round#1: <amount of fish>, round#2: <amount of fish>, ...}
 * folderId is the room_folders id this room is filed in (null = unfiled). Deleting a folder just un-files its rooms
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
      "resourceAllocations" jsonb NOT NULL DEFAULT '{}'::jsonb,
      fish_amount jsonb NOT NULL DEFAULT '{"1": 100}'::jsonb,
      curr_round INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "isTest" BOOLEAN NOT NULL DEFAULT FALSE,
      "folderId" INTEGER REFERENCES room_folders(id) ON DELETE SET NULL
    )
  `);

  // New columns on rooms: CREATE TABLE IF NOT EXISTS skips altering existing tables.
  // await db.query(`
  //   ALTER TABLE rooms
  //   ADD COLUMN IF NOT EXISTS curr_round INTEGER NOT NULL DEFAULT 1
  await db.query(`
    ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  // Flags a room as an automated/simulated run (predetermined bot messages,
  // no real participants) so it's obvious on the admin pages and never gets
  // confused with a real study session.
  await db.query(`
    ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT FALSE
  `);
  // Which room_folders folder the room is filed in (see Room Folders Table above).
  await db.query(`
    ALTER TABLE rooms
    ADD COLUMN IF NOT EXISTS "folderId" INTEGER REFERENCES room_folders(id) ON DELETE SET NULL
  `);

  // Rebuild every folder's list on startup in case anything drifted.
  await db.query(`
    UPDATE room_folders f
    SET rooms = COALESCE(
      (SELECT jsonb_agg(r."roomCode" ORDER BY r."createdAt")
       FROM rooms r WHERE r."folderId" = f.id),
      '[]'::jsonb
    )
  `);

  console.log("✅ Tables checked/created");
};

init().catch((err) => {
  console.error("initDB error:", err);
  process.exit(1);
})


