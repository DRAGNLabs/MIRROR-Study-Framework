import { getUsersInRoom } from "../../services/roomsService";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSurveyStatus } from "../../services/surveyService";
import { socket } from '../socket';

export default function AdminSurvey() {
    const location = useLocation();
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    // const [room, setRoom] = useState("");
    const { roomCode } = location.state;
    const surveyId = 1; // need to change this to what it actually will be
    const [error, setError]= useState("");

    useEffect(() => {
        if (!roomCode) {
            navigate("/admin", { replace: true});
            return;
        }
    }, [roomCode, navigate]);

    // useEffect(() => {
    //     async function fetchUsers() {
    //         try {
    //             const usersFromDB = await getUsersWithSurveyStatus(roomCode, surveyId);
    //             console.log("usersFromDB:", usersFromDB);
    //             console.log(Array.isArray(usersFromDB), usersFromDB);
    //             setUsers(usersFromDB);
    //         } catch (err) {
    //             console.error(err);
    //             setError(err.message || "Failed to fetch users");
    //         }
    //     }
    //     fetchUsers();
    // }, [roomCode, surveyId]);

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
                // console.log(usersFromDB);
                // console.log(Array.isArray(usersFromDB), usersFromDB);
                console.log(usersWithStatus);
                setUsers(usersWithStatus);
                // console.log("users 1", users);
            } catch (err) {
                console.error(err);
                setError(err.message || "failed to fetch users");
            }
        }
        // async function getUsersSurveyStatus() {
        //     try {
        //         console.log(users);
        //         for (const user of users) {
        //             const { completed } = await getSurveyStatus(user.userId);
        //             console.log("in survey status", completed);
        //             if(completed === 1) {
        //                 setUsers(prev => 
        //                     prev.map(u =>
        //                         u.userId === user.userId ? { ...u, completedSurvey: true}: u
        //                     )
        //                 );
        //             }
        //         }
        //     } catch (err) {
        //         console.error(err);
        //         setError(err.message || "failed to fetch survey status");
        //     }
        // }
        fetchUsers();
        // console.log("HERE");
        // console.log(users);
        // getUsersSurveyStatus();
    }, [roomCode]);

    // useEffect(() => {
    //     async function getUsersSurveyStatus() {
    //         try {
    //             console.log(users);
    //             for (const user of users) {
    //                 const { completed } = await getSurveyStatus(user.userId);
    //                 console.log("in survey status", completed);
    //                 if(completed === 1) {
    //                     setUsers(prev => 
    //                         prev.map(u =>
    //                             u.userId === user.userId ? { ...u, completedSurvey: true}: u
    //                         )
    //                     );
    //                 }
    //             }
    //         } catch (err) {
    //             console.error(err);
    //             setError(err.message || "failed to fetch survey status");
    //         }
    //     }
    //     getUsersSurveyStatus();
    // }, [users.length]);


    // useEffect(() => {
    //     retrieveRoom();
    // }, [roomCode]);

    useEffect(() => {
        // socket.on("room-users", setUsers);

        // socket.on("survey-complete", (user) => {
        //     setCompletedSurvey((prev) => [...prev, user]);
        // });
        socket.on("user-survey-complete", ({ userId, surveyId }) => {
            console.log("in socket for survey-complete");
            setUsers(prev =>
                prev.map(u => 
                    u.userId === userId ? { ...u, completedSurvey: true }: u
                )
            );
        });

        return () => {
            // socket.off("room-users");
            socket.off("user-survey-complete");
            // socket.off("receive-message");
        };
    }, []);



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