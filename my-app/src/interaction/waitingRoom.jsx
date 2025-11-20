import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import '../App.css'
import { socket } from "../socket"; 

export default function WaitingRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = location.state
 //not sure if this is the best thing to do if user is not found in state
  if (!location.state?.user) {
    return <p>Loading...</p>
  }
  const { userId } = user;
  const roomCode = String(user.roomCode);
  const [users, setUsers] = useState([]);
  const isAdmin = false;


  useEffect(() => {
    socket.emit("join-room", { roomCode, isAdmin, user });

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

  // useEffect(() => {
  //   if (users.length === 3) {
  //     setTimeout(() => {
  //       navigate("/interaction", { state: { user } });
  //     }, 400);
  //   }
  // }, [users]);


  return (
    <div className="waiting-container">
      <h1>Waiting Room</h1>
      <p>Room Code: {roomCode}</p>

      {/* <ul className="no-bullets">
        {users.map((u, idx) => (
          <li key={idx}>{u.userName}</li>
        ))}
      </ul> */}
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