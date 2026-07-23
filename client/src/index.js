import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

import axios from "axios";
axios.defaults.baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";

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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();