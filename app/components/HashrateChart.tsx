"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { CallbackDataParams } from "echarts/types/dist/shared";

interface HashrateSeries {
  data: number[];
  title: string;
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

interface HashrateChartProps {
  data?: {
    timestamps: string[];
    series: HashrateSeries[];
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

    // Default colors for series
    const defaultColors = ["#CCCCCC", "#666666", "#999999", "#AAAAAA", "#888888"];

    // Function to build chart options - can be reused for updates
    const buildChartOptions = (chartData: typeof data) => ({
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
          
          // Loop through all series in the tooltip
          params.forEach((param, index) => {
            if (param.value !== undefined) {
              tooltipText += `${index > 0 ? '<br/>' : ''}${param.seriesName}: ${formatHashrate(Number(param.value))}`;
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
            color: defaultColors[0],
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
      series: chartData?.series.map((series, index) => {
        const color = series.color || defaultColors[index % defaultColors.length];
        const isPrimary = index === 0;
        
        return {
          name: series.title || `Hashrate ${index + 1}`,
          type: "line",
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
      }) || []
    });

    // Initial chart setup
    chart.setOption(buildChartOptions(data));

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array for initialization

  // Separate effect for data updates
  useEffect(() => {
    if (!chartRef.current || !data) return;
    const chart = echarts.getInstanceByDom(chartRef.current);
    if (chart) {
      // Default colors for visual consistency
      const defaultColors = ["#CCCCCC", "#666666", "#999999", "#AAAAAA", "#888888"];
      
      // Update data points and timestamps while preserving visual styling
      chart.setOption({
        xAxis: {
          data: data.timestamps,
        },
        series: data.series.map((series, index) => {
          const color = series.color || defaultColors[index % defaultColors.length];
          const isPrimary = index === 0;
          
          return {
            // Type and name are required to identify the series
            type: "line",
            name: series.title || `Hashrate ${index + 1}`,
            // Update the data points
            data: series.data,
            // Include styling to maintain visual consistency
            lineStyle: {
              color: color,
              width: isPrimary ? 3 : 2,
              type: series.lineStyle === 'dashed' ? 'dashed' : 
                   series.lineStyle === 'dotted' ? 'dotted' : 'solid'
            },
            itemStyle: {
              color: color
            },
            // Prevent dots from showing
            showSymbol: false,
            symbolSize: isPrimary ? 8 : 6
          };
        })
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
