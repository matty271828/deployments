const fs = require('fs');

// Test the SQL parser with the actual leetrepeat schema
const schemaSql = `-- LeetRepeat Database Schema (SQLite)
-- Supports multiple users with spaced repetition learning for LeetCode problems

-- Users table to support multiple users (auth handled by external service)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT UNIQUE NOT NULL, -- ID from external auth service
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Problems table to store LeetCode problems
CREATE TABLE IF NOT EXISTS problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    easiness_factor REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 1,
    repetition_count INTEGER NOT NULL DEFAULT 0,
    next_review DATETIME NOT NULL,
    last_reviewed DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure each user can only have one entry per URL
    UNIQUE(user_id, url)
);

-- Review history table to track all review sessions
CREATE TABLE IF NOT EXISTS review_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grade INTEGER NOT NULL CHECK (grade >= 0 AND grade <= 5),
    reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_problems_user_id ON problems(user_id);
CREATE INDEX IF NOT EXISTS idx_problems_next_review ON problems(next_review);
CREATE INDEX IF NOT EXISTS idx_problems_user_next_review ON problems(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_review_history_user_problem ON review_history(user_id, problem_id);
CREATE INDEX IF NOT EXISTS idx_review_history_reviewed_at ON review_history(reviewed_at);

-- Views for common queries
CREATE VIEW IF NOT EXISTS problems_due_for_review AS
SELECT 
    p.id,
    p.user_id,
    p.url,
    p.title,
    p.easiness_factor,
    p.interval_days,
    p.repetition_count,
    p.next_review,
    p.last_reviewed,
    u.email
FROM problems p
JOIN users u ON p.user_id = u.id
WHERE p.next_review <= datetime('now')
ORDER BY p.next_review ASC;

-- View to list all problems for a given user (for upcoming reviews card)
CREATE VIEW IF NOT EXISTS user_problems AS
SELECT 
    p.id,
    p.user_id,
    p.url,
    p.title,
    p.easiness_factor,
    p.interval_days,
    p.repetition_count,
    p.next_review,
    p.last_reviewed,
    u.email,
    p.next_review as due_timestamp
FROM problems p
JOIN users u ON p.user_id = u.id
ORDER BY p.next_review ASC;`;

// Improved parseCreateTable function with proper parenthesis matching
function parseCreateTable(sql) {
  // Remove comments first
  const cleanSql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  const tables = [];
  
  // Find all CREATE TABLE statements
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(/gi;
  let match;
  
  while ((match = createTableRegex.exec(cleanSql)) !== null) {
    const tableName = match[1];
    const startPos = match.index + match[0].length;
    
    // Find the matching closing parenthesis
    let parenCount = 1;
    let endPos = startPos;
    
    for (let i = startPos; i < cleanSql.length; i++) {
      const char = cleanSql[i];
      if (char === '(') {
        parenCount++;
      } else if (char === ')') {
        parenCount--;
        if (parenCount === 0) {
          endPos = i;
          break;
        }
      }
    }
    
    const columnDefinitions = cleanSql.substring(startPos, endPos);
    
    console.log(`\n=== Parsing table: ${tableName} ===`);
    console.log(`Column definitions: ${columnDefinitions}`);
    
    const columns = [];
    
    // Split by commas, but handle nested parentheses
    const columnLines = [];
    let currentLine = '';
    let lineParenCount = 0;
    
    for (let i = 0; i < columnDefinitions.length; i++) {
      const char = columnDefinitions[i];
      
      if (char === '(') {
        lineParenCount++;
      } else if (char === ')') {
        lineParenCount--;
      }
      
      if (char === ',' && lineParenCount === 0) {
        columnLines.push(currentLine.trim());
        currentLine = '';
      } else {
        currentLine += char;
      }
    }
    
    // Add the last line
    if (currentLine.trim()) {
      columnLines.push(currentLine.trim());
    }
    
    console.log(`\nColumn lines:`, columnLines);
    
    for (const line of columnLines) {
      if (!line || line.startsWith('PRIMARY KEY') || line.startsWith('FOREIGN KEY') || 
          line.startsWith('UNIQUE') || line.startsWith('INDEX') || 
          line.startsWith('CHECK') || line.startsWith('CONSTRAINT')) {
        console.log(`Skipping constraint line: ${line}`);
        continue;
      }
      
      // Improved regex to handle more complex column definitions
      const columnMatch = line.match(/^[`"]?(\w+)[`"]?\s+(\w+(?:\(\d+(?:,\d+)?\))?)\s*(NOT\s+NULL|NULL)?\s*(PRIMARY\s+KEY)?\s*(AUTOINCREMENT|AUTO_INCREMENT)?\s*(DEFAULT\s+[^,]+)?\s*(REFERENCES\s+[^,]+)?/i);
      
      if (columnMatch) {
        const [, name, type, nullable, primaryKey, autoIncrement] = columnMatch;
        
        // Determine if column is nullable (default to true unless NOT NULL is specified)
        const isNullable = !nullable || nullable.toUpperCase() === 'NULL';
        
        console.log(`Parsed column: ${name} (${type}, nullable: ${isNullable}, primaryKey: ${!!primaryKey})`);
        
        columns.push({
          name,
          type: type.toUpperCase(),
          nullable: isNullable,
          primaryKey: !!primaryKey
        });
      } else {
        console.log(`Failed to parse line: ${line}`);
      }
    }
    
    if (columns.length > 0) {
      tables.push({ name: tableName, columns });
      console.log(`\nFinal columns for ${tableName}:`, columns.map(c => `${c.name}: ${c.type}`));
    }
  }
  
  return tables;
}

// Test the parser
const tables = parseCreateTable(schemaSql);
console.log('\n=== FINAL RESULT ===');
console.log(JSON.stringify(tables, null, 2)); 