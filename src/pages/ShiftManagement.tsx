import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Shift } from '../types';
import { calculateNetMinutes, getWeekKey } from '../utils/leaveEngine';
import { useNavigate } from 'react-router-dom';
import { startOfISOWeek, endOfISOWeek, format, addWeeks, subWeeks, getISOWeek, getISOWeekYear } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function ShiftManagement() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfISOWeek(new Date()));
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [workers, setWorkers] = useState<Array<{ uid: string; name: string }>>([]);
    const [loading, setLoading] = useState(true);

    // New shift form
    const [showForm, setShowForm] = useState(false);
    const [formUid, setFormUid] = useState('');
    const [formDate, setFormDate] = useState('');
    const [formStart, setFormStart] = useState('09:00');
    const [formEnd, setFormEnd] = useState('18:00');
    const [formBreak, setFormBreak] = useState(60);

    const weekKey = `${getISOWeekYear(currentWeekStart)}-W${String(getISOWeek(currentWeekStart)).padStart(2, '0')}`;
    const weekEnd = endOfISOWeek(currentWeekStart);

    useEffect(() => {
        if (!currentUser) return;
        loadData();
    }, [currentUser, currentWeekStart]);

    const loadData = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Workers
            const wQ = query(
                collection(db, 'users'),
                where('storeId', '==', currentUser.storeId),
                where('role', '==', 'worker')
            );
            const wSnap = await getDocs(wQ);
            setWorkers(wSnap.docs.map(d => ({ uid: d.id, name: d.data().name })));

            // Shifts for this week
            const sQ = query(
                collection(db, 'shifts'),
                where('storeId', '==', currentUser.storeId),
                where('weekKey', '==', weekKey)
            );
            const sSnap = await getDocs(sQ);
            setShifts(sSnap.docs.map(d => ({ shiftId: d.id, ...d.data() } as Shift)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddShift = async () => {
        if (!currentUser || !formUid || !formDate) return;
        const netMinutes = calculateNetMinutes(formStart, formEnd, formBreak);
        try {
            await addDoc(collection(db, 'shifts'), {
                storeId: currentUser.storeId,
                uid: formUid,
                date: formDate,
                startTime: formStart,
                endTime: formEnd,
                breakMinutes: formBreak,
                netMinutes,
                weekKey: getWeekKey(formDate),
                confirmed: false,
                source: 'manual',
                createdBy: currentUser.uid,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            setShowForm(false);
            setFormUid('');
            setFormDate('');
            loadData();
        } catch (err) {
            alert('근무 기록 추가에 실패했습니다.');
        }
    };

    const getWorkerName = (uid: string) => workers.find(w => w.uid === uid)?.name ?? uid;

    const workerWeeklyTotal = (uid: string) => {
        return Math.round(
            shifts.filter(s => s.uid === uid).reduce((sum, s) => sum + (s.netMinutes || 0) / 60, 0) * 100
        ) / 100;
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">근무 기록 관리</h1>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    + 근무 추가
                </button>
            </div>

            {/* Week Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                    ← 이전 주
                </button>
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <strong>{weekKey}</strong>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {format(currentWeekStart, 'M/d', { locale: ko })} ~ {format(weekEnd, 'M/d', { locale: ko })}
                    </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                    다음 주 →
                </button>
            </div>

            {/* Add Shift Form */}
            {showForm && (
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                        근무 입력
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-md)' }}>
                        <div className="form-group">
                            <label className="form-label">직원</label>
                            <select className="form-select" value={formUid} onChange={e => setFormUid(e.target.value)}>
                                <option value="">선택</option>
                                {workers.map(w => <option key={w.uid} value={w.uid}>{w.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">날짜</label>
                            <input type="date" className="form-input" value={formDate} onChange={e => setFormDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">출근</label>
                            <input type="time" className="form-input" value={formStart} onChange={e => setFormStart(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">퇴근</label>
                            <input type="time" className="form-input" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">휴게(분)</label>
                            <input type="number" className="form-input" value={formBreak} onChange={e => setFormBreak(Number(e.target.value))} min={0} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                        <button className="btn btn-primary" onClick={handleAddShift}>저장</button>
                        <button className="btn btn-ghost" onClick={() => setShowForm(false)}>취소</button>
                    </div>
                    {formStart && formEnd && (
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-sm)' }}>
                            실근무시간: {(calculateNetMinutes(formStart, formEnd, formBreak) / 60).toFixed(1)}시간
                        </div>
                    )}
                </div>
            )}

            {/* Weekly Summary Per Worker */}
            {workers.map(w => {
                const workerShifts = shifts.filter(s => s.uid === w.uid).sort((a, b) => a.date.localeCompare(b.date));
                const total = workerWeeklyTotal(w.uid);
                if (workerShifts.length === 0) return null;
                return (
                    <div key={w.uid} className="card" style={{ marginBottom: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                <div className="app-header-avatar">{w.name?.[0]}</div>
                                <strong>{w.name}</strong>
                            </div>
                            <span style={{
                                color: total >= 15 ? 'var(--color-success)' : 'var(--color-warning)',
                                fontWeight: 700,
                                fontSize: 'var(--font-size-lg)',
                            }}>
                                {total}h
                            </span>
                        </div>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>날짜</th>
                                        <th>출근</th>
                                        <th>퇴근</th>
                                        <th>휴게</th>
                                        <th>실근무</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {workerShifts.map(s => (
                                        <tr key={s.shiftId}>
                                            <td>{s.date}</td>
                                            <td>{s.startTime}</td>
                                            <td>{s.endTime}</td>
                                            <td>{s.breakMinutes}분</td>
                                            <td>{(s.netMinutes / 60).toFixed(1)}h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}

            {shifts.length === 0 && !loading && (
                <div className="empty-state">
                    <div className="empty-state-icon">⏰</div>
                    <div className="empty-state-title">이 주차에 근무 기록이 없습니다</div>
                </div>
            )}
        </div>
    );
}
