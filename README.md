# Jira Cycle Time

Electron + React + Mantine + Visx application for visualizing Jira issue cycle times.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Development**
   Runs the Vite frontend and Electron backend concurrently.
   ```bash
   npm run dev
   ```

3. **Verify (Local Build)**
    Runs linting, testing, and compilation (Typescript & Vite) to ensure code quality. 
    Does **not** create an executable.
    ```bash
    npm run verify
    ```

3. **Build Executable (Windows)**
   Compiles the code **and** packages it into a Windows installer/executable.
   Output will be in the `release/` directory.
   ```bash
   npm run package
   ```

## Architecture
- **Helper**: `electron/preload.ts` (IPC Bridge)
- **Backend**: `electron/main.ts` (Node.js)
- **Frontend**: `src/` (React, Mantine, Visx)
