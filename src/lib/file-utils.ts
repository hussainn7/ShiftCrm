import { v4 as uuidv4 } from 'uuid';

// Base URL for file uploads
export const UPLOADS_BASE_URL = '/uploads';

// Function to determine if a file is an image
export const isImageFile = (fileName: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return imageExtensions.includes(extension);
};

// Function to generate a unique file path for uploads
export const generateFilePath = (fileName: string): string => {
  // Create a unique ID for the file
  const uniqueId = uuidv4();
  
  // Extract file extension
  const extension = fileName.substring(fileName.lastIndexOf('.'));
  
  // Generate a unique file name with original extension
  const uniqueFileName = `${uniqueId}${extension}`;
  
  // Return the path to the file in the uploads directory
  return `${UPLOADS_BASE_URL}/${uniqueFileName}`;
};

// Function to convert a File object to a base64 string
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Interface for file attachment
export interface FileAttachment {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  isImage: boolean;
}

// Function to create a file attachment object
export const createFileAttachment = async (file: File): Promise<FileAttachment> => {
  const path = generateFilePath(file.name);
  
  return {
    id: uuidv4(),
    name: file.name,
    path: path,
    type: file.type,
    size: file.size,
    isImage: isImageFile(file.name)
  };
};
