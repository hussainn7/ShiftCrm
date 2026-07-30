import { Request, Response } from 'express';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Client from '../models/Client.js';
import User from '../models/User.js';

// Get all tasks
export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await Task.findAll({
      include: [
        { model: Project, as: 'project' },
        { model: Client, as: 'client' },
        { 
          model: User, 
          as: 'assignees', 
          through: { attributes: [] },
          attributes: ['id', 'firstName', 'lastName', 'email', 'profilePicture', 'role']
        },
        { 
          model: User, 
          as: 'creator', 
          attributes: ['id', 'firstName', 'lastName', 'email', 'profilePicture'] 
        }
      ]
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'An error occurred' });
  }
};

// Create a new task
export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract assigneeIds from request body
    const { assigneeIds, ...taskData } = req.body;

    // Create task
    const task = await Task.create({
      ...taskData,
      createdBy: req.user.id
    });

    // Set assignees if provided
    if (assigneeIds && assigneeIds.length > 0) {
      await task.setAssignees(assigneeIds);
    }

    // Fetch the created task with all associations
    const createdTask = await Task.findByPk(task.id, {
      include: [
        { model: Project, as: 'project' },
        { model: Client, as: 'client' },
        { 
          model: User, 
          as: 'assignees', 
          through: { attributes: [] },
          attributes: ['id', 'firstName', 'lastName', 'email', 'profilePicture', 'role']
        },
        { 
          model: User, 
          as: 'creator', 
          attributes: ['id', 'firstName', 'lastName', 'email', 'profilePicture'] 
        }
      ]
    });

    res.status(201).json(createdTask);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'An error occurred' });
  }
};

// Update a task
export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    // Extract assigneeIds from request body
    const { assigneeIds, ...updateData } = req.body;

    // Update task data
    await task.update(updateData);

    // Update assignees if provided
    if (assigneeIds && assigneeIds.length > 0) {
      await task.setAssignees(assigneeIds);
    }

    // Fetch updated task with all associations
    const updatedTask = await Task.findByPk(task.id, {
      include: [
        { model: Project, as: 'project' },
        { model: Client, as: 'client' },
        { 
          model: User, 
          as: 'assignees', 
          through: { attributes: [] },
          attributes: ['id', 'firstName', 'lastName', 'email', 'profilePicture', 'role']
        },
        { 
          model: User, 
          as: 'creator', 
          attributes: ['id', 'firstName', 'lastName', 'email', 'profilePicture'] 
        }
      ]
    });

    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'An error occurred' });
  }
};

// Delete a task
export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }
    await task.destroy();
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'An error occurred' });
  }
}; 