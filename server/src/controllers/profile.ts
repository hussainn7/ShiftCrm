import { Request, Response } from 'express';
import User from '../models/User.js';

const getProfile = async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
    });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: 'Error fetching profile' });
  }
};

const updateProfile = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, profilePicture } = req.body;
    
    // Get current user data
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Store current role
    const currentRole = user.role;

    // Only update allowed fields
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

    // Ensure role stays the same
    updateData.role = currentRole;

    // Update user with preserved role
    await user.update(updateData);

    // Return updated user without sensitive information
    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(400).json({ error: 'Error updating profile' });
  }
};

export { getProfile, updateProfile }; 