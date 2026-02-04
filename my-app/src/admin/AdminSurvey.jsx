import { getUsersInRoom } from "../../services/roomsService";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSurveyStatus } from "../../services/surveyService";
import { socket } from '../socket';

export default function AdminSurvey() {
    const location = useLocation();
    const [users, setUsers] = useState([]);
    const { roomCode } = location.state;
    // const [error, setError]= useState("");

    // this basically rerenders survey status if you refresh
    useEffect(() => {
        async function fetchUsers() {
            try {
                const usersFromDB = await getUsersInRoom(roomCode);
                const usersWithStatus = await Promise.all(
                    usersFromDB.map(async (user) => {
                        const { completed } = await getSurveyStatus(user.userId);
                        return {
                            ...user,
                            completedSurvey: completed === 1
                        };
                    })
                );
                setUsers(usersWithStatus);
            } catch (err) {
                console.error(err);
                // setError(err.message || "failed to fetch users");
            }
        }
        fetchUsers();
    }, [roomCode]);


    useEffect(() => {
        // socket.emit("join-room", {roomCode, isAdmin: true});
        // if (!socket.connected) socket.connect();

        const handleConnect = () => {
            sessionStorage.setItem("roomCode", roomCode);
            socket.emit("join-room", { roomCode, isAdmin: true}); 
        }

        if (socket.connected) {
            handleConnect();
        } else {
            socket.once("connect", handleConnect);
        }
        // socket.on("connect", handleConnect);

        socket.on("user-survey-complete", ({ userId, surveyId }) => {
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

    // useEffect(() => {
    //     return () => {
    //         socket.emit("leave-room", { roomCode });
    //     };
    // }, []);

    return (
        <div className="admin-container">
        <h1>Survey Status</h1>
        <div className="survey-progress-bar">
        <div
            className="survey-progress-fill"
            style={{
            width: `${(users.filter(u => u.completedSurvey).length / users.length) * 100}%`
            }}
        />
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
    )

}