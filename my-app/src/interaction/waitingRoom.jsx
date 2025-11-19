import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import '../App.css'
import { socket } from "../socket"; 

export default function WaitingRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = location.state

  if (!user) {
    navigate("/", { replace: true });
    return null;
  }

  const { userId, userName, roomCode } = user;
  // const roomCode  = user.roomCode;
  // const userId = user.userId;
  const [users, setUsers] = useState([]);

  console.log("user in waitingRoom.jsx ", user);

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
    // socket.on("start-chat", () => {
    //   onStart();
    // });

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      socket.off("room-users");
      socket.off("start-chat");
    };
  }, [roomCode]);

  // leave-room and beforeunload
  // NEW CODE
  // useEffect(() => {
  //   const handleUnload = () => {
  //       socket.emit("leave-room", { roomCode, userId });
  //   };

  //   window.addEventListener("beforeunload", handleUnload);

  //   return () => {
  //       // socket.emit("leave-room", { roomCode, userId });
  //       window.removeEventListener("beforeunload", handleUnload);
  //   };
  // }, []);

  // END OF NEW CODE

  // function onStart() {
  //   navigate("/interaction", {
  //     state: { user }
  //   });
  // }
  useEffect(() => {
    if (users.length === 3) {
      // small delay for UX
      setTimeout(() => {
        navigate("/interaction", { state: { user } });
      }, 400);
    }
  }, [users]);

  // useEffect(() => {
  //   if (users.length >= 3) {
  //     setTimeout(() => onStart(), 800);
  //   }
  // }, [users]);

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