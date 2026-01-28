import { useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { Group } from '@visx/group';
import { Line } from '@visx/shape';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Text } from '@visx/text';
import { GroupStatistic, formatMetric, TierDistributionItem } from '../utils/stats';
import { Tooltip as MantineTooltip } from '@mantine/core'; // Using Mantine tooltip around circles

// We need html-to-image or similar to implement download. 
// Assuming it is not available, we can try to use a canvas or basic SVG serialization.
// Since we are inside a create_file block, we can't search for packages.
// I will implement a basic SVG-to-PNG converter using canvas if possible, or just SVG download.
// The user asked for PNG. 
// I'll stick to a placeholder function `downloadChart` to be implemented.

interface ChartProps {
    width: number;
    height: number;
    data: TierDistributionItem[];
    categories: { id: string; name: string }[];
    stats: GroupStatistic[]; // Reusing GroupStatistic for category stats
    title: string;
}

export interface DistributionChartRef {
    downloadChart: () => void;
}

// Colors
const COLORS = ['#228be6', '#fa5252', '#40c057', '#fab005', '#7950f2', '#15aabf', '#e64980', '#be4bdb', '#7950f2', '#4c6ef5', '#228be6', '#15aabf', '#12b886', '#40c057', '#82c91e', '#fab005', '#fd7e14', '#fa5252'];

export const DistributionChart = forwardRef<DistributionChartRef, ChartProps>(({ width, height, data, categories, stats, title }, ref) => {
    const margin = { top: 60, right: 30, bottom: 60, left: 80 };
    const xMax = width - margin.left - margin.right;
    const yMax = height - margin.top - margin.bottom;
    const svgRef = useRef<SVGSVGElement>(null);

    useImperativeHandle(ref, () => ({
        downloadChart: () => {
            if (!svgRef.current) return;
            const svgData = new XMLSerializer().serializeToString(svgRef.current);
            const canvas = document.createElement('canvas');
            const scale = 2; // Double resolution
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                 if (ctx) {
                     ctx.fillStyle = 'white';
                     ctx.fillRect(0, 0, canvas.width, canvas.height);
                     ctx.scale(scale, scale);
                     ctx.drawImage(img, 0, 0);
                     const pngFile = canvas.toDataURL('image/png');
                     const downloadLink = document.createElement('a');
                     downloadLink.download = `${title.replace(/\s+/g, '_')}.png`;
                     downloadLink.href = pngFile;
                     downloadLink.click();
                 }
            };
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        }
    }));
    
    // Filter categories that exist in data
    const validCategories = categories.filter(c => data.some(d => d.category === c.name || d.category === c.id));

    const xScale = useMemo(() => scaleBand<string>({
        domain: validCategories.map(c => c.name),
        range: [0, xMax],
        padding: 0.2, 
    }), [validCategories, xMax]);

    const yMin = 0;
    const yMaxVal = Math.max(...data.map(d => d.value), 10) * 1.1;

    const yScale = useMemo(() => scaleLinear<number>({
        domain: [yMin, yMaxVal],
        range: [yMax, 0],
        nice: true,
    }), [yMaxVal, yMax]);
    
    const colorScale = useMemo(() => scaleOrdinal({
        domain: validCategories.map(c => c.name),
        range: COLORS,
    }), [validCategories]);

    // Jittered Points
    const points = useMemo(() => {
        return data.map(point => {
            // Check if point.category matches a name
            const catName = point.category; // Assuming point.category IS the name
            const bandStart = xScale(catName) || 0;
            const bandwidth = xScale.bandwidth();
            const jitter = (Math.random() - 0.5) * (bandwidth * 0.6);
            return {
                ...point,
                x: bandStart + bandwidth / 2 + jitter,
                y: yScale(point.value),
                color: colorScale(catName)
            };
        });
    }, [data, xScale, yScale, colorScale]);

    const getMedian = (values: number[]) => {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a,b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    return (
        <div style={{ position: 'relative' }}>
             <svg width={width} height={height} ref={svgRef} style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
                <style>
                    {`
                        text { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                    `}
                </style>
                <rect width={width} height={height} fill="white" />
                <Group left={margin.left} top={margin.top}>
                    <AxisLeft 
                        scale={yScale} 
                        label="Work Days" 
                        labelProps={{fontSize: 16, textAnchor: 'middle', dy: -20}} 
                        tickLabelProps={() => ({ fontSize: 14, textAnchor: 'end', dx: -5, dy: 5 })} 
                    />
                    <AxisBottom 
                        scale={xScale} 
                        top={yMax} 
                        tickLabelProps={() => ({ fontSize: 14, textAnchor: 'middle', dy: 5 })} 
                    />

                    {/* Stats Lines */}
                    {validCategories.map(c => {
                        // Find matching stat. The 'stats' array might use ID or NAME.
                        // In stats.ts, subTaskStats uses GroupStatistic which has groupId and groupName.
                        // For TierStats, we might need to construct ad-hoc stats or change the prop.
                        // Let's assume 'stats' prop is a list of { groupName, average, stdDev } 
                        const catStat = stats.find(s => s.groupName === c.name || s.groupId === c.id);
                        const catData = data.filter(d => d.category === c.name || d.category === c.id).map(d => d.value);

                        if (!catStat || catData.length === 0) return null;

                        const cx = (xScale(c.name) || 0) + xScale.bandwidth() / 2;
                        const w = xScale.bandwidth() * 0.8;

                        const meanY = yScale(catStat.average);
                        const medianVal = getMedian(catData);
                        const medianY = yScale(medianVal);
                        const stdDevTop = yScale(catStat.average + catStat.stdDev);
                        const stdDevBot = yScale(catStat.average - catStat.stdDev);

                        return (
                            <Group key={c.id}>
                                <Line from={{ x: cx, y: stdDevBot }} to={{ x: cx, y: stdDevTop }} stroke="#ccc" strokeWidth={2} />
                                <Line from={{ x: cx - w/4, y: stdDevTop }} to={{ x: cx + w/4, y: stdDevTop }} stroke="#ccc" strokeWidth={2} />
                                <Line from={{ x: cx - w/4, y: stdDevBot }} to={{ x: cx + w/4, y: stdDevBot }} stroke="#ccc" strokeWidth={2} />

                                <Line from={{ x: cx - w/2, y: meanY }} to={{ x: cx + w/2, y: meanY }} stroke="black" strokeWidth={3} />
                                <Text x={cx + w/2 + 5} y={meanY} verticalAnchor="middle" fontSize={13}>{formatMetric(catStat.average)}</Text>
                                
                                <Line from={{ x: cx - w/2, y: medianY }} to={{ x: cx + w/2, y: medianY }} stroke="blue" strokeWidth={3} strokeDasharray="4,4"/>
                                <Text x={cx + w/2 + 5} y={medianY} verticalAnchor="middle" fill="blue" fontSize={13}>{formatMetric(medianVal)}</Text>
                            </Group>
                        );
                    })}

                    {points.map((pt, i) => (
                        <MantineTooltip 
                            key={i} 
                            label={pt.key}
                            withArrow
                        >
                            <circle 
                                cx={pt.x}
                                cy={pt.y}
                                r={4}
                                fill={pt.color}
                                stroke="#fff"
                                strokeWidth={1}
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    if (pt.url) window.open(pt.url, '_blank');
                                }}
                            />
                        </MantineTooltip>
                    ))}
                </Group>
             </svg>
        </div>
    );
});
