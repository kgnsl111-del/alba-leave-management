import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function LeaveRequestForm() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [date, setDate] = useState('');
    const [amountHours, setAmountHours] = useState(8);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const reasonTemplates = ['개인 사유', '병원 방문', '경조사', '관공서 방문', '기타'];

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
                        <input
                            type="date"
                            className="form-input"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                            min={new Date().toISOString().split('T')[0]}
                        />
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
