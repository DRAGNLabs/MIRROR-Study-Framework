/* This is the home page where users will login to the room using a given roomCode*/

import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import Survey from "./survey/Survey";
import './App.css';
import { useState } from "react";
import { loginUser, getCreatedUser } from '../services/usersService';
import { getRoom, loginRoom } from '../services/roomsService';
import { socket } from "./socket"; 
import Interaction from "./interaction/Interaction";
import Exit from "./Exit"
import Admin from "./admin/Admin"
import WaitingRoom from './interaction/WaitingRoom';
import RoomManagement from './admin/RoomManagement'
import AdminInteraction from './admin/AdminInteraction'
import LoginAdmin from "./admin/AdminLogin";
import Instructions from './interaction/Instructions';
import AdminInstructions from './admin/AdminInstructions';
import AdminSurvey from './admin/AdminSurvey';

function RequireState({ children, fallback = "/" }) {
    const location = useLocation();
    if (!location.state) {
      return <Navigate to={fallback} replace />;
    }
    return children;
  }

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
      const canLogin = await loginRoom(roomCode);
      if (!canLogin) {
        console.log("Not a valid room Code");
        alert("Room code is not valid");
        return;
      }

      const room = await getRoom(roomCode);
      const userIds = Array.isArray(room.userIds) ? room.userIds : JSON.parse(room.userIds);
      if(room.completed) {
        alert("Game already completed");
        return;
      }
      if (userIds.length > 0) {
        const user = await getCreatedUser(name, roomCode);
        if (!user) {
          alert("Game already started, you are not part of this room.");
          return;
          // navigate("/waiting", { state: { } });
        }
        navigate("/waiting", { state: { user }});
        return;
      }
      // check if userIds are in room then only those with roomCode already in database can login
      const user = await loginUser(name, roomCode); // this is techincally register
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
  const navigate = useNavigate();
  const hideHomeOn = ["/interaction", "/waiting", "/survey", "/instructions"];
  const shouldHideHome = hideHomeOn.includes(location.pathname)
  const isAdminPage = location.pathname.startsWith("/admin");

  const handleHomeClick = () => {
    const roomCode = sessionStorage.getItem("roomCode");
    console.log(roomCode);
    // const userId = sessionStorage.getItem("userId");
    if (roomCode) {
      socket.emit("leave-room", {roomCode});
      sessionStorage.removeItem("roomCode");
    }
    navigate(isAdminPage ? "/admin" : "/");
  }

  return (
    
    <>
      <header>
        {!shouldHideHome && (
        <nav>
          {/* <Link to={isAdminPage ? "/admin" : "/"}>Home</Link> */}
          <button onClick={handleHomeClick}>Home</button>
        </nav>
        )}
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/survey" element={<RequireState> <Survey /> </RequireState>} /> 
        <Route path="/interaction" element={<RequireState> <Interaction /> </RequireState>} /> 
        <Route path="/exit" element={<RequireState> <Exit /> </RequireState>}/>
        <Route path="/admin" element={<Admin />}/>
        <Route path="/waiting" element={<RequireState> <WaitingRoom /> </RequireState>} />
        <Route path="/admin/waiting" element={<RequireState fallback="/adminLogin"> <RoomManagement /></RequireState>} />
        <Route path="/admin/interaction" element={<RequireState fallback="/adminLogin"> <AdminInteraction/> </RequireState>} />
        <Route path='/adminLogin' element={<LoginAdmin/>} />
        <Route path='/instructions' element={<RequireState> <Instructions/> </RequireState>} /> 
        <Route path='/admin/instructions' element={<RequireState fallback="/adminLogin"><AdminInstructions/></RequireState>} />
        <Route path='/admin/survey' element={<RequireState fallback="/adminLogin"> <AdminSurvey/> </RequireState>} />
        {/* add a route to llm page when its added */}
        <Route path="*" element={window.location.pathname.includes("admin") ? ( < Navigate to= "/adminLogin" /> ) : ( <Navigate to="/" />)} />
      </Routes>
    </>
    
  );
};

