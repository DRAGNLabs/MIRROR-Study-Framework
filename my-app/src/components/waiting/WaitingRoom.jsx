import { useLocation } from "react-router-dom";
import { useRoomSocket } from "./waitingSocket";
import { UserList } from "./UserList";
import './waiting.css';

export default function WaitingRoom() {
  const location = useLocation();
  const { user } = location.state;
  const roomCode = parseInt(user.roomCode);
  
  const { users } = useRoomSocket(roomCode, false, user);

  return (
    <div className="waiting-container">
      <div>
        <h1>Waiting Room</h1>
        <p>Room Code: {roomCode}</p>
        <UserList users={users} variant="user" />
        </div>
    </div>
  );
}