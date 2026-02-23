import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
    calculateNetMinutes,
    getWeekKey,
    getWeeklyWorkedHours,
    calculateWeeklyAccrual,
    getLeaveBalance,
    getMonthlySummary,
    formatHoursAsDays,
    getWeeklyBreakdown,
} from '../utils/leaveEngine';
import { Shift, LeavePolicy, LeaveLedgerEntry } from '../types';

// ─── Helper: 가짜 Shift 생성 ───
function makeShift(overrides: Partial<Shift> = {}): Shift {
    return {
        shiftId: 'shift-1',
        storeId: 'store-1',
        uid: 'user-1',
        date: '2026-02-16',
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        netMinutes: 480,
        weekKey: '2026-W08',
        confirmed: false,
        source: 'manual',
        createdBy: 'admin-1',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...overrides,
    };
}

// ─── Helper: 가짜 정책 ───
function makePolicy(overrides: Partial<LeavePolicy> = {}): LeavePolicy {
    return {
        policyId: 'store-1',
        storeId: 'store-1',
        minWeeklyHours: 15,
        accrualMode: 'fixed',
        accrualFixedHours: 8,
        maxAccumulatedHours: 0,
        displayDayHours: 8,
        enabled: true,
        updatedBy: 'admin-1',
        updatedAt: Timestamp.now(),
        ...overrides,
    };
}

// ─── Helper: 가짜 Ledger Entry ───
function makeLedger(overrides: Partial<LeaveLedgerEntry> = {}): LeaveLedgerEntry {
    return {
        ledgerId: 'ledger-1',
        storeId: 'store-1',
        uid: 'user-1',
        type: 'accrual',
        amountHours: 8,
        balance: 8,
        note: 'test',
        createdBy: 'admin-1',
        createdAt: Timestamp.now(),
        ...overrides,
    };
}

// ═══════════════════════════════════════════
// 테스트 케이스
// ═══════════════════════════════════════════

describe('calculateNetMinutes', () => {
    it('09:00~18:00, 휴게 60분 → 480분 (8시간)', () => {
        expect(calculateNetMinutes('09:00', '18:00', 60)).toBe(480);
    });

    it('10:00~15:00, 휴게 30분 → 270분 (4.5시간)', () => {
        expect(calculateNetMinutes('10:00', '15:00', 30)).toBe(270);
    });

    it('야간근무: 22:00~06:00, 휴게 0분 → 480분', () => {
        expect(calculateNetMinutes('22:00', '06:00', 0)).toBe(480);
    });
});

describe('getWeekKey', () => {
    it('2026-02-16 (월) → 2026-W08', () => {
        expect(getWeekKey('2026-02-16')).toBe('2026-W08');
    });
});

// ═══════════════════════════════════════════
// 케이스 1: 주 5일 8시간 고정(주 40h)에서 정상 발생/차감/잔여
// ═══════════════════════════════════════════
describe('케이스 1: 주 40h 고정 — 정상 발생/차감/잔여', () => {
    const policy = makePolicy({ minWeeklyHours: 15, accrualMode: 'fixed', accrualFixedHours: 8 });
    const shifts: Shift[] = [
        makeShift({ shiftId: 's1', date: '2026-02-16', netMinutes: 480, weekKey: '2026-W08' }),
        makeShift({ shiftId: 's2', date: '2026-02-17', netMinutes: 480, weekKey: '2026-W08' }),
        makeShift({ shiftId: 's3', date: '2026-02-18', netMinutes: 480, weekKey: '2026-W08' }),
        makeShift({ shiftId: 's4', date: '2026-02-19', netMinutes: 480, weekKey: '2026-W08' }),
        makeShift({ shiftId: 's5', date: '2026-02-20', netMinutes: 480, weekKey: '2026-W08' }),
    ];

    it('주간 합산 = 40h', () => {
        expect(getWeeklyWorkedHours(shifts, '2026-W08')).toBe(40);
    });

    it('40h ≥ 15h → accruals=true, 8h 발생', () => {
        const result = calculateWeeklyAccrual(40, policy);
        expect(result.accrues).toBe(true);
        expect(result.hours).toBe(8);
    });

    it('발생 8h, 사용 -8h → 잔여 0h', () => {
        const ledger: LeaveLedgerEntry[] = [
            makeLedger({ type: 'accrual', amountHours: 8, balance: 8 }),
            makeLedger({ type: 'use', amountHours: -8, balance: 0 }),
        ];
        expect(getLeaveBalance(ledger)).toBe(0);
    });

    it('발생 16h, 사용 -8h → 잔여 8h', () => {
        const ledger: LeaveLedgerEntry[] = [
            makeLedger({ type: 'accrual', amountHours: 8 }),
            makeLedger({ type: 'accrual', amountHours: 8 }),
            makeLedger({ type: 'use', amountHours: -8 }),
        ];
        expect(getLeaveBalance(ledger)).toBe(8);
    });
});

