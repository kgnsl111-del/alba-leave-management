import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { User } from '../types';

export default function EmployeeManagement() {
    const { currentUser } = useAuth();
    const [employees, setEmployees] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formWage, setFormWage] = useState(9860);
    const [formHireDate, setFormHireDate] = useState('');
    const [formRole, setFormRole] = useState<'worker' | 'admin'>('worker');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!currentUser) return;
        loadEmployees();
    }, [currentUser]);

    const loadEmployees = async () => {
        if (!currentUser) return;
        try {
            const q = query(
                collection(db, 'users'),
                where('storeId', '==', currentUser.storeId)
            );
            const snap = await getDocs(q);
            setEmployees(snap.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!currentUser || !formName || !formEmail || !formPassword) return;
        setSaving(true);
        try {
            // Note: In production, use Cloud Functions for user creation.
            // This is a simplified MVP approach.
            const cred = await createUserWithEmailAndPassword(auth, formEmail, formPassword);
            await addDoc(collection(db, 'users'), {
                name: formName,
                email: formEmail,
                role: formRole,
                storeId: currentUser.storeId,
                hourlyWage: formWage,
                hireDate: formHireDate ? Timestamp.fromDate(new Date(formHireDate)) : Timestamp.now(),
                isActive: true,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });

            // Also store with uid as doc ID
            const { setDoc } = await import('firebase/firestore');
            await setDoc(doc(db, 'users', cred.user.uid), {
                name: formName,
                email: formEmail,
                role: formRole,
                storeId: currentUser.storeId,
                hourlyWage: formWage,
                hireDate: formHireDate ? Timestamp.fromDate(new Date(formHireDate)) : Timestamp.now(),
                isActive: true,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });

            setShowForm(false);
            setFormName('');
            setFormEmail('');
            setFormPassword('');
            loadEmployees();
        } catch (err: any) {
            alert(`직원 추가 실패: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="loading-screen"><div className="spinner" /></div>;
    }

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">직원 관리</h1>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    + 직원 추가
                </button>
            </div>

            {showForm && (
                <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
                        새 직원 등록
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                        <div className="form-group">
                            <label className="form-label">이름</label>
                            <input className="form-input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="홍길동" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">이메일</label>
                            <input type="email" className="form-input" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@example.com" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">비밀번호 (초기)</label>
                            <input type="password" className="form-input" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="최소 6자" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">역할</label>
                            <select className="form-select" value={formRole} onChange={e => setFormRole(e.target.value as 'worker' | 'admin')}>
                                <option value="worker">근로자 (알바)</option>
                                <option value="admin">관리자</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">시급 (원)</label>
                            <input type="number" className="form-input" value={formWage} onChange={e => setFormWage(Number(e.target.value))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">입사일</label>
                            <input type="date" className="form-input" value={formHireDate} onChange={e => setFormHireDate(e.target.value)} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                        <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
                            {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '등록'}
                        </button>
                        <button className="btn btn-ghost" onClick={() => setShowForm(false)}>취소</button>
                    </div>
                </div>
            )}

            {/* Employee Table */}
            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>이름</th>
                                <th>이메일</th>
                                <th>역할</th>
                                <th>시급</th>
                                <th>상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(emp => (
                                <tr key={emp.uid}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                            <div className="app-header-avatar">{emp.name?.[0]}</div>
                                            {emp.name}
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{emp.email}</td>
                                    <td>
                                        <span className={`badge ${emp.role === 'admin' ? 'badge-approved' : 'badge-requested'}`}>
                                            {emp.role === 'admin' ? '관리자' : '근로자'}
                                        </span>
                                    </td>
                                    <td>{emp.hourlyWage?.toLocaleString()}원</td>
                                    <td>
                                        <span className={`badge ${emp.isActive ? 'badge-approved' : 'badge-canceled'}`}>
                                            {emp.isActive ? '활성' : '비활성'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
