import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { adminLogin } from "../../services/adminService";


export function AdminLogin() {
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const [error, setError] = useState("");


    async function handleClick(){
        if (password){
            setError("");
            const result = await adminLogin(password); 
            if(result.ok){
                sessionStorage.setItem("admin", "true"); // persistent across navigation
                navigate("/admin");
            } else{
                setError("Incorrect password.");
            }
        }
        else{
            setError("You need a password");
        }
    }

    const handleKeyDown = (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        handleClick();
        }
    };

    return(
    <div className="admin-container admin-login">
        <div className="admin-login-card">
          <div className="admin-login-header">
            <h1>Admin</h1>
            <p>Sign in to continue</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleClick(); }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter password"
            />
            {error && <p className="admin-login-error">{error}</p>}
            <button type="submit" className="admin-login-submit" disabled={!password.trim()}>
              Sign in
            </button>
          </form>
        </div>
    </div>
  );
} 

export default AdminLogin;