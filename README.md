# MIRROR-Study-Framework
[![Preview of PDF](Workflow-preview.png)](Workflow.pdf)
**Workflow for website**

## Install Node.js 
Make sure you have Node.js Version 20 or higher installed - npm comes with Node automatically. To check if you have the right versions installed run:
```bash
node -v
npm -v
```

If Node.js is not installed or your verison is <20, download and install the latest LST version from the [Node.js website](https://nodejs.org/en). 

After installation rerun the commands above to confirm Node.js and npm are installed and up to date.

## To start website
### Clone the Repository
```bash
git clone https://github.com/DRAGNLabs/MIRROR-Study-Framework.git
cd MIRROR-Study-Framework
```

### Start the Backend
```bash
cd backend
npm install
npm start
```
This should successfully start the backend on port 3001

### Start the Frontend
Open a new terminal and navigate to the github repository
```bash
cd my-app
npm install
npm run dev
```

This should successfully start the frontend at http://localhost:5173/

