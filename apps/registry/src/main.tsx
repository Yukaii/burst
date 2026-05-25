import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { RegistryApp } from './RegistryApp';
import './globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RegistryApp />
    </BrowserRouter>
  </React.StrictMode>,
);
