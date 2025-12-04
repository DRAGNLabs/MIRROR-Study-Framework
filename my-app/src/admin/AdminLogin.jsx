import { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { adminLogin } from "../../services/adminService";


export function AdminLogin() {
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const [error, setError] = useState("");
    const [isValid, setIsValid] = useState(false);


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
    <div className="admin-container">
        <h1>Welcome Admin!</h1>
        <p>Enter password:</p>
        <input 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          required
        />
        {error && <p style={{ color: "red" }}>{error}</p>}

        <div className="button-group">
            <button onClick={handleClick} disabled={!password.trim()}>Login</button>
            
        </div>
    </div>
  );
} 

export default AdminLogin;