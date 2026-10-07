import type { Routine } from './types';
export function isPlanningDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const day = new Date(value + 'T12:00:00Z');
    return !isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
}
export function routineOccurs(routine: Routine, date: string) {
    if (!isPlanningDate(date) || !isPlanningDate(routine.start) || date < routine.start)
        return false;
    const start = new Date(routine.start + 'T12:00:00Z'), day = new Date(date + 'T12:00:00Z');
    if (routine.frequency === 'daily')
        return true;
    if (routine.frequency === 'weekly')
        return start.getUTCDay() === day.getUTCDay();
    const last = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
    return day.getUTCDate() === Math.min(start.getUTCDate(), last);
}

// Read older single-machine schedules without rewriting their stored data.
export function planningMachines(value: { machine?: string; machines?: string[] }): string[] {
    return value.machines !== undefined ? value.machines : value.machine ? [value.machine] : [];
}

export function planningSchedule(value: { date: string; time: string }) {
    return (value.date ? new Date(value.date + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : 'Date à définir') + (value.time ? ' · ' + value.time : ' · Heure libre');
}
