/* This is the home page where users will login to the room using a given roomCode*/

import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import "./App.css"; // might not need this later
import { socket } from "./socket";
import Login from "./components/login/Login";
import WaitingRoom from "./components/waiting/WaitingRoom";
import Instructions from './components/instructions/Instructions';
import Interaction from "./components/interaction/Interaction";
import Survey from "./survey/Survey";
import Exit from "./Exit";
import AdminLogin from './components/login/AdminLogin';
import Admin from "./admin/Admin";
import CompletedRoomPage from './admin/CompletedRoomDetails';
import AdminWaitingRoom from './components/waiting/AdminWaitingRoom';
import AdminInstructions from './components/instructions/AdminInstructions';
import AdminInteraction from './components/interaction/AdminInteraction';
import AdminSurvey from './admin/AdminSurvey';


function RequireState({ children, fallback = "/" }) {
  const location = useLocation();
  if (!location.state) {
    return <Navigate to={fallback} replace />;
  }
  return children;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const hideHomeOn = ["/interaction", "/waiting", "/survey", "/instructions"];
  const shouldHideHome = hideHomeOn.includes(location.pathname)
  const isAdminPage = location.pathname.startsWith("/admin");
  const isAdminLogin = location.pathname === "/admin/login";

  function handleLogout() {
    sessionStorage.removeItem("admin");
    navigate("/adminLogin");
  }

  const handleHomeClick = () => {
    const roomCode = sessionStorage.getItem("roomCode");
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
        <nav>
          {!shouldHideHome && (
            <button onClick={handleHomeClick}>Home</button> 
          )}
          {isAdminPage && !isAdminLogin && (
            <button type="button" className="nav-logout" onClick={handleLogout}>
              Logout
            </button>
          )}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/survey" element={<RequireState> <Survey /> </RequireState>} /> 
        <Route path="/interaction" element={<RequireState> <Interaction /> </RequireState>} /> 
        <Route path="/exit" element={<RequireState> <Exit /> </RequireState>}/>
        <Route path="/admin" element={<Admin />}/>
        <Route path="/waiting" element={<RequireState> <WaitingRoom /> </RequireState>} />
        <Route path="/admin/waiting" element={<RequireState fallback="/admin/login"> <AdminWaitingRoom /></RequireState>} />
        <Route path="/admin/interaction" element={<RequireState fallback="/admin/login"> <AdminInteraction/> </RequireState>} />
        <Route path='/admin/login' element={<AdminLogin/>} />
        <Route path='/instructions' element={<RequireState> <Instructions/> </RequireState>} /> 
        <Route path='/admin/instructions' element={<RequireState fallback="/admin/login"><AdminInstructions/></RequireState>} />
        <Route path='/admin/survey' element={<RequireState fallback="/admin/login"> <AdminSurvey/> </RequireState>} />
        {/* add a route to llm page when its added */}
        <Route path="*" element={window.location.pathname.includes("admin") ? ( < Navigate to= "/admin/login" /> ) : ( <Navigate to="/" />)} />
        <Route path="/admin/completed-room/:roomCode" element={<CompletedRoomPage />} />
      </Routes>
    </>
    
  );
};

