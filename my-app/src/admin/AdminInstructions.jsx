import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../socket';
import { getRoom, updateStatus } from "../../services/roomsService";
import games from "../gameLoader"

export default function AdminInstructions() {
    const navigate = useNavigate();
    const location = useLocation();
    const { roomCode } = location.state;
    const [game, setGame] = useState(null);
    const [loading, setLoading] = useState(true);
    const isAdmin = true;

    useEffect(() => {

        async function fetchRoom() {
            try {
                const roomData = await getRoom(roomCode);
                setGame(games.find(g => parseInt(g.id) === roomData.gameType));
            } catch (err) {
                console.error("Failed to fetch rom:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchRoom();

    }, [roomCode])

    useEffect(() => {
      socket.emit("join-room", { roomCode, isAdmin });
      // if (!socket.connected) socket.connect();

      // const handleConnect = () => {
      //   socket.emit("join-room", { roomCode, isAdmin});
      // }

      // if (socket.connected) {
      //   handleConnect();
      // } else {
      //   socket.once("connect", handleConnect);
      // }
      // socket.on("connect", handleConnect);

      socket.on("force-return-to-login", () => {
        navigate("/admin");
      })

      // const handleLeaveRoom = () => {
      //   socket.emit("leave-room", { roomCode });
      // };

      // window.addEventListener("beforeunload", handleLeaveRoom);

      return () => {
        // handleLeaveRoom();
        // window.removeEventListener("beforeunload", handleLeaveRoom);
        // socket.off("connect", handleConnect);
        socket.off("force-return-to-login");
      }
    }, []);

    // useEffect(() => {
    //     return () => {
    //         socket.emit("leave-room", { roomCode });
    //     };
    // }, []);


    async function toInteractions() {
        socket.emit("start-game", { roomCode });
        socket.emit('start-round', {
            roomCode,
            round: 1
        });
        await updateStatus(roomCode, "interaction");
        navigate("/admin/interaction", { state: { roomCode } }); // will need to update this once next merge pull request happens (I changed endpoint to /admin/interactions or something like that)
    }
    
    if (loading) {
        return <p> Loading instructions...</p>;
    }

    if (!game) {
        return (
            <div className="admin-container">
                <div className="instructions-card">
                    <p>No game found for this room.</p>
                </div>
            </div>
        );
    }

    const instructions = game.instructions;
    const overview = typeof instructions === "string" ? instructions : instructions?.overview ?? "";
    const firstRound = instructions?.rounds?.[0];

    return (
  <div className="admin-container">
    <div className="instructions-card">

    <h3 className="section-title">Instructions</h3>

      <p className="instructions-overview">
        {overview}
      </p>

      {firstRound && (
        <>
      <h3 className="section-title">Your Task</h3>
      <div className="round-content">
        {firstRound.description}
      </div>
        </>
      )}

    </div>
        <div className="admin-next-bottom-left">
                <button onClick={toInteractions}>Next</button>
        </div>
  </div>
);


}