import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import '../App.css'
import { socket } from "../socket"; 

export default function WaitingRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = location.state;
  const roomCode = parseInt(user.roomCode);
  const [users, setUsers] = useState([]);


  useEffect(() => {
    const handleJoinRoom = () => {
      sessionStorage.setItem("roomCode", roomCode);
      socket.emit("join-room", { roomCode, isAdmin: false, user});
    }

    if (socket.connected) {
      handleJoinRoom();
    } else {
      socket.once("connect", handleJoinRoom);
    }

    socket.on("status", (status) => {
        const currentPath = location.pathname;
        console.log("Current path name in waiting room", currentPath);
        console.log("status", status);
        if(!currentPath.includes(status)) {
            navigate(`/${status}`, { state: { user } });
        }
    });

    socket.on("room-users", (userList) => {
      setUsers(userList);
    });

    const toInstructions = () => {

      navigate("/instructions", { state: { user }});
    }

    socket.on("to-instructions", toInstructions);

    socket.on("force-return-to-login", () => {
      socket.emit("leave-room");
      navigate("/");
    })

    return () => {
      socket.off("connect", handleJoinRoom);
      socket.off("status");
      socket.off("room-users");
      socket.off("to-instructions", toInstructions);
      socket.off("force-return-to-login");
    };
  }, [socket]);


  return (
    <div className="waiting-container">
      <h1>Waiting Room</h1>
      <p>Room Code: {roomCode}</p>

      <div className="users-card">
        <h3>Users in Room:</h3>
        <ul>
          {users.map((u, idx) => (
            <li key={idx}>{u.userName}</li>
          ))}
        </ul>
      </div>

      <p>{users.length < 3 ? "Waiting for more users..." : "Starting..."}</p>
    </div>
  );
}