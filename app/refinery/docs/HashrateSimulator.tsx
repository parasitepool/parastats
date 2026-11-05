'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import OverviewCalculator from './OverviewCalculator';
import {
  HASHES_PER_DIFF_1,
  HASH_DAYS_PER_PHD,
  SECONDS_PER_DAY,
  formatHashWork,
  hashWorkFromRate,
  hashWorkToHashDays,
  phdFromHashDays,
} from '@/app/utils/hashmath';

const MIN_TIMELINE_HOURS = 48;
const MIN_WINDOW_HOURS = 1;
const SAMPLE_COUNT = 721;
const MIN_HASHRATE_HPS = 1e12;
const MAX_HASHRATE_HPS = 1e18;

interface SimulationState {
  hashrateHps: number;
  startHours: number;
  durationSecs: number;
}

const DEFAULT_SIMULATION: SimulationState = {
  hashrateHps: HASH_DAYS_PER_PHD,
  startHours: 0,
  durationSecs: SECONDS_PER_DAY,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function timelineHoursFor(state: SimulationState): number {
  const endHours = state.startHours + state.durationSecs / 3600;
  return Math.max(MIN_TIMELINE_HOURS, Math.ceil((endHours + 12) / 12) * 12);
}

function axisIntervalFor(timelineHours: number): number {
  if (timelineHours <= 72) return 12;
  if (timelineHours <= 144) return 24;
  if (timelineHours <= 288) return 48;
  return 72;
}

function noiseAt(t: number): number {
  return (
    1 +
    0.025 * Math.sin(t * 37) +
    0.018 * Math.sin(t * 91 + 1.7) +
    0.014 * Math.sin(t * 173 + 0.4) +
    0.01 * Math.sin(t * 431 + 2.1) +
    0.008 * Math.sin(t * 857 + 0.9) +
    0.006 * Math.sin(t * 1601 + 2.8)
  );
}

function hashrateAtHours(hours: number, hashratePhs: number, timelineHours: number): number {
  return hashratePhs * noiseAt(hours / timelineHours);
}

function buildProfile(hashratePhs: number, timelineHours: number): [number, number][] {
  return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const t = index / (SAMPLE_COUNT - 1);
    return [t * timelineHours, hashratePhs * noiseAt(t)] as [number, number];
  });
}

