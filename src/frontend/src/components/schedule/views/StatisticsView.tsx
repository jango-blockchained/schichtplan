import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Schedule, Employee } from "@/types";
import { format, addDays } from "date-fns";
import { de } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface StatisticsViewProps {
  schedules: Schedule[];
  employees: Employee[];
  dateRange: { from: Date; to: Date } | undefined;
}

export function StatisticsView({ schedules, employees, dateRange }: StatisticsViewProps) {
  const [activeTab, setActiveTab] = useState<string>("schedule");

  if (!dateRange?.from || !dateRange?.to || schedules.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            No data available for the selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  // Schedule Statistics Data
  const scheduleStats = calculateScheduleStats(schedules);
  
  // Employee Statistics Data
  const employeeStats = calculateEmployeeStats(schedules, employees);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="schedule">Schedule Statistics</TabsTrigger>
            <TabsTrigger value="employees">Employee Statistics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="schedule" className="space-y-4">
            <ScheduleStatisticsContent stats={scheduleStats} />
          </TabsContent>
          
          <TabsContent value="employees" className="space-y-4">
            <EmployeeStatisticsContent stats={employeeStats} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Schedule Statistics Content Component
function ScheduleStatisticsContent({ stats }: { stats: any }) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Distribution by Day</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.byDay}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="shifts" fill="#8884d8" name="Number of Shifts" />
            <Bar dataKey="hours" fill="#82ca9d" name="Total Hours" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">Distribution by Shift Type</h3>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="w-full lg:w-1/2">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.byType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {stats.byType.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color || `#${Math.floor(Math.random()*16777215).toString(16)}`} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="w-full lg:w-1/2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stats.byType.map((type: any) => (
                <div key={type.name} className="flex items-center p-2 border rounded">
                  <div className="w-4 h-4 mr-2" style={{ backgroundColor: type.color }} />
                  <span className="flex-1">{type.name}</span>
                  <span className="font-semibold">{type.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Employee Statistics Content Component
function EmployeeStatisticsContent({ stats }: { stats: any }) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Hours by Employee</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={stats.employeeHours} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={150} />
            <Tooltip />
            <Legend />
            <Bar dataKey="hours" fill="#8884d8" name="Total Hours" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">Shift Count by Employee</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={stats.employeeShifts} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={150} />
            <Tooltip />
            <Legend />
            <Bar dataKey="shifts" fill="#82ca9d" name="Number of Shifts" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Utility function to calculate schedule statistics
function calculateScheduleStats(schedules: Schedule[]) {
  // By day calculation
  const byDay = [0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
    const daySchedules = schedules.filter(s => {
      const date = new Date(s.date);
      return date.getDay() === dayIndex;
    });
    
    const totalHours = daySchedules.reduce((sum, s) => {
      if (s.shift_start && s.shift_end) {
        // Simple hour calculation for example purposes
        const hours = 8; // Simplified calculation
        return sum + hours;
      }
      return sum;
    }, 0);
    
    return {
      name: format(new Date(2023, 0, 1 + dayIndex), 'EEEE', { locale: de }),
      shifts: daySchedules.length,
      hours: totalHours
    };
  });
  
  // By type calculation
  const typeCount: Record<string, { count: number, color: string }> = {};
  
  schedules.forEach(s => {
    const type = s.shift_type_id || 'Unknown';
    if (!typeCount[type]) {
      typeCount[type] = { count: 0, color: getRandomColor(type) };
    }
    typeCount[type].count++;
  });
  
  const byType = Object.entries(typeCount).map(([name, data]) => ({
    name,
    value: data.count,
    color: data.color
  }));
  
  return { byDay, byType };
}

// Utility function to calculate employee statistics
function calculateEmployeeStats(schedules: Schedule[], employees: Employee[]) {
  const employeeData: Record<number, { name: string, hours: number, shifts: number }> = {};
  
  // Initialize with all employees
  employees.forEach(e => {
    employeeData[e.id] = {
      name: `${e.last_name}, ${e.first_name}`,
      hours: 0,
      shifts: 0
    };
  });
  
  // Calculate statistics
  schedules.forEach(s => {
    if (!s.employee_id || !employeeData[s.employee_id]) return;
    
    employeeData[s.employee_id].shifts++;
    
    if (s.shift_start && s.shift_end) {
      // Simple hour calculation for example purposes
      const hours = 8; // Simplified calculation
      employeeData[s.employee_id].hours += hours;
    }
  });
  
  // Convert to arrays for charts
  const employeeHours = Object.values(employeeData)
    .filter(e => e.hours > 0)
    .sort((a, b) => b.hours - a.hours);
    
  const employeeShifts = Object.values(employeeData)
    .filter(e => e.shifts > 0)
    .sort((a, b) => b.shifts - a.shifts);
  
  return { employeeHours, employeeShifts };
}

// Helper function to get a deterministic color based on string
function getRandomColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const c = (hash & 0x00FFFFFF)
    .toString(16)
    .toUpperCase()
    .padStart(6, '0');
    
  return "#" + c;
} 