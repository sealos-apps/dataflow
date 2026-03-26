import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { graphqlClient } from '@/config/graphql-client';
import { useAuthStore } from '@/stores/useAuthStore';
import { ConnectionProvider } from '@/contexts/ConnectionContext';
import { MainLayout } from '@/components/layout/MainLayout';
import './globals.css';

// Bootstrap auth before first render (fire-and-forget; store updates trigger re-render)
useAuthStore.getState().initialize();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={graphqlClient}>
      <ConnectionProvider>
        <MainLayout />
      </ConnectionProvider>
    </ApolloProvider>
  </React.StrictMode>
);
