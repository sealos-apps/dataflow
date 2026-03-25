import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { graphqlClient } from '@/src/config/graphql-client';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { ConnectionProvider } from '@/contexts/ConnectionContext';
import { MainLayout } from '@/components/layout/MainLayout';
import './globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={graphqlClient}>
      <AuthProvider>
        <ConnectionProvider>
          <MainLayout />
        </ConnectionProvider>
      </AuthProvider>
    </ApolloProvider>
  </React.StrictMode>
);
