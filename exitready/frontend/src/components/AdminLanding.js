import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Settings, 
  FileText, 
  Users, 
  Eye,
  BarChart3,
  Calculator,
  Download,
  Home,
  Shield,
  Edit3,
  Database
} from 'lucide-react';

const AdminLanding = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalValuations: 0,
    totalValue: 0,
    recentActivity: 0
  });

  const ADMIN_PASSWORD = "exitready2024";

  useEffect(() => {
    const isAuth = localStorage.getItem('admin_authenticated') === 'true';
    setIsAuthenticated(isAuth);
    
    if (isAuth) {
      calculateStats();
    }
  }, []);

  const calculateStats = () => {
    try {
      // Get all users
      const users = JSON.parse(localStorage.getItem('exitready_users') || '[]');
      
      // Get all user data (valuations)
      const allUserData = JSON.parse(localStorage.getItem('exitready_user_data') || '{}');
      
      // Calculate total valuations across all users
      let totalValuations = 0;
      let totalValue = 0;
      let recentActivity = 0;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      Object.values(allUserData).forEach(userValuations => {
        totalValuations += userValuations.length;
        userValuations.forEach(valuation => {
          // Calculate total value
          const valuationAmount = valuation.valuation.finalRange 
            ? valuation.valuation.finalRange.mid 
            : valuation.valuation.mid;
          totalValue += valuationAmount;
          
          // Check for recent activity
          if (new Date(valuation.createdAt) > oneDayAgo) {
            recentActivity++;
          }
        });
      });
      
      setStats({
        totalUsers: users.length,
        totalValuations,
        totalValue,
        recentActivity
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('admin_authenticated', 'true');
      setIsAuthenticated(true);
      calculateStats();
    } else {
      alert('Invalid password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    setIsAuthenticated(false);
    setPassword('');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="glass-effect rounded-3xl p-8 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Admin Control Center</h1>
            <p className="text-gray-300">Enter password to access admin tools</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-3">Admin Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <Eye size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
            >
              Access Admin Center
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-2">
              <Home size={18} />
              Back to Home
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="glass-effect">
        <div className="container-max">
          <div className="flex items-center justify-between py-4 px-6">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-2xl font-bold text-gradient">
                Exit Ready
              </Link>
              <span className="text-gray-400">Admin Control Center</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-gray-300 transition-colors duration-300 text-sm"
              >
                Logout
              </button>
              <Link 
                to="/"
                className="text-gray-300 hover:text-white transition-colors duration-300 inline-flex items-center gap-2"
              >
                <Home size={18} />
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="section-padding">
        <div className="container-max">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              Admin <span className="text-gradient">Control Center</span>
            </h1>
            <p className="text-xl text-gray-300">
              Manage your Exit Ready platform and monitor user activity
            </p>
          </motion.div>

          {/* Stats Overview */}
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="glass-effect rounded-2xl p-6 text-center"
            >
              <Users className="text-blue-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">{stats.totalUsers}</div>
              <div className="text-gray-400">Registered Users</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="glass-effect rounded-2xl p-6 text-center"
            >
              <Calculator className="text-green-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">{stats.totalValuations}</div>
              <div className="text-gray-400">Total Valuations</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="glass-effect rounded-2xl p-6 text-center"
            >
              <BarChart3 className="text-purple-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">{formatCurrency(stats.totalValue)}</div>
              <div className="text-gray-400">Total Firm Value</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="glass-effect rounded-2xl p-6 text-center"
            >
              <Database className="text-yellow-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">{stats.recentActivity}</div>
              <div className="text-gray-400">Recent Activity (24h)</div>
            </motion.div>
          </div>

          {/* Admin Tools Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {/* User & Lead Management */}
            <Link
              to="/admin/users"
              className="glass-effect rounded-3xl p-8 card-hover group"
            >
              <Users className="text-blue-400 mb-4 group-hover:scale-110 transition-transform" size={48} />
              <h3 className="text-2xl font-bold mb-4">User & Lead Management</h3>
              <p className="text-gray-300 mb-4">
                View all users, their valuations, and lead data. Export contact information and track engagement.
              </p>
              <div className="text-blue-400 font-semibold">Manage Users →</div>
            </Link>

            {/* Valuation Settings */}
            <Link
              to="/admin/dashboard"
              className="glass-effect rounded-3xl p-8 card-hover group"
            >
              <Settings className="text-green-400 mb-4 group-hover:scale-110 transition-transform" size={48} />
              <h3 className="text-2xl font-bold mb-4">Valuation Settings</h3>
              <p className="text-gray-300 mb-4">
                Configure revenue multipliers, EBITDA multiples, quality factors, and risk adjustments.
              </p>
              <div className="text-green-400 font-semibold">Configure Settings →</div>
            </Link>

            {/* Content Manager */}
            <Link
              to="/admin/content"
              className="glass-effect rounded-3xl p-8 card-hover group"
            >
              <Edit3 className="text-purple-400 mb-4 group-hover:scale-110 transition-transform" size={48} />
              <h3 className="text-2xl font-bold mb-4">Content Manager</h3>
              <p className="text-gray-300 mb-4">
                Edit website copy, headlines, and content without touching code. Update branding and messaging.
              </p>
              <div className="text-purple-400 font-semibold">Edit Content →</div>
            </Link>

            {/* PDF Preview */}
            <Link
              to="/preview/pdf"
              className="glass-effect rounded-3xl p-8 card-hover group"
            >
              <Eye className="text-yellow-400 mb-4 group-hover:scale-110 transition-transform" size={48} />
              <h3 className="text-2xl font-bold mb-4">PDF Preview</h3>
              <p className="text-gray-300 mb-4">
                Generate sample PDF reports to see exactly what users receive. Test both simple and detailed reports.
              </p>
              <div className="text-yellow-400 font-semibold">Preview Reports →</div>
            </Link>

            {/* Analytics Dashboard */}
            <div className="glass-effect rounded-3xl p-8 opacity-75">
              <BarChart3 className="text-gray-400 mb-4" size={48} />
              <h3 className="text-2xl font-bold mb-4 text-gray-400">Analytics Dashboard</h3>
              <p className="text-gray-400 mb-4">
                Advanced analytics and reporting features. Track conversion rates, user behavior, and performance metrics.
              </p>
              <div className="text-gray-400 font-semibold">Coming Soon</div>
            </div>

            {/* CRM System */}
            <div className="glass-effect rounded-3xl p-8 opacity-75">
              <Database className="text-gray-400 mb-4" size={48} />
              <h3 className="text-2xl font-bold mb-4 text-gray-400">CRM System</h3>
              <p className="text-gray-400 mb-4">
                Custom CRM for managing leads, tracking deals, and automating follow-ups with accounting firm owners.
              </p>
              <div className="text-gray-400 font-semibold">In Planning</div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-12 glass-effect rounded-2xl p-8"
          >
            <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link
                to="/admin/users"
                className="bg-blue-600/20 hover:bg-blue-600/30 p-4 rounded-xl transition-colors text-center"
              >
                <Download className="mx-auto mb-2 text-blue-400" size={24} />
                <div className="font-semibold">Export All Leads</div>
                <div className="text-sm text-gray-400">Download complete user database</div>
              </Link>

              <Link
                to="/preview/pdf"
                className="bg-green-600/20 hover:bg-green-600/30 p-4 rounded-xl transition-colors text-center"
              >
                <FileText className="mx-auto mb-2 text-green-400" size={24} />
                <div className="font-semibold">Test PDF Reports</div>
                <div className="text-sm text-gray-400">Generate sample valuations</div>
              </Link>

              <Link
                to="/admin/content"
                className="bg-purple-600/20 hover:bg-purple-600/30 p-4 rounded-xl transition-colors text-center"
              >
                <Edit3 className="mx-auto mb-2 text-purple-400" size={24} />
                <div className="font-semibold">Update Website</div>
                <div className="text-sm text-gray-400">Edit headlines and copy</div>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminLanding;