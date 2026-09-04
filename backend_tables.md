# Backend Tables

Below are descriptions of the 3 tables and what is stored in them. 

## **Users**     

| Name | Type/Format | Purpose |
| ---- | ----------- | ------- |
| "userId" | INTEGER, Primary key | A unique identifier for each user |
| "userName" | TEXT | Name of user, used to identify user when messaging and when LLM allocates resources |
| "roomCode" | INTEGER | Room identifier that user joins (the same user can't join two rooms) |
| role | INTEGER | Role assigned to user when game starts, determines how they request resources. The role is used as an index for the role in the game file |


## **Rooms**

| Name | Type/Format | Purpose | 
| ---- | ----------- | ------- |
| "roomCode" | INTEGER, Primary key | roomCode generated when room is created, allows users to join room |
| "gameType" | INTEGER | For fetching the gameFile that has the game type Admin specified when creating the room |
| "numRounds" | INTEGER | Also specified in gameFile, keeps track of how many resousrce allocation rounds users go through. |
| "usersNeeded" | INTEGER | Users needed for a Admin to start game, specified by Admin when creating room | 
| "modelType" | TEXT | Model type specified by Admin when creating the room (right now gpt models are available) | 
| started | BOOLEAN | Set to 1 when Admin opens a room and allows users to join room | 
| "userIds" | jsonb [] | When Admin moves to instructions it saves all the userIds that are currently in the room, any user that joined in waiting room and left before game started won't be tracked here |
| "userMessages" | jsonb {round#1: [[userId, userMessage],...]...} | Keeps track of user messages/resources requests to LLM |
| "llmInstructions" | jsonb {round#1: "llmInstructions1",...} | Keeps track of LLM instructions for each round | 
| "llmResponse" | jsonb {round#1: "llmResponse1",...} | Keeps track of LLM response for each round |
| status | TEXT DEFAULT 'waiting | Status that room is in: waiting, instructions, interactions, survey |
| completed | BOOLEAN DEFAULT false | Set to 1 when all users finish their survey in the corresponding room, or when Admin closes the room (moves room to completed rooms page when set to 1) |
| "resourceAllocations" | jsonb {round#1: {"Username": Allocation1,...}} | Keeps track of allocation per user to update allocations on interactions page |
| fish_amount | jsonb DEFAULT {"1": 100}, {round#1: <amount of fish>, ...} | Keeps track of fish amount across rounds to update for each new round |
| curr_round | INTEGER DEFAULT 1 | What round the game is on |
| "createdAt" | TIMESTAMPTZ DEFAULT NOW() | Allows us to sort games by time created |


## **Survey**
| Name | Type/Format | Purpose |
| ---- | ----------- | ------- |
| "roomCode" | INTEGER | roomCode specifies what room the survey came from |
| "userId" | INTEGER | Specifies what user submitted the survey |
| data | JSONB {"question1": "answer1",...} | Formatted questions and answers from user |
| PRIMARY KEY ("roomCode", "userId") | N/A | Key for survey is roomCode and userId |