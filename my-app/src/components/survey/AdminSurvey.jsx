import { getRoom, getUsersInRoom } from "../../services/roomsService";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { getSurveyStatus } from "../../services/surveyService";
import { socket } from "../../socket";
import { buildResourceHistory } from "./surveyUtils";
import {
    COMPENSATION_BY_PARTICIPANT_COUNT,
    placeLabel,
    rankParticipantsForCompensation,
} from "./compensation";
import './survey.css';

export default function AdminSurvey() {
    const location = useLocation();
    const [users, setUsers] = useState([]);
    const [room, setRoom] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const { roomCode } = location.state;
    // const [error, setError]= useState("");

    const resourceHistory = useMemo(() => buildResourceHistory(room ?? {}), [room]);
    const ranked = useMemo(
        () => rankParticipantsForCompensation(users, resourceHistory),
        [users, resourceHistory]
    );
    const payoutsKnown = COMPENSATION_BY_PARTICIPANT_COUNT[users.length] != null;
    const totalPayout = ranked.reduce((sum, user) => sum + (user.payout ?? 0), 0);

    // this basically rerenders survey status if you refresh
    useEffect(() => {
        async function fetchUsers() {
            try {
                const [usersFromDB, roomFromDB] = await Promise.all([
                    getUsersInRoom(roomCode),
                    getRoom(roomCode),
                ]);
                const usersWithStatus = await Promise.all(
                    usersFromDB.map(async (user) => {
                        const { completed } = await getSurveyStatus(user.userId);
                        return {
                            ...user,
                            completedSurvey: completed
                        };
                    })
                );
                setUsers(usersWithStatus);
                setRoom(roomFromDB);
            } catch (err) {
                console.error(err);
                // setError(err.message || "failed to fetch users");
            } finally {
                setLoaded(true);
            }
        }
        fetchUsers();
    }, [roomCode]);


    useEffect(() => {
        const handleConnect = () => {
            sessionStorage.setItem("roomCode", roomCode);
            socket.emit("join-room", { roomCode, isAdmin: true}); 
        }

        if (socket.connected) {
            handleConnect();
        } else {
            socket.once("connect", handleConnect);
        }

        socket.on("user-survey-complete", ({ userId, roomCode }) => {
            setUsers(prev =>
                prev.map(u => 
                    u.userId === userId ? { ...u, completedSurvey: true }: u
                )
            );
        });

        return () => {
            socket.off("connect", handleConnect);
            socket.off("user-survey-complete");
        };
    }, [socket]);

    return (
        <div className="admin-container">
        <h1>Survey Status</h1>

            <div className="admin-survey-stack">
            <div className="survey-status-box">
                <div className="survey-status-header">
                    <h3>Compensation</h3>
                    {payoutsKnown && resourceHistory.length > 0 && (
                        <span className="survey-progress">${totalPayout} total</span>
                    )}
                </div>

                {!loaded ? (
                    <p className="compensation-note">Loading compensation...</p>
                ) : resourceHistory.length === 0 ? (
                    <p className="compensation-note">
                        Fish allocations have not been recorded for this room yet, so places and amounts cannot be calculated.
                    </p>
                ) : !payoutsKnown ? (
                    <p className="compensation-note">
                        Amounts are set for rooms of 3, 4, or 5 participants. This room has {users.length}.
                    </p>
                ) : (
                    <>
                        <p className="compensation-note">
                            Ranked by total fish caught. Use these amounts on the compensation form.
                        </p>
                        <ol className="compensation-list">
                            {ranked.map((user) => (
                                <li key={user.userId} className="compensation-row">
                                    <span className="compensation-place">{placeLabel(user.place)}</span>
                                    <span className="compensation-person">
                                        <span className="user-name">{user.userName}</span>
                                        <span className="compensation-fish">{user.fish} fish</span>
                                        {user.tiedWith.length > 0 && (
                                            <span className="compensation-tie">
                                                Same fish total as {user.tiedWith.join(", ")}. Listed alphabetically.
                                            </span>
                                        )}
                                    </span>
                                    <span className="compensation-amount">${user.payout}</span>
                                </li>
                            ))}
                        </ol>
                    </>
                )}
            </div>

            <div className="survey-status-box">
            <div className="survey-status-header">
                <h3>Survey Completion</h3>
                <span className="survey-progress">
                {users.filter(u => u.completedSurvey).length} / {users.length} completed
                </span>
            </div>

            <ul className="survey-user-list">
                {users.map(user => (
                <li
                    key={user.userId}
                    className={`survey-user ${
                    user.completedSurvey ? "completed" : "pending"
                    }`}
                >
                    <span className="user-name">{user.userName}</span>
                    <span className="status-badge">
                    {user.completedSurvey ? "Completed" : "Pending"}
                    </span>
                </li>
                ))}
            </ul>
            </div>
            </div>

        </div>
    )

}