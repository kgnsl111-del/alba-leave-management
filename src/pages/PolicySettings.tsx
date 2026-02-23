import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { LeavePolicy } from '../types';

export default function PolicySettings() {
    const { currentUser } = useAuth();
    const [policy, setPolicy] = useState<LeavePolicy | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [minWeeklyHours, setMinWeeklyHours] = useState(15);
    const [accrualMode, setAccrualMode] = useState<'fixed' | 'proportional'>('fixed');
    const [accrualFixedHours, setAccrualFixedHours] = useState(8);
    const [accrualRatio, setAccrualRatio] = useState(0.2);
    const [maxAccumulatedHours, setMaxAccumulatedHours] = useState(0);
    const [displayDayHours, setDisplayDayHours] = useState(8);

    useEffect(() => {
        if (!currentUser) return;
        loadPolicy();
    }, [currentUser]);

    const loadPolicy = async () => {
        if (!currentUser) return;
        try {
            const pDoc = await getDoc(doc(db, 'leavePolicy', currentUser.storeId));
            if (pDoc.exists()) {
                const data = pDoc.data() as LeavePolicy;
                setPolicy(data);
                setMinWeeklyHours(data.minWeeklyHours);
                setAccrualMode(data.accrualMode);
                setAccrualFixedHours(data.accrualFixedHours ?? 8);
                setAccrualRatio(data.accrualRatio ?? 0.2);
                setMaxAccumulatedHours(data.maxAccumulatedHours);
                setDisplayDayHours(data.displayDayHours);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!currentUser) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'leavePolicy', currentUser.storeId), {
                policyId: currentUser.storeId,
                storeId: currentUser.storeId,
                minWeeklyHours,
                accrualMode,
                accrualFixedHours: accrualMode === 'fixed' ? accrualFixedHours : null,
                accrualRatio: accrualMode === 'proportional' ? accrualRatio : null,
                maxAccumulatedHours,
                displayDayHours,
                enabled: true,
                updatedBy: currentUser.uid,
                updatedAt: Timestamp.now(),
            });
            alert('정책이 저장되었습니다.');
        } catch (err) {
            alert('저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="loading-screen"><div className="spinner" /></div>;
    }

    return (
        <div className="page" style={{ maxWidth: 600 }}>
            <div className="page-header">
                <h1 className="page-title">연차 정책 설정</h1>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                {/* Min Weekly Hours */}
                <div className="card">
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                        주 최소 근무시간
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                        이 시간 이상 근무해야 해당 주에 연차가 발생합니다 (한국 기준: 15시간)
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <input
                            type="number"
                            className="form-input"
                            value={minWeeklyHours}
                            onChange={e => setMinWeeklyHours(Number(e.target.value))}
                            min={0}
                            style={{ width: 100 }}
                        />
                        <span style={{ color: 'var(--text-muted)' }}>시간</span>
                    </div>
                </div>

                {/* Accrual Mode */}
                <div className="card">
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                        발생 방식
                    </h3>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                        <button
                            className={`btn ${accrualMode === 'fixed' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setAccrualMode('fixed')}
                        >
                            고정 시간
                        </button>
                        <button
                            className={`btn ${accrualMode === 'proportional' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setAccrualMode('proportional')}
                        >
                            비례 계산
                        </button>
                    </div>

                    {accrualMode === 'fixed' ? (
                        <div className="form-group">
                            <label className="form-label">주당 고정 발생 시간</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={accrualFixedHours}
                                    onChange={e => setAccrualFixedHours(Number(e.target.value))}
                                    min={0}
                                    step={0.5}
                                    style={{ width: 100 }}
                                />
                                <span style={{ color: 'var(--text-muted)' }}>시간/주</span>
                            </div>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">비율 (주간근무시간 × 이 값 = 발생량)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={accrualRatio}
                                    onChange={e => setAccrualRatio(Number(e.target.value))}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    style={{ width: 100 }}
                                />
                                <span style={{ color: 'var(--text-muted)' }}>
                                    (예: 40h × {accrualRatio} = {(40 * accrualRatio).toFixed(1)}h 발생)
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Max Accumulated */}
                <div className="card">
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                        최대 누적 한도
                    </h3>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                        0 = 무제한
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <input
                            type="number"
                            className="form-input"
                            value={maxAccumulatedHours}
                            onChange={e => setMaxAccumulatedHours(Number(e.target.value))}
                            min={0}
                            style={{ width: 100 }}
                        />
                        <span style={{ color: 'var(--text-muted)' }}>시간 (0=무제한)</span>
                    </div>
                </div>

                {/* Display Day Hours */}
                <div className="card">
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                        1일 환산 기준
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <input
                            type="number"
                            className="form-input"
                            value={displayDayHours}
                            onChange={e => setDisplayDayHours(Number(e.target.value))}
                            min={1}
                            style={{ width: 100 }}
                        />
                        <span style={{ color: 'var(--text-muted)' }}>시간 = 1일</span>
                    </div>
                </div>

                <button
                    className="btn btn-primary btn-lg"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ width: '100%' }}
                >
                    {saving ? <span className="spinner" style={{ width: 18, height: 18 }} /> : '💾 저장'}
                </button>
            </div>
        </div>
    );
}
