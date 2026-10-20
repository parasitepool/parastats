'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import { CallbackDataParams } from 'echarts/types/dist/shared';
import { formatHashDays, formatHashrate, formatDifficulty, formatRelativeTime } from '@/app/utils/formatters';
import type { CapacityPoint, OrderTimelinePoint } from '@/app/api/router/types';

// Fallback for Tailwind v4's green-500 (the "active" status color).
const DOT_COLOR_FALLBACK = '#00c951';

interface DemandChartProps {
  points: OrderTimelinePoint[];
  capacity?: CapacityPoint[];
  loading?: boolean;
}

export default function DemandChart({ points, capacity = [], loading = false }: DemandChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  const buildChartOptions = useCallback((data: OrderTimelinePoint[], capacityData: CapacityPoint[]) => {
    const foregroundColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--foreground')
      .trim();
    const borderColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--border')
      .trim();
    const secondaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--secondary')
      .trim();
    // Match the Orders table's "active" status color (Tailwind's green-500).
    const dotColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-green-500')
      .trim() || DOT_COLOR_FALLBACK;

    // Merge both series onto one shared category axis (same pattern as the
    // HashrateChart): category axes automatically skip labels that don't
    // fit, so the x axis stays readable on narrow screens.
    const categories = [
      ...new Set([
        ...capacityData.map(p => p.timestamp * 1000),
        ...data.map(p => p.created_at * 1000),
      ]),
    ].sort((a, b) => a - b);
    const labels = categories.map(ts =>
      new Date(ts).toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    );
    const capacityByTs = new Map(capacityData.map(p => [p.timestamp * 1000, p.used_hash_days]));
    const dotByTs = new Map(data.map(p => [p.created_at * 1000, p]));
    const lineData = categories.map(ts => capacityByTs.get(ts) ?? null);
    const scatterData = categories.map(ts => dotByTs.get(ts)?.requested_hash_days ?? null);

    // A dot within this window of the pointer wins the tooltip over the
    // capacity line: 2% of the visible span (at least a minute per side).
    const span = categories.length > 1 ? categories[categories.length - 1] - categories[0] : 0;
    const dotHoverWindow = Math.max(span * 0.02, 60_000);

    return {
      backgroundColor: 'transparent',
      animation: false,
      textStyle: {
        color: foregroundColor,
        fontFamily: '"Courier New", Courier, monospace',
      },
      // One axis-triggered tooltip (crosshair) for everything; the formatter
      // shows the order card when the pointer is near a dot, the used
      // capacity value otherwise.
      tooltip: {
        trigger: 'axis',
        backgroundColor: secondaryColor,
        borderColor: borderColor,
        textStyle: {
          color: foregroundColor,
          fontFamily: '"Courier New", Courier, monospace',
        },
        formatter: function (params: CallbackDataParams | CallbackDataParams[]) {
          const list = Array.isArray(params) ? params : [params];
          if (list.length === 0) return '';
          const timestamp = categories[list[0].dataIndex];
          if (timestamp == null) return '';

          let nearest: OrderTimelinePoint | null = null;
          let nearestDist = Infinity;
          for (const p of data) {
            const dist = Math.abs(p.created_at * 1000 - timestamp);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = p;
            }
          }
          if (nearest && nearestDist <= dotHoverWindow) {
            return `<span style="color:${dotColor}">●</span> Order ${nearest.id}<br/>` +
              `Created: ${formatRelativeTime(nearest.created_at)}<br/>` +
              `Requested: ${formatHashDays(nearest.requested_hash_days)}<br/>` +
              `Hashrate: ${formatHashrate(nearest.hashrate)}<br/>` +
              `Best Share: ${nearest.best_share != null ? formatDifficulty(nearest.best_share) : '—'}`;
          }

          const capacityParam = list.find(
            p => p.seriesName === 'capacity' && p.value != null,
          );
          if (!capacityParam) return '';

          return `${new Date(timestamp).toLocaleString()}<br/>` +
            `<span style="color:${foregroundColor}">●</span> Used Capacity: ${formatHashDays(Number(capacityParam.value))}`;
        },
        axisPointer: {
          type: 'line',
          label: {
            backgroundColor: secondaryColor,
          },
        },
        // Keep the tooltip inside the grid on small screens.
        confine: true,
      },
      grid: {
        left: '0.5%',
        right: '0.5%',
        bottom: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: {
          lineStyle: {
            color: borderColor,
          },
        },
        axisLabel: {
          color: foregroundColor,
          fontFamily: '"Courier New", Courier, monospace',
        },
        splitLine: {
          lineStyle: {
            color: borderColor,
            opacity: 0.2,
          },
        },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: {
          lineStyle: {
            color: borderColor,
          },
        },
        axisLabel: {
          color: foregroundColor,
          fontFamily: '"Courier New", Courier, monospace',
          fontWeight: 'bold',
          formatter: function (value: number) {
            return formatHashDays(value);
          },
        },
        splitLine: {
          lineStyle: {
            color: borderColor,
            opacity: 0.2,
          },
        },
      },
      series: [
        {
          name: 'capacity',
          type: 'line' as const,
          data: lineData,
          connectNulls: true,
          showSymbol: false,
          animation: false,
          // No hover symbol/emphasis on the line: it would draw a white dot
          // over the order markers. The axis tooltip works regardless.
          silent: true,
          emphasis: {
            disabled: true,
          },
          lineStyle: {
            color: foregroundColor,
            width: 2,
          },
          itemStyle: {
            color: foregroundColor,
          },
          z: 1,
        },
        {
          name: 'Bucket orders',
          type: 'scatter' as const,
          data: scatterData,
          symbol: 'circle',
          symbolSize: 12,
          itemStyle: {
            color: dotColor,
            shadowBlur: 8,
            shadowColor: dotColor,
          },
          // Any emphasis makes the dot vanish on hover (animation is disabled
          // chart-wide); the tooltip card is the hover feedback instead.
          emphasis: {
            disabled: true,
          },
          z: 2,
        },
      ],
    };
  }, []);

  const isEmpty = points.length === 0 && capacity.length === 0;

  useEffect(() => {
    if (!chartRef.current || isEmpty) return;

    let chart = chartInstanceRef.current;
    if (!chart || chart.isDisposed()) {
      chart = echarts.init(chartRef.current);
      chartInstanceRef.current = chart;
    }

    chart.setOption(buildChartOptions(points, capacity), { replaceMerge: ['series'] });
  }, [buildChartOptions, points, capacity, isEmpty]);

  // The chart div unmounts when there is nothing to show; dispose the instance
  // so it doesn't linger on a detached node.
  useEffect(() => {
    if (isEmpty && chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
      chartInstanceRef.current.dispose();
      chartInstanceRef.current = null;
    }
  }, [isEmpty]);

  useEffect(() => {
    const handleResize = () => {
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  if (!loading && isEmpty) {
    return <p className="text-center text-foreground/60 py-8">No active bucket orders</p>;
  }

  return (
    <>
      {loading && isEmpty && <p className="text-center">Loading data...</p>}
      <div ref={chartRef} style={{ width: '100%', height: '300px' }}></div>
    </>
  );
}
