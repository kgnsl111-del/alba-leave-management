import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { LeaveLedgerEntry, LeaveRequest } from '../types';
import { getLeaveBalance, getMonthlySummary, formatHoursAsDays } from '../utils/leaveEngine';
import { useNavigate, NavLink } from 'react-router-dom';

export default function WorkerHome() {
    const { currentUser, signOut } = useAuth();
    const navigate = useNavigate();
    const [ledger, setLedger] = useState<LeaveLedgerEntry[]>([]);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [activeTab, setActiveTab] = useState<'summary' | 'log'>('summary');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;
        loadData();
    }, [currentUser]);

    const loadData = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Load ledger
            const ledgerQ = query(
                collection(db, 'leaveLedger'),
                where('uid', '==', currentUser.uid),
                where('storeId', '==', currentUser.storeId),
                orderBy('createdAt', 'desc')
            );
            const ledgerSnap = await getDocs(ledgerQ);
            const ledgerData = ledgerSnap.docs.map(d => ({ ledgerId: d.id, ...d.data() } as LeaveLedgerEntry));
            setLedger(ledgerData);

            // Load recent requests
            const reqQ = query(
                collection(db, 'leaveRequests'),
                where('uid', '==', currentUser.uid),
                where('storeId', '==', currentUser.storeId),
                orderBy('createdAt', 'desc')
            );
            const reqSnap = await getDocs(reqQ);
            setRequests(reqSnap.docs.map(d => ({ requestId: d.id, ...d.data() } as LeaveRequest)));
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const balance = getLeaveBalance(ledger);
    const now = new Date();
    const monthly = getMonthlySummary(ledger, now.getFullYear(), now.getMonth() + 1);

    const statusLabel: Record<string, string> = {
        requested: '대기',
        approved: '승인',
        rejected: '반려',
        canceled: '취소',
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
                <span style={{ color: 'var(--text-muted)' }}>로딩 중...</span>
            </div>
        );
    }

    return (
        <div className="worker-page">
            {/* Header */}
            <header className="app-header">
                <span className="app-header-title">📅 연차 관리</span>
                <div className="app-header-user">
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                        {currentUser?.name}
                    </span>
                    <button onClick={signOut} className="btn btn-ghost btn-sm">로그아웃</button>
                </div>
            </header>

            <div className="page">
                {/* Balance Card */}
                <div className="balance-card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div className="balance-label">잔여 연차</div>
                    <div className="balance-value">{formatHoursAsDays(balance)}</div>
                    <div className="balance-sub">{balance}시간</div>
                </div>

                {/* Monthly Summary */}
                <div className="summary-grid" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div className="summary-item">
                        <div className="summary-item-value" style={{ color: 'var(--color-success)' }}>
                            +{monthly.accrued}h
                        </div>
                        <div className="summary-item-label">이번 달 발생</div>
                    </div>
                    <div className="summary-item">
                        <div className="summary-item-value" style={{ color: 'var(--color-info)' }}>
                            -{monthly.used}h
                        </div>
                        <div className="summary-item-label">이번 달 사용</div>
                    </div>
                    <div className="summary-item">
                        <div className="summary-item-value" style={{ color: 'var(--color-warning)' }}>
                            {monthly.adjusted >= 0 ? '+' : ''}{monthly.adjusted}h
                        </div>
                        <div className="summary-item-label">조정</div>
                    </div>
                </div>

                {/* Quick Action */}
                <button
                    className="btn btn-primary btn-lg"
                    onClick={() => navigate('/worker/request')}
                    style={{ width: '100%', marginBottom: 'var(--space-lg)' }}
                >
                    ✍️ 연차 신청하기
                </button>

                {/* Tabs */}
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
                        onClick={() => setActiveTab('summary')}
                    >
                        최근 신청
                    </button>
                    <button
                        className={`tab ${activeTab === 'log' ? 'active' : ''}`}
                        onClick={() => setActiveTab('log')}
                    >
                        전체 로그
                    </button>
                </div>

                {activeTab === 'summary' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {requests.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📋</div>
                                <div className="empty-state-title">신청 내역이 없습니다</div>
                            </div>
                        ) : (
                            requests.slice(0, 10).map(req => (
                                <div key={req.requestId} className="card" style={{ padding: 'var(--space-md)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <strong>{req.date}</strong>
                                        <span className={`badge badge-${req.status}`}>{statusLabel[req.status]}</span>
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                        {req.amountHours}시간 · {req.reason}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'log' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                        {ledger.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📊</div>
                                <div className="empty-state-title">로그가 없습니다</div>
                            </div>
                        ) : (
                            ledger.map(entry => (
                                <div key={entry.ledgerId} className="card" style={{ padding: 'var(--space-md)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span className={`badge badge-${entry.type}`}>
                                            {entry.type === 'accrual' ? '발생' : entry.type === 'use' ? '사용' : '조정'}
                                        </span>
                                        <strong style={{
                                            color: entry.amountHours >= 0 ? 'var(--color-success)' : 'var(--color-info)',
                                        }}>
                                            {entry.amountHours >= 0 ? '+' : ''}{entry.amountHours}h
                                        </strong>
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                        {entry.note}
                                        {entry.relatedWeekKey && ` · 주차: ${entry.relatedWeekKey}`}
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                                        잔여: {entry.balance}h · {entry.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') ?? ''}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Nav */}
            <nav className="bottom-nav">
                <NavLink to="/worker" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                    <span className="bottom-nav-icon">🏠</span>
                    홈
                </NavLink>
                <NavLink to="/worker/request" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                    <span className="bottom-nav-icon">✍️</span>
                    신청
                </NavLink>
                <NavLink to="/worker/requests" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
                    <span className="bottom-nav-icon">📋</span>
                    내역
                </NavLink>
            </nav>
        </div>
    );
}
