import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { LeaveRequest, User } from '../types';

export default function LeaveApprovalList() {
    const { currentUser } = useAuth();
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [workers, setWorkers] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'requested' | 'all'>('requested');
    const [decisionNote, setDecisionNote] = useState('');
    const [activeId, setActiveId] = useState<string | null>(null);

    const noteTemplates = ['일정 확인 완료', '인원 부족으로 반려', '대체 인력 확보 완료', '일정 조정 요청'];

    useEffect(() => {
        if (!currentUser) return;
        loadData();
    }, [currentUser, filter]);

    const loadData = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Workers map
            const wQ = query(collection(db, 'users'), where('storeId', '==', currentUser.storeId));
            const wSnap = await getDocs(wQ);
            const wMap: Record<string, string> = {};
            wSnap.docs.forEach(d => { wMap[d.id] = d.data().name; });
            setWorkers(wMap);

            // Requests
            let rQ;
            if (filter === 'requested') {
                rQ = query(
                    collection(db, 'leaveRequests'),
                    where('storeId', '==', currentUser.storeId),
                    where('status', '==', 'requested'),
                    orderBy('createdAt', 'desc')
                );
            } else {
                rQ = query(
                    collection(db, 'leaveRequests'),
                    where('storeId', '==', currentUser.storeId),
                    orderBy('createdAt', 'desc')
                );
            }
            const rSnap = await getDocs(rQ);
            setRequests(rSnap.docs.map(d => ({ requestId: d.id, ...d.data() } as LeaveRequest)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDecision = async (requestId: string, status: 'approved' | 'rejected', req: LeaveRequest) => {
        if (!currentUser) return;
        try {
            await updateDoc(doc(db, 'leaveRequests', requestId), {
                status,
                decidedBy: currentUser.uid,
                decidedAt: Timestamp.now(),
                decisionNote: decisionNote || (status === 'approved' ? '승인' : '반려'),
            });

            // If approved, add ledger entry
            if (status === 'approved') {
                await addDoc(collection(db, 'leaveLedger'), {
                    storeId: currentUser.storeId,
                    uid: req.uid,
                    type: 'use',
                    amountHours: -req.amountHours,
                    balance: 0, // will be recalculated
                    relatedRequestId: requestId,
                    note: `연차 사용: ${req.date} (${req.amountHours}h)`,
                    createdBy: currentUser.uid,
                    createdAt: Timestamp.now(),
                });
            }

            setActiveId(null);
            setDecisionNote('');
            loadData();
        } catch (err) {
            alert('처리에 실패했습니다.');
        }
    };

    const statusLabel: Record<string, string> = {
        requested: '대기',
        approved: '승인',
        rejected: '반려',
        canceled: '취소',
    };

    if (loading) {
        return <div className="loading-screen"><div className="spinner" /></div>;
    }

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">연차 승인 관리</h1>
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <button
                        className={`btn btn-sm ${filter === 'requested' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setFilter('requested')}
                    >
                        대기 중
                    </button>
                    <button
                        className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setFilter('all')}
                    >
                        전체
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {requests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">✅</div>
                        <div className="empty-state-title">
                            {filter === 'requested' ? '대기 중인 신청이 없습니다' : '신청 내역이 없습니다'}
                        </div>
                    </div>
                ) : (
                    requests.map(req => (
                        <div key={req.requestId} className="card" style={{ padding: 'var(--space-md)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 4 }}>
                                        <div className="app-header-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                                            {workers[req.uid]?.[0]}
                                        </div>
                                        <strong>{workers[req.uid] ?? req.uid}</strong>
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                        📅 {req.date} · ⏱️ {req.amountHours}시간 · 💬 {req.reason}
                                    </div>
                                </div>
                                <span className={`badge badge-${req.status}`}>{statusLabel[req.status]}</span>
                            </div>

                            {req.status === 'requested' && (
                                <>
                                    {activeId === req.requestId ? (
                                        <div style={{ marginTop: 'var(--space-sm)' }}>
                                            <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
                                                {noteTemplates.map(t => (
                                                    <button
                                                        key={t}
                                                        className={`btn btn-sm ${decisionNote === t ? 'btn-primary' : 'btn-ghost'}`}
                                                        onClick={() => setDecisionNote(t)}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                            <input
                                                className="form-input"
                                                value={decisionNote}
                                                onChange={e => setDecisionNote(e.target.value)}
                                                placeholder="사유 입력 (선택)"
                                                style={{ marginBottom: 'var(--space-sm)' }}
                                            />
                                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                                <button className="btn btn-success" onClick={() => handleDecision(req.requestId, 'approved', req)}>
                                                    ✅ 승인
                                                </button>
                                                <button className="btn btn-danger" onClick={() => handleDecision(req.requestId, 'rejected', req)}>
                                                    ❌ 반려
                                                </button>
                                                <button className="btn btn-ghost" onClick={() => { setActiveId(null); setDecisionNote(''); }}>
                                                    취소
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                                            <button className="btn btn-success btn-sm" onClick={() => setActiveId(req.requestId)}>
                                                승인/반려
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {req.decisionNote && req.status !== 'requested' && (
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                                    사유: {req.decisionNote}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
