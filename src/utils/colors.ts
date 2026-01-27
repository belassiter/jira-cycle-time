// Color interpolation helper
export function interpolateColor(value: number, min: number, max: number): string {
    if (min === max) return '#228be6'; // Default blue if no range
    
    // Clamp
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
    
    // Green (#40c057) to Orange (#fd7e14)
    // RGB interpolation
    const start = { r: 64, g: 192, b: 87 };
    const end = { r: 253, g: 126, b: 20 };
    
    const r = Math.round(start.r + (end.r - start.r) * t);
    const g = Math.round(start.g + (end.g - start.g) * t);
    const b = Math.round(start.b + (end.b - start.b) * t);
    
    return `rgb(${r}, ${g}, ${b})`;
}
