import { useState, useEffect } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { getTasksByStatus, getEnhancedTasks, getUsers, getProjects, getClients } from "@/lib/api-utils";
import TaskCard from "@/components/TaskCard";
import { ArrowRight, CheckCircle, Clock, Layers, Calendar, Users, Building, Briefcase, AlertCircle } from "lucide-react";
import { CustomBadge } from "@/components/ui/custom-badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useAuth } from "@/contexts/AuthContext";
import { Task, Status, User } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import UserAvatar from "@/components/UserAvatar";
import { format, isToday, isThisWeek, isThisMonth, addDays } from "date-fns";
import { enUS } from "date-fns/locale";

const Dashboard = () => {
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const isMobile = useIsMobile();
  const { user, token } = useAuth();
  
  // Fetch real data using React Query
  const { 
    data: allTasks = [], 
    isLoading: tasksLoading 
  } = useQuery({
    queryKey: ["enhanced-tasks"],
    queryFn: () => getEnhancedTasks(token || ''),
    enabled: !!token
  });
  
  const { 
    data: users = [], 
    isLoading: usersLoading 
  } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(token || ''),
    enabled: !!token
  });
  
  const { 
    data: projects = [], 
    isLoading: projectsLoading 
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(token || ''),
    enabled: !!token
  });
  
  const { 
    data: clients = [], 
    isLoading: clientsLoading 
  } = useQuery({
    queryKey: ["clients"],
    queryFn: () => getClients(token || ''),
    enabled: !!token
  });
  
  const isLoading = tasksLoading || usersLoading || projectsLoading || clientsLoading;
  
  // Filter tasks based on the current user
  const myTasks = allTasks.filter((task: Task) => 
    task.assignees && task.assignees.some(assignee => assignee.id === user?.id)
  );
  
  // Filter projects assigned to the current user
  const myProjects = projects.filter(project => 
    project.assignedUserIds && project.assignedUserIds.includes(user?.id || '')
  );
  
  // Filter tasks based on period
  const filterTasksByPeriod = (tasks: Task[]) => {
    return tasks.filter((task: Task) => {
      const dueDate = new Date(task.dueDate);
      if (period === "day") return isToday(dueDate);
      if (period === "week") return isThisWeek(dueDate);
      return isThisMonth(dueDate);
    });
  };
  
  // Get tasks by status
  const getTasksByStatusMap = (tasks: Task[]) => {
    const statusMap: Record<Status, Task[]> = {
      'draft': [],
      'in-progress': [],
      'under-review': [],
      'completed': [],
      'canceled': [],
      'archived': []
    };
    
    tasks?.forEach(task => {
      if (task && task.status && statusMap[task.status]) {
        statusMap[task.status].push(task);
      }
    });
    
    return statusMap;
  };
  
  const allTasksByStatus = getTasksByStatusMap(allTasks);
  const myTasksByStatus = getTasksByStatusMap(myTasks);
  
  // Get the total count per status for the pie chart
  const getStatusCounts = (tasksByStatus: Record<Status, Task[]>) => {
    return [
      { name: "Draft", value: tasksByStatus.draft.length, color: "#E2E8F0" },
      { name: "In Progress", value: tasksByStatus["in-progress"].length, color: "#93C5FD" },
      { name: "Under Review", value: tasksByStatus["under-review"].length, color: "#FDE68A" },
      { name: "Completed", value: tasksByStatus.completed.length, color: "#86EFAC" },
      { name: "Canceled", value: tasksByStatus.canceled.length, color: "#FECACA" }
    ];
  };
  
  const allStatusCounts = getStatusCounts(allTasksByStatus);
  const myStatusCounts = getStatusCounts(myTasksByStatus);
  
  // Get recent tasks
  const getRecentTasks = (tasks: Task[]) => {
    return [...tasks]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3);
  };
  
  const recentTasks = getRecentTasks(myTasks);
  
  // Get upcoming deadlines
  const getUpcomingDeadlines = (tasks: Task[]) => {
    const today = new Date();
    return [...tasks]
      .filter(task => 
        new Date(task.dueDate) > today && 
        task.status !== "completed" && 
        task.status !== "canceled"
      )
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 3);
  };
  
  const upcomingDeadlines = getUpcomingDeadlines(myTasks);
  
  // Get overdue tasks
  const getOverdueTasks = (tasks: Task[]) => {
    const today = new Date();
    return [...tasks]
      .filter(task => 
        new Date(task.dueDate) < today && 
        task.status !== "completed" && 
        task.status !== "canceled"
      )
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  };
  
  const overdueTasks = getOverdueTasks(myTasks);
  
  // Get task completion rate
  const getCompletionRate = (tasks: Task[]) => {
    if (tasks.length === 0) return 0;
    const completedCount = tasks.filter(task => task.status === "completed").length;
    return Math.round((completedCount / tasks.length) * 100);
  };
  
  const myCompletionRate = getCompletionRate(myTasks);
  
  // Get weekly task data for bar chart
  const getWeeklyTaskData = () => {
    const today = new Date();
    const weekData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = addDays(today, -i);
      const dayName = format(date, 'EEE', { locale: enUS });
      
      const tasksForDay = myTasks.filter(task => {
        const taskDate = new Date(task.createdAt);
        return taskDate.getDate() === date.getDate() && 
               taskDate.getMonth() === date.getMonth() && 
               taskDate.getFullYear() === date.getFullYear();
      });
      
      const completedForDay = tasksForDay.filter(task => task.status === "completed").length;
      
      weekData.push({
        name: dayName,
        Tasks: tasksForDay.length,
        Completed: completedForDay
      });
    }
    
    return weekData;
  };
  
  const weeklyTaskData = getWeeklyTaskData();
  
  // Get projects I'm involved in
  const getMyProjects = () => {
    return projects.filter(project => {
      const projectTasks = allTasks.filter(task => task.projectId === project.id);
      return projectTasks.some(task => 
        task.assignees && task.assignees.some(assignee => assignee.id === user?.id)
      );
    });
  };
  
  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome, Hussain!
            </p>
          </div>
          
          <div className="flex border rounded-md overflow-hidden">
            <Button 
              variant={period === "day" ? "default" : "ghost"} 
              className="rounded-none"
              onClick={() => setPeriod("day")}
            >
              Day
            </Button>
            <Button 
              variant={period === "week" ? "default" : "ghost"} 
              className="rounded-none"
              onClick={() => setPeriod("week")}
            >
              Week
            </Button>
            <Button 
              variant={period === "month" ? "default" : "ghost"} 
              className="rounded-none"
              onClick={() => setPeriod("month")}
            >
              Month
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base md:text-lg font-semibold">My Tasks</CardTitle>
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Layers className="w-4 h-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl md:text-3xl font-bold">{myTasks.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total tasks</p>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base md:text-lg font-semibold">In Progress</CardTitle>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl md:text-3xl font-bold">{myTasksByStatus["in-progress"].length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Current tasks</p>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base md:text-lg font-semibold">Completed</CardTitle>
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl md:text-3xl font-bold">{myTasksByStatus.completed.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Completed tasks</p>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base md:text-lg font-semibold">Projects</CardTitle>
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl md:text-3xl font-bold">{myProjects.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Active projects</p>
                </CardContent>
              </Card>
            </div>
            
            {/* Second row - Completion rate and Overdue tasks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">Efficiency</CardTitle>
                  <CardDescription>Task completion percentage</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-6">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="10"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={myCompletionRate > 75 ? "#86efac" : myCompletionRate > 50 ? "#fde68a" : "#fecaca"}
                        strokeWidth="10"
                        strokeDasharray={`${myCompletionRate * 2.51} 251`}
                        strokeDashoffset="0"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold">{myCompletionRate}%</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    You completed {myTasksByStatus.completed.length} out of {myTasks.length} tasks
                  </p>
                </CardContent>
              </Card>
              
              <Card className="shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Overdue Tasks</CardTitle>
                    <CardDescription>Require your attention</CardDescription>
                  </div>
                  {overdueTasks.length > 0 && (
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overdueTasks.slice(0, 3).map(task => (
                      <div key={task.id} className="flex items-start space-x-3 border-b pb-3 last:border-0">
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-medium line-clamp-1">{task.title}</p>
                            <CustomBadge variant="destructive" className="text-[10px] ml-2">
                              Overdue
                            </CustomBadge>
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {format(new Date(task.dueDate), "dd MMM yyyy", { locale: enUS })}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {overdueTasks.length === 0 && (
                      <div className="text-center py-6">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <p className="text-muted-foreground">You have no overdue tasks</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Status chart */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">My Tasks</CardTitle>
                  <CardDescription>Distribution by status</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px]">
                  {myTasks.length > 0 ? (
                    <ChartContainer 
                      config={{
                        draft: { theme: { light: "#E2E8F0", dark: "#E2E8F0" }, label: "Draft" },
                        "in-progress": { theme: { light: "#93C5FD", dark: "#93C5FD" }, label: "In Progress" },
                        "under-review": { theme: { light: "#FDE68A", dark: "#FDE68A" }, label: "Under Review" },
                        completed: { theme: { light: "#86EFAC", dark: "#86EFAC" }, label: "Completed" },
                        canceled: { theme: { light: "#FECACA", dark: "#FECACA" }, label: "Canceled" },
                      }}
                      className="w-full h-full flex justify-center items-center"
                    >
                      <PieChart>
                        <Pie
                          data={myStatusCounts}
                          cx="50%"
                          cy="50%"
                          innerRadius={isMobile ? 40 : 60}
                          outerRadius={isMobile ? 70 : 90}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                        >
                          {myStatusCounts.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltipContent />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-muted-foreground">No data to display</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Weekly activity chart */}
              <Card className="shadow-sm lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">Weekly Activity</CardTitle>
                  <CardDescription>Created and completed tasks</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={weeklyTaskData}
                      margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                    >
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Tasks" fill="#93C5FD" />
                      <Bar dataKey="Completed" fill="#86EFAC" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Recent Tasks */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Recent Tasks</CardTitle>
                    <CardDescription>Recently updated tasks</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="text-primary gap-1" asChild>
                    <a href="/tasks">
                      All tasks <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentTasks.map(task => (
                      <div key={task.id} className="border rounded-md p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium">{task.title}</h3>
                          <CustomBadge variant={
                            task.status === 'completed' ? 'success' :
                            task.status === 'in-progress' ? 'default' :
                            task.status === 'under-review' ? 'warning' :
                            task.status === 'canceled' ? 'destructive' : 'secondary'
                          }>
                            {task.status === 'draft' ? 'Draft' :
                             task.status === 'in-progress' ? 'In Progress' :
                             task.status === 'under-review' ? 'Under Review' :
                             task.status === 'completed' ? 'Completed' : 'Canceled'}
                          </CustomBadge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Due: {format(new Date(task.dueDate), "dd MMM yyyy", { locale: enUS })}</span>
                          </div>
                          {task.project && (
                            <div className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              <span>Status: {task.project.status === 'active' ? 'Active' : task.project.status === 'completed' ? 'Completed' : 'Paused'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {recentTasks.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No recent tasks</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Deadlines */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">Upcoming Deadlines</CardTitle>
                    <CardDescription>Nearest due dates</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="text-primary gap-1" asChild>
                    <a href="/calendar">
                      Calendar <Calendar className="h-4 w-4 ml-1" />
                    </a>
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcomingDeadlines.map(task => (
                      <div key={task.id} className="flex items-start space-x-3 border-b pb-3 last:border-0 rounded-md p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-medium line-clamp-1">{task.title}</p>
                            <CustomBadge variant={
                              task.status === 'in-progress' ? 'default' :
                              task.status === 'under-review' ? 'warning' : 'secondary'
                            } className="text-[10px] ml-2">
                              {task.status === 'draft' ? 'Draft' :
                               task.status === 'in-progress' ? 'In Progress' : 'Under Review'}
                            </CustomBadge>
                          </div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {format(new Date(task.dueDate), "dd MMM yyyy", { locale: enUS })}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {upcomingDeadlines.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No upcoming deadlines</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Assigned Projects */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Assigned Projects</CardTitle>
                <CardDescription>Projects you are participating in</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {myProjects.map(project => (
                    <div key={project.id} className="border rounded-md p-3 hover:bg-muted/30 transition-colors">
                      <h3 className="font-medium">{project.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{project.description}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>Members: {project.assignedUserIds.length}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          <span>Status: {project.status === 'active' ? 'Active' : project.status === 'completed' ? 'Completed' : 'Paused'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {myProjects.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No assigned projects</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Team section - only show for admins */}
            {user?.role === 'admin' && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-lg font-semibold">Team</CardTitle>
                    <CardDescription className="mt-1 sm:mt-0">Team activity overview</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {users.filter(u => u.id !== user.id).map(teamMember => {
                      const memberTasks = allTasks.filter((task: Task) => 
                        task.assignees && task.assignees.some(assignee => assignee.id === teamMember.id)
                      );
                      const memberTasksByStatus = getTasksByStatusMap(memberTasks);
                      
                      return (
                        <div key={teamMember.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-3 gap-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={teamMember} />
                            <div className="overflow-hidden">
                              <p className="font-medium truncate">{teamMember.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{teamMember.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 sm:gap-3 mt-2 sm:mt-0">
                            <div className="text-center flex-1 sm:flex-auto">
                              <p className="text-xs text-muted-foreground">Total</p>
                              <p className="font-medium">{memberTasks.length}</p>
                            </div>
                            <div className="text-center flex-1 sm:flex-auto">
                              <p className="text-xs text-muted-foreground">In Progress</p>
                              <p className="font-medium">{memberTasksByStatus["in-progress"].length}</p>
                            </div>
                            <div className="text-center flex-1 sm:flex-auto">
                              <p className="text-xs text-muted-foreground">Completed</p>
                              <p className="font-medium">{memberTasksByStatus.completed.length}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default Dashboard;
