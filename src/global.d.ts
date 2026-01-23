/// <reference types="vite/client" />

export interface IElectronAPI {
  getIssue: (issueId: string) => Promise<{ success: boolean; data: any; error?: string }>;
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  off: (channel: string, listener: (...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

declare global {
  interface Window {
    ipcRenderer: IElectronAPI;
  }
}
