'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface OverviewChartProps {
  data?: {
    dates: string[];
    users: number[];
    workers: number[];
  };
}

export default function OverviewChart({ data }: OverviewChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (chartRef.current) {
      const chart = echarts.init(chartRef.current);
      const chartData = data || {
        dates: [],
        users: [],
        workers: []
      };
      
      // Get theme colors from CSS variables
      const foregroundColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
      const accentColor1 = getComputedStyle(document.documentElement).getPropertyValue('--accent-1').trim();
      const accentColor2 = getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim();
      const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
      const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim();
      
      const option = {
        backgroundColor: 'transparent',
        textStyle: {
          color: foregroundColor,
          fontFamily: '"Courier New", Courier, monospace'
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: secondaryColor,
          borderColor: borderColor,
          textStyle: {
            color: foregroundColor,
            fontFamily: '"Courier New", Courier, monospace'
          }
        },
        legend: {
          data: ['Users', 'Workers'],
          textStyle: {
            color: foregroundColor,
            fontFamily: '"Courier New", Courier, monospace'
          }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: chartData.dates,
          axisLine: {
            lineStyle: {
              color: borderColor
            }
          },
          axisLabel: {
            color: foregroundColor,
            fontFamily: '"Courier New", Courier, monospace'
          },
          splitLine: {
            lineStyle: {
              color: borderColor,
              opacity: 0.2
            }
          }
        },
        yAxis: {
          type: 'value',
          axisLine: {
            lineStyle: {
              color: borderColor
            }
          },
          axisLabel: {
            color: foregroundColor,
            fontFamily: '"Courier New", Courier, monospace'
          },
          splitLine: {
            lineStyle: {
              color: borderColor,
              opacity: 0.2
            }
          }
        },
        series: [
          {
            name: 'Users',
            type: 'line',
            data: chartData.users,
            lineStyle: {
              color: accentColor1
            },
            itemStyle: {
              color: accentColor1
            }
          },
          {
            name: 'Workers',
            type: 'line',
            data: chartData.workers,
            lineStyle: {
              color: accentColor2
            },
            itemStyle: {
              color: accentColor2
            }
          }
        ],
      };

      chart.setOption(option);

      const handleResize = () => {
        chart.resize();
      };

      window.addEventListener('resize', handleResize);

      return () => {
        chart.dispose();
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [data]);

  return (
    <div className="bg-background p-6 shadow-md border border-border">
      <div ref={chartRef} style={{ width: '100%', height: '400px' }}></div>
    </div>
  );
} 