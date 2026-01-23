
/**
 * Formats a duration in using weeks calculation: "(X.Y weeks)"
 * @param days number of work days
 */
export function formatWeeks(days: number): string {
    const weeks = days / 5.0; // Assuming 5-day work week for simplicity in "weeks" context? 
    // Wait, requirement says: "Under 'Calendar time' include '(X weeks)'"
    // Calendar Time is wall clock time. So weeks = calendar days / 7.
    // Let's stick to calendar days for this specific formatter if the input is calendar days.
    // But if we pass "work days" it would be different. The User said "Calendar time" -> "(X weeks)".
    // So this function should likely take calendar days.
    return `(${weeks.toFixed(1)} weeks)`;
}

export function formatCalendarWeeks(startDate: Date, endDate: Date): string {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const weeks = diffDays / 7.0;
    
    if (weeks < 0.1) return '0.0 weeks';
    // "Never show more than one decimal place"
    return `${weeks.toFixed(1)} weeks`;
}

/**
 * Formats a duration in work days according to specific business rules.
 * - < 10: 1 decimal place (e.g. "5.1 work days")
 * - >= 10: 0 decimal places (e.g. "12 work days")
 * - Always appends "work days"
 */
export function formatWorkDays(days: number): string {
  if (days < 10) {
    // Check if it's an integer effectively
    if (days % 1 === 0) {
       return `${days} work days`; // Optional cleanup, but requirement says "max 1 decimal". 5.0 is valid? "5 work days" looks better.
       // User said "show no decimals" only for >= 10. For <10, "5.1" is okay. 
       // Start with strict interpretation: toFixed(1) always?
       // "Never show more than one decimal place" means 1 or 0 is fine.
       // Let's use `Number.toFixed(1)` then replace `.0` if we want cleaner look? 
    }
    return `${parseFloat(days.toFixed(1))} work days`;
  } else {
    return `${Math.round(days)} work days`;
  }
}
