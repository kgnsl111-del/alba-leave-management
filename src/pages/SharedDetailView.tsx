import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { User, LeaveLedgerEntry, Shift } from '../types';
import { getLeaveBalance, getMonthlySummary, formatHoursAsDays, getWeeklyBreakdown } from '../utils/leaveEngine';

export default function SharedDetailView() {
    const { currentUser } = useAuth();
    const { uid } = useParams<{ uid: string }>();
    const [targetUser, setTargetUser] = useState<User | null>(null);
    const [ledger, setLedger] = useState<LeaveLedgerEntry[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'summary' | 'log' | 'breakdown'>('summary');

    useEffect(() => {
        if (!currentUser || !uid) return;
        loadData();
    }, [currentUser, uid]);

    const loadData = async () => {
        if (!currentUser || !uid) return;
        setLoading(true);
        try {
            // User info
            const uDoc = await getDoc(doc(db, 'users', uid));
            if (uDoc.exists()) {
                setTargetUser({ uid: uDoc.id, ...uDoc.data() } as User);
            }

            // Ledger
            const lQ = query(
                collection(db, 'leaveLedger'),
                where('uid', '==', uid),
                where('storeId', '==', currentUser.storeId),
                orderBy('createdAt', 'desc')
            );
            const lSnap = await getDocs(lQ);
            setLedger(lSnap.docs.map(d => ({ ledgerId: d.id, ...d.data() } as LeaveLedgerEntry)));

            // Shifts
            const sQ = query(
                collection(db, 'shifts'),
                where('uid', '==', uid),
                where('storeId', '==', currentUser.storeId),
                orderBy('date', 'desc')
            );
            const sSnap = await getDocs(sQ);
            setShifts(sSnap.docs.map(d => ({ shiftId: d.id, ...d.data() } as Shift)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="loading-screen"><div className="spinner" /></div>;
    }

    const balance = getLeaveBalance(ledger);
    const now = new Date();
    const monthly = getMonthlySummary(ledger, now.getFullYear(), now.getMonth() + 1);
    const weeklyData = getWeeklyBreakdown(shifts);
    const isAdmin = currentUser?.role === 'admin';

    return (
        <div className="page" style={{ paddingBottom: 'var(--space-2xl)' }}>
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        {targetUser?.name ?? '직원'} 상세
                    </h1>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        관리자와 근로자가 동일한 데이터를 봅니다
                    </span>
                </div>
                {isAdmin && (
                    <span className="badge badge-approved">관리자 뷰</span>
                )}
            </div>

            {/* Balance */}
            <div className="balance-card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="balance-label">잔여 연차</div>
                <div className="balance-value">{formatHoursAsDays(balance)}</div>
                <div className="balance-sub">{balance}시간</div>
            </div>

            {/* Monthly Summary */}
            <div className="summary-grid" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="summary-item">
                    <div className="summary-item-value" style={{ color: 'var(--color-success)' }}>+{monthly.accrued}h</div>
                    <div className="summary-item-label">이번 달 발생</div>
                </div>
                <div className="summary-item">
                    <div className="summary-item-value" style={{ color: 'var(--color-info)' }}>-{monthly.used}h</div>
                    <div className="summary-item-label">이번 달 사용</div>
                </div>
                <div className="summary-item">
                    <div className="summary-item-value" style={{ color: 'var(--color-warning)' }}>
                        {monthly.adjusted >= 0 ? '+' : ''}{monthly.adjusted}h
                    </div>
                    <div className="summary-item-label">조정</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button className={`tab ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
                    요약
                </button>
                <button className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
                    연차 로그
                </button>
                <button className={`tab ${activeTab === 'breakdown' ? 'active' : ''}`} onClick={() => setActiveTab('breakdown')}>
                    주차별 근거
                </button>
            </div>

            {/* Summary Tab */}
            {activeTab === 'summary' && (
                <div className="card">
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                        전체 현황
                    </h3>
                    <div className="table-container">
                        <table className="table">
                            <tbody>
                                <tr>
                                    <td style={{ color: 'var(--text-muted)' }}>총 발생</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                        {ledger.filter(e => e.type === 'accrual').reduce((s, e) => s + e.amountHours, 0)}h
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--text-muted)' }}>총 사용</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                        {Math.abs(ledger.filter(e => e.type === 'use').reduce((s, e) => s + e.amountHours, 0))}h
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--text-muted)' }}>조정</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                        {ledger.filter(e => e.type === 'adjust').reduce((s, e) => s + e.amountHours, 0)}h
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--text-muted)', fontWeight: 700 }}>잔여</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--color-primary-light)' }}>
                                        {balance}h ({formatHoursAsDays(balance)})
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Log Tab */}
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
                                    <strong style={{ color: entry.amountHours >= 0 ? 'var(--color-success)' : 'var(--color-info)' }}>
                                        {entry.amountHours >= 0 ? '+' : ''}{entry.amountHours}h
                                    </strong>
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                    {entry.note}
                                    {entry.relatedWeekKey && ` · 주차: ${entry.relatedWeekKey}`}
                                    {entry.weeklyHoursWorked != null && ` · 주간근무: ${entry.weeklyHoursWorked}h`}
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                                    잔여: {entry.balance}h · {entry.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') ?? ''}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Weekly Breakdown Tab */}
            {activeTab === 'breakdown' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                    {weeklyData.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📅</div>
                            <div className="empty-state-title">근무 기록이 없습니다</div>
                        </div>
                    ) : (
                        weeklyData.map(week => (
                            <div key={week.weekKey} className="card" style={{ padding: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                                    <strong>{week.weekKey}</strong>
                                    <span style={{
                                        color: week.totalHours >= 15 ? 'var(--color-success)' : 'var(--color-warning)',
                                        fontWeight: 700,
                                    }}>
                                        {week.totalHours}h / {week.shiftCount}일
                                    </span>
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: week.totalHours >= 15 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                    {week.totalHours >= 15 ? '✅ 연차 발생 기준 충족' : '⚠️ 15시간 미만 - 연차 미발생'}
                                </div>
                                <div className="table-container" style={{ marginTop: 'var(--space-sm)' }}>
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>날짜</th>
                                                <th>시간</th>
                                                <th>실근무</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {week.shifts.map(s => (
                                                <tr key={s.shiftId}>
                                                    <td>{s.date}</td>
                                                    <td>{s.startTime}~{s.endTime}</td>
                                                    <td>{(s.netMinutes / 60).toFixed(1)}h</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
