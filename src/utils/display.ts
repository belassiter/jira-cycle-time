import { eachWeekOfInterval, startOfWeek } from 'date-fns';

export function generateMondayTicks(minDate: Date, maxDate: Date): Date[] {
  // Ensure we cover the full range
  const start = startOfWeek(minDate, { weekStartsOn: 1 });
  const ticks = eachWeekOfInterval(
    { start: start, end: maxDate },
    { weekStartsOn: 1 }
  );
  
  return ticks;
}
