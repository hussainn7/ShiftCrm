import User from './User.js';
import Task from './Task.js';
import Project from './Project.js';
import Client from './Client.js';

// Task-User associations (many-to-many for assignees)
Task.belongsToMany(User, { 
  through: 'TaskAssignees', 
  as: 'assignees',
  foreignKey: 'taskId',
  otherKey: 'userId'
});
User.belongsToMany(Task, { 
  through: 'TaskAssignees', 
  as: 'assignedTasks',
  foreignKey: 'userId',
  otherKey: 'taskId'
});

// Task-User association (one-to-many for creator)
Task.belongsTo(User, { 
  as: 'creator',
  foreignKey: 'createdBy'
});
User.hasMany(Task, { 
  as: 'createdTasks',
  foreignKey: 'createdBy'
});

// Task-Project association
Task.belongsTo(Project, { 
  as: 'project',
  foreignKey: 'projectId'
});
Project.hasMany(Task, { 
  as: 'tasks',
  foreignKey: 'projectId'
});

// Task-Client association
Task.belongsTo(Client, { 
  as: 'client',
  foreignKey: 'clientId'
});
Client.hasMany(Task, { 
  as: 'tasks',
  foreignKey: 'clientId'
});

// Project-Client association
Project.belongsTo(Client, { 
  as: 'client',
  foreignKey: 'clientId'
});
Client.hasMany(Project, { 
  as: 'projects',
  foreignKey: 'clientId'
});

export { User, Task, Project, Client }; 