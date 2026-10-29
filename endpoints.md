# Enpoints Between Frontend and Backend

## Endpoints used in frontend

## Users
| Method | Path | Description | Body |
| ------ | ---- | ----------- | ---- |
| POST | /api/users/ | Creates and logins a user to the game | { userName, roomCode } |
| PATCH | /api/users/:userId/role | Updates role for user once game starts | { role } |
| GET | /api/users/:userId/getRole | Gets user role with specific userId | None | 
| GET | /api/users/:userId | Gets user with specific userId | None |
| GET | /api/users/:userName/:roomCode | Gets user with specific userNamen and roomCode | None |
| GET | /api/users/ | Gets all the users | None | 
| DELETE | /api/users/delete/:userId | Deletes a user with a specific userId | None |



## Rooms
--> check when userMessages and completed are updated

| Method | Path | Description | Body |
| ------ | ---- | ----------- | ---- |
| POST | /api/rooms/ | Creates a new room, parameters are specified by Admin when creating room in Admin.jsx, except numRounds which is in game file and roomCode | { roomCode, gameType, numRounds, usersNeeded, modelType } |
| PATCH | /api/rooms/:roomCode/userIds | Updates userIds and started to True, used when Admin directs users to instructions page | { userIds } |
| PATCH | /api/rooms/:roomCode/started | Updates started to true when admin clicks start room on Admin.jsx | None | 
| PATCH | /api/rooms/:roomCode/llmInstructions | Updates llmInstructions each round when LLM sends them | { llmInstructions } |
| PATCH | /api/rooms/:roomCode/userMessages | Updates userMessages ??? | { userMessages } |
| PATCH | /api/rooms/:roomCode/llmResponse | Updates llmResponse each round when LLM sends it | { llmResponse } |
| PATCH | /api/rooms/:roomCode/resourcesAllocations | Updates resourcesAllocations at the end of each round for each user | { resourcesAllocations } |
| PATCH | /api/rooms/:roomCode/fishAmount | Updates how much fish is left in the lake at the end of each round | { fishAmount } |
| PATCH | /api/rooms/:roomCode/completed | Updates room as completed when ??? | None |
| GET | /api/rooms/ | Gets all rooms | None |
| GET | /api/rooms/nonCompleted | Gets all rooms that aren't completed (for Admin.jsx) | None |
| GET | /api/rooms/isCompleted | Gets all rooms that are completed, shows up on completed rooms tab in Admin.jsx | None |
| POST | /api/rooms/valid | Lets us know if roomCode is valid or not (checks if room with roomCode exists) | { roomCode } |
| GET | /api/rooms/:roomCode/login | I honestly don't know the point of this endpoint | None |
| DELETE | /api/rooms/delete/:roomCode | Deletes a room based on roomCode | None |
| GET | /api/rooms/:roomCode | Gets room with specific roomCode | None
| GET | /api/rooms/:roomCode/users | Gets all users that are in room (uses userIds in room table to query users table) | None |
| PATCH | /api/rooms/:roomCode/status | Updates status for room whenever admin navigates to a new page (available values are waiting, instruction, interactions, and survey) | { status } |
| PUT | /api/rooms/complete/:roomCode | Changes room state from incomplete to complete, honestly don't see the point of this endpoint | None |
| PUT | /api/rooms/incomplete/:roomCode | Changes room state from incomplete to complete | None |
| PATCH | /api/rooms/:roomCode/currRound | Updates current round whenever a round ends | { currRound } |





## Survey
| Method | Path | Description | Body |
| ------ | ---- | ----------- | ---- |
| POST | /api/survey/noData | Inputs roomCode and userId into survey table without the survey data | { roomCode, userId } |
| POST | /api/survey/ | Inputs the survey data (questions and answers) with the roomCode and userId into the table | { roomCode, userId, data } |
| GET | /api/survey/ | Gets all the survey data | None |
| GET | /api/survey/:userId | Returns a boolean of whether user has finished survey or not | None |
| GET | /api/survey/user/:userId | Gets a user's survey based on userId | None |
| DELETE | /api/survey/delete/:roomCode | Deletes a rooms surveys based on roomCode | None |


## Admin
| Method | Path | Description | Body |
| ------ | ---- | ----------- | ---- |
| POST | /api/admin/login | Compares input password to actual hashed password | { password } |