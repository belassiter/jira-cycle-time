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

3. **Build**
   Builds the application for production (creates an installer/executable).
   ```bash
   npm run build
   ```

## Architecture
- **Helper**: `electron/preload.ts` (IPC Bridge)
- **Backend**: `electron/main.ts` (Node.js)
- **Frontend**: `src/` (React, Mantine, Visx)
