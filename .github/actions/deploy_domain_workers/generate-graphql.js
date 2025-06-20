const fs = require('fs');
const path = require('path');

// Import the GraphQL generator
const { generateGraphQLModule } = require('./src/graphql-generator');

// Read the schema.sql file
const schemaSql = fs.readFileSync('../schema.sql', 'utf8');

// Generate the GraphQL code
const generatedCode = generateGraphQLModule(schemaSql);

// Write the generated code to generated-graphql.ts
fs.writeFileSync('./src/generated-graphql.ts', generatedCode);

console.log('GraphQL code generated successfully'); 