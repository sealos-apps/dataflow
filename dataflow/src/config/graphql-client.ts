/**
 * Apollo Client configuration for WhoDB Core GraphQL API.
 *
 * Link chain: errorLink → authLink → httpLink
 *
 * - httpLink: POST to /api/query (proxied to Core in dev, same-origin in prod)
 * - authLink: injects Authorization Bearer header from auth-store
 * - errorLink: logs network errors
 *
 * Reference: frontend/src/config/graphql-client.ts
 */

import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { addAuthHeader } from './auth-headers';

const httpLink = createHttpLink({
  uri: '/api/query',
  credentials: 'include',
});

const authLink = setContext((_, previousContext) => ({
  headers: addAuthHeader(
    previousContext.headers,
    previousContext.database,
  ),
}));

const errorLink = onError(({ networkError }) => {
  if (networkError) {
    const status = 'statusCode' in networkError ? networkError.statusCode : undefined;
    console.error(`GraphQL network error (${status ?? 'unknown'}):`, networkError);
  }
});

export const graphqlClient = new ApolloClient({
  link: errorLink.concat(authLink.concat(httpLink)),
  cache: new InMemoryCache(),
  defaultOptions: {
    query: { fetchPolicy: 'no-cache' },
    watchQuery: { fetchPolicy: 'no-cache' },
    mutate: { fetchPolicy: 'no-cache' },
  },
});
