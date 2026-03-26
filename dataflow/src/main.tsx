import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { graphqlClient } from '@/config/graphql-client';
import { useAuthStore } from '@/stores/useAuthStore';
import { MainLayout } from '@/components/layout/MainLayout';
import './globals.css';

useAuthStore.getState().initialize();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={graphqlClient}>
      <MainLayout />
    </ApolloProvider>
  </React.StrictMode>
);
