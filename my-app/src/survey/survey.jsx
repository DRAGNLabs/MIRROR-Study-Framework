/** This page is where the user will take the survey */

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUser } from '../../services/apiService';
import { sendSurvey  } from "../../services/apiService";

export function Survey() {
    const [user, setUser] = useState(null);
    const location = useLocation();
    const { userId } = location.state || {}; //the userId is passed from the previous 
    // page although i need to double check and make sure this is still working
    const [answer, setAnswer] = useState([]);
    const [first, setFirst] = useState("");
    const [second, setSecond] = useState("");
    const [third, setThird] = useState("");
    const [ error, setError] = useState("");
    const navigate = useNavigate();
    const inputRef = useRef();


    useEffect(() => {
        async function fetchUser() {
            try {
                const data = await getUser(userId);
                setUser(data);
            } catch (err) {
                console.error("Failed to fetch user:", err);
            }
        }
        fetchUser();
    }, []);

    //handles click when the enter button is pressed
    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
        e.preventDefault();
        if (first && second && third) {
            const updated = [...answer, {first, second, third }]; //maybe find a way to store that
            // data in the db with a number associate to it to know which question?
            setAnswer(updated);
            handleClick(updated);
            } else {
                alert("Please fill in both answers before submitting!");
            }
        }
    };

    async function handleClick(updated){
        // console.log(user);

        if (!updated) return;


        try {
            console.log(userId);
            console.log(user.userName);
            console.log(updated);
            const response = await sendSurvey(userId, user.userName, updated); 
            navigate("/exit");


        } catch (err) {
            console.error("Error:", err);
            setError(err.message || "Something went wrong.");
         }
    }


    return (
        //survey using dumby questions and dumby data that will be sent.
        <div className="survey-container">
            {user ? (
                <p>{user.userName} please complete the following survey of your experience from room {user.roomCode}!</p> 
            ) : ( <p>User info is loading...</p> )}
            <p>do you like tacos?</p>
            <input 
            type="text"
            value={first} 
            ref={inputRef}
            onChange={(e) => setFirst(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="of course"
            required
            />
            
            <p>do you prefer crunchy or soft tacos?</p>
            <input 
            type="text"
            value={second}
            ref={inputRef}
            onChange={(e) => setSecond(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="crunchy of course"
            required
            />

            <p>are you having a good day?</p>
            <input 
            type="text"
            value={third} //idk if i can set the value to the same name
            ref={inputRef} // GPT says you shouldn't use same ref for all 3 inputs
            onChange={(e) => setThird(e.target.value)} 
            onKeyDown={handleKeyDown}
            placeholder="absolutely!"
            required
            />

            <div className="button-group"> 
                <button
                    onClick={() => {
                    // Only add to answers once both fields are filled
                        if (first && second && third) {
                            setAnswer((prevAnswers) => {
                                const updated = [...prevAnswers, { first, second, third }]; // build the new array
                                handleClick(updated); // do something with it immediately
                                return updated; // give React the new array to store
                            }); // Move on to next page
                        } else {
                            alert("Please fill in both answers before submitting!");
                        }
                    }}
                >
                    Submit
                </button>
            </div>

        </div>
    )
}

export default Survey;