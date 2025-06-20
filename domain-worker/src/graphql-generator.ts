/**
 * GraphQL Generator for Domain Workers
 * 
 * This utility parses SQL CREATE TABLE statements and generates GraphQL
 * schemas and resolvers with automatic user isolation.
 */

// @ts-ignore - sqlite-parser doesn't have TypeScript declarations
import * as sqliteParser from 'sqlite-parser';

interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  autoIncrement: boolean;
  defaultValue?: string;
}

interface TableSchema {
  name: string;
  columns: TableColumn[];
}

interface GeneratedGraphQL {
  schema: string;
  resolvers: string;
  types: string;
}

/**
 * Parse SQL CREATE TABLE statement using sqlite-parser
 */
function parseCreateTable(ast: any): TableSchema | null {
  if (ast.type !== 'create' || ast.variant !== 'table') {
    return null;
  }
  
  const tableName = ast.name.name;
  const columns: TableColumn[] = [];
  
  for (const column of ast.definition) {
    if (column.type === 'column') {
      const columnName = column.name.name;
      const dataType = column.datatype?.type || 'TEXT';
      
      // Check for constraints
      let nullable = true;
      let primaryKey = false;
      let autoIncrement = false;
      let defaultValue: string | undefined;
      
      if (column.constraint) {
        for (const constraint of column.constraint) {
          if (constraint.type === 'primary key') {
            primaryKey = true;
          }
          if (constraint.type === 'not null') {
            nullable = false;
          }
          if (constraint.type === 'default') {
            defaultValue = constraint.value;
          }
        }
      }
      
      // Check for AUTOINCREMENT
      if (dataType.includes('INTEGER') && primaryKey) {
        autoIncrement = true;
      }
      
      columns.push({
        name: columnName,
        type: dataType.toUpperCase(),
        nullable,
        primaryKey,
        autoIncrement,
        defaultValue
      });
    }
  }
  
  return { name: tableName, columns };
}

/**
 * Convert SQL type to GraphQL type
 */
function sqlTypeToGraphQLType(sqlType: string, nullable: boolean): string {
  let graphqlType = 'String';
  
  if (sqlType.includes('INT') || sqlType.includes('REAL') || sqlType.includes('FLOAT') || sqlType.includes('DOUBLE')) {
    graphqlType = 'Int';
  } else if (sqlType.includes('REAL') || sqlType.includes('FLOAT') || sqlType.includes('DOUBLE')) {
    graphqlType = 'Float';
  } else if (sqlType.includes('BOOL')) {
    graphqlType = 'Boolean';
  } else if (sqlType.includes('DATE') || sqlType.includes('TIME')) {
    graphqlType = 'String'; // ISO date string
  }
  
  return nullable ? graphqlType : `${graphqlType}!`;
}

/**
 * Generate GraphQL type definition for a table
 */
function generateGraphQLType(table: TableSchema): string {
  const fields = table.columns.map(col => {
    const graphqlType = sqlTypeToGraphQLType(col.type, col.nullable);
    return `  ${col.name}: ${graphqlType}`;
  }).join('\n');
  
  const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
  
  return `type ${capitalizedName} {
${fields}
}`;
}

/**
 * Generate GraphQL input types for mutations
 */
