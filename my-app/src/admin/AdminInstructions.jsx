import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from '../socket';

export default function AdminInstructions() {
    const navigate = useNavigate();
    
    const { roomCode } = location.state;

    async function toInteractions() {
        // socket.emit("start-game", { roomCode });
        // let userIds = [];
        // for (let i = 0; i < users.length; i++) {
        //     userIds.push(users[i].userId);
        // }
        // await updateUserIds(userIds, roomCode);
        socket.emit('start-round', {
            roomCode,
            round: 1
        });
        navigate("/admin/adminInteraction", { state: { roomCode } });
    }
    
    return(
        <div className="admin-container">
        <h1>Instructions</h1>
            <div className="admin-next-bottom-left">
                <button onClick={toInteractions}>Next</button>
            </div>
        </div>
    )
}