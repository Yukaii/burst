import React from 'react';
import ReactDOM from 'react-dom/client';
import DashboardApp from './DashboardApp';
import './style.css';

const rootEl = document.getElementById('root');

if (!rootEl) {
  throw new Error('Root element not found');
}

const dashboardWindow = window as Window & {
  __burstDashboardRoot?: ReturnType<typeof ReactDOM.createRoot>;
};

const dashboardRoot = dashboardWindow.__burstDashboardRoot ?? ReactDOM.createRoot(rootEl);
dashboardWindow.__burstDashboardRoot = dashboardRoot;

dashboardRoot.render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>,
);
