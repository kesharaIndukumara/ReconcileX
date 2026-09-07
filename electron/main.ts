import { app, BrowserWindow, ipcMain } from 'electron'

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import * as db from './db'
import type { MappingRule, ReconciliationSession, HistoryEvent } from '../src/types'


const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC!, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// ============ IPC HANDLERS: RULE MANAGEMENT ============

ipcMain.handle('db:saveRule', (_event, mappingRules: MappingRule[], name: string, description?: string) => {
  try {
    return db.saveRule(mappingRules, name, description)
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:loadRules', () => {
  try {
    return db.loadRules()
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:getRuleById', (_event, ruleId: string) => {
  try {
    return db.getRuleById(ruleId)
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:updateRule', (_event, ruleId: string, name: string, description?: string, mappingRules?: MappingRule[]) => {
  try {
    db.updateRule(ruleId, name, description, mappingRules)
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:deleteRule', (_event, ruleId: string) => {
  try {
    db.deleteRule(ruleId)
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:duplicateRule', (_event, sourceRuleId: string, newName: string) => {
  try {
    return db.duplicateRule(sourceRuleId, newName)
  } catch (error) {
    return { error: (error as Error).message }
  }
})

// ============ IPC HANDLERS: SESSION MANAGEMENT ============

ipcMain.handle('db:saveSession', (_event, sessionData: Partial<ReconciliationSession>) => {
  try {
    return db.saveSession(sessionData)
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:updateSession', (_event, sessionId: string, updates: Partial<ReconciliationSession>) => {
  try {
    db.updateSession(sessionId, updates)
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:getActiveSessions', () => {
  try {
    return db.getActiveSessions()
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:getSessionById', (_event, sessionId: string) => {
  try {
    return db.getSessionById(sessionId)
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:getAllSessions', () => {
  try {
    return db.getAllSessions()
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:closeSession', (_event, sessionId: string) => {
  try {
    db.closeSession(sessionId)
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:deleteSession', (_event, sessionId: string) => {
  try {
    db.deleteSession(sessionId)
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

// ============ IPC HANDLERS: PREFERENCES MANAGEMENT ============

ipcMain.handle('db:savePreference', (_event, key: string, value: unknown) => {
  try {
    db.savePreference(key, value)
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:getPreference', (_event, key: string) => {
  try {
    return db.getPreference(key)
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:getAllPreferences', () => {
  try {
    return db.getAllPreferences()
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:deletePreference', (_event, key: string) => {
  try {
    db.deletePreference(key)
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

// ============ IPC HANDLERS: HISTORY LOGGING ============

ipcMain.handle('db:logHistory', (_event, event: HistoryEvent) => {
  try {
    db.logHistory(event)
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:getSessionHistory', (_event, sessionId: string) => {
  try {
    return db.getSessionHistory(sessionId)
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:getAllHistory', (_event, limit?: number) => {
  try {
    return db.getAllHistory(limit)
  } catch (error) {
    return { error: (error as Error).message }
  }
})

// ============ IPC HANDLERS: DATABASE MAINTENANCE ============

ipcMain.handle('db:vacuum', () => {
  try {
    db.vacuumDatabase()
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:optimize', () => {
  try {
    db.optimizeDatabase()
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:clearHistory', () => {
  try {
    db.clearHistory()
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

ipcMain.handle('db:resetDatabase', () => {
  try {
    db.resetDatabase()
    return { success: true }
  } catch (error) {
    return { error: (error as Error).message }
  }
})

// Clean up database on app quit
app.on('before-quit', () => {
  db.closeDatabase()
})

app.whenReady().then(createWindow)
