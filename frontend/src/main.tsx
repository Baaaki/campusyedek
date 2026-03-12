import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AppRoutes } from './routes';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </QueryProvider>
    </BrowserRouter>
  </StrictMode>,
);
