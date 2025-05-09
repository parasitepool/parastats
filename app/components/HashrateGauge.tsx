'use client';

import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

interface HashrateGaugeProps {
  totalHashrate?: number; // in PH/s
}

export default function HashrateGauge({ totalHashrate = 0 }: HashrateGaugeProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    if (chartRef.current) {
      const chart = echarts.init(chartRef.current);
      
      // Check for mobile screen
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
      };
      
      // Initial check
      checkMobile();
      
      // Get theme colors from CSS variables
      const foregroundColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
      
      const option = {
        backgroundColor: 'transparent',
        textStyle: {
          fontFamily: '"Courier New", Courier, monospace',
          color: foregroundColor
        },
        series: [
          {
            type: 'gauge',
            center: ['50%', '58%'],
            min: 0,
            max: 69,
            splitNumber: 10,
            radius: '100%',
            axisLine: {
              lineStyle: {
                width: 30,
                color: [
                  [0.2, '#222222'],
                  [0.4, '#444444'],
                  [0.6, '#666666'],
                  [0.8, '#888888'],
                  [1, '#aaaaaa']
                ]
              }
            },
            pointer: {
              itemStyle: {
                color: foregroundColor
              }
            },
            axisTick: {
              distance: -10,
              length: 8,
              lineStyle: {
                color: foregroundColor,
                width: 2
              }
            },
            splitLine: {
              distance: -30,
              length: 30,
              lineStyle: {
                color: foregroundColor,
                width: 2
              }
            },
            axisLabel: {
              color: foregroundColor,
              distance: 40,
              fontSize: 12,
              formatter: function(value: number) {
                return value.toFixed(0);
              }
            },
            detail: {
              valueAnimation: true,
              formatter: '{value} PH/s',
              color: foregroundColor,
              fontSize: 24,
              offsetCenter: [0, '60%']
            },
            title: {
              offsetCenter: [0, '20%'],
              fontSize: 16,
              color: foregroundColor,
              fontFamily: '"Courier New", Courier, monospace'
            },
            data: [
              {
                value: totalHashrate,
              }
            ]
          }
        ]
      };
      
      chart.setOption(option);
      
      const handleResize = () => {
        checkMobile();
        chart.resize();
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        chart.dispose();
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [totalHashrate, isMobile]);
  
  return (
    <div className="bg-background p-6 shadow-md border border-border">
      <h2 className="text-2xl font-semibold mb-4">Pool Hashrate</h2>
      <div ref={chartRef} style={{ width: '100%', height: '350px' }}></div>
    </div>
  );
}
