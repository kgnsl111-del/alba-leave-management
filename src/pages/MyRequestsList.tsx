import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { LeaveRequest } from '../types';
import { useNavigate, NavLink } from 'react-router-dom';

export default function MyRequestsList() {
    const { currentUser, signOut } = useAuth();
    const navigate = useNavigate();
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;
        loadRequests();
    }, [currentUser]);

    const loadRequests = async () => {
        if (!currentUser) return;
        try {
            const q = query(
                collection(db, 'leaveRequests'),
                where('uid', '==', currentUser.uid),
                where('storeId', '==', currentUser.storeId),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);
            setRequests(snap.docs.map(d => ({ requestId: d.id, ...d.data() } as LeaveRequest)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (requestId: string) => {
        if (!confirm('신청을 취소하시겠습니까?')) return;
        try {
            await updateDoc(doc(db, 'leaveRequests', requestId), {
                status: 'canceled',
            });
            loadRequests();
        } catch (err) {
            alert('취소에 실패했습니다.');
        }
    };

    const statusLabel: Record<string, string> = {
        requested: '대기 중',
        approved: '승인됨',
        rejected: '반려됨',
        canceled: '취소됨',
    };

    if (loading) {
        return <div className="loading-screen"><div className="spinner" /></div>;
    }

    return (
        <div className="worker-page">
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
                <div className="page-header">
                    <h2 className="page-title">내 신청 내역</h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {requests.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📋</div>
                            <div className="empty-state-title">신청 내역이 없습니다</div>
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate('/worker/request')}
                                style={{ marginTop: 'var(--space-md)' }}
                            >
                                연차 신청하기
                            </button>
                        </div>
                    ) : (
                        requests.map(req => (
                            <div key={req.requestId} className="card" style={{ padding: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                                    <strong style={{ fontSize: 'var(--font-size-md)' }}>{req.date}</strong>
                                    <span className={`badge badge-${req.status}`}>{statusLabel[req.status]}</span>
                                </div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>
                                    {req.amountHours}시간 · {req.reason}
                                </div>
                                {req.decisionNote && (
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)' }}>
                                        관리자 코멘트: {req.decisionNote}
                                    </div>
                                )}
                                {req.status === 'requested' && (
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleCancel(req.requestId)}
                                        style={{ marginTop: 'var(--space-xs)' }}
                                    >
                                        취소
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
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
