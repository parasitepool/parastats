"use client";

import { useEffect, useRef } from "react";
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
 * Only includes the top N highest difficulties within the timestamp tolerance.
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

  // Sort by difficulty descending and take top N
  const topDiffs = [...diffs]
    .sort((a, b) => b.difficulty - a.difficulty)
    .slice(0, TOP_DIFFS_TO_SHOW);

  // For each top diff, find the closest timestamp index
  for (const diff of topDiffs) {
    let closestIndex = -1;
    let closestDistance = Infinity;

    for (let i = 0; i < rawTimestamps.length; i++) {
      const distance = Math.abs(rawTimestamps[i] - diff.rawTimestamp);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    // Only place the point if within tolerance
    if (closestIndex >= 0 && closestDistance < MAX_TIMESTAMP_DISTANCE_MS) {
      seriesData[closestIndex] = diff.difficulty;
    }
  }

  return seriesData;
}

export default function HashrateChart({ data, bestDiffs, loading = false, title = "Historic Hashrate" }: HashrateChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Chart initialization effect - runs once on mount
  // Dependencies are intentionally empty because:
  // 1. Chart instance is created once and persisted via ref
  // 2. Data updates are handled by the separate useEffect below
  // 3. Event handlers read current state from chart.getOption()
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

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

    // Function to build chart options - can be reused for updates
    const buildChartOptions = (chartData: typeof data, diffData?: BestDiffPoint[]) => {
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
  };

    // Initial chart setup
    chart.setOption(buildChartOptions(data, bestDiffs));

    // Add datazoom event listener for auto-scaling y-axis
    const handleDataZoom = (params: unknown) => {
      const dataZoomParams = params as { start: number; end: number; type: string };
      // Get current data from the chart option instead of using closure data
      const currentOption = chart.getOption() as {
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
        chart.setOption({
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
        chart.setOption({
          yAxis: {
            min: 0, // For hashrate, let's just keep it at 0 for now
            max: adjustedMax
          }
        }, false);
      }
    };

    chart.on('datazoom', handleDataZoom);

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      chart.off('datazoom', handleDataZoom);
      chart.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Separate effect for data updates - runs when data or bestDiffs changes
  useEffect(() => {
    if (!chartRef.current || !data) return;
    const chart = echarts.getInstanceByDom(chartRef.current);
    if (!chart) return;

    const bestDiffSeriesData = mapBestDiffsToSeriesData(
      data.timestamps,
      data.rawTimestamps,
      bestDiffs || []
    );
    const hasBestDiffs = bestDiffs && bestDiffs.length > 0 && bestDiffSeriesData.some(v => v !== null);
    
    // Update data points and timestamps while preserving visual styling
    chart.setOption({
      xAxis: {
        data: data.timestamps,
      },
      series: [
        ...data.series.map((series, index) => {
          const color = series.color || DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length];
          const isPrimary = index === 0;
          
          return {
            type: "line" as const,
            name: series.title || `Hashrate ${index + 1}`,
            yAxisIndex: 0,
            data: series.data,
            lineStyle: {
              color: color,
              width: isPrimary ? 3 : 2,
              type: series.lineStyle === 'dashed' ? 'dashed' : 
                   series.lineStyle === 'dotted' ? 'dotted' : 'solid'
            },
            itemStyle: {
              color: color
            },
            showSymbol: false,
            symbolSize: isPrimary ? 8 : 6
          };
        }),
        // Best Diff series update
        ...(hasBestDiffs ? [{
          name: "Best Diff",
          type: "scatter" as const,
          yAxisIndex: 1,
          data: bestDiffSeriesData,
          itemStyle: {
            color: BEST_DIFF_COLOR,
          },
        }] : []),
      ]
    }, { notMerge: false });
  }, [data, bestDiffs]);

  return (
    <div className="bg-background shadow-md border border-border py-6">
      <h2 className="text-2xl font-semibold mb-4 px-6">{title}</h2>
      {loading && <p className="text-center">Loading data...</p>}
      <div ref={chartRef} style={{ width: "100%", height: "400px" }}></div>
    </div>
  );
}
