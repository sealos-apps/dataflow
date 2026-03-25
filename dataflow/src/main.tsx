import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConnectionProvider } from '@/contexts/ConnectionContext';
import { MainLayout } from '@/components/layout/MainLayout';
import './globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConnectionProvider>
      <MainLayout />
    </ConnectionProvider>
  </React.StrictMode>
);
