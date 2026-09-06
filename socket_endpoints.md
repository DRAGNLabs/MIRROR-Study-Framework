# Socket endpoints used between frontend and backend

Note that all socket events emitted and listened to on backend are in the `/backend/socket/socketServer.js` folder

## Socket events emitted from frontend to backend

### /src/admin
| title | description | body | file |
| ----- | ----------- | ---- | ---- |
| "close-room" | Sent when an Admin closes the room | { roomCode } | Admin.jsx |
| "delete-room" | Sent when an Admin deletes a room | { roomCode } | DeleteCompletedRoom.jsx | 

### /src/common
| title | description | body | file |
| ----- | ----------- | ---- | ---- |
| "join-room" | Sent when user/admin connects/reconnects to socket | { roomCode, isAdmin, user } | socketListener.js |
| "leave-room" | Sent when it receives the force-return-to-login, essentially boots all users out of the room | None | socketListener.js |

### /src/instructions
| title | description | body | file | 
| ----- | ----------- | ---- | ---- |
| "navigate-users" | Sent when Admin clicks next on instructions page | { roomCode, status } | AdminInstructions.jsx |
| "start-round" |  Sent when Admin clicks next on instructions page | { roomCode, round } | AdminInstructions.jsx |

### /src/interaction
| title | description | body | file |
| ----- | ----------- | ---- | ---- |
| "navigate-users" | Sent when Admin clicks next on interactions page | { roomCode, status } | AdminInteraction.jsx |
| "leave-room" | Sent when Admin clicks home | { roomCode } | AdminInteraction.jsx |
| "submit-round-message" | Sent when a user submits a message | { roomCode, userId, userName, text } | Interaction.jsx |

### /src/survey
| title | description | body | file |
| ----- | ----------- | ---- | ---- |
| "join-room" | Sent when Admin reconnects to socket | { roomCode, isAdmin } | AdminSurvey.jsx |
| "survey-complete" | Sent when a user completes a survey | { roomCode, userId } | Survey.jsx |

### /src/waiting
| title | description | body | file |
| ----- | ----------- | ---- | ---- |
| "navigate-users" | Sent when admin clicks next on waiting page | { roomCode, status } | AdminWaitingRoom.jsx |


### /src/App.jsx
| title | description | body | file |
| ----- | ----------- | ---- | ---- |
| "leave-room" | Sent when admin or user clicks home | { roomCode } | App.jsx |


## Socket events emitted from backend to frontend

### /socket/gameHandler.js
| title | description | body |
| ----- | ----------- | ---- |
| "ai-start" | Sent before LLM streaming starts for LLM response | None |
| "ai-token" | Sent as LLM stream is being called | { token } |
| "ai-end" | Sent when AI streaming is done | None |
| "user-messages-complete" | Sent once all users have sent one message to LLM (or if timer runs out, whichever is first) | None |
| "ai-end" (line 185) | Sent if there is an error in getLlmText | None |
| "game-complete" (line 202) | Sent once round is equal to total rounds | None |
| "receive-message" (line 204) | Sent once game is complete | { message } |
| "timer-expired" (line 205) | Sent once game is complete | None |
| "receive-message" (line 211) | Sent if fish_amount is below 5 | { message } |
| "game-complete" (line 212) | Sent if fish_amount is below 5 | None |
| "timer-expired" (line 213) | Sent if fish_amount is below 5 | None |
| "round-complete" | Sent once round is complete | { round } |
| "receive-message" | Sent at beginning of each round for instructions message | { message } |
| "instructions-complete" | Sent after LLM Instructions are sent | ( round ) |
| "user-survey-complete" | Sent when a user completes a survey | { userId, roomCode } |
| "timer-start" | Sent whenever a new round starts after instructions have been sent | { duration, endTime } |
| "timer-expired" | Sent once timer has ended | None | 
| "all-user-messages" | Sent when all user messages have been sent or when new round start if user messages exist | { round, messages } |
| "timer-start" (line 376) | This one sends time left if checked in middle of the round | { duration, endTime } |

