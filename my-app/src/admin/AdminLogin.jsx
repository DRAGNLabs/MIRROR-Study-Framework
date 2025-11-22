import { useState } from "react";
import { useNavigate } from 'react-router-dom';


export function AdminLogin() {
    const [userName, setUserName] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const [error, setError] = useState("");


    async function handleClick(){
        if (userName === "admin" && password === "admin"){
            setError("");
            navigate("/admin");
        }
        else{
            setError("Username or password is incorrect.");
        }
    }

    const handleKeyDown = (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        handleClick();
        }
    };

    return(
    <div className="admin-container">
        <h1>Welcome Admin!</h1>
        <p>Enter the username:</p>
        <input 
          type="text"
          value={userName} 
          onChange={(e) => setUserName(e.target.value)}
          onKeyDown={handleKeyDown}
          required
          />
        <p>Enter the password:</p>
        <input 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          required
        />
        {error && <p style={{ color: "red" }}>{error}</p>}

        <div className="button-group">
            <button onClick={handleClick} disabled={!userName.trim() || !password.trim()}>Login</button>
            
        </div>
    </div>
  );
} 

export default AdminLogin;