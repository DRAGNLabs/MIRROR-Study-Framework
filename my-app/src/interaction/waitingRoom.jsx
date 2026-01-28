import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import '../App.css'
import { socket } from "../socket"; 

export default function WaitingRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = location.state
  const { userId } = user;
  const roomCode = parseInt(user.roomCode);
  const [users, setUsers] = useState([]);


  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit("join-room", { roomCode, isAdmin: false, user});

    socket.on("status", (status) => {
        const currentPath = location.pathname;
        if(currentPath.includes(status)) {
            return;
        } else {
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
      navigate("/");
    })

    const handleUnload = () => {
      socket.emit("leave-room", { roomCode, userId });
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      socket.off("status");
      socket.off("room-users");
      socket.off("to-instructions", toInstructions);
      socket.off("force-return-to-login");
    };
  }, []);

    useEffect(() => {
      return () => {
          socket.emit("leave-room", { roomCode });
      };
  }, []);

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