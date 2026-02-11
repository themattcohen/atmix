import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, 
  FileText, 
  Download, 
  Calculator, 
  TrendingUp,
  Calendar,
  DollarSign,
  Building,
  LogOut,
  Plus,
  Eye,
  BarChart3
} from 'lucide-react';
import { 
  getCurrentUser, 
  getUserValuations, 
  logoutUser, 
  isAuthenticated,
  createDemoValuation 
} from '../utils/userAuth';
import { generateValuationPDF } from '../utils/pdfGenerator';

const UserDashboard = () => {
  const [user, setUser] = useState(null);
  const [valuations, setValuations] = useState([]);
  const [selectedValuation, setSelectedValuation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || !isAuthenticated()) {
      navigate('/user/auth');
      return;
    }

    setUser(currentUser);
    const userValuations = getUserValuations(currentUser.id);
    
    // If no valuations exist, create a demo one
    if (userValuations.length === 0) {
      const demoValuation = createDemoValuation(currentUser.id);
      setValuations([demoValuation]);
    } else {
      setValuations(userValuations);
    }
    
    setIsLoading(false);
  }, [navigate]);

  const handleLogout = () => {
    logoutUser();
    navigate('/');
  };

  const downloadReport = async (valuation) => {
    try {
      await generateValuationPDF(valuation.formData, valuation.valuation, valuation.reportType);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Error downloading report');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getValuationValue = (valuation) => {
    if (valuation.valuation.finalRange) {
      return valuation.valuation.finalRange.mid;
    }
    return valuation.valuation.mid;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-effect">
        <div className="container-max">
          <div className="flex items-center justify-between py-4 px-6">
            <Link to="/" className="text-2xl font-bold text-gradient">
              Exit Ready
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">Welcome, {user?.name}</span>
              <button
                onClick={handleLogout}
                className="text-gray-300 hover:text-white transition-colors duration-300 inline-flex items-center gap-2"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-32 pb-20 section-padding">
        <div className="container-max">
          
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              Your <span className="text-gradient">Dashboard</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl">
              View your firm valuations, download reports, and track your exit planning progress.
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
              <Calculator className="text-blue-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">{valuations.length}</div>
              <div className="text-gray-400 text-sm">Valuations</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="glass-effect rounded-2xl p-6 text-center"
            >
              <DollarSign className="text-green-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">
                {valuations.length > 0 ? formatCurrency(getValuationValue(valuations[0])) : '$0'}
              </div>
              <div className="text-gray-400 text-sm">Latest Value</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="glass-effect rounded-2xl p-6 text-center"
            >
              <FileText className="text-purple-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">{valuations.length}</div>
              <div className="text-gray-400 text-sm">Reports</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="glass-effect rounded-2xl p-6 text-center"
            >
              <Calendar className="text-yellow-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">
                {valuations.length > 0 ? formatDate(valuations[0].createdAt) : 'N/A'}
              </div>
              <div className="text-gray-400 text-sm">Last Updated</div>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="glass-effect rounded-2xl p-8 mb-12"
          >
            <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link
                to="/calculator/simple"
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 text-center group"
              >
                <Plus className="mx-auto mb-3 group-hover:scale-110 transition-transform" size={32} />
                <div className="font-semibold mb-2">New Quick Valuation</div>
                <div className="text-sm opacity-90">2-3 minute estimate</div>
              </Link>

              <Link
                to="/calculator/detailed"
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 text-center group"
              >
                <BarChart3 className="mx-auto mb-3 group-hover:scale-110 transition-transform" size={32} />
                <div className="font-semibold mb-2">Detailed Analysis</div>
                <div className="text-sm opacity-90">Comprehensive 15-page report</div>
              </Link>

              <Link
                to="/qoe"
                className="bg-gradient-to-r from-purple-500 to-pink-600 text-white p-6 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 text-center group"
              >
                <Eye className="mx-auto mb-3 group-hover:scale-110 transition-transform" size={32} />
                <div className="font-semibold mb-2">QOE Generator</div>
                <div className="text-sm opacity-90">Quality of Earnings packages</div>
              </Link>
            </div>
          </motion.div>

          {/* Valuations History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="glass-effect rounded-2xl p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Your Valuations</h2>
              <div className="text-gray-400 text-sm">
                {valuations.length} valuation{valuations.length !== 1 ? 's' : ''}
              </div>
            </div>

            {valuations.length === 0 ? (
              <div className="text-center py-12">
                <Calculator className="mx-auto mb-4 text-gray-400" size={48} />
                <p className="text-gray-400 mb-6">No valuations yet. Create your first one to get started!</p>
                <Link
                  to="/calculator"
                  className="inline-flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors"
                >
                  <Plus size={18} />
                  Create First Valuation
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {valuations.map((valuation, index) => (
                  <motion.div
                    key={valuation.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="bg-slate-800/50 rounded-xl p-6 hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="grid md:grid-cols-5 gap-4 items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Building size={18} className="text-blue-400" />
                          <span className="font-semibold">{valuation.firmName}</span>
                        </div>
                        <div className="text-gray-400 text-sm">
                          {formatDate(valuation.createdAt)}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-sm text-gray-400 mb-1">Valuation</div>
                        <div className="font-bold text-green-400">
                          {formatCurrency(getValuationValue(valuation))}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-sm text-gray-400 mb-1">Revenue</div>
                        <div className="font-semibold">
                          {formatCurrency(valuation.formData.grossRevenue)}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-sm text-gray-400 mb-1">Type</div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          valuation.reportType === 'detailed' 
                            ? 'bg-purple-600/20 text-purple-400'
                            : 'bg-green-600/20 text-green-400'
                        }`}>
                          {valuation.reportType === 'detailed' ? 'Comprehensive' : 'Quick'}
                        </span>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setSelectedValuation(valuation)}
                          className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => downloadReport(valuation)}
                          className="p-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors"
                          title="Download Report"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Valuation Details Modal */}
          {selectedValuation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedValuation(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-effect rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold">{selectedValuation.firmName}</h3>
                  <button
                    onClick={() => setSelectedValuation(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-blue-400">Firm Information</h4>
                    <div className="space-y-2 text-sm">
                      <div>Contact: {selectedValuation.formData.contactName}</div>
                      <div>Email: {selectedValuation.formData.email}</div>
                      <div>Clients: {selectedValuation.formData.totalClients}</div>
                      {selectedValuation.formData.yearsInBusiness && (
                        <div>Years in Business: {selectedValuation.formData.yearsInBusiness}</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-green-400">Financial Data</h4>
                    <div className="space-y-2 text-sm">
                      <div>Revenue: {formatCurrency(selectedValuation.formData.grossRevenue)}</div>
                      <div>Net Income: {formatCurrency(selectedValuation.formData.netIncome)}</div>
                      {selectedValuation.formData.ownerSalary && (
                        <div>Owner Salary: {formatCurrency(selectedValuation.formData.ownerSalary)}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
                  <h4 className="font-semibold mb-3 text-purple-400">Valuation Results</h4>
                  {selectedValuation.valuation.finalRange ? (
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-sm text-gray-400">Low</div>
                        <div className="font-bold">{formatCurrency(selectedValuation.valuation.finalRange.low)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Mid</div>
                        <div className="font-bold text-blue-400">{formatCurrency(selectedValuation.valuation.finalRange.mid)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">High</div>
                        <div className="font-bold">{formatCurrency(selectedValuation.valuation.finalRange.high)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400 mb-2">
                        {formatCurrency(selectedValuation.valuation.mid)}
                      </div>
                      <div className="text-sm text-gray-400">
                        Range: {formatCurrency(selectedValuation.valuation.low)} - {formatCurrency(selectedValuation.valuation.high)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => downloadReport(selectedValuation)}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-300 inline-flex items-center justify-center gap-2"
                  >
                    <Download size={18} />
                    Download Report
                  </button>
                  <button
                    onClick={() => setSelectedValuation(null)}
                    className="px-6 py-3 bg-gray-700 text-white rounded-xl font-semibold hover:bg-gray-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;