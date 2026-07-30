import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

class Task extends Model {
  public id!: string;
  public title!: string;
  public description?: string;
  public status!: 'draft' | 'in-progress' | 'under-review' | 'completed' | 'canceled';
  public dueDate?: Date;
  public projectId?: string;
  public clientId?: string;
  public createdBy!: string;

  // Add method declarations for Sequelize association methods
  public setAssignees!: (assigneeIds: string[]) => Promise<void>;
  public getAssignees!: () => Promise<User[]>;
  public addAssignee!: (assigneeId: string) => Promise<void>;
  public removeAssignee!: (assigneeId: string) => Promise<void>;
}

Task.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'in-progress', 'under-review', 'completed', 'canceled'),
    defaultValue: 'draft'
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  projectId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  clientId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'Task'
});

export default Task; 