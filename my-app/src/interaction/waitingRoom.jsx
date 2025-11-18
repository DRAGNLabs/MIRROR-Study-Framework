import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import '../App.css'
import { socket } from "../socket"; 

export default function WaitingRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = location.state
  const roomCode  = user.roomCode;

  const [users, setUsers] = useState([]);

  console.log("user in waitingRoom.jsx ", user);

  useEffect(() => {
    socket.emit("join-room", { roomCode, user });

    socket.on("room-users", (userList) => {
      setUsers(userList);
    });

    socket.on("start-chat", () => {
      onStart();
    });

    return () => {
      socket.off("room-users");
      socket.off("start-chat");
    };
  }, []);

  // leave-room and beforeunload
  // useEffect(() => {
  //   const handleUnload = () => {
  //       socket.emit("leave-room", { roomCode, userId });
  //   };

  //   window.addEventListener("beforeunload", handleUnload);

  //   return () => {
  //       socket.emit("leave-room", { roomCode, userId });
  //       window.removeEventListener("beforeunload", handleUnload);
  //   };
  // }, []);

  function onStart() {
    navigate("/interaction", {
      state: { user }
    });
  }

  useEffect(() => {
    if (users.length >= 3) {
      setTimeout(() => onStart(), 800);
    }
  }, [users]);

  return (
    <div className="waiting-container">
      <h1>Waiting Room</h1>
      <p>Room Code: {roomCode}</p>

      <ul className="no-bullets">
        {users.map((u, idx) => (
          <li key={idx}>{u.userName}</li>
        ))}
      </ul>

      <p>{users.length < 3 ? "Waiting for more users..." : "Starting..."}</p>
    </div>
  );
}