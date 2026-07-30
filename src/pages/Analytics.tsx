import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsers, getClients, getEnhancedTasks } from "@/lib/api-utils";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, subMonths, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { enUS } from "date-fns/locale";
import { CalendarIcon, CheckCircle2, Clock, AlertCircle, BarChart3, Users, Calendar as CalendarIconFull } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "@/components/UserAvatar";
import { Task, User, Client } from "@/lib/types";

type DateRange = 'all' | 'today' | 'week' | 'month';
type FilterState = {
  dateRange: DateRange;
  clientId: string | null;
  status: string | null;
  assigneeId: string | null;
  customDateFrom: Date | null;
  customDateTo: Date | null;
};

const Analytics = () => {
  const { user, token } = useAuth();
  // No tabs anymore, all content is displayed in a single view
  const [filters, setFilters] = useState<FilterState>({
    dateRange: 'all',
    clientId: null,
    status: null,
    assigneeId: null,
    customDateFrom: null,
    customDateTo: null
  });

  // Fetch data
  const { data: allTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["enhanced-tasks"],
    queryFn: () => getEnhancedTasks(token),
    enabled: !!token
  });
  
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(token),
    enabled: !!token
  });
  
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => getClients(token),
    enabled: !!token
  });
  
  // Apply filters to tasks
  const filteredTasks = allTasks.filter((task: Task) => {
    // Date filter
    if (filters.dateRange !== 'all' || filters.customDateFrom || filters.customDateTo) {
      const taskDate = task.updatedAt ? new Date(task.updatedAt) : new Date(task.createdAt);
      
      if (filters.customDateFrom && filters.customDateTo) {
        // Custom date range
        if (!isWithinInterval(taskDate, {
          start: startOfDay(filters.customDateFrom),
          end: endOfDay(filters.customDateTo)
        })) {
          return false;
        }
      } else {
        // Predefined date ranges
        const now = new Date();
        let start: Date, end: Date;
        
        switch (filters.dateRange) {
          case 'today':
            start = startOfDay(now);
            end = endOfDay(now);
            break;
          case 'week':
                    start = startOfWeek(now, { locale: enUS });
        end = endOfWeek(now, { locale: enUS });
            break;
          case 'month':
            start = startOfMonth(now);
            end = endOfMonth(now);
            break;
          default:
            start = new Date(0); // Beginning of time
            end = now;
        }
        
        if (!isWithinInterval(taskDate, { start, end })) {
          return false;
        }
      }
    }
    
    // Client filter
    if (filters.clientId && task.clientId !== filters.clientId) {
      return false;
    }
    
    // Status filter
    if (filters.status && task.status !== filters.status) {
      return false;
    }
    
    // Assignee filter
    if (filters.assigneeId && (!task.assigneeIds || !task.assigneeIds.includes(filters.assigneeId))) {
      return false;
    }
    
    return true;
  });
  
  // Calculate task statistics
  const taskStats = {
    total: filteredTasks.length,
    completed: filteredTasks.filter(task => task.status === 'completed').length,
    inProgress: filteredTasks.filter(task => task.status === 'in-progress').length,
    underReview: filteredTasks.filter(task => task.status === 'under-review').length,
    draft: filteredTasks.filter(task => task.status === 'draft').length,
    canceled: filteredTasks.filter(task => task.status === 'canceled').length,
    overdue: filteredTasks.filter(task => {
      if (!task.dueDate) return false;
      return new Date(task.dueDate) < new Date() && task.status !== 'completed';
    }).length
  };
  
  // Calculate employee efficiency
  const employeeStats = users.map(user => {
    const userTasks = filteredTasks.filter(task => 
      task.assigneeIds && task.assigneeIds.includes(user.id)
    );
    
    const completedTasks = userTasks.filter(task => task.status === 'completed');
    const overdueTasks = userTasks.filter(task => {
      if (!task.dueDate) return false;
      return new Date(task.dueDate) < new Date() && task.status !== 'completed';
    });
    
    return {
      user,
      totalTasks: userTasks.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      completionRate: userTasks.length > 0 ? (completedTasks.length / userTasks.length) * 100 : 0
    };
  }).sort((a, b) => b.completedTasks - a.completedTasks);
  
  if (tasksLoading || usersLoading || clientsLoading) {
    return (
      <MainLayout title="Analytics">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </MainLayout>
    );
  }
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin';
  
  // If not admin, show limited analytics
  if (!isAdmin) {
    return (
      <MainLayout title="Analytics">
        <div className="container mx-auto py-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                                  <CardTitle>Total Tasks</CardTitle>
                  <CardDescription>Total number of tasks in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{taskStats.total}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Completed</CardTitle>
                <CardDescription>Tasks with "Completed" status</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{taskStats.completed}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>In Progress</CardTitle>
                <CardDescription>Tasks with "In Progress" status</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{taskStats.inProgress}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }
  
  return (
    <MainLayout title="Analytics">
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Date Range Filter */}
              <div>
                <Select
                  value={filters.dateRange}
                  onValueChange={(value) => setFilters({...filters, dateRange: value as DateRange})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This week</SelectItem>
                    <SelectItem value="month">This month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Custom Date Range */}
              <div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal truncate"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {filters.customDateFrom && filters.customDateTo
                          ? `${format(filters.customDateFrom, 'dd.MM.yyyy')} - ${format(filters.customDateTo, 'dd.MM.yyyy')}`
                          : "Select dates"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{
                        from: filters.customDateFrom || undefined,
                        to: filters.customDateTo || undefined,
                      }}
                      onSelect={(range) => {
                        setFilters({
                          ...filters,
                          customDateFrom: range?.from || null,
                          customDateTo: range?.to || null,
                          dateRange: range?.from ? 'all' : filters.dateRange
                        });
                      }}
                      locale={enUS}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Client Filter */}
              <div>
                <Select
                  value={filters.clientId || "all"}
                  onValueChange={(value) => setFilters({...filters, clientId: value === "all" ? null : value})}
                >
                  <SelectTrigger>
                                      <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                    {clients.map((client: Client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Status Filter */}
              <div>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(value) => setFilters({...filters, status: value === "all" ? null : value})}
                >
                  <SelectTrigger>
                                      <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="review">Under Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Assignee Filter */}
              <div>
                <Select
                  value={filters.assigneeId || "all"}
                  onValueChange={(value) => setFilters({...filters, assigneeId: value === "all" ? null : value})}
                >
                  <SelectTrigger>
                                      <SelectValue placeholder="All assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignees</SelectItem>
                    {users.map((user: User) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setFilters({
                  dateRange: 'all',
                  clientId: null,
                  status: null,
                  assigneeId: null,
                  customDateFrom: null,
                  customDateTo: null
                })}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Task Report</h2>
          </div>
        </div>
          
          <div className="space-y-6">
            {/* Task Summary Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Total Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-3xl font-bold">{taskStats.total}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="bg-green-100 p-2 rounded-full">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold">{taskStats.completed}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {taskStats.total > 0 ? 
                      `${Math.round((taskStats.completed / taskStats.total) * 100)}% of total` : 
                      '0% of total'}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">In Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-3xl font-bold">{taskStats.inProgress + taskStats.underReview}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {taskStats.total > 0 ? 
                      `${Math.round(((taskStats.inProgress + taskStats.underReview) / taskStats.total) * 100)}% of total` : 
                      '0% of total'}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="bg-red-100 p-2 rounded-full">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="text-3xl font-bold">{taskStats.overdue}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {taskStats.total > 0 ? 
                      `${Math.round((taskStats.overdue / taskStats.total) * 100)}% of total` : 
                      '0% of total'}
                  </p>
                </CardContent>
              </Card>
            </div>
            
            {/* Task Status Distribution */}
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                        <span>Draft</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{taskStats.draft}</span>
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gray-300 rounded-full" 
                            style={{ width: `${taskStats.total > 0 ? (taskStats.draft / taskStats.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span>In Progress</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{taskStats.inProgress}</span>
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full" 
                            style={{ width: `${taskStats.total > 0 ? (taskStats.inProgress / taskStats.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span>Under Review</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{taskStats.underReview}</span>
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-yellow-500 rounded-full" 
                            style={{ width: `${taskStats.total > 0 ? (taskStats.underReview / taskStats.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>Completed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{taskStats.completed}</span>
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full" 
                            style={{ width: `${taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span>Canceled</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{taskStats.canceled}</span>
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-red-500 rounded-full" 
                            style={{ width: `${taskStats.total > 0 ? (taskStats.canceled / taskStats.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Overdue Tasks</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[300px] overflow-y-auto">
                  {filteredTasks.filter(task => {
                    if (!task.dueDate) return false;
                    return new Date(task.dueDate) < new Date() && task.status !== 'completed';
                  }).length > 0 ? (
                    <div className="space-y-2">
                      {filteredTasks.filter(task => {
                        if (!task.dueDate) return false;
                        return new Date(task.dueDate) < new Date() && task.status !== 'completed';
                      }).map(task => (
                        <div key={task.id} className="p-2 border rounded-md">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{task.title}</p>
                              <p className="text-xs text-muted-foreground">
                                Due: {format(new Date(task.dueDate), "dd.MM.yyyy")}
                              </p>
                            </div>
                            <Badge variant="destructive">Overdue</Badge>
                          </div>
                          {task.assignees && task.assignees.length > 0 && (
                            <div className="flex mt-2">
                              {task.assignees.slice(0, 3).map((assignee, index) => (
                                assignee && <UserAvatar key={`assignee-${task.id}-${index}`} user={assignee} size="sm" />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No overdue tasks</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Employee Efficiency Section */}
            <Card>
              <CardHeader>
                <CardTitle>Employee Efficiency</CardTitle>
                <CardDescription>
                  Statistics on completed tasks and efficiency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {employeeStats.length > 0 ? (
                    employeeStats.map((stat, index) => (
                      <div key={stat.user?.id || index} className="flex flex-col p-3 border rounded-md">
                        <div className="flex items-center gap-3 mb-3">
                          {stat.user && <UserAvatar user={stat.user} />}
                          <div>
                            <p className="font-medium">{stat.user?.name || 'Unknown User'}</p>
                            <p className="text-sm text-muted-foreground">{stat.user?.email || 'No email'}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 sm:gap-4">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Total Tasks</p>
                            <p className="font-bold">{stat.totalTasks}</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Completed</p>
                            <p className="font-bold">{stat.completedTasks}</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Efficiency</p>
                            <div className="flex items-center justify-center gap-1">
                              <p className="font-bold">{Math.round(stat.completionRate)}%</p>
                              <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full",
                                    stat.completionRate >= 70 ? "bg-green-500" :
                                    stat.completionRate >= 40 ? "bg-yellow-500" :
                                    "bg-red-500"
                                  )}
                                  style={{ width: `${stat.completionRate}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No employee data</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
      </div>
    </MainLayout>
  );
};

export default Analytics;
