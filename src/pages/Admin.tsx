import { useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { get, post, del } from '../utils/api';

const Admin = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('team');
  
  // User management
  const [newUser, setNewUser] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'employee' as 'team-lead' | 'employee'
  });
  
  // Fetch users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      return get('admin/users');
    },
    enabled: !!token
  });
  
  // Fetch tasks for workload analysis
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['admin-tasks'],
    queryFn: async () => {
      return get('tasks');
    },
    enabled: !!token
  });
  
  // Add user mutation
  const addUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      return post('admin/users', userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNewUser({ email: '', firstName: '', lastName: '', password: '', role: 'employee' });
      toast.success('User successfully added');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to add user');
    }
  });
  
  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return del(`admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User successfully deleted');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete user');
    }
  });
  
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    addUserMutation.mutate(newUser);
  };
  
  const handleDeleteUser = (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      deleteUserMutation.mutate(userId);
    }
  };
  
  // Calculate employee workload data
  const employeeWorkloadData = users.map((user: any) => {
    const userTasks = tasks.filter((task: any) => 
      task.assigneeIds && task.assigneeIds.includes(user.id)
    );
    
    const tasksByStatus = {
      pending: userTasks.filter((task: any) => task.status === 'pending').length,
      inProgress: userTasks.filter((task: any) => task.status === 'in-progress').length,
      review: userTasks.filter((task: any) => task.status === 'review').length,
      completed: userTasks.filter((task: any) => task.status === 'completed').length
    };
    
    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      ...tasksByStatus,
      total: userTasks.length
    };
  }).sort((a: any, b: any) => b.total - a.total); // Sort by total tasks
  
  // Calculate task status data for the performance tab
  const taskStatusCounts: Record<string, number> = {};
  tasks.forEach((task: any) => {
    const status = task.status || 'unknown';
    taskStatusCounts[status] = (taskStatusCounts[status] || 0) + 1;
  });
  
  const taskStatusData = Object.entries(taskStatusCounts).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
    count
  }));
  
  return (
    <MainLayout>
      <div className="container mx-auto py-3 px-2 sm:py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-6">Admin Panel</h1>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-10 p-0.5">
          <TabsTrigger value="team" className="text-xs sm:text-sm px-1 py-1 h-9 flex items-center justify-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden sm:inline-block"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span>Team</span>
          </TabsTrigger>
          <TabsTrigger value="workload" className="text-xs sm:text-sm px-1 py-1 h-9 flex items-center justify-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden sm:inline-block"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            <span>Workload</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="text-xs sm:text-sm px-1 py-1 h-9 flex items-center justify-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden sm:inline-block"><path d="M12 20V10"></path><path d="M18 20V4"></path><path d="M6 20v-6"></path></svg>
            <span>Analytics</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Team Management Tab */}
        <TabsContent value="team" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Add New Team Member</CardTitle>
              <CardDescription className="text-sm sm:text-base">Create a new user account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName" 
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName" 
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={newUser.role} 
                    onValueChange={(value: 'team-lead' | 'employee') => setNewUser({...newUser, role: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team-lead">Team Lead</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button type="submit" disabled={addUserMutation.isPending}>
                  {addUserMutation.isPending ? 'Adding...' : 'Add User'}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Team Members</CardTitle>
              <CardDescription className="text-sm sm:text-base">Manage your team</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <p className="text-center py-4">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="text-center py-4">No users found</p>
              ) : (
                <div className="space-y-4">
                  {users.map((user: any) => (
                    <div key={user.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{user.firstName} {user.lastName}</h3>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        <span className="inline-block px-2 py-1 mt-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                          {user.role === 'admin' ? 'Administrator' : user.role === 'team-lead' ? 'Team Lead' : 'Employee'}
                        </span>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={deleteUserMutation.isPending || user.role === 'admin'}
                        className="w-full mt-2 sm:mt-0 sm:w-auto"
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Employee Workload Tab */}
        <TabsContent value="workload" className="mt-4 sm:mt-6">
          <Card className="overflow-hidden">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-xl">Employee Workload</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Task distribution among team members</CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
              {isLoadingTasks || isLoadingUsers ? (
                <p className="text-center py-2 text-sm">Loading data...</p>
              ) : employeeWorkloadData.length === 0 ? (
                <p className="text-center py-2 text-sm">No data available</p>
              ) : (
                <div className="h-[250px] sm:h-96 -mx-2 sm:mx-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={employeeWorkloadData}
                      margin={{ top: 5, right: 0, left: -15, bottom: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                      <XAxis 
                        dataKey="name" 
                        angle={-45} 
                        textAnchor="end" 
                        height={60} 
                        tick={{ fontSize: 10 }}
                        tickMargin={5}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                      <Bar dataKey="inProgress" name="In Progress" fill="#8884d8" />
                      <Bar dataKey="pending" name="Pending" fill="#82ca9d" />
                      <Bar dataKey="review" name="Under Review" fill="#ffc658" />
                      <Bar dataKey="completed" name="Completed" fill="#0088fe" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Performance Analytics Tab */}
        <TabsContent value="performance" className="mt-4 sm:mt-6">
          <Card className="overflow-hidden">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-xl">Task Status Distribution</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Overview of tasks by current status</CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
              {isLoadingTasks ? (
                <p className="text-center py-2 text-sm">Loading data...</p>
              ) : (
                <div className="h-[250px] sm:h-96 -mx-2 sm:mx-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={taskStatusData}
                      margin={{ top: 5, right: 0, left: -15, bottom: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                      <XAxis 
                        dataKey="status" 
                        angle={-45} 
                        textAnchor="end" 
                        height={60} 
                        tick={{ fontSize: 10 }}
                        tickMargin={5}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                      <Bar dataKey="count" name="Task Count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
};

export default Admin;
