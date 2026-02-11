import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { 
  Settings, 
  DollarSign, 
  TrendingUp, 
  Shield, 
  Save,
  Eye,
  EyeOff,
  Home,
  BarChart,
  Users,
  Calculator,
  FileText,
  Download
} from 'lucide-react';

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('multipliers');
  
  const { register, handleSubmit, formState: { errors } } = useForm();

  // Mock admin credentials (in production, this would be handled securely)
  const ADMIN_PASSWORD = "exitready2024";

  const onLogin = (data) => {
    if (data.password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert('Invalid password');
    }
  };

  // Mock valuation settings (these would come from a database in production)
  const [settings, setSettings] = useState({
    revenueMultipliers: {
      bookkeeping: 0.8,
      compilations: 1.0,
      reviews: 1.3,
      audits: 1.5,
      businessTax: 1.2,
      personalTax: 0.9,
      taxAdvisory: 1.8,
      consulting: 2.0,
      forensicAccounting: 2.2,
      businessValuation: 2.5
    },
    ebitdaMultipliers: {
      small: 2.5,  // <$500K revenue
      medium: 3.5, // $500K-$2M revenue
      large: 4.5   // >$2M revenue
    },
    qualityFactors: {
      clientRetentionWeight: 0.2,
      technologyWeight: 0.25,
      serviceWeight: 0.2,
      geographicWeight: 0.1,
      growthWeight: 0.1,
      employeeWeight: 0.15
    },
    riskAdjustments: {
      keyPersonDependency: -0.5,
      clientConcentration: -0.3,
      oldTechnology: -0.4,
      noSuccessionPlan: -0.3,
      marketDecline: -0.2
    }
  });

  const saveSettings = () => {
    // In production, this would save to database
    console.log('Settings saved:', settings);
    alert('Settings saved successfully!');
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
            <h1 className="text-3xl font-bold mb-2">Admin Access</h1>
            <p className="text-gray-300">Enter password to access valuation settings</p>
          </div>

          <form onSubmit={handleSubmit(onLogin)} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-3">Password</label>
              <div className="relative">
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter admin password"
                  className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-sm mt-2">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
            >
              Access Dashboard
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
              <span className="text-gray-400">Admin Dashboard</span>
            </div>
            <Link 
              to="/"
              className="text-gray-300 hover:text-white transition-colors duration-300 inline-flex items-center gap-2"
            >
              <Home size={18} />
              Back to Home
            </Link>
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
              Valuation <span className="text-gradient">Settings</span>
            </h1>
            <p className="text-xl text-gray-300">
              Configure multipliers and parameters for firm valuations
            </p>
          </motion.div>

          {/* Stats Overview */}
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <div className="glass-effect rounded-2xl p-6 text-center">
              <Calculator className="text-blue-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">127</div>
              <div className="text-gray-400">Total Valuations</div>
            </div>
            <div className="glass-effect rounded-2xl p-6 text-center">
              <Users className="text-green-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">89</div>
              <div className="text-gray-400">Unique Users</div>
            </div>
            <div className="glass-effect rounded-2xl p-6 text-center">
              <TrendingUp className="text-purple-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">$45M</div>
              <div className="text-gray-400">Total Value</div>
            </div>
            <div className="glass-effect rounded-2xl p-6 text-center">
              <BarChart className="text-yellow-400 mx-auto mb-3" size={32} />
              <div className="text-2xl font-bold mb-1">1.2x</div>
              <div className="text-gray-400">Avg Multiple</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="glass-effect rounded-3xl p-8">
            <div className="flex flex-wrap gap-4 mb-8">
              {[
                { id: 'multipliers', label: 'Revenue Multipliers', icon: DollarSign },
                { id: 'ebitda', label: 'EBITDA Multipliers', icon: TrendingUp },
                { id: 'quality', label: 'Quality Factors', icon: BarChart },
                { id: 'risk', label: 'Risk Adjustments', icon: Shield },
                { id: 'pdfs', label: 'Sample PDFs', icon: FileText }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 inline-flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Revenue Multipliers Tab */}
            {activeTab === 'multipliers' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold mb-6">Service-Specific Revenue Multipliers</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(settings.revenueMultipliers).map(([service, multiplier]) => (
                    <div key={service} className="bg-slate-800/50 rounded-xl p-4">
                      <label className="block text-sm font-semibold mb-2 capitalize">
                        {service.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={multiplier}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          revenueMultipliers: {
                            ...prev.revenueMultipliers,
                            [service]: parseFloat(e.target.value)
                          }
                        }))}
                        className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
                      />
                      <div className="text-xs text-gray-400 mt-1">{multiplier}x revenue</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* EBITDA Multipliers Tab */}
            {activeTab === 'ebitda' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold mb-6">EBITDA Multipliers by Firm Size</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  {Object.entries(settings.ebitdaMultipliers).map(([size, multiplier]) => (
                    <div key={size} className="bg-slate-800/50 rounded-xl p-6">
                      <label className="block text-lg font-semibold mb-3 capitalize">{size} Firms</label>
                      <input
                        type="number"
                        step="0.1"
                        value={multiplier}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          ebitdaMultipliers: {
                            ...prev.ebitdaMultipliers,
                            [size]: parseFloat(e.target.value)
                          }
                        }))}
                        className="w-full bg-slate-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-xl font-semibold focus:border-blue-400 focus:outline-none"
                      />
                      <div className="text-sm text-gray-400 mt-2">
                        {size === 'small' && '<$500K revenue'}
                        {size === 'medium' && '$500K-$2M revenue'}
                        {size === 'large' && '>$2M revenue'}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Quality Factors Tab */}
            {activeTab === 'quality' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold mb-6">Quality Score Weightings</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(settings.qualityFactors).map(([factor, weight]) => (
                    <div key={factor} className="bg-slate-800/50 rounded-xl p-4">
                      <label className="block text-sm font-semibold mb-2 capitalize">
                        {factor.replace(/([A-Z])/g, ' $1').replace('Weight', '').trim()}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={weight}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          qualityFactors: {
                            ...prev.qualityFactors,
                            [factor]: parseFloat(e.target.value)
                          }
                        }))}
                        className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
                      />
                      <div className="text-xs text-gray-400 mt-1">{(weight * 100).toFixed(1)}% weight</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Risk Adjustments Tab */}
            {activeTab === 'risk' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold mb-6">Risk Factor Adjustments</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {Object.entries(settings.riskAdjustments).map(([risk, adjustment]) => (
                    <div key={risk} className="bg-slate-800/50 rounded-xl p-4">
                      <label className="block text-sm font-semibold mb-2 capitalize">
                        {risk.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={adjustment}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          riskAdjustments: {
                            ...prev.riskAdjustments,
                            [risk]: parseFloat(e.target.value)
                          }
                        }))}
                        className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
                      />
                      <div className="text-xs text-gray-400 mt-1">
                        {adjustment > 0 ? '+' : ''}{adjustment} multiple adjustment
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Sample PDFs Tab */}
            {activeTab === 'pdfs' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold mb-6">Sample PDFs & Lead Magnets</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* 23 Red Flags Assessment */}
                  <div className="bg-slate-800/50 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                        <FileText className="text-white" size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold">23 Red Flags Assessment</h3>
                        <p className="text-gray-400 text-sm">Lead magnet PDF</p>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm mb-4">
                      Comprehensive checklist of issues that kill accounting firm sales. Perfect lead magnet for exit preparation.
                    </p>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          const backendUrl = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
                          window.open(`${backendUrl}/api/lead-magnet/red-flags-pdf`, '_blank');
                        }}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors duration-300 inline-flex items-center justify-center gap-2"
                      >
                        <Download size={16} />
                        Download PDF
                      </button>
                      <Link
                        to="/red-flags-assessment"
                        className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-colors duration-300 inline-flex items-center justify-center gap-2"
                      >
                        <Eye size={16} />
                        View Landing Page
                      </Link>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="text-xs text-gray-400">
                        <p><strong>Purpose:</strong> Lead capture for exit preparation</p>
                        <p><strong>Format:</strong> Professional branded PDF</p>
                        <p><strong>Usage:</strong> Email capture required (business emails only)</p>
                      </div>
                    </div>
                  </div>

                  {/* QOE Sample Reports */}
                  <div className="bg-slate-800/50 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                        <BarChart size={20} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold">QOE Sample Reports</h3>
                        <p className="text-gray-400 text-sm">Quality of Earnings</p>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm mb-4">
                      Sample Quality of Earnings reports showing the professional output format that buyers expect.
                    </p>
                    <div className="space-y-2">
                      <Link
                        to="/qoe"
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors duration-300 inline-flex items-center justify-center gap-2"
                      >
                        <Eye size={16} />
                        QOE Generator
                      </Link>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="text-xs text-gray-400">
                        <p><strong>Available:</strong> Basic ($997) & Comprehensive ($1,997)</p>
                        <p><strong>Format:</strong> Excel + PDF packages</p>
                        <p><strong>Features:</strong> Add-backs, client analysis, red flags</p>
                      </div>
                    </div>
                  </div>

                  {/* Valuation Reports */}
                  <div className="bg-slate-800/50 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <Calculator size={20} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Valuation Reports</h3>
                        <p className="text-gray-400 text-sm">Firm valuation PDFs</p>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm mb-4">
                      Sample valuation reports from both simple and detailed calculators showing comprehensive analysis.
                    </p>
                    <div className="space-y-2">
                      <Link
                        to="/calculator"
                        className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition-colors duration-300 inline-flex items-center justify-center gap-2"
                      >
                        <Calculator size={16} />
                        Valuation Calculator
                      </Link>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="text-xs text-gray-400">
                        <p><strong>Types:</strong> Quick & Comprehensive valuations</p>
                        <p><strong>Methods:</strong> Revenue & EBITDA multiples</p>
                        <p><strong>Features:</strong> Risk analysis, recommendations</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PDF Management Info */}
                <div className="bg-blue-600/20 rounded-2xl p-6 mt-8">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="text-blue-400" size={20} />
                    PDF Management Information
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
                    <div>
                      <h4 className="font-medium mb-2">Lead Magnet Strategy</h4>
                      <ul className="space-y-1 text-xs">
                        <li>• Red Flags Assessment captures business emails</li>
                        <li>• No Gmail addresses accepted</li>
                        <li>• Automatic PDF delivery + email storage</li>
                        <li>• Perfect for nurturing potential clients</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Quality Control</h4>
                      <ul className="space-y-1 text-xs">
                        <li>• All PDFs professionally branded</li>
                        <li>• Consistent Exit Ready styling</li>
                        <li>• Mobile-optimized viewing</li>
                        <li>• Download tracking available</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Save Button */}
            <div className="mt-8 pt-6 border-t border-gray-700">
              <button
                onClick={saveSettings}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-300 inline-flex items-center gap-3"
              >
                <Save size={20} />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;