
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
