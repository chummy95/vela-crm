import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import blueLogo from './assets/logos/BLUE LOGO.png';
import './styles/global.css';

const iconLink = document.querySelector("link[rel~='icon']") || document.createElement('link');
iconLink.rel = 'icon';
iconLink.type = 'image/png';
iconLink.href = blueLogo;
document.head.appendChild(iconLink);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
