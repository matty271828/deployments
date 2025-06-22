const fs = require('fs');
const path = require('path');

// Improved GraphQL generator logic with better SQL parsing
function parseCreateTable(sql) {
  // Remove comments first
  const cleanSql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Improved regex-based parser for CREATE TABLE statements
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(([\s\S]*?)\)/gi;
  const tables = [];
  let match;

  while ((match = createTableRegex.exec(cleanSql)) !== null) {
    const tableName = match[1];
    const columnDefinitions = match[2];
    
    const columns = [];
    
    // Split by commas, but handle nested parentheses
    const columnLines = [];
    let currentLine = '';
    let parenCount = 0;
    
    for (let i = 0; i < columnDefinitions.length; i++) {
      const char = columnDefinitions[i];
      
      if (char === '(') {
        parenCount++;
      } else if (char === ')') {
        parenCount--;
      }
      
      if (char === ',' && parenCount === 0) {
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
    
    for (const line of columnLines) {
      if (!line || line.startsWith('PRIMARY KEY') || line.startsWith('FOREIGN KEY') || 
          line.startsWith('UNIQUE') || line.startsWith('INDEX') || 
          line.startsWith('CHECK') || line.startsWith('CONSTRAINT')) {
        continue;
      }
      
      // Improved regex to handle more complex column definitions
      const columnMatch = line.match(/^[`"]?(\w+)[`"]?\s+(\w+(?:\(\d+(?:,\d+)?\))?)\s*(NOT\s+NULL|NULL)?\s*(PRIMARY\s+KEY)?\s*(AUTOINCREMENT|AUTO_INCREMENT)?\s*(DEFAULT\s+[^,]+)?\s*(REFERENCES\s+[^,]+)?/i);
      
      if (columnMatch) {
        const [, name, type, nullable, primaryKey, autoIncrement] = columnMatch;
        
        // Determine if column is nullable (default to true unless NOT NULL is specified)
        const isNullable = !nullable || nullable.toUpperCase() === 'NULL';
        
        columns.push({
          name,
          type: type.toUpperCase(),
          nullable: isNullable,
          primaryKey: !!primaryKey
        });
      }
    }
    
    if (columns.length > 0) {
      tables.push({ name: tableName, columns });
    }
  }
  
  return tables;
}

function sqlTypeToGraphQLType(sqlType, nullable) {
  let graphqlType = 'String';
  
  if (sqlType.includes('INTEGER') || sqlType.includes('INT')) {
    graphqlType = 'Int';
  } else if (sqlType.includes('REAL') || sqlType.includes('FLOAT') || sqlType.includes('DOUBLE')) {
    graphqlType = 'Float';
  } else if (sqlType.includes('BOOL')) {
    graphqlType = 'Boolean';
  } else if (sqlType.includes('DATETIME') || sqlType.includes('DATE') || sqlType.includes('TIME')) {
    graphqlType = 'String'; // ISO date string
  }
  
  return nullable ? graphqlType : `${graphqlType}!`;
}

function generateGraphQLType(table) {
  const fields = table.columns.map(col => {
    const graphqlType = sqlTypeToGraphQLType(col.type, col.nullable);
    return `  ${col.name}: ${graphqlType}`;
  }).join('\n');
  
  const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
  
  return `type ${capitalizedName} {
${fields}
}`;
}

function generateInputTypes(table) {
  const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
  
  // Create input type (excludes auto-generated fields)
  const createFields = table.columns
    .filter(col => !col.primaryKey && col.name !== 'created_at' && col.name !== 'updated_at')
    .map(col => {
      const graphqlType = sqlTypeToGraphQLType(col.type, col.nullable);
      return `  ${col.name}: ${graphqlType}`;
    }).join('\n');
  
  // Update input type (all fields optional except ID)
  const updateFields = table.columns
    .filter(col => !col.primaryKey && !col.autoIncrement && col.name !== 'created_at' && col.name !== 'updated_at')
    .map(col => {
      const graphqlType = sqlTypeToGraphQLType(col.type, true); // Always nullable for updates
      return `  ${col.name}: ${graphqlType}`;
    }).join('\n');
  
  return `input Create${capitalizedName}Input {
${createFields}
}

input Update${capitalizedName}Input {
${updateFields}
}`;
}

function generateTableResolvers(table) {
  const tableName = table.name;
  const capitalizedName = tableName.charAt(0).toUpperCase() + tableName.slice(1);
  const primaryKeyColumn = table.columns.find(col => col.primaryKey)?.name || 'id';
  const hasUserId = table.columns.some(col => col.name === 'user_id');
  
  return `
// ${tableName} resolvers
const ${tableName}Resolvers = {
  Query: {
    ${tableName}s: async (_, __, { user_id, db }) => {
      if (!user_id) throw new Error('User ID required');
      ${hasUserId ? 
        `const result = await db.prepare(\`SELECT * FROM ${tableName} WHERE user_id = ?\`).bind(user_id).all();` :
        `const result = await db.prepare(\`SELECT * FROM ${tableName}\`).all();`
      }
      return result.results;
    },
    ${tableName}: async (_, { id }, { user_id, db }) => {
      if (!user_id) throw new Error('User ID required');
      ${hasUserId ?
        `const result = await db.prepare(\`SELECT * FROM ${tableName} WHERE ${primaryKeyColumn} = ? AND user_id = ?\`).bind(id, user_id).first();` :
        `const result = await db.prepare(\`SELECT * FROM ${tableName} WHERE ${primaryKeyColumn} = ?\`).bind(id).first();`
      }
      if (!result) throw new Error('Not found');
      return result;
    }
  },
  Mutation: {
    create${capitalizedName}: async (_, { input }, { user_id, db }) => {
      if (!user_id) throw new Error('User ID required');
      ${hasUserId ?
        `const dataWithUserId = { ...input, user_id };
      const columns = Object.keys(dataWithUserId).join(', ');
      const placeholders = Object.keys(dataWithUserId).map(() => '?').join(', ');
      const values = Object.values(dataWithUserId);` :
        `const columns = Object.keys(input).join(', ');
      const placeholders = Object.keys(input).map(() => '?').join(', ');
      const values = Object.values(input);`
      }
      
      const result = await db.prepare(\`INSERT INTO ${tableName} (\${columns}) VALUES (\${placeholders})\`).bind(...values).run();
      return { id: result.meta.last_row_id, ...input };
    },
    update${capitalizedName}: async (_, { id, input }, { user_id, db }) => {
      if (!user_id) throw new Error('User ID required');
      const setClause = Object.keys(input).map(key => \`\${key} = ?\`).join(', ');
      ${hasUserId ?
        `const values = [...Object.values(input), id, user_id];
      
      const result = await db.prepare(\`UPDATE ${tableName} SET \${setClause} WHERE ${primaryKeyColumn} = ? AND user_id = ?\`).bind(...values).run();` :
        `const values = [...Object.values(input), id];
      
      const result = await db.prepare(\`UPDATE ${tableName} SET \${setClause} WHERE ${primaryKeyColumn} = ?\`).bind(...values).run();`
      }
      if (result.meta.changes === 0) throw new Error('Not found');
      return { id, ...input };
    },
    delete${capitalizedName}: async (_, { id }, { user_id, db }) => {
      if (!user_id) throw new Error('User ID required');
      ${hasUserId ?
        `const result = await db.prepare(\`DELETE FROM ${tableName} WHERE ${primaryKeyColumn} = ? AND user_id = ?\`).bind(id, user_id).run();` :
        `const result = await db.prepare(\`DELETE FROM ${tableName} WHERE ${primaryKeyColumn} = ?\`).bind(id).run();`
      }
      if (result.meta.changes === 0) throw new Error('Not found');
      return true;
    }
  }
};`;
}

function generateGraphQLSchema(tables) {
  const types = tables.map(table => generateGraphQLType(table)).join('\n\n');
  const inputs = tables.map(table => generateInputTypes(table)).join('\n\n');
  
  return `const typeDefs = \`#graphql
${types}

${inputs}

type Query {
${tables.map(table => `  ${table.name}s: [${table.name.charAt(0).toUpperCase() + table.name.slice(1)}]!
  ${table.name}(id: ID!): ${table.name.charAt(0).toUpperCase() + table.name.slice(1)}`).join('\n')}
}

type Mutation {
${tables.map(table => {
  const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
  return `  create${capitalizedName}(input: Create${capitalizedName}Input!): ${capitalizedName}!
  update${capitalizedName}(id: ID!, input: Update${capitalizedName}Input!): ${capitalizedName}!
  delete${capitalizedName}(id: ID!): Boolean!`;
}).join('\n')}
}\`;`;
}

function generateResolverMapping(tables) {
  const resolvers = tables.map(table => generateTableResolvers(table)).join('\n');
  
  return `${resolvers}

const resolvers = {
  Query: {
${tables.map(table => `    ${table.name}s: ${table.name}Resolvers.Query.${table.name}s,
    ${table.name}: ${table.name}Resolvers.Query.${table.name}`).join(',\n')}
  },
  Mutation: {
${tables.map(table => {
  const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
  return `    create${capitalizedName}: ${table.name}Resolvers.Mutation.create${capitalizedName},
    update${capitalizedName}: ${table.name}Resolvers.Mutation.update${capitalizedName},
    delete${capitalizedName}: ${table.name}Resolvers.Mutation.delete${capitalizedName}`;
}).join(',\n')}
  }
};`;
}

function generateGraphQLModule(schemaSql) {
  const tables = parseCreateTable(schemaSql);
  
  if (tables.length === 0) {
    console.log('No tables found in schema, using placeholder GraphQL code');
    return `// Placeholder GraphQL code - no tables found in schema
import { createSchema } from 'graphql-yoga';

const typeDefs = \`#graphql
type Query {
  hello: String!
}

type Mutation {
  hello: String!
}\`;

const resolvers = {
  Query: {
    hello: () => 'Hello from GraphQL!'
  },
  Mutation: {
    hello: () => 'Hello from GraphQL mutation!'
  }
};

// Create the schema using createSchema
export const schema = createSchema({
  typeDefs,
  resolvers
});

export function createContext(request: Request, env: any) {
  const user_id = request.headers.get('X-User-ID');
  return {
    user_id,
    db: env.DOMAIN_DB
  };
}`;
  }
  
  const schema = generateGraphQLSchema(tables);
  const resolvers = generateResolverMapping(tables);
  
  return `// Auto-generated GraphQL module
// Generated from SQL schema
// All operations are automatically scoped to the authenticated user

import { createSchema } from 'graphql-yoga';

${schema}

${resolvers}

// Create the schema using createSchema
export const schema = createSchema({
  typeDefs,
  resolvers
});

// Context function to extract user_id from headers
export function createContext(request: Request, env: any) {
  const user_id = request.headers.get('X-User-ID');
  return {
    user_id,
    db: env.DOMAIN_DB
  };
}`;
}

// Read the schema.sql file (it should be in the current directory when copied)
const schemaSql = fs.readFileSync('./schema.sql', 'utf8');

// Generate the GraphQL code
const generatedCode = generateGraphQLModule(schemaSql);

// Write the generated code to generated-graphql.ts
fs.writeFileSync('./src/generated-graphql.ts', generatedCode);

console.log('GraphQL code generated successfully'); 