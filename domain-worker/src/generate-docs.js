const fs = require('fs');
const path = require('path');

// Read the schema.sql file
const schemaSql = fs.readFileSync('./schema.sql', 'utf8');

// Parse the schema to extract table information
const tables = [];
const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]?\s*\(([\s\S]*?)\)/gi;
let match;

while ((match = createTableRegex.exec(schemaSql)) !== null) {
  const tableName = match[1];
  const columnDefinitions = match[2];
  
  const columns = [];
  const columnLines = columnDefinitions.split(',').map(line => line.trim());
  
  for (const line of columnLines) {
    if (line.startsWith('PRIMARY KEY') || line.startsWith('FOREIGN KEY') || line.startsWith('UNIQUE') || line.startsWith('INDEX')) {
      continue;
    }
    
    const columnMatch = line.match(/^[`"]?(\w+)[`"]?\s+(\w+(?:\(\d+(?:,\d+)?\))?)\s*(NOT\s+NULL|NULL)?\s*(PRIMARY\s+KEY)?\s*(AUTOINCREMENT|AUTO_INCREMENT)?/i);
    
    if (columnMatch) {
      const [, name, type, nullable, primaryKey] = columnMatch;
      columns.push({
        name,
        type: type.toUpperCase(),
        nullable: !nullable || nullable.toUpperCase() === 'NULL',
        primaryKey: !!primaryKey
      });
    }
  }
  
  tables.push({ name: tableName, columns });
}

// Generate GraphQL documentation
const graphqlDocs = `# GraphQL API Documentation

This documentation is auto-generated from your database schema.

## Authentication

All GraphQL requests must be authenticated via the auth service:

\`\`\`bash
curl -X POST https://your-domain.com/auth/graphql \\
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "query { multiUser { id name } }"}'
\`\`\`

## Available Types

${tables.map(table => {
  const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
  const fields = table.columns.map(col => {
    let graphqlType = 'String';
    if (col.type.includes('INT')) graphqlType = 'Int';
    else if (col.type.includes('REAL') || col.type.includes('FLOAT')) graphqlType = 'Float';
    else if (col.type.includes('BOOL')) graphqlType = 'Boolean';
    
    return `  ${col.name}: ${graphqlType}${col.nullable ? '' : '!'}`;
  }).join('\n');
  
  return `### ${capitalizedName}

\`\`\`graphql
type ${capitalizedName} {
${fields}
}
\`\`\`

**Fields:**
${table.columns.map(col => {
  let graphqlType = 'String';
  if (col.type.includes('INT')) graphqlType = 'Int';
  else if (col.type.includes('REAL') || col.type.includes('FLOAT')) graphqlType = 'Float';
  else if (col.type.includes('BOOL')) graphqlType = 'Boolean';
  
  return `- ${col.name} (${graphqlType})${col.primaryKey ? ' - Primary Key' : ''}${col.nullable ? ' - Optional' : ' - Required'}`;
}).join('\n')}
`;
}).join('\n\n')}

## Queries

${tables.map(table => {
  const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
  const multiName = `multi${capitalizedName}`;
  return `### Get All ${capitalizedName}s

\`\`\`graphql
query {
  ${multiName} {
    id
    # Add other fields as needed
  }
}
\`\`\`

### Get Single ${capitalizedName}

\`\`\`graphql
query {
  ${table.name}(id: "123") {
    id
    # Add other fields as needed
  }
}
\`\`\`
`;
}).join('\n\n')}

## Mutations

${tables.map(table => {
  const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
  const createFields = table.columns
    .filter(col => !col.primaryKey && col.name !== 'created_at' && col.name !== 'updated_at')
    .map(col => col.name)
    .join(', ');
  
  return `### Create ${capitalizedName}

\`\`\`graphql
mutation {
  create${capitalizedName}(input: {
    ${createFields}
  }) {
    id
    # Add other fields as needed
  }
}
\`\`\`

### Update ${capitalizedName}

\`\`\`graphql
mutation {
  update${capitalizedName}(id: "123", input: {
    # Add fields to update
  }) {
    id
    # Add other fields as needed
  }
}
\`\`\`

### Delete ${capitalizedName}

\`\`\`graphql
mutation {
  delete${capitalizedName}(id: "123")
}
\`\`\`
`;
}).join('\n\n')}

## Examples

### Complete User Management Example

\`\`\`graphql
# Create a user
mutation CreateUser {
  createUser(input: {
    name: "John Doe"
    email: "john@example.com"
  }) {
    id
    name
    email
  }
}

# Get all users
query GetUsers {
  multiUser {
    id
    name
    email
  }
}

# Get specific user
query GetUser {
  user(id: "123") {
    id
    name
    email
  }
}

# Update user
mutation UpdateUser {
  updateUser(id: "123", input: {
    name: "Jane Doe"
  }) {
    id
    name
    email
  }
}

# Delete user
mutation DeleteUser {
  deleteUser(id: "123")
}
\`\`\`

## Notes

- All operations are automatically scoped to the authenticated user
- The \`user_id\` field is automatically injected for all operations
- All timestamps are returned as ISO strings
- Primary keys are returned as \`ID\` type in GraphQL
- List operations use the \`multi\` prefix (e.g., \`multiUser\`, \`multiProduct\`)
`;

// Write the documentation
fs.writeFileSync('./API_DOCUMENTATION.md', graphqlDocs);

console.log('Documentation generated successfully'); 