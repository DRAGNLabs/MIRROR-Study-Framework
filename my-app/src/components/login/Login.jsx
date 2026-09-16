import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { loginUser, getCreatedUser } from '../../services/usersService';
import { getRoom, loginRoom } from '../../services/roomsService';
import './login.css';

export default function Login() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [roomCode, setRoomCode] = useState("");
    const [error, setError] = useState("");

/** After the user hits submit it'll double check if it has a roomCode and a userName,
 *  then it will pass that information to the database and carry the userId to the next page
 */
    async function handleClick(){
        try {
            setError("");

            if (!name.trim() || !roomCode.trim()) {
                setError("Please enter your name and room code.");
                return;
            }

            const parsedRoomCode = parseInt(roomCode);
            if (isNaN(parsedRoomCode)) {
                setError("Room code must be a number.");
                return;
            }

            const canLogin = await loginRoom(parsedRoomCode);
            if (!canLogin) {
                setError("Invalid room code.");
                return;
            }

            const room = await getRoom(parsedRoomCode);
            const userIds = Array.isArray(room.userIds) ? room.userIds : JSON.parse(room.userIds);
            if(room.completed) {
                setError("This session has already ended.");
                return;
            }
            if (userIds.length > 0) {
                const user = await getCreatedUser(name, parsedRoomCode);
                if (!user) {
                    setError("This room has already started. You are not part of this session.");
                    return;
                }   
            
                const status = room.status;
                if (status === "waiting") {
                    navigate("/waiting", { state: { user }});
                } else if (status === "instructions") {
                    navigate("/instructions", { state: { user }});
                } else if (status === "interaction") {
                    navigate("/interaction", { state: { user }});
                } else if (status === "survey") {
                    navigate("/survey", { state: { user }});
                }
                return;
            }
            const user = await loginUser(name, parsedRoomCode);
            navigate("/waiting", { state: { user } }); 
        } catch (err) {
            setError(err.message || "Something went wrong. Please try again.");
        }
    };

  /** This allows the enter button to be hit and send it to the function above to login */
    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
        e.preventDefault();
        handleClick();
        }
    };

    return(
        <div className="login-page">
        <div className="login-card">
            <h1 className="login-title">Join your session</h1>
            <p className="login-subtitle">Enter your details to join the room</p>
            <form className="login-form" onSubmit={(e) => { e.preventDefault(); handleClick(); }}>
            <div className="form-field">
                <label htmlFor="name">Your name</label>
                <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Alex Johnson"
                autoComplete="name"
                />
            </div>
            <div className="form-field">
                <label htmlFor="roomCode">Room code</label>
                <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 675435"
                />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={!name.trim() || !roomCode.trim()}>
                Enter room
            </button>
            </form>
        </div>
        </div>
    );
}