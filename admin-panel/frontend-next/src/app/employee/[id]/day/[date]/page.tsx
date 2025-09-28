'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Clock, Calendar, User, Activity, Play, Pause, CheckCircle, XCircle } from 'lucide-react';

interface Session {
  id: number;
  startTime: string;
  endTime: string | null;
  startTimeFormatted: string;
  endTimeFormatted: string;
  duration: number;
  durationFormatted: string;
  isActive: boolean;
}

interface DayData {
  date: string;
  sessions: Session[];
  totalMinutes: number;
  totalTimeFormatted: string;
  isInOffice: boolean;
  sessionsCount: number;
}

export default function DayDetailPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;
  const date = params.date as string;
  
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [employeeName, setEmployeeName] = useState<string>('Загрузка...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEmployeeName();
    loadDayData();
  }, [employeeId, date]);

  const loadEmployeeName = async () => {
    try {
      const response = await fetch(`http://192.168.15.20:3000/api/employees`);
      if (response.ok) {
        const employees = await response.json();
        const employee = employees.find((emp: any) => emp.id === parseInt(employeeId));
        if (employee) {
          setEmployeeName(employee.name);
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки имени сотрудника:', err);
    }
  };

  const loadDayData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://192.168.15.20:3000/api/employee/${employeeId}/day/${date}`);
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки данных дня');
      }
      
      const data = await response.json();
      setDayData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPreviousDay = () => {
    const currentDate = new Date(date);
    currentDate.setDate(currentDate.getDate() - 1);
    return currentDate.toISOString().split('T')[0];
  };

  const getNextDay = () => {
    const currentDate = new Date(date);
    currentDate.setDate(currentDate.getDate() + 1);
    return currentDate.toISOString().split('T')[0];
  };

  const navigateToDay = (newDate: string) => {
    router.push(`/employee/${employeeId}/day/${newDate}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка данных дня...</p>
        </div>
      </div>
    );
  }

  if (error || !dayData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || 'Данные не найдены'}</p>
          <button
            onClick={() => router.back()}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header - такой же как на странице сотрудника */}
      <div className="bg-white/90 backdrop-blur-xl shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/employee/${employeeId}`)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к сотруднику
              </button>
            </div>
            
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                {employeeName}
              </h1>
            </div>
            
            <div className="w-32"></div> {/* Spacer для центрирования */}
          </div>
        </div>
      </div>

      {/* Hero Section - центральный блок с датой */}
      <div className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-center mb-4">
                <Calendar className="h-8 w-8 mr-4 text-blue-600" />
                {formatDate(dayData.date)}
              </h2>
              <p className="text-lg text-gray-600 mb-8">Детальная история дня</p>
              
              {/* Navigation buttons */}
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => navigateToDay(getPreviousDay())}
                  className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Предыдущий день
                </button>
                
                <button
                  onClick={() => navigateToDay(getNextDay())}
                  className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Следующий день
                  <ArrowLeft className="h-5 w-5 ml-2 rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Time */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Общее время</p>
                <p className="text-3xl font-bold text-gray-900">{dayData.totalTimeFormatted}</p>
              </div>
              <Clock className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          {/* Sessions Count */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Сессий</p>
                <p className="text-3xl font-bold text-gray-900">{dayData.sessionsCount}</p>
              </div>
              <Activity className="h-12 w-12 text-green-500" />
            </div>
          </div>

          {/* Current Status */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Статус</p>
                <p className={`text-lg font-bold ${dayData.isInOffice ? 'text-green-600' : 'text-red-600'}`}>
                  {dayData.isInOffice ? 'В офисе' : 'Вне офиса'}
                </p>
              </div>
              {dayData.isInOffice ? (
                <CheckCircle className="h-12 w-12 text-green-500" />
              ) : (
                <XCircle className="h-12 w-12 text-red-500" />
              )}
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <Activity className="h-6 w-6 mr-3 text-blue-600" />
              История сессий
            </h3>
          </div>
          
          {dayData.sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Нет данных за этот день</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {dayData.sessions.map((session, index) => (
                <div key={session.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        session.isActive 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {session.isActive ? (
                          <Play className="h-6 w-6" />
                        ) : (
                          <Pause className="h-6 w-6" />
                        )}
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-4">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Начало</p>
                            <p className="text-lg font-bold text-gray-900">{session.startTimeFormatted}</p>
                          </div>
                          
                          <div className="text-gray-400">
                            <ArrowLeft className="h-4 w-4" />
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium text-gray-600">Конец</p>
                            <p className="text-lg font-bold text-gray-900">{session.endTimeFormatted}</p>
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            Длительность: <span className="font-semibold text-gray-900">{session.durationFormatted}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                        session.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {session.isActive ? 'Активна' : 'Завершена'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
