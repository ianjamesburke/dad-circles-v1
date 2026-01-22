#!/usr/bin/env node

/**
 * Log Reader Script
 * 
 * Reads and displays the debug log files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, '..', 'logs');

function readLogFile(logType) {
  const logFile = path.join(logsDir, `${logType}.log`);
  
  if (!fs.existsSync(logFile)) {
    console.log(`❌ Log file ${logType}.log not found`);
    return;
  }
  
  const content = fs.readFileSync(logFile, 'utf8');
  
  if (!content.trim()) {
    console.log(`📝 ${logType}.log is empty`);
    return;
  }
  
  console.log(`\n📋 === ${logType.toUpperCase()} LOG ===`);
  console.log(content);
}

function main() {
  const logType = process.argv[2];
  
  if (logType) {
    readLogFile(logType);
  } else {
    console.log('📚 Reading all log files...\n');
    readLogFile('debug');
    readLogFile('matching');
    readLogFile('database');
  }
}

main();