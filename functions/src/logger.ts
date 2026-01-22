/**
 * Comprehensive logging system for debugging email integration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as logger from 'firebase-functions/logger';

export class DebugLogger {
  private static logFile = path.join(__dirname, '../debug.log');
  
  static log(level: 'INFO' | 'ERROR' | 'DEBUG', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    
    // Log to Firebase Functions console
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
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      logger.error('Failed to write to debug log file', error);
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
      logger.error('Failed to clear debug log', error);
    }
  }
}