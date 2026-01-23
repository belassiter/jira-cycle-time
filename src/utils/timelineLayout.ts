import { differenceInMinutes } from 'date-fns';

/**
 * Calculates the percentage position (0-100) of a date within a timeline range.
 */
export function getTimelinePosition(date: Date, minDate: Date, totalMinutes: number): number {
    if (totalMinutes === 0) return 0;
    const minutesFromStart = differenceInMinutes(date, minDate);
    return (minutesFromStart / totalMinutes) * 100;
}

/**
 * Calculates the percentage width (0-100) of a duration within a timeline range.
 */
export function getTimelineWidth(start: Date, end: Date, totalMinutes: number): number {
     if (totalMinutes === 0) return 0;
    const durationCurrent = differenceInMinutes(end, start);
    return (durationCurrent / totalMinutes) * 100;
}
