import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { User, LeaveLedgerEntry, LeaveRequest, Shift } from '../types';
import { getLeaveBalance, formatHoursAsDays } from '../utils/leaveEngine';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';

export default function AdminDashboard() {
    const { currentUser, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [workers, setWorkers] = useState<User[]>([]);
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;
        loadDashboard();
    }, [currentUser]);

    const loadDashboard = async () => {
        if (!currentUser) return;
        try {
            // Load workers
            const userQ = query(
                collection(db, 'users'),
                where('storeId', '==', currentUser.storeId),
                where('role', '==', 'worker')
            );
            const userSnap = await getDocs(userQ);
            const workerList = userSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User));
            setWorkers(workerList);

            // Load balances for each worker
            const balMap: Record<string, number> = {};
            for (const w of workerList) {
                const ledgerQ = query(
                    collection(db, 'leaveLedger'),
                    where('storeId', '==', currentUser.storeId),
                    where('uid', '==', w.uid)
                );
                const ledgerSnap = await getDocs(ledgerQ);
                const entries = ledgerSnap.docs.map(d => d.data() as LeaveLedgerEntry);
                balMap[w.uid] = getLeaveBalance(entries);
            }
            setBalances(balMap);

            // Pending requests count
            const reqQ = query(
                collection(db, 'leaveRequests'),
                where('storeId', '==', currentUser.storeId),
                where('status', '==', 'requested')
            );
            const reqSnap = await getDocs(reqQ);
            setPendingCount(reqSnap.size);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const sidebarLinks = [
        { to: '/admin', icon: '🏠', label: '대시보드' },
        { to: '/admin/shifts', icon: '⏰', label: '근무 기록' },
        { to: '/admin/requests', icon: '📋', label: '연차 승인' },
        { to: '/admin/payroll', icon: '💰', label: '정산표' },
        { to: '/admin/employees', icon: '👥', label: '직원 관리' },
        { to: '/admin/settings', icon: '⚙️', label: '정책 설정' },
    ];

    if (loading) {
        return <div className="loading-screen"><div className="spinner" /></div>;
    }

    return (
        <div className="admin-layout">
            {/* Sidebar */}
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
                            {link.to === '/admin/requests' && pendingCount > 0 && (
                                <span className="badge badge-requested" style={{ marginLeft: 'auto' }}>{pendingCount}</span>
                            )}
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

            {/* Main Content */}
            <main className="admin-content">
                {/* Mobile Header */}
                <header className="app-header" style={{ display: 'none' }}>
                    <span className="app-header-title">📅 연차 관리</span>
                    <button onClick={signOut} className="btn btn-ghost btn-sm">로그아웃</button>
                </header>
                <style>{`@media(max-width:768px){.app-header{display:flex!important}}`}</style>

                <div className="page">
                    <div className="page-header">
                        <h1 className="page-title">대시보드</h1>
                    </div>

                    {/* Alerts */}
                    {pendingCount > 0 && (
                        <div className="alert alert-warning" style={{ marginBottom: 'var(--space-lg)', cursor: 'pointer' }} onClick={() => navigate('/admin/requests')}>
                            ⏳ 승인 대기 중인 연차 신청이 <strong>{pendingCount}건</strong> 있습니다.
                        </div>
                    )}

                    {/* Summary Cards */}
                    <div className="summary-grid" style={{ marginBottom: 'var(--space-lg)' }}>
                        <div className="summary-item">
                            <div className="summary-item-value">{workers.length}</div>
                            <div className="summary-item-label">전체 직원</div>
                        </div>
                        <div className="summary-item">
                            <div className="summary-item-value" style={{ color: 'var(--color-warning)' }}>{pendingCount}</div>
                            <div className="summary-item-label">승인 대기</div>
                        </div>
                        <div className="summary-item">
                            <div className="summary-item-value" style={{ color: 'var(--color-success)' }}>
                                {workers.filter(w => (balances[w.uid] ?? 0) > 0).length}
                            </div>
                            <div className="summary-item-label">연차 보유</div>
                        </div>
                    </div>

                    {/* Employee List */}
                    <div className="card">
                        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                            직원 연차 현황
                        </h3>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>이름</th>
                                        <th>잔여 연차</th>
                                        <th>상세</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workers.map(w => (
                                        <tr key={w.uid}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                                    <div className="app-header-avatar">{w.name?.[0]}</div>
                                                    <span>{w.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <strong style={{ color: (balances[w.uid] ?? 0) > 0 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                                                    {formatHoursAsDays(balances[w.uid] ?? 0)}
                                                </strong>
                                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 4 }}>
                                                    ({balances[w.uid] ?? 0}h)
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => navigate(`/shared/${w.uid}`)}
                                                >
                                                    상세 →
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {workers.length === 0 && (
                                        <tr>
                                            <td colSpan={3} style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                                                등록된 직원이 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

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
                <style>{`@media(max-width:768px){.bottom-nav{display:flex!important}.admin-content{padding-bottom:80px}}`}</style>
            </main>
        </div>
    );
}
