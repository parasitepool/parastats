'use client';

import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { formatAddress } from '../utils/formatters';

interface User {
  id: number;
  address: string;
  hashrate: number;
}

interface HashrateDistributionProps {
  users?: User[];
}

export default function HashrateDistribution({ users }: HashrateDistributionProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    if (chartRef.current) {
      const chart = echarts.init(chartRef.current);
      const userData = users || [];
      
      // Check for mobile screen
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
      };
      
      // Initial check
      checkMobile();
      
      // Get theme colors from CSS variables
      const foregroundColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
      const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim();
      const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
      
      // Get top 9 users by hashrate
      const sortedUsers = [...userData].sort((a, b) => b.hashrate - a.hashrate);
      const top9Users = sortedUsers.slice(0, 9);
      
      // Calculate sum of hashrates for remaining users
      const otherUsers = sortedUsers.slice(9);
      const otherHashrate = otherUsers.reduce((sum, user) => sum + user.hashrate, 0);
      
      // Prepare chart data
      const chartData = top9Users.map(user => ({
        value: user.hashrate,
        name: formatAddress(user.address)
      }));
      
      // Add "Others" category if there are more than 20 users
      if (otherUsers.length > 0) {
        chartData.push({
          value: otherHashrate,
          name: 'Others'
        });
      }
      
      // Generate grayscale color palette
      const colorPalette = [
        '#CCCCCC', '#BBBBBB', '#AAAAAA', '#999999', '#888888',
        '#777777', '#666666', '#555555', '#444444', '#333333',
        '#DDDDDD', '#EEEEEE', '#F5F5F5', '#E0E0E0', '#D0D0D0',
        '#C0C0C0', '#B0B0B0', '#A0A0A0', '#909090', '#808080',
        '#707070'
      ];
      
      const option = {
        backgroundColor: 'transparent',
        textStyle: {
          color: foregroundColor,
          fontFamily: '"Courier New", Courier, monospace'
        },
        tooltip: {
          trigger: 'item',
          formatter: '{b}<br/>{c} H/s ({d}%)',
          backgroundColor: secondaryColor,
          borderColor: borderColor,
          textStyle: {
            color: foregroundColor,
            fontFamily: '"Courier New", Courier, monospace'
          }
        },
        legend: {
          type: 'plain',
          orient: isMobile ? 'horizontal' : 'vertical',
          right: isMobile ? 'auto' : 10,
          top: isMobile ? 'auto' : 20,
          bottom: isMobile ? 0 : 20,
          left: isMobile ? 'center' : 'auto',
          data: chartData.map(item => item.name),
          textStyle: {
            color: foregroundColor,
            fontFamily: '"Courier New", Courier, monospace'
          }
        },
        series: [
          {
            name: 'Hashrate',
            type: 'pie',
            radius: ['40%', '70%'],
            center: isMobile ? ['50%', '30%'] : ['40%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 2,
              borderColor: borderColor,
              borderWidth: 1
            },
            label: {
              show: false,
              position: 'center',
              color: foregroundColor,
              fontFamily: '"Courier New", Courier, monospace'
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 16,
                fontWeight: 'bold',
                color: foregroundColor,
                fontFamily: '"Courier New", Courier, monospace'
              }
            },
            labelLine: {
              show: false
            },
            color: colorPalette,
            data: chartData
          }
        ]
      };
      
      chart.setOption(option);
      
      const handleResize = () => {
        checkMobile();
        chart.resize();
        chart.setOption({
          legend: {
            orient: isMobile ? 'horizontal' : 'vertical',
            right: isMobile ? 'auto' : 10,
            top: isMobile ? 'auto' : 20,
            bottom: isMobile ? 0 : 20,
            left: isMobile ? 'center' : 'auto',
          },
          series: [{
            center: isMobile ? ['50%', '40%'] : ['40%', '50%']
          }]
        });
      };
      
      window.addEventListener('resize', handleResize);
      
      return () => {
        chart.dispose();
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [users, isMobile]);
  
  return (
    <div className="bg-background p-6 shadow-md border border-border">
      <h2 className="text-2xl font-semibold mb-4">Hashrate Distribution</h2>
      <div ref={chartRef} style={{ width: '100%', height: '400px' }}></div>
    </div>
  );
} 