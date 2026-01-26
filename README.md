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
   
   > **Note**: This command requires **Administrator privileges** (or Windows Developer Mode enabled) to create symbolic links during the build process. If you see specific "Cannot create symbolic link" errors, please run your terminal as Administrator.

   ```bash
   npm run package
   ```

4. **Build Executable (No Admin Rights)**
   If you do not have Admin privileges, use this command.
   It creates a folder containing the `.exe` (instead of an installer) in `release-simple/`.
   ```bash
   npm run pack:simple
   ```

## Architecture
- **Helper**: `electron/preload.ts` (IPC Bridge)
- **Backend**: `electron/main.ts` (Node.js)
- **Frontend**: `src/` (React, Mantine, Visx)
