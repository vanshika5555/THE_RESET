import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

import axios from "axios";
axios.defaults.baseURL = import.meta.env.REACT_APP_API_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

