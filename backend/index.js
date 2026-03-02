import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// [Railway] path + fileURLToPath needed to resolve the frontend dist directory
// for static file serving in production (single-service deployment).
import path from "path";
import { fileURLToPath } from "url";
import userRouter from "./routes/userRouter.js";
import surveyRouter from "./routes/surveyRouter.js";
import adminRouter from "./routes/adminRouter.js";
import roomsRouter from "./routes/roomsRouter.js"
import "./initDB.js";
import { createServer } from 'http';
import { initializeSocketServer } from "./socket/socketServer.js";


dotenv.config();

// [Railway] __dirname is not available in ES modules, so we derive it manually.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const httpServer = createServer(app);

// [Railway] CORS_ORIGIN env var controls which origins can connect.
// In production single-service mode, frontend is served from the same origin,
// so CORS is not strictly needed. This is mainly for local dev where the
// Vite dev server (port 5173) and backend (port 3001) run on different ports.
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
initializeSocketServer(httpServer, corsOrigin);

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.use("/api/users", userRouter);
app.use("/api/survey", surveyRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/admin", adminRouter);

// [Railway] Serve the React frontend's built static files from the backend.
// In production, `npm run build` in my-app/ creates a dist/ folder, and the
// backend serves it directly — this is the "single-service" deployment model
// so frontend and backend share the same origin (no CORS issues).
const frontendPath = path.join(__dirname, "../my-app/dist");
app.use(express.static(frontendPath));

// [Railway] SPA catch-all: any route that doesn't match an API endpoint serves
// index.html, so React Router can handle client-side routing (e.g. /survey, /admin).
// Uses Express 5 named wildcard syntax {*splat} (bare * is not valid in Express 5).
app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
);
