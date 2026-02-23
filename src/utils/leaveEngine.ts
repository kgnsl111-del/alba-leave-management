import { Shift, LeavePolicy, LeaveLedgerEntry } from '../types';
import { getISOWeek, getISOWeekYear, parseISO } from 'date-fns';

/**
 * 날짜 문자열에서 ISO weekKey 생성 (YYYY-WW)
 */
export function getWeekKey(dateStr: string): string {
    const d = parseISO(dateStr);
    const year = getISOWeekYear(d);
    const week = getISOWeek(d);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Shift의 실근무시간(분) 계산
 */
export function calculateNetMinutes(startTime: string, endTime: string, breakMinutes: number): number {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // 야간근무 (자정 넘김)
    return Math.max(0, totalMinutes - breakMinutes);
}

/**
 * 특정 주차의 실근무시간 합산(시간)
 */
export function getWeeklyWorkedHours(shifts: Shift[], weekKey: string): number {
    return shifts
        .filter(s => s.weekKey === weekKey)
        .reduce((sum, s) => sum + s.netMinutes / 60, 0);
}

/**
 * 해당 주 연차 발생 여부 & 발생량
 */
export function calculateWeeklyAccrual(
    weeklyHours: number,
    policy: LeavePolicy
): { accrues: boolean; hours: number } {
    if (!policy.enabled) {
        return { accrues: false, hours: 0 };
    }
    if (weeklyHours < policy.minWeeklyHours) {
        return { accrues: false, hours: 0 };
    }
    if (policy.accrualMode === 'fixed') {
        return { accrues: true, hours: policy.accrualFixedHours ?? 0 };
    }
    // proportional 모드: 주간근무시간 × ratio
    const hours = Math.round((weeklyHours * (policy.accrualRatio ?? 0)) * 100) / 100;
    return { accrues: true, hours };
}

/**
 * 잔여 연차 계산 (시간)
 */
export function getLeaveBalance(ledger: LeaveLedgerEntry[]): number {
    return Math.round(ledger.reduce((sum, entry) => sum + entry.amountHours, 0) * 100) / 100;
}

/**
 * 월별 요약 (발생/사용/조정)
 */
export function getMonthlySummary(ledger: LeaveLedgerEntry[], year: number, month: number) {
    const monthEntries = ledger.filter(e => {
        const d = e.createdAt.toDate();
        return d.getFullYear() === year && d.getMonth() + 1 === month;
    });

    return {
        accrued: Math.round(
            monthEntries
                .filter(e => e.type === 'accrual')
                .reduce((s, e) => s + e.amountHours, 0) * 100
        ) / 100,
        used: Math.round(
            monthEntries
                .filter(e => e.type === 'use')
                .reduce((s, e) => s + Math.abs(e.amountHours), 0) * 100
        ) / 100,
        adjusted: Math.round(
            monthEntries
                .filter(e => e.type === 'adjust')
                .reduce((s, e) => s + e.amountHours, 0) * 100
        ) / 100,
    };
}

/**
 * 시간 → 일+시간 표시
 */
export function formatHoursAsDays(hours: number, hoursPerDay: number = 8): string {
    const absHours = Math.abs(hours);
    const days = Math.floor(absHours / hoursPerDay);
    const remainingHours = Math.round((absHours % hoursPerDay) * 10) / 10;
    const sign = hours < 0 ? '-' : '';

    if (days > 0 && remainingHours > 0) {
        return `${sign}${days}일 ${remainingHours}시간`;
    } else if (days > 0) {
        return `${sign}${days}일`;
    }
    return `${sign}${remainingHours}시간`;
}

/**
 * 주차별 근무 데이터 요약 (근거 표시용)
 */
export function getWeeklyBreakdown(shifts: Shift[]): Array<{
    weekKey: string;
    totalHours: number;
    shiftCount: number;
    shifts: Shift[];
}> {
    const weekMap = new Map<string, Shift[]>();
    for (const s of shifts) {
        const arr = weekMap.get(s.weekKey) || [];
        arr.push(s);
        weekMap.set(s.weekKey, arr);
    }

    return Array.from(weekMap.entries())
        .map(([weekKey, weekShifts]) => ({
            weekKey,
            totalHours: Math.round(weekShifts.reduce((sum, s) => sum + s.netMinutes / 60, 0) * 100) / 100,
            shiftCount: weekShifts.length,
            shifts: weekShifts.sort((a, b) => a.date.localeCompare(b.date)),
        }))
        .sort((a, b) => a.weekKey.localeCompare(b.weekKey));
}
