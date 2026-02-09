/**
 * Comprehensive logging system for debugging email integration
 * Wraps firebase-functions/logger to provide pretty printing in local development
 */

import * as fs from 'fs';
import * as path from 'path';
import * as firebaseLogger from 'firebase-functions/logger';

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

// Helper for pretty printing
const prettyPrint = (level: string, message: string, ...args: any[]) => {
  let color = '';
  switch (level) {
    case 'INFO': color = '\x1b[36m'; break; // Cyan
    case 'WARN': color = '\x1b[33m'; break; // Yellow
    case 'ERROR': color = '\x1b[31m'; break; // Red
    case 'DEBUG': color = '\x1b[90m'; break; // Gray
  }
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';

  // Filter out undefined/null args to avoid clutter
  const validArgs = args.filter(a => a !== undefined);

  console.log(`${color}${bold}[${level}]${reset} ${message}`);
  
  if (validArgs.length > 0) {
     validArgs.forEach(arg => {
        if (typeof arg === 'object') {
            // Indent the JSON for readability
            const jsonLines = JSON.stringify(arg, null, 2).split('\n');
            jsonLines.forEach(line => console.log(`      ${line}`));
        } else {
            console.log(`      ${arg}`);
        }
     });
  }
};

// Export a logger object that mimics firebase-functions/logger
export const logger = {
  info: (message: string, ...args: any[]) => {
    if (isEmulator) prettyPrint('INFO', message, ...args);
    else firebaseLogger.info(message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    if (isEmulator) prettyPrint('WARN', message, ...args);
    else firebaseLogger.warn(message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    if (isEmulator) prettyPrint('ERROR', message, ...args);
    else firebaseLogger.error(message, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (isEmulator) prettyPrint('DEBUG', message, ...args);
    else firebaseLogger.debug(message, ...args);
  },
  write: (entry: any) => {
      if (isEmulator) prettyPrint(entry.severity || 'INFO', entry.message || '', entry);
      else firebaseLogger.write(entry);
  }
};

export class DebugLogger {
  private static logFile = path.join(__dirname, '../debug.log');
  
  static log(level: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    
    // Log to console (via our unified logger)
    switch (level) {
      case 'INFO':
        logger.info(message, data);
        break;
      case 'ERROR':
        logger.error(message, data);
        break;
      case 'DEBUG':
        logger.debug(message, data);
        break;
    }
    
    // Also write to local file for debugging
    try {
      const logLine = `[${timestamp}] ${level}: ${message}${data ? '\nDATA: ' + JSON.stringify(data, null, 2) : ''}\n\n`;
      // Ensure file exists or append
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to debug log file', error);
    }
  }
  
  static info(message: string, data?: any) {
    this.log('INFO', message, data);
  }
  
  static error(message: string, data?: any) {
    this.log('ERROR', message, data);
  }
  
  static debug(message: string, data?: any) {
    this.log('DEBUG', message, data);
  }
  
  static clearLog() {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.unlinkSync(this.logFile);
      }
    } catch (error) {
      console.error('Failed to clear debug log', error);
    }
  }
}
