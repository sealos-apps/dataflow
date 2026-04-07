import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { graphqlClient } from '@/config/graphql-client';
import { useAuthStore } from '@/stores/useAuthStore';
import { MainLayout } from '@/components/layout/MainLayout';
import { I18nProvider } from '@/i18n/I18nProvider';
import { resolveLocaleFromSearch } from '@/i18n/locale';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

useAuthStore.getState().initialize();
const locale = resolveLocaleFromSearch(window.location.search);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider locale={locale}>
      <ApolloProvider client={graphqlClient}>
        <TooltipProvider>
          <MainLayout />
        </TooltipProvider>
      </ApolloProvider>
    </I18nProvider>
  </React.StrictMode>
);
