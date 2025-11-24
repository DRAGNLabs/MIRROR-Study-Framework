/* This is the home page where users will login to the room using a given roomCode*/

import { Link, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Survey from "./survey/survey";
import { useState } from "react";
import './App.css';
import { loginUser, validRoomCode } from '../services/apiService';
import Interaction from "./interaction/interaction";
import Exit from "./exit"
import Admin from "./admin/Admin"
import WaitingRoom from './interaction/waitingRoom';
import RoomManagement from './admin/roomManagement'
import AdminInteraction from './admin/adminInteraction'

function Home() {
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

/** After the user hits submit it'll double check if it has a roomCode and a userName,
 *  then it will pass that information to the database and carry the userId to the next page
 */
  async function handleClick(){
    try {
      if (!name || !roomCode){
        console.log("You need both a name and a roomcode!");
        return;
      }
      const doesNotExist = await validRoomCode(roomCode);
      if (doesNotExist) {
        console.log("Not a valid room Code");
        alert("Room code is not valid");
        return;
      }
      const user = await loginUser(name, roomCode);
      const userId = user.userId; // not using this variable rn
      // add user to room database
      console.log(`${name} logged in!`);
      navigate("/waiting", { state: { user } }); 
    } catch (error) {
      setError(error.message);
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
    <div className="login-container">
        <h1>Welcome!</h1>
        <p>Enter your name:</p>
        <input 
          type="text"
          value={name} 
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ex: Katie Smith"
          required
          />
        <p>Enter a room code:</p>
        <input 
          type="text" 
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ex: 675435"
          required
        />
        <div className="button-group">
            <button onClick={handleClick} disabled={!name.trim() || !roomCode.trim()}>Login</button>
            
        </div>
    </div>
  );
}


export default function App() {
  const location = useLocation();
  const hideHomeOn = ["/interaction", "/waiting", "/survey"];
  const shouldHideHome = hideHomeOn.includes(location.pathname)
  const isAdminPage = location.pathname.startsWith("/admin");

  return (
    
    <>
      <header>
        {!shouldHideHome && (
        <nav>
          <Link to={isAdminPage ? "/admin" : "/"}>Home</Link>
        </nav>
        )}
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/survey" element={<Survey />} /> 
        <Route path="/interaction" element={<Interaction />} /> 
        <Route path="/exit" element={<Exit />}/>
        <Route path="/admin" element={<Admin />}/>
        <Route path="/waiting" element={<WaitingRoom />} />
        <Route path="/admin/roomManagement" element={<RoomManagement />} />
        <Route path="/admin/adminInteraction" element={<AdminInteraction/>} />
        {/* add a route to llm page when its added */}
      </Routes>
    </>
    
  );
};

