import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to tasks.json file
const tasksFilePath = path.join(__dirname, 'data', 'tasks.json');

// Read the tasks file
try {
  // Read the file
  const tasksData = fs.readFileSync(tasksFilePath, 'utf8');
  const tasks = JSON.parse(tasksData);
  
  console.log(`Found ${tasks.length} tasks in the file.`);
  
  // Create a mapping of old IDs to new UUIDs
  const idMapping = {};
  
  // Update each task with a UUID
  const updatedTasks = tasks.map(task => {
    const oldId = task.id;
    const newId = uuidv4();
    
    // Store the mapping for reference
    idMapping[oldId] = newId;
    
    // Return the updated task with UUID
    return {
      ...task,
      id: newId
    };
  });
  
  // Write the updated tasks back to the file
  fs.writeFileSync(tasksFilePath, JSON.stringify(updatedTasks, null, 2), 'utf8');
  
  console.log('Task IDs have been updated successfully!');
  console.log('ID Mapping (for reference):');
  console.log(JSON.stringify(idMapping, null, 2));
  
} catch (error) {
  console.error('Error updating task IDs:', error);
}
