'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Clock, TrendingUp, Calendar, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Employee {
  id: number;
  name: string;
  deviceId: string;
  isInOffice: boolean;
  totalTimeToday: string;
  lastSeen: string;
  targetHours?: number;
  coefficient?: number;
}

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState('today');
  const { isAuthenticated, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (isAuthenticated) {
      loadEmployees();
    }
  }, [isAuthenticated, authLoading, router]);

  const loadEmployees = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/employees');
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      // Демо данные
      setEmployees([
        {
          id: 1,
          name: 'Иван Петров',
          deviceId: 'device_001',
          isInOffice: true,
          totalTimeToday: '7:30',
          lastSeen: '2 минуты назад'
        },
        {
          id: 2,
          name: 'Мария Сидорова',
          deviceId: 'device_002',
          isInOffice: false,
          totalTimeToday: '6:15',
          lastSeen: '15 минут назад'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const inOfficeCount = employees.filter(emp => emp.isInOffice).length;
  const avgTime = '7.5';
  const totalTime = (employees.length * 7.5).toFixed(1);

  const handleLogout = () => {
    logout();
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-8">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                🏢 In Office
              </h1>
              <p className="text-gray-600 mt-1">Отслеживание присутствия сотрудников</p>
            </div>
            <div className="flex space-x-4">
              <button 
                onClick={loadEmployees}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium"
              >
                🔄 Обновить
              </button>
              <button 
                onClick={handleLogout}
                className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-3 rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center font-medium"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Выйти
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Period Selector */}
        <div className="mb-10">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-white/20">
            <div className="flex space-x-2">
              {['today', 'week', 'month', 'year'].map((period) => (
                <button
                  key={period}
                  onClick={() => setCurrentPeriod(period)}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                    currentPeriod === period
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg transform scale-105'
                      : 'text-gray-700 hover:bg-white/50 hover:shadow-md'
                  }`}
                >
                  {period === 'today' && 'Сегодня'}
                  {period === 'week' && 'Неделя'}
                  {period === 'month' && 'Месяц'}
                  {period === 'year' && 'Год'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 rounded-2xl shadow-xl text-white transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium mb-2">Всего сотрудников</p>
                <p className="text-4xl font-bold">{employees.length}</p>
              </div>
              <div className="bg-white/20 p-4 rounded-xl">
                <Users className="h-8 w-8" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 p-8 rounded-2xl shadow-xl text-white transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium mb-2">В офисе сейчас</p>
                <p className="text-4xl font-bold">{inOfficeCount}</p>
              </div>
              <div className="bg-white/20 p-4 rounded-xl">
                <Clock className="h-8 w-8" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-8 rounded-2xl shadow-xl text-white transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium mb-2">Среднее время (ч)</p>
                <p className="text-4xl font-bold">{avgTime}</p>
              </div>
              <div className="bg-white/20 p-4 rounded-xl">
                <TrendingUp className="h-8 w-8" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 rounded-2xl shadow-xl text-white transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium mb-2">Общее время (ч)</p>
                <p className="text-4xl font-bold">{totalTime}</p>
              </div>
              <div className="bg-white/20 p-4 rounded-xl">
                <Calendar className="h-8 w-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Employees List */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">👥 Сотрудники</h2>
            <p className="text-gray-600">Нажмите на карточку для просмотра истории</p>
          </div>
          
          <div className="divide-y divide-gray-100">
            {employees.map((employee) => (
              <div 
                key={employee.id} 
                onClick={() => router.push(`/employee/${employee.id}`)}
                className="p-8 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 cursor-pointer transition-all duration-300 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                      {employee.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-1">ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{employee.deviceId}</span></p>
                    <p className="text-sm text-gray-500">Последняя активность: {employee.lastSeen}</p>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-3xl font-bold bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent mb-2">
                      {employee.totalTimeToday}
                    </div>
                    {employee.coefficient !== undefined && (
                      <div className={`text-lg font-bold mb-2 ${
                        employee.coefficient >= 100 ? 'text-green-600' : 
                        employee.coefficient >= 80 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {employee.coefficient}%
                      </div>
                    )}
                    <div className={`inline-flex px-4 py-2 rounded-full text-sm font-bold ${
                      employee.isInOffice
                        ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-300'
                        : 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-300'
                    }`}>
                      {employee.isInOffice ? 'В ОФИСЕ' : 'ВНЕ ОФИСА'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export Section */}
        <div className="mt-10 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📊 Экспорт данных</h2>
          <div className="flex flex-wrap gap-4">
            <button className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 font-semibold text-lg">
              📈 Excel
            </button>
            <button className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 font-semibold text-lg">
              📄 CSV
            </button>
            <button className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 font-semibold text-lg">
              📋 Отчет
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}