import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import WorkerHome from './pages/WorkerHome';
import LeaveRequestForm from './pages/LeaveRequestForm';
import MyRequestsList from './pages/MyRequestsList';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import ShiftManagement from './pages/ShiftManagement';
import LeaveApprovalList from './pages/LeaveApprovalList';
import PayrollView from './pages/PayrollView';
import PolicySettings from './pages/PolicySettings';
import EmployeeManagement from './pages/EmployeeManagement';
import SharedDetailView from './pages/SharedDetailView';
import './index.css';

function PrivateRoute({ children, role }: { children: React.ReactNode; role?: 'admin' | 'worker' }) {
    const { currentUser, loading } = useAuth();
    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
            </div>
        );
    }
    if (!currentUser) return <Navigate to="/login" />;
    if (role && currentUser.role !== role) {
        return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/worker'} />;
    }
    return <>{children}</>;
}

function AppRoutes() {
    const { currentUser, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
                <span style={{ color: 'var(--text-muted)' }}>로딩 중...</span>
            </div>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={
                currentUser ? <Navigate to={currentUser.role === 'admin' ? '/admin' : '/worker'} /> : <LoginPage />
            } />

            {/* Worker Routes */}
            <Route path="/worker" element={<PrivateRoute role="worker"><WorkerHome /></PrivateRoute>} />
            <Route path="/worker/request" element={<PrivateRoute role="worker"><LeaveRequestForm /></PrivateRoute>} />
            <Route path="/worker/requests" element={<PrivateRoute role="worker"><MyRequestsList /></PrivateRoute>} />

            {/* Admin Routes */}
            <Route path="/admin" element={<PrivateRoute role="admin"><AdminLayout /></PrivateRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="shifts" element={<ShiftManagement />} />
                <Route path="requests" element={<LeaveApprovalList />} />
                <Route path="payroll" element={<PayrollView />} />
                <Route path="settings" element={<PolicySettings />} />
                <Route path="employees" element={<EmployeeManagement />} />
            </Route>

            {/* Shared View */}
            <Route path="/shared/:uid" element={<PrivateRoute><SharedDetailView /></PrivateRoute>} />

            {/* Default */}
            <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
