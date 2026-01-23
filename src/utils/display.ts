import { startOfWeek, addWeeks, differenceInWeeks } from 'date-fns';

export function generateSmartTicks(minDate: Date, maxDate: Date, maxTicks: number = 10): Date[] {
  const start = startOfWeek(minDate, { weekStartsOn: 1 });
  // total weeks in range
  const weekCount = differenceInWeeks(maxDate, start) + 1; // +1 to ensure we cover the end

  // Find step size: 1, 2, 4, 8, 16...
  let step = 1;
  while ((weekCount / step) > maxTicks) {
      step *= 2;
  }

  const ticks: Date[] = [];
  let current = start;

  // Generate ticks
  while (current <= maxDate) {
      ticks.push(current);
      current = addWeeks(current, step);
  }
  
  return ticks;
}

export function generateMondayTicks(minDate: Date, maxDate: Date): Date[] {
  // Backwards compatibility or default to step 1
  return generateSmartTicks(minDate, maxDate, 1000);
}
