/**
 * Robust File Logger for Debugging
 * 
 * Writes detailed logs to files with timestamps and context
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const debugLogFile = path.join(logsDir, 'debug.log');
const matchingLogFile = path.join(logsDir, 'matching.log');
const databaseLogFile = path.join(logsDir, 'database.log');

class Logger {
  static formatTimestamp() {
    return new Date().toISOString();
  }

  static writeToFile(filePath, level, category, message, data = null) {
    const timestamp = this.formatTimestamp();
    const dataStr = data ? `\nDATA: ${JSON.stringify(data, null, 2)}` : '';
    const logEntry = `[${timestamp}] [${level}] [${category}] ${message}${dataStr}\n`;
    
    try {
      fs.appendFileSync(filePath, logEntry);
      // Also log to console for immediate feedback
      console.log(`📝 ${level} [${category}] ${message}`, data || '');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  // General debug logging
  static debug(category, message, data = null) {
    this.writeToFile(debugLogFile, 'DEBUG', category, message, data);
  }

  static info(category, message, data = null) {
    this.writeToFile(debugLogFile, 'INFO', category, message, data);
  }

  static warn(category, message, data = null) {
    this.writeToFile(debugLogFile, 'WARN', category, message, data);
  }

  static error(category, message, data = null) {
    this.writeToFile(debugLogFile, 'ERROR', category, message, data);
  }

  // Matching-specific logging
  static matching(level, message, data = null) {
    this.writeToFile(matchingLogFile, level, 'MATCHING', message, data);
  }

  // Database-specific logging
  static database(level, message, data = null) {
    this.writeToFile(databaseLogFile, level, 'DATABASE', message, data);
  }

  // Clear log files (for fresh debugging sessions)
  static clearLogs() {
    try {
      if (fs.existsSync(debugLogFile)) fs.writeFileSync(debugLogFile, '');
      if (fs.existsSync(matchingLogFile)) fs.writeFileSync(matchingLogFile, '');
      if (fs.existsSync(databaseLogFile)) fs.writeFileSync(databaseLogFile, '');
      console.log('🧹 Log files cleared');
    } catch (error) {
      console.error('Failed to clear log files:', error);
    }
  }

  // Get log file paths for reading
  static getLogPaths() {
    return {
      debug: debugLogFile,
      matching: matchingLogFile,
      database: databaseLogFile
    };
  }
}

export default Logger;