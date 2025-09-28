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
  targetTime: string;
  coefficient: number;
  timeDiff: string;
  timeDiffMinutes: number;
}

interface EmployeeCoefficients {
  targetHours: number;
  targetMinutes: number;
  totalTargetMinutes: number; // Общее целевое время за период
  avgMinutes: number;
  totalMinutes: number;
  daysCount: number;
  avgCoefficient: number;
  totalCoefficient: number;
  avgTimeDiff: number;
  totalTimeDiff: number; // Разница времени за весь период
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
  const [coefficients, setCoefficients] = useState<EmployeeCoefficients | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState('today');
  const [editingName, setEditingName] = useState(false);
  const [editingTargetHours, setEditingTargetHours] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTargetHours, setNewTargetHours] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(30);
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

  const loadEmployeeData = async (period?: string) => {
    const targetPeriod = period || currentPeriod;
    
    try {
      setLoading(true);
      
      console.log(`🔄 Начинаем загрузку данных для периода: ${targetPeriod}`);
      
      // Загружаем данные сотрудника
      const employeeResponse = await fetch(`http://localhost:3000/api/employees`);
      const employees = await employeeResponse.json();
      const currentEmployee = employees.find((emp: Employee) => emp.id === Number(employeeId));
      
      if (currentEmployee) {
        setEmployee(currentEmployee);
        setNewName(currentEmployee.name);
      }

      // Загружаем историю и коэффициенты параллельно
      const [historyResponse, coefficientsResponse] = await Promise.all([
        fetch(`http://localhost:3000/api/employee/${employeeId}/history?period=${targetPeriod}`),
        fetch(`http://localhost:3000/api/employee/${employeeId}/coefficients?period=${targetPeriod}`)
      ]);

      const historyData = await historyResponse.json();
      const coefficientsData = await coefficientsResponse.json();
      
      setHistory(historyData);
      setCoefficients(coefficientsData);
      setNewTargetHours(coefficientsData.targetHours);
      
      console.log(`✅ Данные загружены для периода: ${targetPeriod}`, { 
        historyCount: historyData.length, 
        coefficients: coefficientsData 
      });
    } catch (error) {
      console.error('❌ Ошибка загрузки данных сотрудника:', error);
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

  const handleUpdateTargetHours = async () => {
    if (!employee || newTargetHours < 0 || newTargetHours > 24) return;

    try {
      const response = await fetch(`http://localhost:3000/api/employee/${employee.id}/target-hours`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetHours: newTargetHours }),
      });

      if (response.ok) {
        setEditingTargetHours(false);
        loadEmployeeData(); // Перезагружаем данные для обновления коэффициентов
      }
    } catch (error) {
      console.error('Ошибка обновления целевых часов:', error);
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
    if (!Array.isArray(history)) return 0;
    return history.reduce((total, day) => total + (day.total_minutes || 0), 0);
  };

  const formatTime = (minutes: number) => {
    if (isNaN(minutes) || minutes === undefined || minutes === null) {
      return '0ч 0м';
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}ч ${mins}м`;
  };

  const formatTimeDiff = (minutes: number) => {
    if (isNaN(minutes) || minutes === undefined || minutes === null) {
      return '0:00';
    }
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '+';
    return `${sign}${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // Пагинация
  const getPaginatedHistory = () => {
    if (!Array.isArray(history)) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return history.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    if (!Array.isArray(history)) return 0;
    return Math.ceil(history.length / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Простая функция смены периода
  const handlePeriodChange = (period: string) => {
    if (currentPeriod === period) return;
    
    console.log(`🔄 Смена периода с ${currentPeriod} на ${period}`);
    setCurrentPeriod(period);
    setCurrentPage(1);
    loadEmployeeData(period);
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
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'today', label: 'Сегодня' },
                { key: 'week', label: 'Неделя' },
                { key: 'month', label: 'Месяц' },
                { key: 'quarter', label: 'Квартал' },
                { key: '6months', label: '6 месяцев' },
                { key: 'year', label: 'Год' },
                { key: 'alltime', label: 'Все время' }
              ].map((period) => (
                <button
                  key={period.key}
                  onClick={() => handlePeriodChange(period.key)}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-sm ${
                    currentPeriod === period.key
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg transform scale-105'
                      : 'text-gray-700 hover:bg-white/50 hover:shadow-md'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
        </div>


        {/* Coefficients Cards */}
        {coefficients && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Коэффициент</p>
                  <p className={`text-3xl font-bold ${
                    coefficients.avgCoefficient >= 120 ? 'text-green-800' :
                    coefficients.avgCoefficient >= 100 ? 'text-green-600' : 
                    coefficients.avgCoefficient >= 90 ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {coefficients.avgCoefficient}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-gray-400" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Целевые часы</p>
                  <p className="text-3xl font-bold text-gray-900">{formatTime(coefficients.totalTargetMinutes)}</p>
                </div>
                <Clock className="h-8 w-8 text-gray-400" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Разница времени (в среднем)</p>
                  <p className={`text-3xl font-bold ${coefficients.avgTimeDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {coefficients.avgTimeDiff >= 0 ? '+' : ''}{formatTime(Math.abs(coefficients.avgTimeDiff || 0))}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-gray-400" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-2">Разница за период (общая)</p>
                  <p className={`text-3xl font-bold ${coefficients.totalTimeDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {coefficients.totalTimeDiff >= 0 ? '+' : ''}{formatTime(Math.abs(coefficients.totalTimeDiff))}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-gray-400" />
              </div>
            </div>
          </div>
        )}

        {/* Target Hours Settings */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">🎯 Настройки целевых часов</h3>
              <p className="text-gray-600">Установите количество часов, которое сотрудник должен проводить в офисе ежедневно</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {editingTargetHours ? (
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={newTargetHours}
                    onChange={(e) => setNewTargetHours(Number(e.target.value))}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-600">часов</span>
                  <button
                    onClick={handleUpdateTargetHours}
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setEditingTargetHours(false);
                      setNewTargetHours(coefficients?.targetHours || 8);
                    }}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <span className="text-2xl font-bold text-gray-900">{coefficients?.targetHours || 8} часов</span>
                  <button
                    onClick={() => setEditingTargetHours(true)}
                    className="text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    ✏️
                  </button>
                </div>
              )}
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
                  
                  {history.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Нет данных за выбранный период</p>
                    </div>
                  ) : (
                    <>
                      {/* Table Header */}
                      <div className="bg-gray-50 px-8 py-4 border-b border-gray-200">
                        <div className="grid grid-cols-5 gap-0 text-sm font-semibold text-gray-700">
                          <div>Дата</div>
                          <div className="text-right">Время</div>
                          <div className="text-right">Коэффициент</div>
                          <div className="text-right">Разница</div>
                          <div className="text-right">Статус</div>
                        </div>
                      </div>
                      
                      {/* Table Body */}
                      <div className="divide-y divide-gray-100">
                        {getPaginatedHistory().map((day, index) => (
                          <div key={index} className="px-8 py-4 hover:bg-gray-50 transition-colors">
                            <div className="grid grid-cols-5 gap-0 items-center">
                              {/* Дата */}
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {formatDate(day.date)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {day.date}
                                </div>
                              </div>
                              
                              {/* Время (справа) */}
                              <div className="text-right">
                                <div className="text-lg font-bold text-gray-900">
                                  {day.time}
                                </div>
                                <div className="text-sm text-gray-500">
                                  из {day.targetTime}
                                </div>
                              </div>
                              
                              {/* Коэффициент (справа) */}
                              <div className={`text-lg font-bold text-right ${
                                day.coefficient >= 120 ? 'text-green-800' :
                                day.coefficient >= 100 ? 'text-green-600' : 
                                day.coefficient >= 90 ? 'text-orange-600' : 'text-red-600'
                              }`}>
                                {day.coefficient}%
                              </div>
                              
                              {/* Разница (справа) */}
                              <div className={`text-lg font-bold text-right ${
                                day.timeDiffMinutes >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatTimeDiff(day.timeDiffMinutes)}
                              </div>
                              
                              {/* Статус (справа) */}
                              <div className="text-right">
                                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                                  day.status === 'В офисе'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {day.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Пагинация */}
                      {getTotalPages() > 1 && (
                        <div className="p-6 bg-gray-50 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                              Показано {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, history.length)} из {history.length} записей
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                ← Назад
                              </button>
                              
                              {Array.from({ length: getTotalPages() }, (_, i) => i + 1).map((page) => (
                                <button
                                  key={page}
                                  onClick={() => handlePageChange(page)}
                                  className={`px-3 py-2 text-sm font-medium rounded-lg ${
                                    currentPage === page
                                      ? 'bg-blue-500 text-white'
                                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              ))}
                              
                              <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === getTotalPages()}
                                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Вперед →
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
      </div>
    </div>
  );
}
