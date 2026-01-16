import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../socket';
import { getRoom } from "../../services/roomsService";
import game1 from "../games/game1.json";
import game2 from "../games/game2.json";
import game3 from "../games/game3.json";

const gameMap = { // we need to find a better way to access the games then just doing this multiple times also having to import each game individually is not a good idea
    1: game1,
    2: game2, 
    3: game3
}

export default function AdminInstructions() {
    const navigate = useNavigate();
    const location = useLocation();
    const { roomCode } = location.state;
    const [game, setGame] = useState(null);
    const [loading, setLoading] = useState(true);
    const isAdmin = true;

    useEffect(() => {
        socket.emit("join-room", { roomCode, isAdmin});
        async function fetchRoom() {
            try {
                const roomData = await getRoom(roomCode);
                setGame(gameMap[roomData.gameType]);
            } catch (err) {
                console.error("Failed to fetch rom:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchRoom();

    }, [roomCode])

    useEffect(() => {
      socket.on("force-return-to-login", () => {
        navigate("/admin");
      })

      return () => {
        socket.off("force-return-to-login");
      }
    }, []);

    async function toInteractions() {
        socket.emit("start-game", { roomCode });
        socket.emit('start-round', {
            roomCode,
            round: 1
        });
        navigate("/admin/interaction", { state: { roomCode } }); // will need to update this once next merge pull request happens (I changed endpoint to /admin/interactions or something like that)
    }
    
    if(loading) {
        return <p> Loading instructions...</p>;
    }

    return (
  <div className="admin-container">
    <div className="instructions-card">

    {<h3 className="section-title">Instructions</h3>}

      <p className="instructions-overview">
        {game.instructions.overview}
      </p>

      <h3 className="section-title">Rounds</h3>

      <div className="rounds-container">
        {game.instructions.rounds.map((round, index) => (
          <div key={round.round} className="round-row">
            <div className="round-badge">{index + 1}</div>
            <div className="round-content">
              {round.description}
            </div>
          </div>
        ))}
      </div>

      <h3 className="section-title">Overall Goal</h3>

      <p className="instructions-overview">
        {game.instructions.goal}
      </p>

    </div>
        <div className="admin-next-bottom-left">
                <button onClick={toInteractions}>Next</button>
        </div>
  </div>
);


}