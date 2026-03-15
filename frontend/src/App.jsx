import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from "./Dashboard";
import Login from "./Login";
import Register from "./Register";
import CoderLog2 from "./CoderLog2";
import CreateProject from "./CreateProject";
import Projectviewrouter from "./Projectviewrouter";  // Changed this line

export default function App() {
  const token = localStorage.getItem('token');
  
  return (
    <Routes>
      <Route 
        path="/register" 
        element={token ? <Navigate to="/dashboard" /> : <Register />} 
      />
      <Route 
        path="/login" 
        element={token ? <Navigate to="/dashboard" /> : <Login />} 
      />
      <Route 
        path="/dashboard" 
        element={token ? <Dashboard /> : <Navigate to="/login" />} 
      />
      <Route path="/coderlog" element={<CoderLog2 />} />
      <Route 
        path="/createproject" 
        element={token ? <CreateProject /> : <Navigate to="/login" />} 
      />
      <Route 
        path="/project/:id" 
        element={token ? <Projectviewrouter /> : <Navigate to="/login" />}  // Changed this line
      />
      <Route 
        path="/" 
        element={<Navigate to={token ? "/dashboard" : "/login"} />} 
      />
    </Routes>
  );
}