// ═══════════════════════════════════════════
// 케이스 2: 주차별 근무 변동 — 정책 기준에 따라 발생 여부 변동
// ═══════════════════════════════════════════
describe('케이스 2: 변동 스케줄 — 발생 여부 분기', () => {
    const policy = makePolicy({ minWeeklyHours: 15 });

    it('주 12h (< 15h) → 미발생', () => {
        const result = calculateWeeklyAccrual(12, policy);
        expect(result.accrues).toBe(false);
        expect(result.hours).toBe(0);
    });

    it('주 28h (≥ 15h) → 발생', () => {
        const result = calculateWeeklyAccrual(28, policy);
        expect(result.accrues).toBe(true);
        expect(result.hours).toBe(8);
    });

    it('주 15h (= 15h, 경계값) → 발생', () => {
        const result = calculateWeeklyAccrual(15, policy);
        expect(result.accrues).toBe(true);
    });

    it('주 14.9h (< 15h) → 미발생', () => {
        const result = calculateWeeklyAccrual(14.9, policy);
        expect(result.accrues).toBe(false);
    });
});

// ═══════════════════════════════════════════
// 케이스 3: 비례 계산(proportional) 모드
// ═══════════════════════════════════════════
describe('케이스 3: 비례 모드 발생 계산', () => {
    const policy = makePolicy({ accrualMode: 'proportional', accrualRatio: 0.2 });

    it('주 40h × 0.2 = 8h 발생', () => {
        const result = calculateWeeklyAccrual(40, policy);
        expect(result.hours).toBe(8);
    });

    it('주 20h × 0.2 = 4h 발생', () => {
        const result = calculateWeeklyAccrual(20, policy);
        expect(result.hours).toBe(4);
    });
});

// ═══════════════════════════════════════════
// 케이스 4: shift 수정 시 조정(adjust) 기록
// ═══════════════════════════════════════════
describe('케이스 4: 조정(adjust) — shift 수정 반영', () => {
    it('발생 8h, 조정 -2h → 잔여 6h', () => {
        const ledger: LeaveLedgerEntry[] = [
            makeLedger({ type: 'accrual', amountHours: 8 }),
            makeLedger({ type: 'adjust', amountHours: -2, note: 'shift 소급 정정' }),
        ];
        expect(getLeaveBalance(ledger)).toBe(6);
    });

    it('발생 8h, 사용 -8h, 조정 +2h → 잔여 2h', () => {
        const ledger: LeaveLedgerEntry[] = [
            makeLedger({ type: 'accrual', amountHours: 8 }),
            makeLedger({ type: 'use', amountHours: -8 }),
            makeLedger({ type: 'adjust', amountHours: 2 }),
        ];
        expect(getLeaveBalance(ledger)).toBe(2);
    });
});

// ═══════════════════════════════════════════
// 케이스 5: 잔여 부족 확인
// ═══════════════════════════════════════════
describe('케이스 5: 잔여 부족 검증', () => {
    it('잔여 4h → 8h 신청 불가(잔여 < 신청량)', () => {
        const ledger: LeaveLedgerEntry[] = [
            makeLedger({ type: 'accrual', amountHours: 4 }),
        ];
        const balance = getLeaveBalance(ledger);
        const requestAmount = 8;
        expect(balance < requestAmount).toBe(true);
    });
});

// ═══════════════════════════════════════════
// 케이스 6: 정책 비활성 시 미발생
// ═══════════════════════════════════════════
describe('케이스 6: 정책 비활성', () => {
    it('enabled=false → 미발생', () => {
        const policy = makePolicy({ enabled: false });
        const result = calculateWeeklyAccrual(40, policy);
        expect(result.accrues).toBe(false);
    });
});

// ═══════════════════════════════════════════
// 포맷 유틸
// ═══════════════════════════════════════════
describe('formatHoursAsDays', () => {
    it('8h → 1일', () => {
        expect(formatHoursAsDays(8)).toBe('1일');
    });
    it('12h → 1일 4시간', () => {
        expect(formatHoursAsDays(12)).toBe('1일 4시간');
    });
    it('4h → 4시간', () => {
        expect(formatHoursAsDays(4)).toBe('4시간');
    });
    it('0h → 0시간', () => {
        expect(formatHoursAsDays(0)).toBe('0시간');
    });
});

// ═══════════════════════════════════════════
// 주차별 근무 분석
// ═══════════════════════════════════════════
describe('getWeeklyBreakdown', () => {
    it('2주차 데이터를 올바르게 그룹화', () => {
        const shifts: Shift[] = [
            makeShift({ shiftId: 's1', weekKey: '2026-W07', netMinutes: 480 }),
            makeShift({ shiftId: 's2', weekKey: '2026-W07', netMinutes: 480 }),
            makeShift({ shiftId: 's3', weekKey: '2026-W08', netMinutes: 360 }),
        ];
        const breakdown = getWeeklyBreakdown(shifts);
        expect(breakdown).toHaveLength(2);
        expect(breakdown[0].weekKey).toBe('2026-W07');
        expect(breakdown[0].totalHours).toBe(16);
        expect(breakdown[0].shiftCount).toBe(2);
        expect(breakdown[1].weekKey).toBe('2026-W08');
        expect(breakdown[1].totalHours).toBe(6);
    });
});
