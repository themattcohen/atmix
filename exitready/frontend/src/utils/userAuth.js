// User authentication and data management utilities - Now using backend API
import { siteContent } from '../content/siteContent';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

// User data structure
export const createUser = (email, password, name) => ({
  id: generateId(),
  email,
  password, // In production, this would be hashed
  name,
  createdAt: new Date().toISOString(),
  lastLogin: new Date().toISOString()
});

// Valuation data structure
export const createValuationRecord = (userId, formData, valuation, reportType) => ({
  id: generateId(),
  userId,
  formData,
  valuation,
  reportType,
  createdAt: new Date().toISOString(),
  firmName: formData.firmName || 'Unnamed Firm'
});

// Utility functions
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// Backend API functions for user management
export const registerUser = async (email, password, name) => {
  try {
    const response = await fetch(`${backendUrl}/api/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Registration failed');
    }

    const result = await response.json();
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Registration error:', error);
    throw new Error(error.message || 'Registration failed');
  }
};

export const loginUser = async (email, password) => {
  try {
    const response = await fetch(`${backendUrl}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Login failed');
    }

    const result = await response.json();
    
    // Store user in localStorage for session management
    localStorage.setItem('exitready_current_user', JSON.stringify(result.user));
    
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Login error:', error);
    throw new Error(error.message || 'Login failed');
  }
};

export const logoutUser = () => {
  localStorage.removeItem('exitready_current_user');
  return { success: true };
};

export const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('exitready_current_user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

export const isAuthenticated = () => {
  return getCurrentUser() !== null;
};

// Valuation data functions - now using backend
export const saveValuationForUser = async (userId, formData, valuation, reportType) => {
  try {
    // First submit to tracking API
    const submissionData = {
      company_name: formData.firmName || 'Unnamed Firm',
      email: formData.email,
      phone: formData.phone,
      valuation_type: reportType,
      annual_revenue: formData.grossRevenue,
      ebitda: formData.netIncome,
      estimated_value: valuation.mid,
      industry: formData.industry,
      firm_age: formData.yearsInBusiness,
      employee_count: formData.totalEmployees,
      growth_rate: formData.growthRate
    };

    const response = await fetch(`${backendUrl}/api/valuation/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submissionData),
    });

    if (!response.ok) {
      throw new Error('Failed to save valuation');
    }

    const result = await response.json();
    
    // Create local record for user dashboard
    const newRecord = createValuationRecord(userId, formData, valuation, reportType);
    newRecord.backend_id = result.id; // Link to backend record
    
    // Store in localStorage for user dashboard (until we have user-specific backend endpoints)
    const userData = getUserDataLocal(userId);
    userData.push(newRecord);
    saveUserDataLocal(userId, userData);
    
    return newRecord;
  } catch (error) {
    console.error('Error saving valuation:', error);
    throw error;
  }
};

// Local storage functions (temporary until backend user data endpoints are ready)
const getUserDataLocal = (userId) => {
  try {
    const allData = JSON.parse(localStorage.getItem('exitready_user_data') || '{}');
    return allData[userId] || [];
  } catch {
    return [];
  }
};

const saveUserDataLocal = (userId, data) => {
  try {
    const allData = JSON.parse(localStorage.getItem('exitready_user_data') || '{}');
    allData[userId] = data;
    localStorage.setItem('exitready_user_data', JSON.stringify(allData));
  } catch (error) {
    console.error('Error saving user data:', error);
  }
};

export const getUserValuations = (userId) => {
  return getUserDataLocal(userId);
};

export const getValuationById = (userId, valuationId) => {
  const userData = getUserDataLocal(userId);
  return userData.find(record => record.id === valuationId);
};

export const updateUserProfile = async (userId, updates) => {
  try {
    // TODO: Implement backend user update endpoint
    // For now, fall back to localStorage
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    
    users[userIndex] = { ...users[userIndex], ...updates };
    saveUsers(users);
    
    // Update current user if it's the same user
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      localStorage.setItem('exitready_current_user', JSON.stringify({ ...users[userIndex], password: undefined }));
    }
    
    return { success: true, user: { ...users[userIndex], password: undefined } };
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// Legacy localStorage functions (keep for backward compatibility)
const getUsers = () => {
  try {
    return JSON.parse(localStorage.getItem('exitready_users') || '[]');
  } catch {
    return [];
  }
};

const saveUsers = (users) => {
  localStorage.setItem('exitready_users', JSON.stringify(users));
};

// Demo data for new users
export const createDemoValuation = (userId) => {
  const demoFormData = {
    firmName: "Demo Accounting Services",
    yearsInBusiness: 8,
    grossRevenue: 650000,
    netIncome: 97500,
    totalClients: 120,
    contactName: getCurrentUser()?.name || "Demo User",
    email: getCurrentUser()?.email || "demo@example.com"
  };
  
  const demoValuation = {
    low: 520000,
    mid: 650000,
    high: 780000,
    multiple: "1.0"
  };
  
  return saveValuationForUser(userId, demoFormData, demoValuation, 'simple');
};