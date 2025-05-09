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
  
  // Mock data - replace with actual API data
  const mockUsers: User[] = [
    { id: 1, address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', hashrate: 5432 },
    { id: 2, address: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', hashrate: 4987 },
    { id: 3, address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', hashrate: 4532 },
    { id: 4, address: '1CounterpartyXXXXXXXXXXXXXXXUWLpVr', hashrate: 4124 },
    { id: 5, address: '3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5', hashrate: 3989 },
    { id: 6, address: 'bc1q9d4ywgfnd8h43da5tpcxcn6ajv590cg6d3tg6axemvljvt2k76zs50tv4q', hashrate: 3721 },
    { id: 7, address: '1JryTePceSiWVpoNBU8SbwiT7J4ghzijzW', hashrate: 3632 },
    { id: 8, address: '15KDN1DHs5xc1tTPGsg5kmkdgBhCN4WsGc', hashrate: 3521 },
    { id: 9, address: 'bc1qd7spv5q28248jl7a385kj47ypk3sphr9pv46zf', hashrate: 3433 },
    { id: 10, address: '14YK4mzJGo5NKkNnmVJeuEAQftLt795Gec', hashrate: 3254 },
    { id: 11, address: '1F34duy2eeMz5mSrvFepVzy7Y1rBsnAyWC', hashrate: 3132 },
    { id: 12, address: 'bc1qlkgzrh9adnk42tkr0akfz5f99wqta0jt6cmsq3', hashrate: 3021 },
    { id: 13, address: '1Nh7uHdvY6fNwtQtM1G5EZAFPLC33B59rB', hashrate: 2987 },
    { id: 14, address: '1LagHJk2FyCV2VzrNHVqg3gYG4TSYwDV4m', hashrate: 2932 },
    { id: 15, address: '1BW18n7MfpU35q4MTBSk8pse3XzQF8XvzT', hashrate: 2876 },
    { id: 16, address: '1Bfe4RpGfd3xseATv3X3WagYUy7dWnW8uF', hashrate: 2765 },
    { id: 17, address: '1NH2Pp6Xz6UyGXXZrXNBi19k9mzD3GsK5U', hashrate: 2654 },
    { id: 18, address: '1KFHE7w8BhaENAswwryaoccDb6qcT6DbYY', hashrate: 2543 },
    { id: 19, address: '13AM4VW2dhxYgXeQepoHkHSQSfhASMn7cL', hashrate: 2432 },
    { id: 20, address: '12tkqA9xSoowkzoERHMWNKsTey55YEBqkv', hashrate: 2321 },
    { id: 21, address: '179X4rbqxKBJYfR6o7wdcxWVr1FrTMdgpT', hashrate: 2210 },
    { id: 22, address: '1AmKhQw8ySzgMnYRJPiQaAbCeGEYdCUHGj', hashrate: 2109 },
    { id: 23, address: '1HtLJJbJYGL9Q1tXCpu4kcn3NPu1fYeJKB', hashrate: 2013 },
    { id: 24, address: '1B8qNY8JXNr6rJhwQZMRxLHrZMKWgPVqcH', hashrate: 1954 },
    { id: 25, address: '13WYNBzGAJKU6QMdRPLkQRPjjzJQWJkkJK', hashrate: 1876 }
  ];
  
  useEffect(() => {
    if (chartRef.current) {
      const chart = echarts.init(chartRef.current);
      const userData = users || mockUsers;
      
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