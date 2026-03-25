/**
 * Apollo Client configuration for WhoDB Core GraphQL API.
 *
 * Link chain: errorLink → authLink → httpLink
 *
 * - httpLink: POST to /api/query (proxied to Core in dev, same-origin in prod)
 * - authLink: injects Authorization Bearer header from auth-store
 * - errorLink: logs network errors (auto-login retry added in Phase 3)
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

const authLink = setContext((_, { headers }) => ({
  headers: addAuthHeader(headers),
}));

const errorLink = onError(({ networkError }) => {
  if (networkError && 'statusCode' in networkError && networkError.statusCode === 401) {
    // TODO (Phase 3): auto-login retry using saved credentials from auth-store
    console.warn('GraphQL 401: unauthorized — auto-login not yet wired');
  } else if (networkError) {
    console.error('GraphQL network error:', networkError);
  }
});

export const graphqlClient = new ApolloClient({
  link: errorLink.concat(authLink.concat(httpLink)),
  cache: new InMemoryCache(),
  defaultOptions: {
    query: { fetchPolicy: 'no-cache' },
    mutate: { fetchPolicy: 'no-cache' },
  },
});
