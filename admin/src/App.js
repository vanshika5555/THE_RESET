import './App.css';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import AddProduct from './components/AddProduct';
import EditProduct from './components/EditProduct';
import AdminOrders from './components/AdminOrders';
import Customers from './components/Customers';
import AdminLogin from './components/AdminLogin';

const TOKEN_KEY = 'theresetAdminToken';
const NAME_KEY  = 'theresetAdminName';

// Attach the saved token to every request from the moment the app loads.
const savedToken = localStorage.getItem(TOKEN_KEY);
if (savedToken) {
  axios.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
}

function App() {
  const [token, setToken] = useState(savedToken || '');
  const [name, setName]   = useState(localStorage.getItem(NAME_KEY) || '');

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
    delete axios.defaults.headers.common.Authorization;
    setToken('');
    setName('');
  };

  // If the server ever rejects our token, drop straight back to the login screen.
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          handleLogout();
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  const handleLogin = (newToken, adminName) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(NAME_KEY, adminName || '');
    axios.defaults.headers.common.Authorization = `Bearer ${newToken}`;
    setToken(newToken);
    setName(adminName || '');
  };

  if (!token) return <AdminLogin onLogin={handleLogin} />;

  return (
    <Router>
      <div className="admin-layout">
        <Sidebar />
        <main className="admin-main">
          <div style={{
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
            gap: '14px', padding: '14px 24px 0', fontSize: '13px', color: '#666',
          }}>
            <span>{name ? `Signed in as ${name}` : 'Signed in'}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: '7px 14px', border: '1px solid #ddd', background: '#fff',
                borderRadius: '4px', font: 'inherit', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Log out
            </button>
          </div>

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/add" element={<AddProduct />} />
            <Route path="/products/edit/:id" element={<EditProduct />} />
            <Route path="/orders" element={<AdminOrders />} />
            <Route path="/customers" element={<Customers />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;