function generateInputTypes(table: TableSchema): string {
  const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
  
  // Create input type (excludes auto-generated fields)
  const createFields = table.columns
    .filter(col => !col.autoIncrement && col.name !== 'created_at' && col.name !== 'updated_at')
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

/**
 * Generate GraphQL resolvers for a table
 */
function generateTableResolvers(table: TableSchema): string {
  const tableName = table.name;
  const capitalizedName = tableName.charAt(0).toUpperCase() + tableName.slice(1);
  const primaryKeyColumn = table.columns.find(col => col.primaryKey)?.name || 'id';
  
  return `
// ${tableName} resolvers
const ${tableName}Resolvers = {
  Query: {
    ${tableName}s: async (_, __, { user_id, db }) => {
      if (!user_id) throw new Error('User ID required');
      const result = await db.prepare(\`SELECT * FROM ${tableName} WHERE user_id = ?\`).bind(user_id).all();
      return result.results;
    },
    ${tableName}: async (_, { id }, { user_id, db }) => {
      if (!user_id) throw new Error('User ID required');
      const result = await db.prepare(\`SELECT * FROM ${tableName} WHERE ${primaryKeyColumn} = ? AND user_id = ?\`).bind(id, user_id).first();
      if (!result) throw new Error('Not found');
      return result;
    }
  },
  Mutation: {
    create${capitalizedName}: async (_, { input }, { user_id, db }) => {
      if (!user_id) throw new Error('User ID required');
      const dataWithUserId = { ...input, user_id };
      const columns = Object.keys(dataWithUserId).join(', ');
      const placeholders = Object.keys(dataWithUserId).map(() => '?').join(', ');
      const values = Object.values(dataWithUserId);
      
      const result = await db.prepare(\`INSERT INTO ${tableName} (\${columns}) VALUES (\${placeholders})\`).bind(...values).run();
      return { id: result.meta.last_row_id, ...input };
    },
    update${capitalizedName}: async (_, { id, input }, { user_id, db }) => {
      if (!user_id) throw new Error('User ID required');
      const setClause = Object.keys(input).map(key => \`\${key} = ?\`).join(', ');
      const values = [...Object.values(input), id, user_id];
      
      const result = await db.prepare(\`UPDATE ${tableName} SET \${setClause} WHERE ${primaryKeyColumn} = ? AND user_id = ?\`).bind(...values).run();
      if (result.meta.changes === 0) throw new Error('Not found');
      return { id, ...input };
    },
    delete${capitalizedName}: async (_, { id }, { user_id, db }) => {
      if (!user_id) throw new Error('User ID required');
      const result = await db.prepare(\`DELETE FROM ${tableName} WHERE ${primaryKeyColumn} = ? AND user_id = ?\`).bind(id, user_id).run();
      if (result.meta.changes === 0) throw new Error('Not found');
      return true;
    }
  }
};`;
}

/**
 * Generate GraphQL schema
 */
function generateGraphQLSchema(tables: TableSchema[]): string {
  const types = tables.map(generateGraphQLType).join('\n\n');
  const inputTypes = tables.map(generateInputTypes).join('\n\n');
  
  const queryFields = tables.map(table => {
    const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
    return `  ${table.name}s: [${capitalizedName}!]!
  ${table.name}(id: ID!): ${capitalizedName}`;
  }).join('\n');
  
  const mutationFields = tables.map(table => {
    const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
    return `  create${capitalizedName}(input: Create${capitalizedName}Input!): ${capitalizedName}!
  update${capitalizedName}(id: ID!, input: Update${capitalizedName}Input!): ${capitalizedName}!
  delete${capitalizedName}(id: ID!): Boolean!`;
  }).join('\n');
  
  return `# Auto-generated GraphQL schema
# Generated from SQL schema

${types}

${inputTypes}

type Query {
${queryFields}
}

type Mutation {
${mutationFields}
}`;
}

/**
 * Generate resolver mapping
 */
function generateResolverMapping(tables: TableSchema[]): string {
  const resolverImports = tables.map(table => {
    const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
    return `import { ${table.name}Resolvers } from './resolvers/${table.name}';`;
  }).join('\n');
  
  const queryResolvers = tables.map(table => {
    const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
    return `    ${table.name}s: ${table.name}Resolvers.Query.${table.name}s,
    ${table.name}: ${table.name}Resolvers.Query.${table.name}`;
  }).join('\n');
  
  const mutationResolvers = tables.map(table => {
    const capitalizedName = table.name.charAt(0).toUpperCase() + table.name.slice(1);
    return `    create${capitalizedName}: ${table.name}Resolvers.Mutation.create${capitalizedName},
    update${capitalizedName}: ${table.name}Resolvers.Mutation.update${capitalizedName},
    delete${capitalizedName}: ${table.name}Resolvers.Mutation.delete${capitalizedName}`;
  }).join('\n');
  
  return `// Auto-generated resolver mapping
${resolverImports}

export const resolvers = {
  Query: {
${queryResolvers}
  },
  Mutation: {
${mutationResolvers}
  }
};`;
}

/**
 * Main function to generate GraphQL code from SQL schema
 */
export function generateGraphQL(schemaSql: string): GeneratedGraphQL {
  const tables: TableSchema[] = [];
  
  try {
    // Parse SQL using sqlite-parser
    const ast = sqliteParser(schemaSql);
    
    // Extract CREATE TABLE statements
    for (const statement of ast) {
      if (statement.type === 'create' && statement.variant === 'table') {
        const table = parseCreateTable(statement);
        if (table) {
          tables.push(table);
        }
      }
    }
  } catch (error: any) {
    console.error('Error parsing SQL schema:', error);
    throw new Error(`Failed to parse SQL schema: ${error.message}`);
  }
  
  // Generate GraphQL code
  const schema = generateGraphQLSchema(tables);
  const resolvers = tables.map(generateTableResolvers).join('\n');
  const resolverMapping = generateResolverMapping(tables);
  
  return {
    schema,
    resolvers,
    types: resolverMapping
  };
}

/**
 * Generate the complete GraphQL module code
 */
export function generateGraphQLModule(schemaSql: string): string {
  const graphql = generateGraphQL(schemaSql);
  
  return `// Auto-generated GraphQL module
// Generated from SQL schema
// All operations are automatically scoped to the authenticated user

// GraphQL Schema
export const typeDefs = \`${graphql.schema}\`;

// Resolvers
${graphql.resolvers}

// Resolver mapping
${graphql.types}

// Context function to extract user_id from headers
export function createContext(request: Request, env: any) {
  const user_id = request.headers.get('X-User-ID');
  return {
    user_id,
    db: env.DOMAIN_DB
  };
}`;
} 