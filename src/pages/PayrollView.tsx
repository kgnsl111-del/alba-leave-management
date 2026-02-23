import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { LeaveLedgerEntry, Shift, User } from '../types';

export default function PayrollView() {
    const { currentUser } = useAuth();
    const [workers, setWorkers] = useState<User[]>([]);
    const [periodStart, setPeriodStart] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [periodEnd, setPeriodEnd] = useState(() => {
        const d = new Date();
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return last.toISOString().split('T')[0];
    });
    const [rows, setRows] = useState<Array<{
        uid: string; name: string; totalWorkHours: number;
        leaveHoursUsed: number; leaveDates: string[]; paidLeaveAmount: number; hourlyWage: number;
    }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;
        generate();
    }, [currentUser, periodStart, periodEnd]);

    const generate = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Workers
            const wQ = query(collection(db, 'users'), where('storeId', '==', currentUser.storeId), where('role', '==', 'worker'));
            const wSnap = await getDocs(wQ);
            const workerList = wSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User));
            setWorkers(workerList);

            const resultRows = [];
            for (const w of workerList) {
                // Shifts in period
                const sQ = query(
                    collection(db, 'shifts'),
                    where('storeId', '==', currentUser.storeId),
                    where('uid', '==', w.uid)
                );
                const sSnap = await getDocs(sQ);
                const shifts = sSnap.docs
                    .map(d => d.data() as Shift)
                    .filter(s => s.date >= periodStart && s.date <= periodEnd);
                const totalWorkHours = Math.round(shifts.reduce((sum, s) => sum + (s.netMinutes || 0) / 60, 0) * 100) / 100;

                // Leave used (approved) in period
                const lQ = query(
                    collection(db, 'leaveLedger'),
                    where('storeId', '==', currentUser.storeId),
                    where('uid', '==', w.uid),
                    where('type', '==', 'use')
                );
                const lSnap = await getDocs(lQ);
                const leaveEntries = lSnap.docs.map(d => d.data() as LeaveLedgerEntry);
                const leaveHoursUsed = Math.abs(
                    leaveEntries.reduce((sum, e) => sum + e.amountHours, 0)
                );

                // Approved leave request dates in period
                const rQ = query(
                    collection(db, 'leaveRequests'),
                    where('storeId', '==', currentUser.storeId),
                    where('uid', '==', w.uid),
                    where('status', '==', 'approved')
                );
                const rSnap = await getDocs(rQ);
                const leaveDates = rSnap.docs
                    .map(d => d.data().date as string)
                    .filter(d => d >= periodStart && d <= periodEnd);

                const hourlyWage = w.hourlyWage || 0;
                const paidLeaveAmount = Math.round(leaveHoursUsed * hourlyWage);

                resultRows.push({
                    uid: w.uid,
                    name: w.name,
                    totalWorkHours,
                    leaveHoursUsed,
                    leaveDates,
                    paidLeaveAmount,
                    hourlyWage,
                });
            }
            setRows(resultRows);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = () => {
        const header = '이름,총근무시간(h),연차사용시간(h),연차사용일,유급휴가금액(원),시급(원)\n';
        const body = rows.map(r =>
            `${r.name},${r.totalWorkHours},${r.leaveHoursUsed},"${r.leaveDates.join('; ')}",${r.paidLeaveAmount},${r.hourlyWage}`
        ).join('\n');
        const bom = '\uFEFF';
        const blob = new Blob([bom + header + body], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `정산표_${periodStart}_${periodEnd}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return <div className="loading-screen"><div className="spinner" /></div>;
    }

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">정산표</h1>
                <button className="btn btn-primary" onClick={downloadCSV}>
                    📥 CSV 다운로드
                </button>
            </div>

            {/* Period Selector */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group">
                        <label className="form-label">시작일</label>
                        <input type="date" className="form-input" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">종료일</label>
                        <input type="date" className="form-input" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Payroll Table */}
            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>이름</th>
                                <th>총 근무(h)</th>
                                <th>연차 사용(h)</th>
                                <th>연차 사용일</th>
                                <th>유급휴가 금액</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.uid}>
                                    <td><strong>{r.name}</strong></td>
                                    <td>{r.totalWorkHours}h</td>
                                    <td style={{ color: r.leaveHoursUsed > 0 ? 'var(--color-info)' : 'var(--text-muted)' }}>
                                        {r.leaveHoursUsed}h
                                    </td>
                                    <td style={{ fontSize: 'var(--font-size-xs)' }}>
                                        {r.leaveDates.length > 0 ? r.leaveDates.join(', ') : '-'}
                                    </td>
                                    <td style={{ fontWeight: 600 }}>
                                        {r.paidLeaveAmount > 0 ? (
                                            <span style={{ color: 'var(--color-success)' }}>₩{r.paidLeaveAmount.toLocaleString()}</span>
                                        ) : '-'}
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                                        데이터가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Summary */}
            {rows.length > 0 && (
                <div className="summary-grid" style={{ marginTop: 'var(--space-lg)' }}>
                    <div className="summary-item">
                        <div className="summary-item-value">
                            {rows.reduce((s, r) => s + r.totalWorkHours, 0).toFixed(1)}h
                        </div>
                        <div className="summary-item-label">총 근무시간</div>
                    </div>
                    <div className="summary-item">
                        <div className="summary-item-value" style={{ color: 'var(--color-info)' }}>
                            {rows.reduce((s, r) => s + r.leaveHoursUsed, 0)}h
                        </div>
                        <div className="summary-item-label">총 연차사용</div>
                    </div>
                    <div className="summary-item">
                        <div className="summary-item-value" style={{ color: 'var(--color-success)' }}>
                            ₩{rows.reduce((s, r) => s + r.paidLeaveAmount, 0).toLocaleString()}
                        </div>
                        <div className="summary-item-label">유급휴가 합계</div>
                    </div>
                </div>
            )}
        </div>
    );
}
