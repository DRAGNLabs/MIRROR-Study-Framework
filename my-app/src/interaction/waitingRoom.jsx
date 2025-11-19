import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import '../App.css'
import { socket } from "../socket"; 

export default function WaitingRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = location.state
  // if user not passed into state sends back to home page, not sure if this is the best way to handle this or if passing info in state is really that inconsistent
  if (!user) {
    console.log("User not passed through state")
    navigate("/", { replace: true });
    return null;
  }
  const { userId, userName, roomCode } = user;
  const [users, setUsers] = useState([]);


  useEffect(() => {
    socket.emit("join-room", { roomCode, user });

    socket.on("room-users", (userList) => {
      setUsers(userList);
    });

    const onStart = () => {
      navigate("/interaction", { state: { user }});
    }
    socket.on("start-chat", onStart);

    const handleUnload = () => {
      socket.emit("leave-room", { roomCode, userId });
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      socket.off("room-users");
      socket.off("start-chat");
    };
  }, [roomCode]);

  useEffect(() => {
    if (users.length === 3) {
      setTimeout(() => {
        navigate("/interaction", { state: { user } });
      }, 400);
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