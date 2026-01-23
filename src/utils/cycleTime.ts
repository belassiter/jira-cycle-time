import { addDays, isWeekend, format, startOfDay, isSameDay, setHours, setMinutes, setSeconds, setMilliseconds, isBefore, isAfter } from 'date-fns';
import holidaysRaw from '../data/holidays.json';

const HOLIDAYS = new Set(holidaysRaw); // 'YYYY-MM-DD'

/**
 * Converts a date to a representation of Pacific Time.
 * effectively "shifting" the UTC number so that getHours() returns Pacific hour.
 */
function toPacificWallTime(date: Date): Date {
  const pacificString = date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  return new Date(pacificString);
}

/**
 * Calculates cycle time in work days (8 hours/day).
 * - 9am - 5pm Pacific
 * - Excludes Weekends
 * - Excludes Holidays
 */
export function calculateCycleTime(startDateUTC: Date, endDateUTC: Date): number {
  if (isAfter(startDateUTC, endDateUTC)) return 0;

  // 1. Convert to Pacific Wall Time for calculation
  const start = toPacificWallTime(startDateUTC);
  const end = toPacificWallTime(endDateUTC);

  let current = startOfDay(start);
  const finish = startOfDay(end);
  
  let totalMinutes = 0;

  // Loop through every day from start to end
  while (current <= finish) {
    const dayString = format(current, 'yyyy-MM-dd');
    
    // Skip interruptions
    if (isWeekend(current) || HOLIDAYS.has(dayString)) {
      current = addDays(current, 1);
      continue;
    }

    // Define Work Day Window: 09:00 - 17:00
    const workStart = setMilliseconds(setSeconds(setMinutes(setHours(current, 9), 0), 0), 0);
    const workEnd = setMilliseconds(setSeconds(setMinutes(setHours(current, 17), 0), 0), 0);

    // Determine the actual active window for this specific day
    // The working window must be constrained by the actual start/end times if they fall on this day
    let activeStart = workStart;
    let activeEnd = workEnd;

    // If this is the start day, we might start late
    if (isSameDay(start, current)) {
      if (isAfter(start, workStart)) {
        activeStart = start;
      }
    }

    // If this is the end day, we might end early
    if (isSameDay(end, current)) {
      if (isBefore(end, workEnd)) {
        activeEnd = end;
      }
    }

    // Calculate overlap
    if (isBefore(activeStart, activeEnd)) {
        // Only if the valid window is positive (e.g. didn't start at 6pm)
        // Also ensure we don't count outside 9-5
        const effectiveStart = isBefore(activeStart, workStart) ? workStart : activeStart;
        const effectiveEnd = isAfter(activeEnd, workEnd) ? workEnd : activeEnd;
        
        if (isBefore(effectiveStart, effectiveEnd)) {
            const diff = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60);
            totalMinutes += diff;
        }
    }

    current = addDays(current, 1);
  }

  // 1 day = 8 hours = 480 minutes
  return totalMinutes / 480;
}