### /socket/socketHandler.js 
| title | description | body |
| ----- | ----------- | ---- |
| "room-users" (line 33) | Sent whenever a user joins/reconnects to the room | { userList } |
| "room-users" (line 49) | Sent whenever a user leaves/disconnects from the room | { userList } |
| "force-return-to-login" | Sent to users whenever Admin closes a room | None |

### /socket/socketServer.js
| title | description | body |
| ----- | ----------- | ---- |
| "change-status" | Sent when Admin navigates users to next page | { status } |
| "timerStarted" | Sent when timer starts for round | { endTime } |
| "timerEnded" | Sent once timer for round ends | None |
| "timeUpdate" | Sent to update round time for users/Admin | { timeLeft } |



## Socket events listend to from frontend

### /src/common
| title | description | body | file |
| ----- | ----------- | ---- | ---- |
| "connect" | Once socket is connected this will emit the socket to join the room as soon as the socket is connected for the user | None | socketListener.js |
| "force-return-to-login" | This will emit the leave-room event and navigate user back to home page (either admin or login page) | { roomCode } | DeleteCompletedRoom.jsx | 
| "change-status" | This navigates admin and users to next page (usually happens when admin clicks next) | { status } | socketListener.js |

### /src/interaction
| title | description | body | file |
| ----- | ----------- | ---- | ---- |
| "receive-message" | Adds new message to a useState array of messages that is displayed on the interactions screen | { message } | interactionSocket.js |
| "all-user-messages" | Reloads messages once all users have sent messages in case some were missed on users screen | { round, messages } | interactionSocket.js |
| "ai-start" | This starts to keep track of stream coming in from AI | None | interactionSocket.js |
| "ai-token" | Grabs new token from AI and updates streaming texts and display on interactions page | { token } | interactionSocket.js |
| "ai-end" | Ends AI stream and resets variables as needed | None | interactionSocket.js |
| "round-complete" | Sent when round is complete, this will reload the time and reset variables such as the round number and ability for users to message | { round } | interactionSocket.js |
| "game-complete" | Sent when game is complete and resets variables as needed | None | interactionSocket.js |
| "instructions-complete" | Sent when instructions are complete, resets varibles to allow users to send messages | { round } | interactionSocket.js |
| "timer-start" | Starts timer for user messages each round | { duration, endTime } | interactionSocket.js |
| "timer-expired" | Resets timer useState variables | None | interactionSocket.js |

### /src/survey
| title | description | body | file |
| ----- | ----------- | ---- | ---- |
| "user-survey-complete" | Whenever user completes survey this is used to update the display on admins page | { userId, roomCode } | AdminSurvey.jsx |


### /src/waiting
| title | description | body | file |
| ----- | ----------- | ---- | ---- |
| "room-users" | Whenever a user joins this is used to update the useState usersList | { userList } | waitingSocket.js |

## Socket events listened to on backend (should be emitted from frontend)
| title | description | body | file |
| ----- | ----------- | ---- | ---- |
| "join-room" | This joins user to room. The backend gets any relevant information such as time left, round number, etc. to user in case they reconnected in the middle of a game | { roomCode, isAdmin, user } | socketServer.js |
| "navigate-users" | Admin sends this to navigate users to next page, backend emits a change-status event to all users to navigate them | { roomCode, status } | socketServer.js |
| "start-round" | This will call the function to get the LLM instructions for the round | { roomCode, round } | socketServer.js |
| "startTimer" | Starts timer for round | None | socketServer.js |
| "submit-round-message" | Calls a function to submit user messages to backend and send them back to all users in application | { roomCode, userId, userName, text } | socketServer.js |
| "close-room" | Deletes timer and disconnects all users from the room | { roomCode } | socketServer.js |
| "survey-complete" | Updates user survey status on backend and notifies frontend | { roomCode, userId } | socketServer.js |
| "delete-room" | Deletes timer and disconnects all users from room | { roomCode } | socketServer.js |
| "leave-room" | Cleans up socketUserMap | None | socketServer.js |
| "disconnect" | Cleans up socketUserMap | None | socketServer.js |


look at lines 46-65 on socketServer.js seems pointless and not needed anymore