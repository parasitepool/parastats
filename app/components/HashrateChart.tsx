"use client";

import { useEffect, useRef, useCallback } from "react";
import * as echarts from "echarts";
import { CallbackDataParams } from "echarts/types/dist/shared";
import { formatDifficulty, formatHashrate } from "../utils/formatters";

// Constants
const MAX_TIMESTAMP_DISTANCE_MS = 30 * 60 * 1000; // 30 minutes tolerance for matching timestamps
const TOP_DIFFS_TO_SHOW = 9; // Number of top difficulties to display
const DEFAULT_SERIES_COLORS = ["#CCCCCC", "#666666", "#999999", "#AAAAAA", "#888888"];
const BEST_DIFF_COLOR = "#ef4444";

interface HashrateSeries {
  data: number[];
  title: string;
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

interface BestDiffPoint {
  timestamp: string;  // Formatted timestamp for display matching
  rawTimestamp: number; // Unix timestamp in ms for comparison
  difficulty: number;
}

interface HashrateChartProps {
  data?: {
    timestamps: string[];
    rawTimestamps?: number[]; // Unix timestamps in ms for comparison
    series: HashrateSeries[];
  };
  bestDiffs?: BestDiffPoint[];
  loading?: boolean;
  title?: string;
}

/**
 * Map best diff points to chart series data by finding the closest timestamp match.
 * First filters to diffs within the chart's time range, then takes top N highest difficulties.
 */
function mapBestDiffsToSeriesData(
  timestamps: string[],
  rawTimestamps: number[] | undefined,
  diffs: BestDiffPoint[]
): (number | null)[] {
  const seriesData: (number | null)[] = new Array(timestamps.length).fill(null);
  
  if (!rawTimestamps || rawTimestamps.length !== timestamps.length || diffs.length === 0) {
    return seriesData;
  }

  // Get the time range of the chart
  const chartMinTime = Math.min(...rawTimestamps);
  const chartMaxTime = Math.max(...rawTimestamps);

  // First, filter diffs to only those within the chart's time range (with tolerance)
  const diffsInRange = diffs.filter(diff => 
    diff.rawTimestamp >= chartMinTime - MAX_TIMESTAMP_DISTANCE_MS &&
    diff.rawTimestamp <= chartMaxTime + MAX_TIMESTAMP_DISTANCE_MS
  );

  // Sort by difficulty descending and take top N from those in range
  const topDiffs = [...diffsInRange]
    .sort((a, b) => b.difficulty - a.difficulty)
    .slice(0, TOP_DIFFS_TO_SHOW);

  // For each top diff, find the closest timestamp index that isn't already taken
  const usedIndices = new Set<number>();
  
  for (const diff of topDiffs) {
    let closestIndex = -1;
    let closestDistance = Infinity;

    for (let i = 0; i < rawTimestamps.length; i++) {
      // Skip indices that already have a dot (higher difficulty already placed there)
      if (usedIndices.has(i)) continue;
      
      const distance = Math.abs(rawTimestamps[i] - diff.rawTimestamp);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    // Only place the point if within tolerance and index not already used
    if (closestIndex >= 0 && closestDistance < MAX_TIMESTAMP_DISTANCE_MS) {
      seriesData[closestIndex] = diff.difficulty;
      usedIndices.add(closestIndex);
    }
  }

  return seriesData;
}

export default function HashrateChart({ data, bestDiffs, loading = false, title = "Historic Hashrate" }: HashrateChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const isInitializedRef = useRef(false);

  // Build chart options function - memoized to avoid recreating on every render
  const buildChartOptions = useCallback((chartData: typeof data, diffData?: BestDiffPoint[]) => {
    // Get theme colors from CSS variables
    const foregroundColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--foreground")
      .trim();
    const borderColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--border")
      .trim();
    const secondaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--secondary")
      .trim();

    const bestDiffSeriesData = chartData?.timestamps 
      ? mapBestDiffsToSeriesData(chartData.timestamps, chartData.rawTimestamps, diffData || [])
      : [];

    const hasBestDiffs = diffData && diffData.length > 0 && bestDiffSeriesData.some(v => v !== null);

    return {
      backgroundColor: "transparent",
      animation: false,
      textStyle: {
        color: foregroundColor,
        fontFamily: '"Courier New", Courier, monospace',
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: secondaryColor,
        borderColor: borderColor,
        textStyle: {
          color: foregroundColor,
          fontFamily: '"Courier New", Courier, monospace',
        },
        formatter: function (params: CallbackDataParams[]) {
          let tooltipText = `${params[0].name}<br/>`;
          
          // Loop through all series in the tooltip
          params.forEach((param, index) => {
            if (param.value !== undefined && param.value !== null) {
              if (param.seriesName === "Best Diff") {
                tooltipText += `${index > 0 ? '<br/>' : ''}<span style="color:${BEST_DIFF_COLOR}">●</span> ${param.seriesName}: ${formatDifficulty(Number(param.value))}`;
              } else {
                tooltipText += `${index > 0 ? '<br/>' : ''}${param.seriesName}: ${formatHashrate(Number(param.value))}`;
              }
            }
          });

          return tooltipText;
        },
        axisPointer: {
          type: "line",
          label: {
            backgroundColor: secondaryColor,
          },
        },
      },
      legend: hasBestDiffs ? {
        data: ["Hashrate", "Best Diff"],
        textStyle: {
          color: foregroundColor,
          fontFamily: '"Courier New", Courier, monospace',
        },
      } : undefined,
      grid: {
        left: "2%",
        right: hasBestDiffs ? "8%" : "2%",
        bottom: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: chartData?.timestamps || [],
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
      yAxis: [
        {
          type: "value",
          scale: true,
          nameTextStyle: {
            color: foregroundColor,
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: "bold",
          },
          axisLine: {
            lineStyle: {
              color: DEFAULT_SERIES_COLORS[0],
            },
          },
          axisLabel: {
            color: foregroundColor,
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: "bold",
            formatter: function (value: number) {
              if (value >= 1e15) return (value / 1e15).toFixed(1) + " PH/s";
              if (value >= 1e12) return (value / 1e12).toFixed(1) + " TH/s";
              if (value >= 1e9) return (value / 1e9).toFixed(1) + " GH/s";
              if (value >= 1e6) return (value / 1e6).toFixed(1) + " MH/s";
              if (value >= 1e3) return (value / 1e3).toFixed(1) + " KH/s";
              return value + " H/s";
            },
          },
          splitLine: {
            lineStyle: {
              color: borderColor,
              opacity: 0.2,
            },
          },
        },
        // Secondary Y-axis for Best Diff (logarithmic, right side)
        ...(hasBestDiffs ? [{
          type: "log" as const,
          position: "right" as const,
          logBase: 10,
          axisLine: {
            lineStyle: {
              color: BEST_DIFF_COLOR,
            },
          },
          axisLabel: {
            color: BEST_DIFF_COLOR,
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: "bold" as const,
            formatter: function (value: number) {
              return formatDifficulty(value);
            },
          },
          splitLine: {
            show: false,
          },
        }] : []),
      ],
    dataZoom: [
      {
        type: "slider",
        xAxisIndex: [0],
        filterMode: "none",
        backgroundColor: secondaryColor,
        fillerColor: "rgba(0, 0, 0, 0.1)",
        borderColor: borderColor,
        handleStyle: {
          color: foregroundColor,
          borderColor: borderColor,
          borderWidth: 1,
        },
        textStyle: {
          color: foregroundColor,
          fontFamily: '"Courier New", Courier, monospace',
        },
        selectedDataBackground: {
          lineStyle: {
            color: foregroundColor,
            opacity: 0.3,
          },
          areaStyle: {
            color: "rgba(0, 0, 0, 0.1)",
          },
        },
        emphasis: {
          handleStyle: {
            borderColor: foregroundColor,
            color: foregroundColor,
          },
        },
        moveHandleStyle: {
          color: foregroundColor,
          borderColor: borderColor,
        },
        showDetail: false,
      },
    ],
    series: [
      // Hashrate series
      ...(chartData?.series.map((series, index) => {
        const color = series.color || DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length];
        const isPrimary = index === 0;
        
        return {
          name: series.title || `Hashrate ${index + 1}`,
          type: "line" as const,
          yAxisIndex: 0,
          data: series.data,
          smooth: true,
          sampling: "average",
          lineStyle: {
            color: color,
            width: isPrimary ? 3 : 2,
            type: series.lineStyle === 'dashed' ? 'dashed' : 
                 series.lineStyle === 'dotted' ? 'dotted' : 'solid'
          },
          itemStyle: {
            color: color,
          },
          symbol: "circle",
          symbolSize: isPrimary ? 8 : 6,
          showSymbol: false,
          showAllSymbol: "auto",
          ...(isPrimary ? {
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: color,
                },
                {
                  offset: 1,
                  color: "transparent",
                },
              ]),
              opacity: 0.1,
            }
          } : {})
        };
      }) || []),
      // Best Diff scatter series (red dots)
      ...(hasBestDiffs ? [{
        name: "Best Diff",
        type: "scatter" as const,
        yAxisIndex: 1,
        z: 10, // Render above the hashrate line and area
        data: bestDiffSeriesData,
        symbol: "circle",
        symbolSize: 10,
        itemStyle: {
          color: BEST_DIFF_COLOR,
          shadowBlur: 8,
          shadowColor: BEST_DIFF_COLOR,
        },
        emphasis: {
          scale: 1.5,
          itemStyle: {
            shadowBlur: 12,
          },
        },
      }] : []),
    ]
  };
  }, []);

  // Combined effect for chart initialization and data updates
  // Only initializes when we have valid data to prevent ECharts errors
  useEffect(() => {
    if (!chartRef.current) return;
    
    // Don't initialize chart until we have valid data with timestamps
    // This prevents the "Cannot read properties of undefined (reading 'get')" error
    // that occurs when ECharts tries to create a cartesian2d coordinate system with no data
    if (!data || !data.timestamps || data.timestamps.length === 0) {
      return;
    }

    let chart = chartInstanceRef.current;
    
    // Initialize chart if not already done
    if (!chart || chart.isDisposed()) {
      chart = echarts.init(chartRef.current);
      chartInstanceRef.current = chart;

      // Add datazoom event listener for auto-scaling y-axis
      const handleDataZoom = (params: unknown) => {
        const dataZoomParams = params as { start: number; end: number; type: string };
        // Get current data from the chart option instead of using closure data
        const currentOption = chart!.getOption() as {
          series?: Array<{ data?: number[]; name?: string }>;
          xAxis?: Array<{ data?: string[] }>;
        };
        const currentSeries = currentOption.series;
        const currentXAxisData = currentOption.xAxis?.[0]?.data;
        
        if (!currentSeries || !currentSeries.length || !currentXAxisData || !currentXAxisData.length) {
          return;
        }
        
        // Get start and end percentages directly from the event params
        const startPercent = dataZoomParams.start || 0;
        const endPercent = dataZoomParams.end || 100;
        
        // If fully zoomed out, revert to automatic scaling
        if (startPercent <= 0 && endPercent >= 100) {
          chart!.setOption({
            yAxis: {
              min: null,
              max: null
            }
          }, false);
          return;
        }
        
        // Calculate the actual data indices for the zoom range
        const totalDataLength = currentXAxisData.length;
        const startIndex = Math.floor((startPercent / 100) * totalDataLength);
        const endIndex = Math.min(Math.ceil((endPercent / 100) * totalDataLength), totalDataLength - 1);
        
        // Find min and max values within the visible range for all series
        let visibleMin = Infinity;
        let visibleMax = -Infinity;
        
        currentSeries.forEach((series) => {
          if (!series.data) return;
          
          for (let i = startIndex; i <= endIndex && i < series.data.length; i++) {
            const value = series.data[i];
            if (value !== null && value !== undefined && !isNaN(value)) {
              visibleMin = Math.min(visibleMin, value);
              visibleMax = Math.max(visibleMax, value);
            }
          }
        });
        
        // Only update if we found valid data
        if (visibleMin !== Infinity && visibleMax !== -Infinity) {
          // Add some padding (10% on each side for better visibility)
          const range = visibleMax - visibleMin;
          const padding = Math.max(range * 0.1, range === 0 ? visibleMax * 0.1 : 0);
          // const adjustedMin = Math.max(0, visibleMin - padding); // Don't go below 0 for hashrate
          const adjustedMax = visibleMax + padding;
          
          // Update y-axis with new range
          chart!.setOption({
            yAxis: {
              min: 0, // For hashrate, let's just keep it at 0 for now
              max: adjustedMax
            }
          }, false);
        }
      };

      chart.on('datazoom', handleDataZoom);
      isInitializedRef.current = true;
    }

    // Set/update chart options with data
    if (isInitializedRef.current) {
      chart.setOption(buildChartOptions(data, bestDiffs), { notMerge: true });
    }
  }, [data, bestDiffs, buildChartOptions]);

  // Resize handler effect - separate to avoid recreating on data changes
  useEffect(() => {
    const handleResize = () => {
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.resize();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Cleanup effect - dispose chart on unmount
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current && !chartInstanceRef.current.isDisposed()) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, []);

  return (
    <div className="bg-background shadow-md border border-border py-6">
      <h2 className="text-2xl font-semibold mb-4 px-6">{title}</h2>
      {loading && <p className="text-center">Loading data...</p>}
      <div ref={chartRef} style={{ width: "100%", height: "400px" }}></div>
    </div>
  );
}
