import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  BarChart3,
  FileText,
  Mail,
  Users,
  TrendingUp,
  CheckCircle,
  Calendar,
  Download,
  DollarSign,
  Eye,
  Building,
  Globe,
  ArrowLeft,
  Calculator,
  Settings,
  Package,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminMain = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    sessionStorage.getItem('adminAuthenticated') === 'true'
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [leadMagnets, setLeadMagnets] = useState([]);
  const [qoeProjects, setQoeProjects] = useState([]);
  const [valuations, setValuations] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedQOE, setSelectedQOE] = useState(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${backendUrl}/api/admin/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        sessionStorage.setItem('adminAuthenticated', 'true');
        loadDashboardData();
      } else {
        setError('Invalid password');
      }
    } catch (error) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuthenticated');
    setPassword('');
  };

  const loadDashboardData = async () => {
    try {
      // Load stats
      const statsResponse = await fetch(`${backendUrl}/api/admin/stats`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Load lead magnets
      const leadResponse = await fetch(`${backendUrl}/api/admin/lead-magnets`);
      if (leadResponse.ok) {
        const leadData = await leadResponse.json();
        setLeadMagnets(leadData);
      }

      // Load QOE projects
      const qoeResponse = await fetch(`${backendUrl}/api/admin/qoe-projects`);
      if (qoeResponse.ok) {
        const qoeData = await qoeResponse.json();
        setQoeProjects(qoeData);
      }

      // Load valuations
      const valuationsResponse = await fetch(`${backendUrl}/api/admin/valuations`);
      if (valuationsResponse.ok) {
        const valuationsData = await valuationsResponse.json();
        setValuations(valuationsData);
      }

      // Load users
      const usersResponse = await fetch(`${backendUrl}/api/admin/users`);
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="glass-effect rounded-3xl p-8 lg:p-12 max-w-md mx-auto"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="text-white" size={36} />
            </div>
            <h1 className="text-3xl font-bold mb-2">Admin Access</h1>
            <p className="text-gray-300">Enter the admin password to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Admin Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-3 bg-slate-800/50 border border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-4 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link to="/" className="text-gray-400 hover:text-blue-400 transition-colors text-sm">
              ← Back to Exit Ready
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // QOE Detail View
  if (selectedQOE) {
    return (
      <div className="min-h-screen gradient-bg">
        {/* Header */}
        <div className="glass-effect sticky top-0 z-50">
          <div className="container-max">
            <div className="flex items-center justify-between py-4 px-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedQOE(null)}
                  className="w-10 h-10 bg-gray-600 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors"
                >
                  <ArrowLeft className="text-white" size={20} />
                </button>
                <div>
                  <h1 className="text-xl font-bold">QOE Project Details</h1>
                  <p className="text-gray-400 text-sm">{selectedQOE.company_name}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-400 transition-colors text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="container-max py-8 px-6">
          <div className="glass-effect rounded-2xl p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-bold mb-6">Project Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm">Company Name</label>
                    <p className="font-semibold">{selectedQOE.company_name}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Package Type</label>
                    <p className="font-semibold capitalize">{selectedQOE.package_type}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Annual Revenue</label>
                    <p className="font-semibold">{formatCurrency(selectedQOE.annual_revenue)}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Industry</label>
                    <p className="font-semibold">{selectedQOE.industry || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Created</label>
                    <p className="font-semibold">{formatDate(selectedQOE.created_at)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-6">Financial Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm">EBITDA</label>
                    <p className="font-semibold">{formatCurrency(selectedQOE.ebitda)}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Employee Count</label>
                    <p className="font-semibold">{selectedQOE.employee_count || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Status</label>
                    <span className="inline-block bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
                      Active
                    </span>
                  </div>
                </div>

                {selectedQOE.files && selectedQOE.files.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">Uploaded Files</h3>
                    <div className="space-y-2">
                      {selectedQOE.files.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 bg-slate-800/30 rounded-lg p-3">
                          <FileText size={16} className="text-blue-400" />
                          <span className="text-sm">{file.filename || `File ${index + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <div className="glass-effect sticky top-0 z-50">
        <div className="container-max">
          <div className="flex items-center justify-between py-4 px-6">
            <div className="flex items-center gap-4">
              <img src="/logo-teal.svg" alt="Audit Trail Mix Logo" className="w-10 h-10" />
              <div>
                <h1 className="text-xl font-bold">Audit Trail Mix Admin</h1>
                <p className="text-gray-400 text-sm">Dashboard & Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                to="/"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <Globe size={20} />
              </Link>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-400 transition-colors text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-max py-8 px-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-4 mb-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'leads', label: 'Lead Magnets', icon: Mail },
            { id: 'valuations', label: 'Valuations', icon: Calculator },
            { id: 'qoe', label: 'QOE Projects', icon: FileText },
            { id: 'users', label: 'Users', icon: Users }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'glass-effect text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
          
          {/* Admin Tools Links */}
          <div className="flex gap-4 ml-auto">
            <Link
              to="/admin/dashboard"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium glass-effect text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-300"
            >
              <Settings size={18} />
              Valuation Settings
            </Link>
            <Link
              to="/admin/qoe-settings"
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium glass-effect text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-300"
            >
              <Package size={18} />
              QOE Settings
            </Link>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Stats Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="glass-effect rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <Mail className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{stats.total_lead_magnets}</h3>
                    <p className="text-gray-400">Lead Magnets</p>
                  </div>
                </div>
              </div>

              <div className="glass-effect rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                    <Calculator className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{stats.total_valuations}</h3>
                    <p className="text-gray-400">Valuations</p>
                  </div>
                </div>
              </div>

              <div className="glass-effect rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <FileText className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{stats.total_qoe_projects}</h3>
                    <p className="text-gray-400">QOE Projects</p>
                  </div>
                </div>
              </div>

              <div className="glass-effect rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                    <Users className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{stats.total_users}</h3>
                    <p className="text-gray-400">Users</p>
                  </div>
                </div>
              </div>

              <div className="glass-effect rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center">
                    <TrendingUp className="text-white" size={20} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{stats.recent_submissions}</h3>
                    <p className="text-gray-400">Recent (30d)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Tools */}
            <div className="glass-effect rounded-2xl p-8">
              <h2 className="text-2xl font-bold mb-6">Application Tools</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
                <Link
                  to="/calculator"
                  className="bg-green-500/20 hover:bg-green-500/30 rounded-xl p-6 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Calculator className="text-green-400 group-hover:text-green-300" size={24} />
                    <h3 className="font-semibold">Valuation Calculator</h3>
                  </div>
                  <p className="text-gray-300 text-sm">Get firm valuations</p>
                </Link>

                <Link
                  to="/value-calculator"
                  className="bg-purple-500/20 hover:bg-purple-500/30 rounded-xl p-6 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <BarChart3 className="text-purple-400 group-hover:text-purple-300" size={24} />
                    <h3 className="font-semibold">Value Calculator Suite</h3>
                  </div>
                  <p className="text-gray-300 text-sm">Sellability & wealth gap</p>
                </Link>

                <Link
                  to="/qoe"
                  className="bg-blue-500/20 hover:bg-blue-500/30 rounded-xl p-6 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="text-blue-400 group-hover:text-blue-300" size={24} />
                    <h3 className="font-semibold">QOE Generator</h3>
                  </div>
                  <p className="text-gray-300 text-sm">Quality of Earnings</p>
                </Link>

                <Link
                  to="/red-flags-assessment"
                  className="bg-red-500/20 hover:bg-red-500/30 rounded-xl p-6 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className="text-red-400 group-hover:text-red-300" size={24} />
                    <h3 className="font-semibold">Red Flags Assessment</h3>
                  </div>
                  <p className="text-gray-300 text-sm">Lead magnet</p>
                </Link>

                <Link
                  to="/admin/dashboard"
                  className="bg-indigo-500/20 hover:bg-indigo-500/30 rounded-xl p-6 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Settings className="text-indigo-400 group-hover:text-indigo-300" size={24} />
                    <h3 className="font-semibold">Calculator Admin</h3>
                  </div>
                  <p className="text-gray-300 text-sm">Manage settings</p>
                </Link>
              </div>

              {/* Value Calculator Admin Section */}
              <div className="mt-8 pt-8 border-t border-white/10">
                <h3 className="text-xl font-bold mb-4">Value Calculator Administration</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <Link
                    to="/admin/value-calculator"
                    className="bg-yellow-500/20 hover:bg-yellow-500/30 rounded-xl p-6 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <BarChart3 className="text-yellow-400 group-hover:text-yellow-300" size={24} />
                      <h4 className="font-semibold">Value Calculator Admin</h4>
                    </div>
                    <p className="text-gray-300 text-sm">Manage questions, weights, scoring parameters, and validation rules</p>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Lead Magnets Tab */}
        {activeTab === 'leads' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Lead Magnet Submissions</h2>
              <div className="text-gray-400">
                Total: {leadMagnets.length} submissions
              </div>
            </div>

            <div className="glass-effect rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="text-left p-4 font-semibold">Company</th>
                      <th className="text-left p-4 font-semibold">Email</th>
                      <th className="text-left p-4 font-semibold">Lead Magnet</th>
                      <th className="text-left p-4 font-semibold">Submitted</th>
                      <th className="text-left p-4 font-semibold">Status</th>
                      <th className="text-left p-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {leadMagnets.map((lead, index) => (
                      <tr key={lead.id || index} className="hover:bg-slate-800/30">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Building size={16} className="text-gray-400" />
                            <span className="font-medium">{lead.company}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Mail size={16} className="text-gray-400" />
                            <span className="text-gray-300">{lead.email}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-full text-sm">
                            {lead.lead_magnet}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            <span className="text-gray-300">{formatDate(lead.submitted_at)}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-400" />
                            <span className="text-green-400 text-sm">Delivered</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => window.open(`${backendUrl}/api/lead-magnet/red-flags-pdf`, '_blank')}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm transition-colors inline-flex items-center gap-2"
                          >
                            <Download size={14} />
                            Download PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Valuations Tab */}
        {activeTab === 'valuations' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Valuation Submissions</h2>
              <div className="text-gray-400">
                Total: {valuations.length} submissions
              </div>
            </div>

            <div className="glass-effect rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="text-left p-4 font-semibold">Company</th>
                      <th className="text-left p-4 font-semibold">Type</th>
                      <th className="text-left p-4 font-semibold">Revenue</th>
                      <th className="text-left p-4 font-semibold">Est. Value</th>
                      <th className="text-left p-4 font-semibold">Email</th>
                      <th className="text-left p-4 font-semibold">Submitted</th>
                      <th className="text-left p-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {valuations.map((valuation, index) => (
                      <tr key={valuation.id || index} className="hover:bg-slate-800/30">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Building size={16} className="text-gray-400" />
                            <span className="font-medium">{valuation.company_name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-sm ${
                            valuation.valuation_type === 'detailed' 
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {valuation.valuation_type === 'detailed' ? 'Detailed' : 'Simple'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-gray-300">{formatCurrency(valuation.annual_revenue)}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-gray-300">{formatCurrency(valuation.estimated_value)}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-gray-300">{valuation.email || 'N/A'}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            <span className="text-gray-300">{formatDate(valuation.submitted_at)}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => {
                              const sampleType = valuation.valuation_type === 'detailed' ? 'sample-detailed-pdf' : 'sample-simple-pdf';
                              window.open(`${backendUrl}/api/valuation/${sampleType}`, '_blank');
                            }}
                            className={`px-3 py-1 rounded-lg text-sm transition-colors inline-flex items-center gap-2 ${
                              valuation.valuation_type === 'detailed' 
                                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                          >
                            <Download size={14} />
                            Sample Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* QOE Projects Tab */}
        {activeTab === 'qoe' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">QOE Projects</h2>
              <div className="text-gray-400">
                Total: {qoeProjects.length} projects
              </div>
            </div>

            <div className="glass-effect rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="text-left p-4 font-semibold">Company</th>
                      <th className="text-left p-4 font-semibold">Package</th>
                      <th className="text-left p-4 font-semibold">Revenue</th>
                      <th className="text-left p-4 font-semibold">Created</th>
                      <th className="text-left p-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {qoeProjects.map((project, index) => (
                      <tr key={project.id || index} className="hover:bg-slate-800/30">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Building size={16} className="text-gray-400" />
                            <span className="font-medium">{project.company_name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-sm ${
                            project.package_type === 'comprehensive' 
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {project.package_type === 'comprehensive' ? 'Comprehensive ($1,997)' : 'Basic ($997)'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-gray-300">{formatCurrency(project.annual_revenue)}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            <span className="text-gray-300">{formatDate(project.created_at)}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedQOE(project)}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm transition-colors inline-flex items-center gap-2 mr-2"
                            >
                              <Eye size={14} />
                              View Details
                            </button>
                            <button
                              onClick={() => {
                                const sampleType = project.package_type === 'comprehensive' ? 'sample-comprehensive-pdf' : 'sample-basic-pdf';
                                window.open(`${backendUrl}/api/qoe/${sampleType}`, '_blank');
                              }}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm transition-colors inline-flex items-center gap-2 mr-2"
                            >
                              <Download size={14} />
                              PDF
                            </button>
                            <button
                              onClick={() => {
                                const sampleType = project.package_type === 'comprehensive' ? 'sample-comprehensive-excel' : 'sample-basic-excel';
                                window.open(`${backendUrl}/api/qoe/${sampleType}`, '_blank');
                              }}
                              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm transition-colors inline-flex items-center gap-2"
                            >
                              <Download size={14} />
                              Excel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Registered Users</h2>
              <div className="text-gray-400">
                Total: {users.length} users
              </div>
            </div>

            {users.length > 0 ? (
              <div className="glass-effect rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th className="text-left p-4 font-semibold">Name</th>
                        <th className="text-left p-4 font-semibold">Email</th>
                        <th className="text-left p-4 font-semibold">Company</th>
                        <th className="text-left p-4 font-semibold">Joined</th>
                        <th className="text-left p-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {users.map((user, index) => (
                        <tr key={user.id || index} className="hover:bg-slate-800/30">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Users size={16} className="text-gray-400" />
                              <span className="font-medium">{user.name}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Mail size={16} className="text-gray-400" />
                              <span className="text-gray-300">{user.email}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Building size={16} className="text-gray-400" />
                              <span className="text-gray-300">{user.company || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Calendar size={16} className="text-gray-400" />
                              <span className="text-gray-300">{formatDate(user.created_at)}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-green-400" />
                              <span className="text-green-400 text-sm">Active</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="glass-effect rounded-2xl p-12 text-center">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Users Yet</h3>
                <p className="text-gray-400">User registrations will appear here when available.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdminMain;