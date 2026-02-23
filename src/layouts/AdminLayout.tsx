import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
    const { currentUser, signOut } = useAuth();

    const sidebarLinks = [
        { to: '/admin', icon: '🏠', label: '대시보드' },
        { to: '/admin/shifts', icon: '⏰', label: '근무 기록' },
        { to: '/admin/requests', icon: '📋', label: '연차 승인' },
        { to: '/admin/payroll', icon: '💰', label: '정산표' },
        { to: '/admin/employees', icon: '👥', label: '직원 관리' },
        { to: '/admin/settings', icon: '⚙️', label: '정책 설정' },
    ];

    return (
        <div className="admin-layout">
            {/* Desktop Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-brand">📅 연차 관리</div>
                <nav className="sidebar-nav">
                    {sidebarLinks.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.to === '/admin'}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <span className="sidebar-link-icon">{link.icon}</span>
                            {link.label}
                        </NavLink>
                    ))}
                </nav>
                <div style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                        {currentUser?.name}
                    </div>
                    <button onClick={signOut} className="btn btn-ghost btn-sm" style={{ width: '100%' }}>로그아웃</button>
                </div>
            </aside>

            {/* Main */}
            <main className="admin-content">
                {/* Mobile Header */}
                <header className="app-header" style={{ display: 'none' }}>
                    <span className="app-header-title">📅 연차 관리</span>
                    <button onClick={signOut} className="btn btn-ghost btn-sm">로그아웃</button>
                </header>
                <style>{`@media(max-width:768px){.admin-layout>.admin-content>.app-header{display:flex!important}}`}</style>

                <Outlet />

                {/* Mobile Bottom Nav */}
                <nav className="bottom-nav" style={{ display: 'none' }}>
                    {sidebarLinks.slice(0, 5).map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.to === '/admin'}
                            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="bottom-nav-icon">{link.icon}</span>
                            {link.label}
                        </NavLink>
                    ))}
                </nav>
                <style>{`@media(max-width:768px){.admin-layout>.admin-content>.bottom-nav{display:flex!important}.admin-content{padding-bottom:80px}}`}</style>
            </main>
        </div>
    );
}
