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
}

export default function UsersWorkersChart({ data, loading = false }: UsersWorkersChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

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

    const getChartOption = (chartData: typeof data) => ({
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
          },
          position: "left",
          axisLine: {
            lineStyle: {
              color: usersColor,
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
        {
          type: "value",
          name: "Workers",
          scale: true,
          minInterval: 1,
          nameTextStyle: {
            color: foregroundColor,
            fontFamily: '"Courier New", Courier, monospace',
          },
          position: "right",
          axisLine: {
            lineStyle: {
              color: workersColor,
            },
          },
          axisLabel: {
            color: foregroundColor,
            fontFamily: '"Courier New", Courier, monospace',
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
    chart.setOption(getChartOption(data));

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);

    // Update chart when data changes
    if (data) {
      chart.setOption(getChartOption(data), { notMerge: false });
    }

    return () => {
      chart.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, []);  // Empty dependency array for initialization

  // Separate effect for data updates
  useEffect(() => {
    if (!chartRef.current || !data) return;
    const chart = echarts.getInstanceByDom(chartRef.current);
    if (chart) {
      chart.setOption({
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
      }, { notMerge: false });
    }
  }, [data]);  // Only run when data changes

  return (
    <div className="bg-background py-6 shadow-md border border-border">
      <h2 className="text-2xl font-semibold mb-4 px-6">Users & Workers</h2>
      {loading && <p className="text-center">Loading data...</p>}
      <div ref={chartRef} style={{ width: "100%", height: "450px" }}></div>
    </div>
  );
}
