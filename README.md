# MIRROR-Study-Framework
[![Preview of PDF](Workflow-preview.png)](Workflow.pdf)
**Workflow for website**

## Install Node.js 
Make sure you have Node.js Version 20 or higher installed - npm comes with Node automatically. To check if you have the right versions installed run:
```bash
node -v
npm -v
```

If Node.js is not installed or your verison is <20, download and install the latest LTS version from the [Node.js website](https://nodejs.org/en). 

After installation rerun the commands above to confirm Node.js and npm are installed and up to date.

## Create .env file
In the `backend/` directory, create a `.env` file. See `backend/.env.example` for all required variables. At minimum you need:
- `OPENAI_MODEL` — the OpenAI model to use (e.g., `gpt-4o`)
- `OPENAI_API_KEY` — your OpenAI API key
- `ADMIN_PASSWORD_HASH` — bcrypt hash of your admin login password
- PostgreSQL connection variables:
  - `PGHOST` — database host (locally this is `localhost`)
  - `PGPORT` — database port (Postgres default is `5432`)
  - `PGDATABASE` — name of your database (e.g., `mirror_study`, or whatever you created)
  - `PGUSER` — database user (locally this is usually `postgres`)
  - `PGPASSWORD` — password for that user (whatever you set when installing Postgres)

A typical local `.env` looks like:
```
PGHOST=localhost
PGPORT=5432
PGDATABASE=mirror_study
PGUSER=postgres
PGPASSWORD=yourpassword
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
ADMIN_PASSWORD_HASH=$2b$10$...
```

You need a running PostgreSQL instance locally. The tables are created automatically when the backend starts (`initDB.js`).

## Local Development
### Clone the Repository
```bash
git clone https://github.com/DRAGNLabs/MIRROR-Study-Framework.git
cd MIRROR-Study-Framework
```

### Start the Backend
```bash
cd backend
npm install
npm run dev
```
This starts the backend on port 3001 with auto-restart (nodemon).

### Start the Frontend
Open a new terminal and navigate to the repository:
```bash
cd my-app
npm install
npm run dev
```

This starts the frontend at http://localhost:5173/

## Production Deployment (Railway)
For deploying to Railway, see [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for the full setup guide, code changes reference, and environment variable documentation.

