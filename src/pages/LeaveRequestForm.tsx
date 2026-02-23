import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDateLabel(d: Date): string {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

export default function LeaveRequestForm() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [date, setDate] = useState('');
    const [amountHours, setAmountHours] = useState(8);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [calMonth, setCalMonth] = useState(() => new Date());

    const reasonTemplates = ['개인 사유', '병원 방문', '경조사', '관공서 방문', '기타'];

    const today = useMemo(() => formatDate(new Date()), []);

    // Quick date options: today + next 6 days
    const quickDates = useMemo(() => {
        const arr: { label: string; value: string }[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            arr.push({
                label: i === 0 ? '오늘' : i === 1 ? '내일' : formatDateLabel(d),
                value: formatDate(d),
            });
        }
        return arr;
    }, []);

    // Calendar grid
    const calendarDays = useMemo(() => {
        const year = calMonth.getFullYear();
        const month = calMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const grid: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) grid.push(null);
        for (let i = 1; i <= daysInMonth; i++) grid.push(i);
        return { year, month, grid };
    }, [calMonth]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !date) return;
        setLoading(true);
        setError('');
        try {
            await addDoc(collection(db, 'leaveRequests'), {
                storeId: currentUser.storeId,
                uid: currentUser.uid,
                date,
                amountHours,
                reason: reason || '개인 사유',
                status: 'requested',
                createdAt: Timestamp.now(),
            });
            navigate('/worker/requests');
        } catch (err: any) {
            setError('신청에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="worker-page">
            <header className="app-header">
                <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm">← 뒤로</button>
                <span className="app-header-title">연차 신청</span>
                <div style={{ width: 60 }} />
            </header>

            <div className="page" style={{ maxWidth: 500 }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                    {error && <div className="alert alert-danger">⚠️ {error}</div>}

                    {/* Step 1: Date */}
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <span style={{ fontSize: 24 }}>📅</span>
                            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>날짜 선택</h3>
                        </div>

                        {/* Quick date buttons */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
                            {quickDates.map(qd => (
                                <button
                                    key={qd.value}
                                    type="button"
                                    className={`btn btn-sm ${date === qd.value ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setDate(qd.value)}
                                >
                                    {qd.label}
                                </button>
                            ))}
                        </div>

                        {/* Mini Calendar */}
                        <div style={{ border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', padding: 'var(--space-sm)', background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                                <button type="button" className="btn btn-ghost btn-sm"
                                    onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}>
                                    &lt;
                                </button>
                                <strong style={{ fontSize: 'var(--font-size-sm)' }}>
                                    {calendarDays.year}년 {calendarDays.month + 1}월
                                </strong>
                                <button type="button" className="btn btn-ghost btn-sm"
                                    onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}>
                                    &gt;
                                </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
                                {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                                    <div key={d} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', padding: '4px 0', fontWeight: 600 }}>{d}</div>
                                ))}
                                {calendarDays.grid.map((day, i) => {
                                    if (day === null) return <div key={`e-${i}`} />;
                                    const val = `${calendarDays.year}-${String(calendarDays.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const isPast = val < today;
                                    const isSelected = val === date;
                                    const isToday = val === today;
                                    return (
                                        <button
                                            key={val}
                                            type="button"
                                            disabled={isPast}
                                            onClick={() => setDate(val)}
                                            style={{
                                                padding: '6px 0',
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: isSelected ? 700 : 400,
                                                border: isToday && !isSelected ? '1px solid var(--color-primary)' : 'none',
                                                borderRadius: 'var(--radius-sm)',
                                                background: isSelected ? 'var(--color-primary)' : 'transparent',
                                                color: isSelected ? '#fff' : isPast ? '#d1d5db' : 'var(--text-primary)',
                                                cursor: isPast ? 'not-allowed' : 'pointer',
                                            }}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {date && (
                            <div style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', fontWeight: 600 }}>
                                선택: {date}
                            </div>
                        )}
                    </div>

                    {/* Step 2: Hours */}
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <span style={{ fontSize: 24 }}>⏱️</span>
                            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>사용 시간</h3>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                            {[4, 8].map(h => (
                                <button
                                    key={h}
                                    type="button"
                                    className={`btn ${amountHours === h ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setAmountHours(h)}
                                >
                                    {h}시간 ({h / 8}일)
                                </button>
                            ))}
                            <input
                                type="number"
                                className="form-input"
                                value={amountHours}
                                onChange={(e) => setAmountHours(Number(e.target.value))}
                                min={1}
                                max={24}
                                step={1}
                                style={{ width: 100 }}
                                placeholder="직접 입력"
                            />
                        </div>
                    </div>

                    {/* Step 3: Reason */}
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <span style={{ fontSize: 24 }}>💬</span>
                            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>사유</h3>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginBottom: 'var(--space-sm)' }}>
                            {reasonTemplates.map(r => (
                                <button
                                    key={r}
                                    type="button"
                                    className={`btn btn-sm ${reason === r ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setReason(r)}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <textarea
                            className="form-textarea"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="사유를 입력하세요 (선택)"
                            rows={2}
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={loading || !date}
                        style={{ width: '100%' }}
                    >
                        {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : '📤 신청 제출'}
                    </button>
                </form>
            </div>
        </div>
    );
}
