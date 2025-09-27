'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Clock, Calendar, TrendingUp, User, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface EmployeeHistory {
  date: string;
  time: string;
  status: string;
  total_minutes: number;
}

interface Employee {
  id: number;
  name: string;
  deviceId: string;
  isInOffice: boolean;
  totalTimeToday: string;
  lastSeen: string;
}

export default function EmployeeDetail() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [history, setHistory] = useState<EmployeeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState('today');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (isAuthenticated && employeeId) {
      loadEmployeeData();
    }
  }, [isAuthenticated, authLoading, employeeId, router]);

  const loadEmployeeData = async () => {
    try {
      // Загружаем данные сотрудника
      const employeeResponse = await fetch(`http://localhost:3000/api/employees`);
      const employees = await employeeResponse.json();
      const currentEmployee = employees.find((emp: Employee) => emp.id === Number(employeeId));
      
      if (currentEmployee) {
        setEmployee(currentEmployee);
        setNewName(currentEmployee.name);
      }

      // Загружаем историю
      const historyResponse = await fetch(`http://localhost:3000/api/employee/${employeeId}/history?period=${currentPeriod}`);
      const historyData = await historyResponse.json();
      setHistory(historyData);
    } catch (error) {
      console.error('Ошибка загрузки данных сотрудника:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!employee || !newName.trim()) return;

    try {
      const response = await fetch(`http://localhost:3000/api/employees/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (response.ok) {
        setEmployee({ ...employee, name: newName.trim() });
        setEditingName(false);
      }
    } catch (error) {
      console.error('Ошибка обновления имени:', error);
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

  const getTotalTimeForPeriod = () => {
    return history.reduce((total, day) => total + day.total_minutes, 0);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}ч ${mins}м`;
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
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

  if (!employee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Сотрудник не найден</h1>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="bg-gradient-to-r from-gray-500 to-gray-600 text-white p-3 rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  👤 {employee.name}
                </h1>
                <p className="text-gray-600">ID: {employee.deviceId}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                employee.isInOffice
                  ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-300'
                  : 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-300'
              }`}>
                {employee.isInOffice ? 'В ОФИСЕ' : 'ВНЕ ОФИСА'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Employee Info Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-4 rounded-2xl">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                {editingName ? (
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="text-2xl font-bold bg-transparent border-b-2 border-blue-500 focus:outline-none focus:border-blue-600"
                      autoFocus
                    />
                    <button
                      onClick={handleUpdateName}
                      className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setNewName(employee.name);
                      }}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-bold text-gray-900">{employee.name}</h2>
                    <button
                      onClick={() => setEditingName(true)}
                      className="text-blue-500 hover:text-blue-600 transition-colors"
                    >
                      ✏️
                    </button>
                  </div>
                )}
                <p className="text-gray-600 mt-1">Последняя активность: {employee.lastSeen}</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent mb-2">
                {employee.totalTimeToday}
              </div>
              <p className="text-gray-600">Сегодня</p>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="mb-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-white/20">
            <div className="flex space-x-2">
              {['today', 'week', 'month', 'year'].map((period) => (
                <button
                  key={period}
                  onClick={() => {
                    setCurrentPeriod(period);
                    loadEmployeeData();
                  }}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-xl text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium mb-2">Общее время</p>
                <p className="text-3xl font-bold">{formatTime(getTotalTimeForPeriod())}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-xl text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium mb-2">Дней в офисе</p>
                <p className="text-3xl font-bold">{history.filter(h => h.total_minutes > 0).length}</p>
              </div>
              <Calendar className="h-8 w-8 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl shadow-xl text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium mb-2">Среднее время</p>
                <p className="text-3xl font-bold">
                  {history.length > 0 ? formatTime(Math.round(getTotalTimeForPeriod() / history.length)) : '0ч 0м'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-200" />
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <Activity className="h-6 w-6 mr-3 text-blue-600" />
              История активности
            </h3>
          </div>
          
          <div className="divide-y divide-gray-100">
            {history.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Нет данных за выбранный период</p>
              </div>
            ) : (
              history.map((day, index) => (
                <div key={index} className="p-6 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {formatDate(day.date)}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {day.date}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        {day.time}
                      </div>
                      <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                        day.status === 'В офисе'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {day.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
