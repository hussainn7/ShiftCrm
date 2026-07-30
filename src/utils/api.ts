// API utility functions for making requests

/**
 * Base function to make API requests
 * @param endpoint - API endpoint (without the /api prefix)
 * @param options - Fetch options
 * @returns Promise with the response data
 */
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  // Use relative URLs for all API requests
  const url = `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  // Set default headers if not provided
  if (!options.headers) {
    options.headers = {
      'Content-Type': 'application/json',
    };
  }
  
  // Get token from localStorage if available
  const token = localStorage.getItem('token');
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };
  }
  
  try {
    const response = await fetch(url, options);
    
    // Try to parse JSON response
    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    
    // Handle error responses
    if (!response.ok) {
      throw new Error(data.message || data.error || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

/**
 * GET request helper
 */
export const get = (endpoint: string, options: RequestInit = {}) => {
  return apiRequest(endpoint, { ...options, method: 'GET' });
};

/**
 * POST request helper
 */
export const post = (endpoint: string, data: any, options: RequestInit = {}) => {
  return apiRequest(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * PUT request helper
 */
export const put = (endpoint: string, data: any, options: RequestInit = {}) => {
  return apiRequest(endpoint, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * DELETE request helper
 */
export const del = (endpoint: string, options: RequestInit = {}) => {
  return apiRequest(endpoint, { ...options, method: 'DELETE' });
};

/**
 * Upload file helper
 * @param endpoint - API endpoint
 * @param file - File to upload
 * @param additionalData - Additional form data to include
 * @returns Promise with the response data
 */
export const uploadFile = async (endpoint: string, file: File, additionalData: Record<string, any> = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  
  // Add any additional data to the form
  Object.entries(additionalData).forEach(([key, value]) => {
    formData.append(key, value);
  });
  
  // Get token from localStorage if available
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Use relative URLs for all API requests
  const url = `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData
    });
    
    // Try to parse JSON response
    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    
    // Handle error responses
    if (!response.ok) {
      throw new Error(data.message || data.error || 'File upload failed');
    }
    
    return data;
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
};
