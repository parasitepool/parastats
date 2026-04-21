'use client';

import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { formatHashrate } from '../utils/formatters';

interface HashrateGaugeProps {
  hashrate?: number; // in H/s
}

export default function HashrateGauge({ hashrate = 0 }: HashrateGaugeProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (chartRef.current) {
      const chart = echarts.init(chartRef.current);

      const tier = hashrate >= 1e18
        ? { divisor: 1e18, max: 9.99, decimals: 2 }
        : { divisor: 1e15, max: 9999, decimals: 0 };
      
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
            max: tier.max,
            splitNumber: 9,
            radius: '100%',
            axisLine: {
              lineStyle: {
                width: 30,
                color: [
                  [2/9, '#222222'],
                  [4/9, '#444444'],
                  [6/9, '#666666'],
                  [8/9, '#888888'],
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
                return value.toLocaleString(undefined, {
                  minimumFractionDigits: tier.decimals,
                  maximumFractionDigits: tier.decimals,
                });
              }
            },
            detail: {
              valueAnimation: true,
              formatter: function(value: number) {
                return formatHashrate(value * tier.divisor);
              },
              color: foregroundColor,
              fontSize: 24,
              offsetCenter: [0, '70%']
            },
            title: {
              offsetCenter: [0, '20%'],
              fontSize: 16,
              color: foregroundColor,
              fontFamily: '"Courier New", Courier, monospace'
            },
            data: [
              {
                value: hashrate / tier.divisor,
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
  }, [hashrate, isMobile]);
  
  return (
    <div className="bg-background p-6 shadow-md border border-border">
      <h2 className="text-2xl font-semibold mb-4">Pool Hashrate</h2>
      <div ref={chartRef} style={{ width: '100%', height: '350px' }}></div>
    </div>
  );
}
