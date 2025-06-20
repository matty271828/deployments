// This file will be auto-generated during deployment
// Placeholder for generated GraphQL schema and resolvers

import { createSchema } from 'graphql-yoga';

export const typeDefs = `
  type Query {
    _placeholder: String
  }
  
  type Mutation {
    _placeholder: String
  }
`;

export const resolvers = {
  Query: {
    _placeholder: () => "GraphQL schema not yet generated"
  },
  Mutation: {
    _placeholder: () => "GraphQL schema not yet generated"
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
} 