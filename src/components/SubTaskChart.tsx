import { useMemo } from 'react';
import { Group } from '@visx/group';
import { Circle, Line } from '@visx/shape';
import { scaleBand, scaleLinear, scaleOrdinal } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { Text } from '@visx/text';
import { SubTaskGroup, OTHER_GROUP_ID, OTHER_GROUP_NAME } from '../utils/grouping';
import { GroupStatistic, formatMetric } from '../utils/stats';

interface DataPoint {
    id: string;
    groupId: string;
    value: number; // Cycle Time
}

interface ChartProps {
    width: number;
    height: number;
    data: DataPoint[];
    groups: SubTaskGroup[];
    stats: GroupStatistic[];
}

// Colors for groups
const COLORS = ['#228be6', '#fa5252', '#40c057', '#fab005', '#7950f2', '#15aabf', '#e64980', '#be4bdb', '#7950f2', '#4c6ef5', '#228be6', '#15aabf', '#12b886', '#40c057', '#82c91e', '#fab005', '#fd7e14', '#fa5252'];

export function SubTaskChart({ width, height, data, groups, stats }: ChartProps) {
    const margin = { top: 60, right: 30, bottom: 60, left: 80 }; // Increased margin for font size
    const xMax = width - margin.left - margin.right;
    const yMax = height - margin.top - margin.bottom;

    // Prepare domain for X axis (Groups)
    // Include 'Other' if present in data
    const activeGroupIds = new Set(data.map(d => d.groupId));
    const allGroups = [...groups, { id: OTHER_GROUP_ID, name: OTHER_GROUP_NAME, keywords: [] }];
    const validGroups = allGroups.filter(g => activeGroupIds.has(g.id));
    
    // Axis Scales

    const xScaleAdjusted = useMemo(() => scaleBand<string>({
        domain: validGroups.map(g => g.name),
        range: [0, xMax],
        padding: 0.2, 
    }), [validGroups, xMax]);

    const yMin = 0;
    const yMaxVal = Math.max(...data.map(d => d.value), 10) * 1.1; // 10% padding

    const yScale = useMemo(() => scaleLinear<number>({
        domain: [yMin, yMaxVal],
        range: [yMax, 0],
        nice: true,
    }), [yMaxVal, yMax]);
    
    const colorScale = useMemo(() => scaleOrdinal({
        domain: validGroups.map(g => g.id),
        range: COLORS,
    }), [validGroups]);

    // Jittered Points
    const points = useMemo(() => {
        return data.map(point => {
            const groupName = validGroups.find(g => g.id === point.groupId)?.name || '';
            const bandStart = xScaleAdjusted(groupName) || 0;
            const bandwidth = xScaleAdjusted.bandwidth();
            // Jitter: random position within 60% of bandwidth
            const jitter = (Math.random() - 0.5) * (bandwidth * 0.6);
            return {
                ...point,
                x: bandStart + bandwidth / 2 + jitter,
                y: yScale(point.value),
                color: colorScale(point.groupId)
            };
        });
    }, [data, xScaleAdjusted, yScale, colorScale, validGroups]);

    // Median Calculation Helper
    const getMedian = (values: number[]) => {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a,b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    return (
        <svg width={width} height={height}>
            <Group left={margin.left} top={margin.top}>
                <AxisLeft 
                    scale={yScale} 
                    label="Work Days" 
                    labelProps={{fontSize: 14, textAnchor: 'middle', dy: -20}} 
                    tickLabelProps={() => ({ fontSize: 12, textAnchor: 'end', dx: -5, dy: 5 })} 
                />
                <AxisBottom 
                    scale={xScaleAdjusted} 
                    top={yMax} 
                    tickLabelProps={() => ({ fontSize: 12, textAnchor: 'middle', dy: 5 })} 
                />

                {/* Draw Stats Lines FIRST (behind dots) */}
                {validGroups.map(g => {
                    const groupName = g.name;
                    const groupStat = stats.find(s => s.groupId === g.id);
                    const groupData = data.filter(d => d.groupId === g.id).map(d => d.value);
                    
                    if (!groupStat || groupData.length === 0) return null;

                    const cx = (xScaleAdjusted(groupName) || 0) + xScaleAdjusted.bandwidth() / 2;
                    const width = xScaleAdjusted.bandwidth() * 0.8;

                    const meanY = yScale(groupStat.average);
                    const medianVal = getMedian(groupData);
                    const medianY = yScale(medianVal);
                    const stdDevTop = yScale(groupStat.average + groupStat.stdDev);
                    const stdDevBot = yScale(groupStat.average - groupStat.stdDev);

                    return (
                        <Group key={g.id}>
                            {/* StdDev Box/Line */}
                            <Line from={{ x: cx, y: stdDevBot }} to={{ x: cx, y: stdDevTop }} stroke="#ccc" strokeWidth={2} />
                            <Line from={{ x: cx - width/4, y: stdDevTop }} to={{ x: cx + width/4, y: stdDevTop }} stroke="#ccc" strokeWidth={2} />
                            <Line from={{ x: cx - width/4, y: stdDevBot }} to={{ x: cx + width/4, y: stdDevBot }} stroke="#ccc" strokeWidth={2} />

                            {/* Mean Line (Solid Black) */}
                            <Line 
                                from={{ x: cx - width/2, y: meanY }} 
                                to={{ x: cx + width/2, y: meanY }} 
                                stroke="black" 
                                strokeWidth={3} 
                            />
                            <Text x={cx + width/2 + 5} y={meanY} verticalAnchor="middle" fontSize={11}>{formatMetric(groupStat.average)}</Text>
                            
                            {/* Median Line (Dashed Blue) */}
                            <Line 
                                from={{ x: cx - width/2, y: medianY }} 
                                to={{ x: cx + width/2, y: medianY }} 
                                stroke="blue" 
                                strokeWidth={3} 
                                strokeDasharray="4,4"
                            />
                            <Text x={cx + width/2 + 5} y={medianY} verticalAnchor="middle" fill="blue" fontSize={11}>{formatMetric(medianVal)}</Text>
                        </Group>
                    );
                })}

                {/* Data Points */}
                {points.map((pt, i) => (
                    <Circle 
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={6} // Increased dot size slightly
                        fill={pt.color}
                        fillOpacity={0.6}
                        stroke="#fff"
                        strokeWidth={1}
                    />
                ))}

            </Group>
            
            {/* Legend (Overlapping Plot, Upper Left) */}
            <Group left={margin.left + 20} top={margin.top + 10}>
                <rect width={140} height={80} fill="white" fillOpacity={0.8} stroke="#eee" />
                
                <Line from={{x:10, y:20}} to={{x:40, y:20}} stroke="black" strokeWidth={3} />
                <Text x={50} y={24} fontSize={11} verticalAnchor="middle">Mean</Text>

                <Line from={{x:10, y:45}} to={{x:40, y:45}} stroke="blue" strokeWidth={3} strokeDasharray="4,4" />
                <Text x={50} y={49} fontSize={11} verticalAnchor="middle">Median</Text>
                
                <Line from={{x:25, y:60}} to={{x:25, y:75}} stroke="#ccc" strokeWidth={2} />
                <Line from={{x:15, y:60}} to={{x:35, y:60}} stroke="#ccc" strokeWidth={2} />
                <Line from={{x:15, y:75}} to={{x:35, y:75}} stroke="#ccc" strokeWidth={2} />
                <Text x={50} y={67} fontSize={11} verticalAnchor="middle">StdDev</Text>
            </Group>
        </svg>
    );
}
