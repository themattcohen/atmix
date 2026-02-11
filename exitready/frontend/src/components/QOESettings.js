import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { 
  Settings, 
  BarChart3, 
  DollarSign, 
  FileText, 
  Shield,
  Save,
  Eye,
  EyeOff,
  Home,
  Package,
  AlertTriangle,
  CheckCircle,
  Download,
  Edit3
} from 'lucide-react';

const QOESettings = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('packages');
  
  const { register, handleSubmit, formState: { errors } } = useForm();

  // Mock admin credentials
  const ADMIN_PASSWORD = "exitready2024";

  const onLogin = (data) => {
    if (data.password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert('Invalid password');
    }
  };

  // QOE Settings (editable configuration)
  const [qoeSettings, setQoeSettings] = useState({
    packages: {
      basic: {
        name: "Basic QOE Package",
        price: 997,
        description: "Essential quality of earnings analysis for smaller accounting firms",
        features: [
          "Financial statement normalization",
          "Basic add-back identification",
          "Client concentration analysis",
          "Excel analysis workbook",
          "Executive summary PDF",
          "Email support"
        ],
        deliverables: [
          "Executive Summary PDF",
          "Excel Analysis Workbook (3 tabs)",
          "Add-backs calculation worksheet",
          "Client concentration summary"
        ]
      },
      comprehensive: {
        name: "Comprehensive QOE Package",
        price: 1997,
        description: "Complete due diligence package for serious buyers and larger firms",
        features: [
          "Advanced financial analysis",
          "Detailed add-back documentation",
          "Full client anonymization",
          "Vendor categorization",
          "Risk assessment matrix",
          "PowerPoint buyer presentation",
          "Phone consultation included"
        ],
        deliverables: [
          "Executive Summary PDF (15+ pages)",
          "Detailed Excel Analysis (6 tabs)",
          "Professional PowerPoint presentation",
          "Anonymized client data export",
          "Due diligence response templates",
          "Q&A preparation guide"
        ]
      }
    },
    analysis: {
      addbackCategories: [
        { name: "Owner Compensation", description: "Above-market owner salary and benefits", typical: "15-25% of revenue" },
        { name: "One-time Expenses", description: "Non-recurring costs and investments", typical: "2-5% of revenue" },
        { name: "Personal Expenses", description: "Owner personal costs run through business", typical: "1-3% of revenue" },
        { name: "Depreciation", description: "Non-cash depreciation expense", typical: "1-2% of revenue" },
        { name: "Professional Fees", description: "Legal, accounting, consulting for transaction", typical: "1-2% of revenue" }
      ],
      redFlagThresholds: {
        clientConcentration: 20, // % - any client >20% is a red flag
        arAging: 90, // days - A/R >90 days old
        revenueDecline: 10, // % - >10% decline year-over-year
        ownerDependency: 75, // % - owner handles >75% of client relationships
        staffTurnover: 25 // % - annual staff turnover >25%
      },
      qualityMetrics: {
        excellentRetention: 95, // % client retention
        goodMargin: 25, // % profit margin
        strongGrowth: 15, // % revenue growth
        modernTech: 4, // technology score out of 5
        diversifiedServices: 5 // number of service lines
      }
    },
    templates: {
      executiveSummary: {
        sections: [
          "Engagement Overview",
          "Key Findings Summary", 
          "Quality of Earnings Analysis",
          "Add-backs Summary",
          "Red Flags Assessment",
          "Recommendations",
          "Appendices"
        ],
        standardText: {
          disclaimer: "This analysis is based on information provided by management and has not been audited.",
          scope: "Our analysis focused on the quality and sustainability of earnings for potential buyers.",
          methodology: "We employed industry-standard QOE procedures including normalization, add-back analysis, and risk assessment."
        }
      },
      excelTemplates: {
        basicTabs: ["Executive Summary", "General Ledger", "Add-backs", "Client Analysis"],
        comprehensiveTabs: ["Executive Summary", "General Ledger", "Revenue Analysis", "Add-backs", "Red Flags", "Client Concentration"],
        formulas: {
          normalizedEBITDA: "Net Income + Owner Salary + Add-backs",
          clientConcentration: "Top 5 clients / Total Revenue",
          marginAnalysis: "Gross Profit / Total Revenue"
        }
      }
    },
    pricing: {
      basicHourly: 150, // equivalent hourly rate for basic package
      comprehensiveHourly: 200, // equivalent hourly rate for comprehensive  
      rushFee: 0.5, // 50% surcharge for <7 day delivery
      revisionFee: 250, // per revision after first draft
      consultationRate: 300 // per hour for phone consultations
    }
  });

  const saveSettings = () => {
    // In production, this would save to database/backend
    console.log('QOE Settings saved:', qoeSettings);
    alert('QOE Settings saved successfully!');
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
              <BarChart3 size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">QOE Admin</h1>
            <p className="text-gray-300">Enter password to access QOE settings</p>
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
              Access QOE Settings
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/admin" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-2">
              <Home size={18} />
              Back to Admin
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
              <span className="text-gray-400">QOE Settings</span>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                to="/admin"
                className="text-gray-300 hover:text-white transition-colors duration-300 inline-flex items-center gap-2"
              >
                <Settings size={18} />
                Main Admin
              </Link>
              <Link 
                to="/"
                className="text-gray-300 hover:text-white transition-colors duration-300 inline-flex items-center gap-2"
              >
                <Home size={18} />
                Home
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
              QOE <span className="text-gradient">Configuration</span>
            </h1>
            <p className="text-xl text-gray-300">
              Configure Quality of Earnings packages, analysis parameters, and templates
            </p>
          </motion.div>

          {/* Tabs */}
          <div className="glass-effect rounded-3xl p-8">
            <div className="flex flex-wrap gap-4 mb-8">
              {[
                { id: 'packages', label: 'Package Settings', icon: Package },
                { id: 'analysis', label: 'Analysis Parameters', icon: BarChart3 },
                { id: 'templates', label: 'Report Templates', icon: FileText },
                { id: 'pricing', label: 'Pricing Structure', icon: DollarSign }
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

            {/* Package Settings Tab */}
            {activeTab === 'packages' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <h2 className="text-2xl font-bold mb-6">QOE Package Configuration</h2>
                
                {Object.entries(qoeSettings.packages).map(([packageKey, pkg]) => (
                  <div key={packageKey} className="bg-slate-800/50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold capitalize">{packageKey} Package</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-green-400">${pkg.price}</span>
                        <Edit3 size={18} className="text-gray-400" />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Package Name</label>
                        <input
                          type="text"
                          value={pkg.name}
                          onChange={(e) => setQoeSettings(prev => ({
                            ...prev,
                            packages: {
                              ...prev.packages,
                              [packageKey]: { ...prev.packages[packageKey], name: e.target.value }
                            }
                          }))}
                          className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2">Price ($)</label>
                        <input
                          type="number"
                          value={pkg.price}
                          onChange={(e) => setQoeSettings(prev => ({
                            ...prev,
                            packages: {
                              ...prev.packages,
                              [packageKey]: { ...prev.packages[packageKey], price: parseInt(e.target.value) }
                            }
                          }))}
                          className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-semibold mb-2">Description</label>
                      <textarea
                        value={pkg.description}
                        onChange={(e) => setQoeSettings(prev => ({
                          ...prev,
                          packages: {
                            ...prev.packages,
                            [packageKey]: { ...prev.packages[packageKey], description: e.target.value }
                          }
                        }))}
                        rows={2}
                        className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 mt-6">
                      <div>
                        <h4 className="font-semibold mb-3 text-blue-400">Features</h4>
                        <div className="space-y-2">
                          {pkg.features.map((feature, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-green-400" />
                              <span className="text-sm">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 text-purple-400">Deliverables</h4>
                        <div className="space-y-2">
                          {pkg.deliverables.map((deliverable, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <FileText size={16} className="text-blue-400" />
                              <span className="text-sm">{deliverable}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Analysis Parameters Tab */}
            {activeTab === 'analysis' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <h2 className="text-2xl font-bold mb-6">Analysis Parameters & Thresholds</h2>

                {/* Add-back Categories */}
                <div className="bg-slate-800/50 rounded-2xl p-6">
                  <h3 className="text-xl font-bold mb-4">Add-back Categories</h3>
                  <div className="space-y-4">
                    {qoeSettings.analysis.addbackCategories.map((category, index) => (
                      <div key={index} className="grid md:grid-cols-3 gap-4 p-4 bg-slate-700/50 rounded-lg">
                        <div>
                          <label className="block text-sm font-semibold mb-1">Category Name</label>
                          <input
                            type="text"
                            value={category.name}
                            className="w-full bg-slate-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Description</label>
                          <input
                            type="text"
                            value={category.description}
                            className="w-full bg-slate-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Typical Range</label>
                          <input
                            type="text"
                            value={category.typical}
                            className="w-full bg-slate-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                            readOnly
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Red Flag Thresholds */}
                <div className="bg-slate-800/50 rounded-2xl p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle className="text-red-400" size={24} />
                    Red Flag Thresholds
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(qoeSettings.analysis.redFlagThresholds).map(([key, value]) => (
                      <div key={key} className="bg-slate-700/50 rounded-lg p-4">
                        <label className="block text-sm font-semibold mb-2 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => setQoeSettings(prev => ({
                            ...prev,
                            analysis: {
                              ...prev.analysis,
                              redFlagThresholds: {
                                ...prev.analysis.redFlagThresholds,
                                [key]: parseFloat(e.target.value)
                              }
                            }
                          }))}
                          className="w-full bg-slate-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                        <span className="text-xs text-gray-400 mt-1">
                          {key.includes('Concentration') || key.includes('Decline') || key.includes('Dependency') || key.includes('Turnover') ? '%' : 
                           key.includes('Aging') ? 'days' : 'units'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quality Metrics */}
                <div className="bg-slate-800/50 rounded-2xl p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <CheckCircle className="text-green-400" size={24} />
                    Quality Metrics (Excellence Thresholds)
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(qoeSettings.analysis.qualityMetrics).map(([key, value]) => (
                      <div key={key} className="bg-slate-700/50 rounded-lg p-4">
                        <label className="block text-sm font-semibold mb-2 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => setQoeSettings(prev => ({
                            ...prev,
                            analysis: {
                              ...prev.analysis,
                              qualityMetrics: {
                                ...prev.analysis.qualityMetrics,
                                [key]: parseFloat(e.target.value)
                              }
                            }
                          }))}
                          className="w-full bg-slate-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                        <span className="text-xs text-gray-400 mt-1">
                          {key.includes('Retention') || key.includes('Margin') || key.includes('Growth') ? '%' : 
                           key.includes('Tech') ? '/5 scale' : 'count'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <h2 className="text-2xl font-bold mb-6">Report Templates & Structure</h2>

                {/* Executive Summary Template */}
                <div className="bg-slate-800/50 rounded-2xl p-6">
                  <h3 className="text-xl font-bold mb-4">Executive Summary Sections</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3 text-blue-400">Report Sections (in order)</h4>
                      <div className="space-y-2">
                        {qoeSettings.templates.executiveSummary.sections.map((section, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded">
                            <span className="text-blue-400 font-bold w-6">{index + 1}.</span>
                            <span className="text-sm">{section}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3 text-purple-400">Standard Text</h4>
                      <div className="space-y-3">
                        {Object.entries(qoeSettings.templates.executiveSummary.standardText).map(([key, text]) => (
                          <div key={key}>
                            <label className="block text-sm font-semibold mb-1 capitalize">{key}</label>
                            <textarea
                              value={text}
                              rows={2}
                              className="w-full bg-slate-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                              readOnly
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Excel Templates */}
                <div className="bg-slate-800/50 rounded-2xl p-6">
                  <h3 className="text-xl font-bold mb-4">Excel Template Structure</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3 text-green-400">Basic Package Tabs</h4>
                      <div className="space-y-2">
                        {qoeSettings.templates.excelTemplates.basicTabs.map((tab, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded">
                            <FileText size={16} className="text-green-400" />
                            <span className="text-sm">{tab}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3 text-blue-400">Comprehensive Package Tabs</h4>
                      <div className="space-y-2">
                        {qoeSettings.templates.excelTemplates.comprehensiveTabs.map((tab, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded">
                            <FileText size={16} className="text-blue-400" />
                            <span className="text-sm">{tab}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-semibold mb-3 text-purple-400">Standard Formulas</h4>
                    <div className="grid md:grid-cols-3 gap-4">
                      {Object.entries(qoeSettings.templates.excelTemplates.formulas).map(([key, formula]) => (
                        <div key={key} className="p-3 bg-slate-700/50 rounded">
                          <div className="text-sm font-semibold text-purple-400 mb-1 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                          <div className="text-xs text-gray-300 font-mono">{formula}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Pricing Tab */}
            {activeTab === 'pricing' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                <h2 className="text-2xl font-bold mb-6">Pricing Structure & Rates</h2>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(qoeSettings.pricing).map(([key, value]) => (
                    <div key={key} className="bg-slate-800/50 rounded-xl p-6">
                      <label className="block text-sm font-semibold mb-3 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">$</span>
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => setQoeSettings(prev => ({
                            ...prev,
                            pricing: {
                              ...prev.pricing,
                              [key]: parseFloat(e.target.value)
                            }
                          }))}
                          className="w-full bg-slate-700 border border-gray-600 rounded-lg px-3 py-2 text-white font-semibold text-lg"
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        {key.includes('Hourly') && 'per hour'}
                        {key.includes('Fee') && key !== 'rushFee' && 'flat fee'}
                        {key === 'rushFee' && 'multiplier (0.5 = 50% surcharge)'}
                        {key.includes('Rate') && 'per hour'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pricing Calculator */}
                <div className="bg-blue-600/20 rounded-2xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="text-blue-400" size={20} />
                    Pricing Validation
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-300">
                    <div>
                      <h4 className="font-medium mb-2">Basic Package Analysis</h4>
                      <ul className="space-y-1 text-xs">
                        <li>• Package Price: ${qoeSettings.packages.basic.price}</li>
                        <li>• Hourly Rate: ${qoeSettings.pricing.basicHourly}</li>
                        <li>• Hours Required: {(qoeSettings.packages.basic.price / qoeSettings.pricing.basicHourly).toFixed(1)}</li>
                        <li>• Break-even: {(qoeSettings.packages.basic.price / qoeSettings.pricing.basicHourly).toFixed(1)} hours</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Comprehensive Package Analysis</h4>
                      <ul className="space-y-1 text-xs">
                        <li>• Package Price: ${qoeSettings.packages.comprehensive.price}</li>
                        <li>• Hourly Rate: ${qoeSettings.pricing.comprehensiveHourly}</li>
                        <li>• Hours Required: {(qoeSettings.packages.comprehensive.price / qoeSettings.pricing.comprehensiveHourly).toFixed(1)}</li>
                        <li>• Break-even: {(qoeSettings.packages.comprehensive.price / qoeSettings.pricing.comprehensiveHourly).toFixed(1)} hours</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Save Button */}
            <div className="mt-8 pt-6 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Last saved: Never (demo mode)
                </div>
                <button
                  onClick={saveSettings}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-300 inline-flex items-center gap-3"
                >
                  <Save size={20} />
                  Save QOE Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QOESettings;