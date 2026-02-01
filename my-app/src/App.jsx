/* This is the home page where users will login to the room using a given roomCode*/

import { Link, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import Survey from "./survey/Survey";
import './App.css';
import { useState } from "react";
import { loginUser, getCreatedUser } from '../services/usersService';
import { getRoom, loginRoom } from '../services/roomsService';
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
      setError("");
      if (!name || !roomCode){
        setError("Please enter your name and room code.");
        return;
      }
      const canLogin = await loginRoom(roomCode);
      if (!canLogin) {
        setError("Invalid room code.");
        return;
      }

      const room = await getRoom(roomCode);
      const userIds = JSON.parse(room.userIds);
      if(room.completed) {
        setError("This session has already ended.");
        return;
      }
      if (userIds.length > 0) {
        const user = await getCreatedUser(name, roomCode);
        if (!user) {
          setError("This room has already started. You are not part of this session.");
          return;
        }
        navigate("/waiting", { state: { user }});
        return;
      }
      const user = await loginUser(name, roomCode);
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


export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPage = location.pathname.startsWith("/admin");
  const isAdminLogin = location.pathname === "/adminLogin";

  function handleLogout() {
    sessionStorage.removeItem("admin");
    navigate("/adminLogin");
  }

  return (
    <>
      <header>
        <nav>
          <Link to={isAdminPage && !isAdminLogin ? "/admin" : "/"}>Home</Link>
          {isAdminPage && !isAdminLogin && (
            <button type="button" className="nav-logout" onClick={handleLogout}>
              Logout
            </button>
          )}
        </nav>
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

