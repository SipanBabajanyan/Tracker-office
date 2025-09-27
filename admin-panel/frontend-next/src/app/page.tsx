'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Clock, TrendingUp, Calendar, LogOut } from 'lucide-react';

interface Employee {
  id: number;
  name: string;
  deviceId: string;
  isInOffice: boolean;
  totalTimeToday: string;
  lastSeen: string;
}

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState('today');
  const router = useRouter();

  useEffect(() => {
    // Проверяем авторизацию
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    loadEmployees();
  }, [router]);

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
    localStorage.removeItem('isAuthenticated');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🏢 In Office</h1>
              <p className="text-gray-600">Отслеживание присутствия сотрудников</p>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={loadEmployees}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Обновить
              </button>
              <button 
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center"
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
        <div className="mb-8">
          <div className="flex space-x-2">
            {['today', 'week', 'month', 'year'].map((period) => (
              <button
                key={period}
                onClick={() => setCurrentPeriod(period)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPeriod === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border'
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Всего сотрудников</p>
                <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">В офисе сейчас</p>
                <p className="text-2xl font-bold text-gray-900">{inOfficeCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Среднее время (ч)</p>
                <p className="text-2xl font-bold text-gray-900">{avgTime}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Общее время (ч)</p>
                <p className="text-2xl font-bold text-gray-900">{totalTime}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Employees List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">👥 Сотрудники</h2>
            <p className="text-sm text-gray-600">Нажмите на карточку для просмотра истории</p>
          </div>
          
          <div className="divide-y">
            {employees.map((employee) => (
              <div key={employee.id} className="p-6 hover:bg-gray-50 cursor-pointer transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">{employee.name}</h3>
                    <p className="text-sm text-gray-600">ID: {employee.deviceId}</p>
                    <p className="text-sm text-gray-500">Последняя активность: {employee.lastSeen}</p>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {employee.totalTimeToday}
                    </div>
                    <div className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      employee.isInOffice
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
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
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Экспорт данных</h2>
          <div className="flex space-x-4">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              📈 Excel
            </button>
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              📄 CSV
            </button>
            <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              📋 Отчет
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}