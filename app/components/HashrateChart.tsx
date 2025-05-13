"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { CallbackDataParams } from "echarts/types/dist/shared";

interface HashrateChartProps {
  data?: {
    timestamps: string[];
    hashrates: number[];
    hashrates2?: number[];
    hashrates2Title?: string;
  };
  loading?: boolean;
}

export default function HashrateChart({ data, loading = false }: HashrateChartProps) {
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

    // Hashrate line color
    const hashrateColor = "#CCCCCC";

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
        formatter: function (params: CallbackDataParams[]) {
          const formatHashrate = (hashrate: number) => {
            let unit = "H/s";
            let value: number = hashrate;

            if (hashrate >= 1e15) {
              value = hashrate / 1e15;
              unit = "PH/s";
            } else if (hashrate >= 1e12) {
              value = hashrate / 1e12;
              unit = "TH/s";
            } else if (hashrate >= 1e9) {
              value = hashrate / 1e9;
              unit = "GH/s";
            } else if (hashrate >= 1e6) {
              value = hashrate / 1e6;
              unit = "MH/s";
            } else if (hashrate >= 1e3) {
              value = hashrate / 1e3;
              unit = "KH/s";
            }

            return `${value.toFixed(2)} ${unit}`;
          };

          let tooltipText = `${params[0].name}<br/>`;
          tooltipText += `Hashrate: ${formatHashrate(Number(params[0].value))}`;
          
          if (params.length > 1 && params[1].value !== undefined) {
            tooltipText += `<br/>${params[1].seriesName}: ${formatHashrate(Number(params[1].value))}`;
          }

          return tooltipText;
        },
        axisPointer: {
          type: "line",
          label: {
            backgroundColor: secondaryColor,
          },
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
      yAxis: {
        type: "value",
        scale: true,
        nameTextStyle: {
          color: foregroundColor,
          fontFamily: '"Courier New", Courier, monospace',
          fontWeight: "bold",
        },
        axisLine: {
          lineStyle: {
            color: hashrateColor,
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
        {
          name: "Hashrate",
          type: "line",
          data: chartData?.hashrates || [],
          smooth: true,
          sampling: "average",
          lineStyle: {
            color: hashrateColor,
            width: 3,
          },
          itemStyle: {
            color: hashrateColor,
          },
          symbol: "circle",
          symbolSize: 8,
          showSymbol: false,
          showAllSymbol: "auto",
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              {
                offset: 0,
                color: hashrateColor,
              },
              {
                offset: 1,
                color: "transparent",
              },
            ]),
            opacity: 0.1,
          },
        },
        ...(chartData?.hashrates2 ? [{
          name: chartData.hashrates2Title || "Secondary Hashrate",
          type: "line",
          data: chartData.hashrates2,
          smooth: true,
          sampling: "average",
          lineStyle: {
            color: "#666666",
            width: 2,
            type: "dashed"
          },
          itemStyle: {
            color: "#666666"
          },
          symbol: "circle",
          symbolSize: 6,
          showSymbol: false,
          showAllSymbol: "auto"
        }] : []),
      ],
    });

    // Initial chart setup
    chart.setOption(getChartOption(data));

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
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
      chart.setOption({
        xAxis: {
          data: data.timestamps,
        },
        series: [
          {
            data: data.hashrates,
          },
          ...(data.hashrates2 ? [{
            data: data.hashrates2,
          }] : []),
        ],
      }, { notMerge: false });
    }
  }, [data]); // Only run when data changes

  return (
    <div className="bg-background shadow-md border border-border py-6">
      <h2 className="text-2xl font-semibold mb-4 px-6">Historic Hashrate</h2>
      {loading && <p className="text-center">Loading data...</p>}
      <div ref={chartRef} style={{ width: "100%", height: "400px" }}></div>
    </div>
  );
}