function buildSelectedProfile(
  startHours: number,
  endHours: number,
  hashratePhs: number,
  timelineHours: number,
): [number, number][] {
  if (!(endHours > startHours)) return [];

  const points: [number, number][] = [
    [startHours, hashrateAtHours(startHours, hashratePhs, timelineHours)],
  ];
  for (let index = 0; index < SAMPLE_COUNT; index++) {
    const hours = (index / (SAMPLE_COUNT - 1)) * timelineHours;
    if (hours > startHours && hours < endHours) {
      points.push([hours, hashrateAtHours(hours, hashratePhs, timelineHours)]);
    }
  }
  points.push([endHours, hashrateAtHours(endHours, hashratePhs, timelineHours)]);
  return points;
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatHours(hours: number): string {
  return `${formatAmount(hours)}h`;
}

function niceAxisMax(hashratePhs: number): number {
  const raw = Math.max(1e-9, hashratePhs * 1.2);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const niceFraction =
    fraction <= 1 ? 1 :
    fraction <= 1.5 ? 1.5 :
    fraction <= 2 ? 2 :
    fraction <= 3 ? 3 :
    fraction <= 4 ? 4 :
    fraction <= 5 ? 5 :
    fraction <= 6 ? 6 :
    fraction <= 8 ? 8 : 10;
  return niceFraction * magnitude;
}

function buildChartOption(state: SimulationState, yAxisMax: number, isMobile: boolean) {
  const foregroundColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
  const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  const fontFamily = '"Courier New", Courier, monospace';

  const hashratePhs = state.hashrateHps / HASH_DAYS_PER_PHD;
  const startHours = state.startHours;
  const endHours = startHours + state.durationSecs / 3600;
  const timelineHours = timelineHoursFor(state);
  const centerHours = (startHours + endHours) / 2;
  const workDiff1 = hashWorkFromRate(state.hashrateHps, state.durationSecs);
  const workPhd = phdFromHashDays(hashWorkToHashDays(workDiff1));
  const areaLabel = `${formatAmount(workPhd)} PHd (${formatHashWork(workDiff1)})`;

  return {
    backgroundColor: 'transparent',
    animation: false,
    textStyle: {
      color: foregroundColor,
      fontFamily,
    },
    grid: {
      left: isMobile ? 4 : 8,
      right: isMobile ? 8 : 18,
      top: isMobile ? 16 : 22,
      bottom: isMobile ? 22 : 24,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: timelineHours,
      interval: axisIntervalFor(timelineHours) * (isMobile ? 2 : 1),
      axisLine: {
        lineStyle: {
          color: borderColor,
        },
      },
      axisTick: {
        lineStyle: {
          color: borderColor,
        },
      },
      axisLabel: {
        color: foregroundColor,
        fontFamily,
        formatter: (value: number) => formatHours(value),
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yAxisMax,
      splitNumber: isMobile ? 3 : 5,
      axisLine: {
        show: true,
        lineStyle: {
          color: borderColor,
        },
      },
      axisTick: {
        lineStyle: {
          color: borderColor,
        },
      },
      axisLabel: {
        color: foregroundColor,
        fontFamily,
        formatter: (value: number) => isMobile
          ? `${formatAmount(value)}P`
          : `${formatAmount(value)} PH/s`,
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
        name: 'Selected work',
        type: 'line',
        symbol: 'none',
        data: buildSelectedProfile(startHours, endHours, hashratePhs, timelineHours),
        lineStyle: {
          opacity: 0,
        },
        areaStyle: {
          color: 'rgba(237, 237, 237, 0.08)',
        },
        silent: true,
        tooltip: {
          show: false,
        },
        z: 1,
      },
      {
        name: 'Hashrate',
        type: 'line',
        symbol: 'none',
        data: buildProfile(hashratePhs, timelineHours),
        lineStyle: {
          color: foregroundColor,
          width: 2,
        },
        itemStyle: {
          color: foregroundColor,
        },
        markLine: {
          silent: true,
          symbol: 'none',
          animation: false,
          lineStyle: {
            color: foregroundColor,
            width: 1,
            opacity: 0.6,
          },
          label: {
            show: false,
          },
          data: [
            [
              { coord: [startHours, 0] },
              { coord: [startHours, hashrateAtHours(startHours, hashratePhs, timelineHours)] },
            ],
            [
              { coord: [endHours, 0] },
              { coord: [endHours, hashrateAtHours(endHours, hashratePhs, timelineHours)] },
            ],
          ],
        },
        z: 2,
      },
      {
        name: 'Window handles',
        type: 'scatter',
        data: [
          {
            value: [startHours, 0],
            label: { formatter: formatHours(startHours) },
          },
          {
            value: [endHours, 0],
            label: { formatter: formatHours(endHours) },
          },
        ],
        symbol: 'rect',
        symbolSize: [10, 20],
        // Grows upward from the axis so the extra height doesn't push into the
        // axis labels below.
        symbolOffset: [0, -4],
        itemStyle: {
          color: foregroundColor,
        },
        label: {
          show: true,
          position: 'bottom',
          distance: 3,
          color: foregroundColor,
          fontFamily,
          fontSize: 11,
          opacity: 0.85,
        },
        silent: true,
        tooltip: {
          show: false,
        },
        clip: false,
        z: 4,
      },
      {
        name: 'Hashrate handle',
        type: 'scatter',
        data: [
          {
            value: [0, hashrateAtHours(0, hashratePhs, timelineHours)],
            label: { formatter: `${formatAmount(hashratePhs)} PH/s` },
          },
        ],
        symbol: 'rect',
        symbolSize: [20, 10],
        itemStyle: {
          color: foregroundColor,
        },
        label: {
          show: true,
          position: 'bottom',
          distance: 8,
          align: 'left',
          verticalAlign: 'top',
          color: foregroundColor,
          fontFamily,
          fontSize: 12,
          fontWeight: 'bold',
          backgroundColor,
          borderColor,
          borderWidth: 1,
          padding: [3, 6],
        },
        silent: true,
        tooltip: {
          show: false,
        },
        clip: false,
        z: 4,
      },
      {
        name: 'Area label',
        type: 'scatter',
        data: [[centerHours, hashratePhs * 0.45]],
        symbol: 'circle',
        symbolSize: 1,
        itemStyle: {
          opacity: 0,
        },
        label: {
          show: true,
          position: 'inside',
          formatter: areaLabel,
          color: foregroundColor,
          fontFamily,
          fontSize: isMobile ? 14 : 18,
          align: 'center',
          opacity: 0.85,
        },
        silent: true,
        tooltip: {
          show: false,
        },
        z: 3,
      },
    ],
  };
}

export default function HashrateSimulator() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [simulation, setSimulation] = useState<SimulationState>(DEFAULT_SIMULATION);
  const [isMobile, setIsMobile] = useState(false);
  const simulationRef = useRef(simulation);
  const isMobileRef = useRef(isMobile);
  const yAxisMaxRef = useRef(niceAxisMax(DEFAULT_SIMULATION.hashrateHps / HASH_DAYS_PER_PHD));
  const dragRef = useRef<'start' | 'end' | 'hashrate' | null>(null);
  const hashrateDragRef = useRef<{ startClientY: number; startHashratePhs: number } | null>(null);
  const windowDragOffsetRef = useRef(0);

  const updateSimulation = useCallback((updater: (current: SimulationState) => SimulationState) => {
    const next = updater(simulationRef.current);
    simulationRef.current = next;
    setSimulation(next);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => {
      isMobileRef.current = media.matches;
      setIsMobile(media.matches);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const handleHashrateChange = useCallback((hashrateHps: number) => {
    updateSimulation(current => ({
      ...current,
      hashrateHps: clamp(hashrateHps, MIN_HASHRATE_HPS, MAX_HASHRATE_HPS),
    }));
  }, [updateSimulation]);

  const workDiff1 = hashWorkFromRate(simulation.hashrateHps, simulation.durationSecs);
  const handleWorkChange = useCallback((work: number) => {
    updateSimulation(current => ({
      ...current,
      hashrateHps: current.durationSecs > 0
        ? clamp((work * HASHES_PER_DIFF_1) / current.durationSecs, MIN_HASHRATE_HPS, MAX_HASHRATE_HPS)
        : current.hashrateHps,
    }));
  }, [updateSimulation]);

  const handleDurationChange = useCallback((durationSecs: number) => {
    updateSimulation(current => ({
      ...current,
      durationSecs: Math.max(MIN_WINDOW_HOURS * 3600, durationSecs),
    }));
  }, [updateSimulation]);

  // Reset restores the default simulation (chart follows via the effect below)
  // and remounts the calculator so its unit selectors also return to defaults.
  const [calculatorKey, setCalculatorKey] = useState(0);
  const handleReset = useCallback(() => {
    updateSimulation(() => DEFAULT_SIMULATION);
    setCalculatorKey(key => key + 1);
  }, [updateSimulation]);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;

    let disposed = false;
    let chart = chartInstanceRef.current;

    const ensureChart = () => {
      if (disposed || element.clientWidth === 0 || element.clientHeight === 0) return null;
      if (!chart || chart.isDisposed()) {
        chart = echarts.init(element);
        chartInstanceRef.current = chart;
        chart.setOption(buildChartOption(simulationRef.current, yAxisMaxRef.current, isMobileRef.current), true);
      }
      return chart;
    };

    const activeChart = ensureChart();
    if (!activeChart) return;

    const setCursor = (cursor: string) => {
      element.style.cursor = cursor;
    };

    const guideAt = (x: number): 'start' | 'end' | null => {
      const current = simulationRef.current;
      const endHours = current.startHours + current.durationSecs / 3600;
      const startPixel = activeChart.convertToPixel({ gridIndex: 0 }, [current.startHours, 0]) as [number, number];
      const endPixel = activeChart.convertToPixel({ gridIndex: 0 }, [endHours, 0]) as [number, number];
      if (Math.abs(x - startPixel[0]) <= 28) return 'start';
      if (Math.abs(x - endPixel[0]) <= 28) return 'end';
      return null;
    };

    const isNearHashrateLine = (x: number, y: number): boolean => {
      const point = activeChart.convertFromPixel({ gridIndex: 0 }, [x, y]) as [number, number];
      const hours = point[0];
      if (!Number.isFinite(hours)) return false;
      const current = simulationRef.current;
      const hashratePhs = current.hashrateHps / HASH_DAYS_PER_PHD;
      const linePixel = activeChart.convertToPixel(
        { gridIndex: 0 },
        [hours, hashrateAtHours(hours, hashratePhs, timelineHoursFor(current))],
      ) as [number, number];
      return Number.isFinite(linePixel[1]) && Math.abs(y - linePixel[1]) <= 32;
    };

    const preventDefault = (event: { event?: Event }) => {
      if (event.event?.cancelable) event.event.preventDefault();
    };

    const handleMouseDown = (event: { offsetX: number; offsetY: number; event?: Event }) => {
      if (isNearHashrateLine(event.offsetX, event.offsetY)) {
        hashrateDragRef.current = {
          startClientY: element.getBoundingClientRect().top + event.offsetY,
          startHashratePhs: simulationRef.current.hashrateHps / HASH_DAYS_PER_PHD,
        };
        dragRef.current = 'hashrate';
        setCursor('ns-resize');
        preventDefault(event);
        return;
      }
      const guide = guideAt(event.offsetX);
      if (guide) {
        // Remember the grab offset so the handle follows the pointer without
        // jumping to the cursor position.
        const point = activeChart.convertFromPixel({ gridIndex: 0 }, [event.offsetX, 0]) as [number, number];
        const current = simulationRef.current;
        const handleHours = guide === 'start' ? current.startHours : current.startHours + current.durationSecs / 3600;
        windowDragOffsetRef.current = Number.isFinite(point[0]) ? point[0] - handleHours : 0;
        dragRef.current = guide;
        setCursor('ew-resize');
        preventDefault(event);
      }
    };

    const handleMouseMove = (event: { offsetX: number; offsetY: number; event?: Event }) => {
      const drag = dragRef.current;

      if (!drag) {
        const nearLine = isNearHashrateLine(event.offsetX, event.offsetY);
        const guide = guideAt(event.offsetX);
        setCursor(nearLine ? 'ns-resize' : guide ? 'ew-resize' : 'default');
        return;
      }

      preventDefault(event);

      if (drag === 'hashrate') return;

      const point = activeChart.convertFromPixel(
        { gridIndex: 0 },
        [event.offsetX, event.offsetY],
      ) as [number, number];

      const hours = point[0] - windowDragOffsetRef.current;
      if (!Number.isFinite(hours)) return;

      updateSimulation(current => {
        const endHours = current.startHours + current.durationSecs / 3600;
        if (drag === 'start') {
          const nextStart = clamp(Math.round(hours), 0, endHours - MIN_WINDOW_HOURS);
          return {
            ...current,
            startHours: nextStart,
            durationSecs: (endHours - nextStart) * 3600,
          };
        }
        const nextEnd = clamp(
          Math.round(hours),
          current.startHours + MIN_WINDOW_HOURS,
          timelineHoursFor(current),
        );
        return {
          ...current,
          durationSecs: (nextEnd - current.startHours) * 3600,
        };
      });
    };

    const applyHashrateDrag = (clientY: number) => {
      const hashrateDrag = hashrateDragRef.current;
      if (!hashrateDrag) return;

      const deltaY = hashrateDrag.startClientY - clientY;
      const nextHashratePhs = hashrateDrag.startHashratePhs * 10 ** (deltaY / 120);
      const snappedHashratePhs = Math.max(0.1, Math.round(nextHashratePhs * 10) / 10);

      updateSimulation(current => ({
        ...current,
        hashrateHps: clamp(snappedHashratePhs * HASH_DAYS_PER_PHD, MIN_HASHRATE_HPS, MAX_HASHRATE_HPS),
      }));
    };

    const handleWindowMouseMove = (event: MouseEvent) => {
      if (dragRef.current !== 'hashrate') return;
      applyHashrateDrag(event.clientY);
    };

    const handleWindowTouchMove = (event: TouchEvent) => {
      if (dragRef.current !== 'hashrate') return;
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      applyHashrateDrag(touch.clientY);
    };

    const handleMouseUp = () => {
      const wasDraggingHashrate = dragRef.current === 'hashrate';
      dragRef.current = null;
      hashrateDragRef.current = null;
      windowDragOffsetRef.current = 0;
      setCursor('default');
      if (wasDraggingHashrate) {
        yAxisMaxRef.current = niceAxisMax(simulationRef.current.hashrateHps / HASH_DAYS_PER_PHD);
        activeChart.setOption(buildChartOption(simulationRef.current, yAxisMaxRef.current, isMobileRef.current), true);
      }
    };

    activeChart.getZr().on('mousedown', handleMouseDown);
    activeChart.getZr().on('mousemove', handleMouseMove);
    activeChart.getZr().on('mouseup', handleMouseUp);
    activeChart.getZr().on('touchstart', handleMouseDown);
    activeChart.getZr().on('touchmove', handleMouseMove);
    activeChart.getZr().on('touchend', handleMouseUp);
    activeChart.getZr().on('touchcancel', handleMouseUp);
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
    window.addEventListener('touchcancel', handleMouseUp);

    const observer = new ResizeObserver(() => {
      const currentChart = ensureChart();
      if (currentChart && !currentChart.isDisposed()) currentChart.resize();
    });
    observer.observe(element);

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('touchcancel', handleMouseUp);
      activeChart.getZr().off('mousedown', handleMouseDown);
      activeChart.getZr().off('mousemove', handleMouseMove);
      activeChart.getZr().off('mouseup', handleMouseUp);
      activeChart.getZr().off('touchstart', handleMouseDown);
      activeChart.getZr().off('touchmove', handleMouseMove);
      activeChart.getZr().off('touchend', handleMouseUp);
      activeChart.getZr().off('touchcancel', handleMouseUp);
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.dispose();
      }
      chartInstanceRef.current = null;
    };
  }, [updateSimulation]);

  useEffect(() => {
    simulationRef.current = simulation;
    const nextAxisMax = niceAxisMax(simulation.hashrateHps / HASH_DAYS_PER_PHD);
    if (dragRef.current === 'hashrate') {
      yAxisMaxRef.current = Math.max(yAxisMaxRef.current, nextAxisMax);
    } else {
      yAxisMaxRef.current = nextAxisMax;
    }
    const chart = chartInstanceRef.current;
    if (!chart || chart.isDisposed()) return;
    chart.setOption(buildChartOption(simulation, yAxisMaxRef.current, isMobile), true);
  }, [simulation, isMobile]);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[1fr_1.618fr] lg:items-center lg:gap-8">
      <div className="order-2 mx-auto w-full lg:order-1 lg:max-w-sm">
        <OverviewCalculator
          key={calculatorKey}
          hashrateHps={simulation.hashrateHps}
          durationSecs={simulation.durationSecs}
          workDiff1={workDiff1}
          onHashrateChange={handleHashrateChange}
          onDurationChange={handleDurationChange}
          onWorkChange={handleWorkChange}
          onReset={handleReset}
        />
      </div>
      <div ref={chartRef} className="order-1 h-[360px] w-full touch-none sm:h-[340px] lg:order-2" />
    </div>
  );
}
