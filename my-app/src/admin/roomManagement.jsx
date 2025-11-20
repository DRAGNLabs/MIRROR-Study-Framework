import { useLocation, useNavigate } from "react-router-dom";

/*
Some Notes:
if user leaves room during game then it should redirect admin to this page (use websockets for this)
websockets are needed to update users list on admin page
Also needed when push start to send users to interactions page
after admin pushes start it should take admin to a new page? but idk what
This page should display link to website, QR code to website, and roomCode --> right now have dummy website and QR code

*/
export default function roomManagement() {
    const location = useLocation();
    const { room } = location.state;
    console.log("location state ", location.state);
    const users = [{userName: "Jake"}, {userName: "Nick"}, {userName: "Austin"}]

    // only allow this button to be clicked if 3 or more users have joined
    // code should prevent users from joining over the limit
    // use websocket when admin clicks this to direct users to ineractions page
    function start() {

    }


    return (
        <div className="admin-container">
        <h1>Room Management</h1>
            <p>Room Code: {room.roomCode}</p>
                        <p>https://localhost:5173</p> 
             <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1"
                alt="QR Code"
                style={{ marginTop: "20px" , marginBottom: "20px"}}
            />
                <div className="users-box">
                    <h3>Users in Room:</h3>
                    <ul>
                        {users.map((u, idx) => (
                        <li key={idx}>{u.userName}</li>
                        ))}
                    </ul>
                </div>

            {/* <p>{users.length < 3 ? "Waiting for more users..." : "Starting..."}</p> */}
            <button onClick={start}>Start</button>
        </div>
    )
}