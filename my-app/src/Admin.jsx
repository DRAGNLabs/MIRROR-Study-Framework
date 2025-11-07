export function Admin() {
    async function createRoom() {
        <p>Hi</p>
        /**Adding into database with a 
         * roomCode - INTEGER 
         * count - INTEGER, a number of users you want in the room
         * users - TEXT, the users in your room that join given by their id/username?*/
    }
    async function closeRoom() {
        <p>Hi</p>
    }

    return (
        <div className="admin-container">
            <div className="admin-buttons">
                <button onClick={createRoom}>Create Room</button>
                <button onClick={closeRoom}>Close Room</button>
            </div>

        </div>
    )
}

export default Admin;