import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';

const popupRootEl = document.getElementById('root');

if (!popupRootEl) {
  throw new Error('Root element not found');
}

const popupWindow = window as Window & {
  __burstPopupRoot?: ReturnType<typeof ReactDOM.createRoot>;
};

const popupRoot = popupWindow.__burstPopupRoot ?? ReactDOM.createRoot(popupRootEl);
popupWindow.__burstPopupRoot = popupRoot;
popupRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
