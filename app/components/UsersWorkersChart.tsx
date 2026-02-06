"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface UsersWorkersChartProps {
  data?: {
    dates: string[];
    users: number[];
    workers: number[];
    idle: number[];
    disconnected: number[];
  };
  loading?: boolean;
  onZoomChange?: (startPercent: number, endPercent: number) => void;
  refetching?: boolean;
}

export default function UsersWorkersChart({
  data,
  loading = false,
  onZoomChange,
  refetching = false,
}: UsersWorkersChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const onZoomChangeRef = useRef(onZoomChange);
  const zoomStateRef = useRef({ start: 0, end: 100 });
  useEffect(() => { onZoomChangeRef.current = onZoomChange; }, [onZoomChange]);

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

    // Grayscale colors for users and workers
    const usersColor = "#CCCCCC";
    const workersColor = "#666666";

    const getChartOption = (chartData: typeof data, zoomState: { start: number; end: number }) => ({
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
        axisPointer: {
          type: "line",
          label: {
            backgroundColor: secondaryColor,
          },
        },
      },
      legend: {
        data: ["Users", "Workers"],
        textStyle: {
          color: foregroundColor,
          fontFamily: '"Courier New", Courier, monospace',
        },
      },
      grid: {
        left: "2%",
        right: "2%",
        bottom: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: chartData?.dates || [],
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
          name: "Users",
          scale: true,
          minInterval: 1,
          nameTextStyle: {
            color: usersColor,
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: "bold",
          },
          position: "left",
          axisLine: {
            lineStyle: {
              color: usersColor,
            },
          },
          axisLabel: {
            color: usersColor,
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: "bold",
          },
          splitLine: {
            lineStyle: {
              color: borderColor,
              opacity: 0.2,
            },
          },
        },
        {
          type: "value",
          name: "Workers",
          scale: true,
          minInterval: 1,
          nameTextStyle: {
            color: workersColor,
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: "bold",
          },
          position: "right",
          axisLine: {
            lineStyle: {
              color: workersColor,
            },
          },
          axisLabel: {
            color: workersColor,
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: "bold",
          },
          splitLine: {
            show: false,
          },
        },
      ],
      dataZoom: [
        {
          type: "slider",
          xAxisIndex: [0, 1],
          filterMode: "none",
          start: zoomState.start,
          end: zoomState.end,
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
        {
          name: "Users",
          type: "line",
          yAxisIndex: 0,
          data: chartData?.users || [],
          smooth: true,
          sampling: "average",
          lineStyle: {
            color: usersColor,
            width: 3,
          },
          itemStyle: {
            color: usersColor,
          },
          symbol: "circle",
          symbolSize: 8,
          showSymbol: false,
          showAllSymbol: "auto",
        },
        {
          name: "Workers",
          type: "line",
          yAxisIndex: 1,
          data: chartData?.workers || [],
          smooth: true,
          sampling: "average",
          lineStyle: {
            color: workersColor,
            width: 3,
          },
          itemStyle: {
            color: workersColor,
          },
          symbol: "circle",
          symbolSize: 8,
          showSymbol: false,
          showAllSymbol: "auto",
        },
      ],
    });

    // Initial chart setup
    chart.setOption(getChartOption(data, zoomStateRef.current));

    // Add datazoom event listener for auto-scaling y-axes
    const handleDataZoom = (params: unknown) => {
      const dataZoomParams = params as { start: number; end: number; type: string };
      
      // Get current data from the chart option
      const currentOption = chart.getOption() as {
        series?: Array<{ data?: number[]; name?: string; yAxisIndex?: number }>;
        xAxis?: Array<{ data?: string[] }>;
      };
      const currentSeries = currentOption.series;
      const currentXAxisData = currentOption.xAxis?.[0]?.data;
      
      if (!currentSeries || !currentSeries.length || !currentXAxisData || !currentXAxisData.length) {
        return;
      }
      
      // Get start and end percentages from the event params
      const startPercent = dataZoomParams.start || 0;
      const endPercent = dataZoomParams.end || 100;
      
      // If fully zoomed out, revert to automatic scaling for both axes
      if (startPercent <= 0 && endPercent >= 100) {
        chart.setOption({
          yAxis: [
            { min: null, max: null },
            { min: null, max: null }
          ]
        }, false);
        return;
      }
      
      // Calculate the actual data indices for the zoom range
      const totalDataLength = currentXAxisData.length;
      const startIndex = Math.floor((startPercent / 100) * totalDataLength);
      const endIndex = Math.min(Math.ceil((endPercent / 100) * totalDataLength), totalDataLength - 1);
      
      // Find min and max values for each y-axis separately
      let usersMin = Infinity;
      let usersMax = -Infinity;
      let workersMin = Infinity;
      let workersMax = -Infinity;
      
      currentSeries.forEach((series) => {
        if (!series.data) return;
        
        for (let i = startIndex; i <= endIndex && i < series.data.length; i++) {
          const value = series.data[i];
          if (value !== null && value !== undefined && !isNaN(value)) {
            if (series.yAxisIndex === 0 || series.yAxisIndex === undefined) {
              // Users series (left y-axis)
              usersMin = Math.min(usersMin, value);
              usersMax = Math.max(usersMax, value);
            } else if (series.yAxisIndex === 1) {
              // Workers series (right y-axis)
              workersMin = Math.min(workersMin, value);
              workersMax = Math.max(workersMax, value);
            }
          }
        }
      });
      
      // Update y-axes if we found valid data
      const yAxisUpdates: Array<{ min?: number; max?: number }> = [{}, {}]; // Array for both y-axes
      
      if (usersMin !== Infinity && usersMax !== -Infinity) {
        // Add padding for users axis (10% on each side) and ensure integer values
        const usersRange = usersMax - usersMin;
        const usersPadding = Math.max(Math.ceil(usersRange * 0.1), usersRange === 0 ? Math.ceil(usersMax * 0.1) : 1);
        const adjustedUsersMin = Math.max(0, Math.floor(usersMin - usersPadding));
        const adjustedUsersMax = Math.ceil(usersMax + usersPadding);
        
        yAxisUpdates[0] = {
          min: adjustedUsersMin,
          max: adjustedUsersMax
        };
      }
      
      if (workersMin !== Infinity && workersMax !== -Infinity) {
        // Add padding for workers axis (10% on each side) and ensure integer values
        const workersRange = workersMax - workersMin;
        const workersPadding = Math.max(Math.ceil(workersRange * 0.1), workersRange === 0 ? Math.ceil(workersMax * 0.1) : 1);
        const adjustedWorkersMin = Math.max(0, Math.floor(workersMin - workersPadding));
        const adjustedWorkersMax = Math.ceil(workersMax + workersPadding);
        
        yAxisUpdates[1] = {
          min: adjustedWorkersMin,
          max: adjustedWorkersMax
        };
      }
      
      // Apply updates to both y-axes
      chart.setOption({
        yAxis: yAxisUpdates
      }, false);
    };

    chart.on('datazoom', (params: unknown) => {
      handleDataZoom(params);
      const p = params as { start: number; end: number };
      const start = typeof p.start === "number" ? p.start : zoomStateRef.current.start;
      const end = typeof p.end === "number" ? p.end : zoomStateRef.current.end;
      zoomStateRef.current = { start, end };
      onZoomChangeRef.current?.(start, end);
    });

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);

    // Update chart when data changes
    if (data) {
      chart.setOption(getChartOption(data, zoomStateRef.current), { notMerge: false });
    }

    return () => {
      chart.off('datazoom', handleDataZoom);
      chart.dispose();
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array for initialization

  // Separate effect for data updates
  useEffect(() => {
    if (!chartRef.current || !data) return;
    const chart = echarts.getInstanceByDom(chartRef.current);
    if (chart) {
      chart.setOption(
        {
          xAxis: {
            data: data.dates,
          },
          series: [
            {
              data: data.users,
            },
            {
              data: data.workers,
            },
          ],
        },
        { notMerge: false }
      );
    }
  }, [data]); // Only run when data changes

  return (
    <div className="bg-background py-6 shadow-md border border-border">
      <div className="flex items-center gap-3 mb-4 px-6">
        <h2 className="text-2xl font-semibold">Users & Workers</h2>
        {refetching && <span className="text-sm text-muted-foreground animate-pulse">Loading detail...</span>}
      </div>
      {loading && <p className="text-center">Loading data...</p>}
      <div ref={chartRef} style={{ width: "100%", height: "450px" }}></div>
    </div>
  );
}
