// components/UserList.jsx
export function UserList({ users, usersNeeded, variant="user" }) {
  const className = variant === "admin" ? "users-box" : "users-card";
  return (
    <div className={className}>
      <h3>{usersNeeded ? "Participants" : "Users in Room:"}</h3>
      {usersNeeded && (
        <p className="users-progress">{users.length} joined (min {usersNeeded})</p>
      )}
      <ul>
        {users.map((u, idx) => (
          <li key={idx}>{u.userName}</li>
        ))}
      </ul>
    </div>
  );
}