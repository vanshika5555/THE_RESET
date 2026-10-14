import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// Brand layer last, so its shared look wins over component defaults.
import './brand.css';

import axios from "axios";
// The API address comes from REACT_APP_API_URL (set on Vercel). Vite is told
// to accept that old name too, so nothing on Vercel has to change.
axios.defaults.baseURL = import.meta.env.REACT_APP_API_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";

// The free hosting plan puts the API to sleep after a quiet spell, and the
// first request has to wait for it to boot. Ping it the moment the page
// loads so it is usually awake by the time someone opens a collection.
axios.get('/').catch(() => {});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
