'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type { CallbackDataParams, ECElementEvent } from 'echarts/types/dist/shared';
import { formatDifficulty } from '../utils/hashmath';
import { escapeHtml } from '../utils/formatters';

interface ShadowBlockTopDiffChartRow {
  block_height: number;
  difficulty: number | null;
  top_diff_address: string | null;
}

interface ShadowBlockTopDiffChartProps {
  rows: ShadowBlockTopDiffChartRow[];
  selectedHeight: number | null;
  onSelectBlock: (blockHeight: number) => void;
}

const AXIS_COLOR = '#444444';
const LABEL_COLOR = '#888888';
const SPLIT_LINE_COLOR = '#333333';
const TOOLTIP_BACKGROUND = '#222222';
const TOOLTIP_BORDER = '#444444';
const TEXT_COLOR = '#ededed';
const DOT_COLOR = '#ef4444';
const FONT_FAMILY = '"Courier New", Courier, monospace';

export default function ShadowBlockTopDiffChart({
  rows,
  selectedHeight,
  onSelectBlock,
}: ShadowBlockTopDiffChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const chartRows = useMemo(
    () => rows.filter(
      (row): row is ShadowBlockTopDiffChartRow & { difficulty: number } =>
        row.difficulty !== null && row.difficulty > 0,
    ),
    [rows],
  );

  const chartData = useMemo(
    () => chartRows.map((row, index) => ({
      value: [index + 1, row.difficulty] as [number, number],
      symbolSize: row.block_height === selectedHeight ? 11 : 8,
      itemStyle: row.block_height === selectedHeight
        ? {
            color: DOT_COLOR,
            borderColor: TEXT_COLOR,
            borderWidth: 2,
            shadowBlur: 10,
          }
        : undefined,
    })),
    [chartRows, selectedHeight],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const chart = echarts.init(node);
    chartRef.current = chart;

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const option = {
      backgroundColor: 'transparent',
      animation: false,
      grid: {
        left: 70,
        right: 24,
        top: 24,
        bottom: 52,
      },
      xAxis: {
        type: 'value',
        name: 'Block height',
        nameLocation: 'middle',
        nameGap: 30,
        min: 1,
        max: Math.max(chartRows.length, 1),
        axisLine: {
          lineStyle: { color: AXIS_COLOR },
        },
        axisLabel: {
          color: LABEL_COLOR,
          fontFamily: FONT_FAMILY,
          formatter: (value: number) => {
            const index = Math.max(
              0,
              Math.min(chartRows.length - 1, Math.round(value) - 1),
            );
            return chartRows[index]?.block_height.toLocaleString() ?? '';
          },
        },
        splitLine: {
          lineStyle: { color: SPLIT_LINE_COLOR, opacity: 0.5 },
        },
        nameTextStyle: {
          color: LABEL_COLOR,
          fontFamily: FONT_FAMILY,
        },
        axisPointer: {
          label: { show: false },
        },
      },
      yAxis: {
        type: 'log',
        name: 'Difficulty',
        nameLocation: 'middle',
        nameGap: 58,
        axisLine: {
          lineStyle: { color: AXIS_COLOR },
        },
        axisLabel: {
          color: LABEL_COLOR,
          fontFamily: FONT_FAMILY,
          formatter: (value: number) => formatDifficulty(value),
        },
        splitLine: {
          lineStyle: { color: SPLIT_LINE_COLOR, opacity: 0.5 },
        },
        nameTextStyle: {
          color: LABEL_COLOR,
          fontFamily: FONT_FAMILY,
        },
        axisPointer: {
          label: { show: false },
        },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: TOOLTIP_BACKGROUND,
        borderColor: TOOLTIP_BORDER,
        textStyle: {
          color: TEXT_COLOR,
          fontFamily: FONT_FAMILY,
        },
        formatter: (params: CallbackDataParams) => {
          const row = chartRows[params.dataIndex];
          if (!row) return '';

          return [
            `Block ${row.block_height.toLocaleString()}`,
            `Difficulty ${formatDifficulty(row.difficulty)}`,
            row.top_diff_address
              ? `Top diff ${escapeHtml(row.top_diff_address)}`
              : 'No public top diff',
          ].join('<br/>');
        },
      },
      series: [{
        type: 'scatter',
        data: chartData,
        itemStyle: {
          color: DOT_COLOR,
          shadowBlur: 6,
          shadowColor: DOT_COLOR,
        },
        emphasis: {
          scale: 1.5,
          itemStyle: {
            shadowBlur: 10,
          },
        },
      }],
    };

    chart.setOption(option, { notMerge: true });

    const handleClick = (params: ECElementEvent) => {
      const row = chartRows[params.dataIndex];
      if (row) onSelectBlock(row.block_height);
    };

    chart.off('click');
    chart.on('click', handleClick);

    return () => {
      chart.off('click', handleClick);
    };
  }, [chartData, chartRows, onSelectBlock]);

  return (
    <div className="w-full border border-border bg-background">
      <div ref={containerRef} className="h-64 w-full" />
    </div>
  );
}
