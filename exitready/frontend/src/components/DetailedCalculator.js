import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { 
  ChevronLeft, 
  Calculator, 
  DollarSign, 
  Users, 
  Building,
  Mail,
  Settings,
  FileText,
  Download,
  CheckCircle,
  Target,
  TrendingUp,
  BarChart,
  UserPlus,
  Eye
} from 'lucide-react';
import { generateValuationPDF, sendValuationEmail } from '../utils/pdfGenerator';
import { getCurrentUser, saveValuationForUser, isAuthenticated } from '../utils/userAuth';

const DetailedCalculator = () => {
  const [step, setStep] = useState(1);
  const [valuation, setValuation] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formDataForPDF, setFormDataForPDF] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm();

  // Auto-populate user information if logged in
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser && isAuthenticated()) {
      setValue('contactName', currentUser.name);
      setValue('email', currentUser.email);
    }
  }, [setValue]);

  // Advanced valuation calculation
  const calculateDetailedValuation = (data) => {
    const revenue = parseFloat(data.grossRevenue) || 0;
    const netIncome = parseFloat(data.netIncome) || 0;
    const clients = parseInt(data.totalClients) || 0;
    const recurringClients = parseInt(data.recurringClients) || 0;
    const employees = parseInt(data.totalEmployees) || 0;
    const technologyLevel = parseInt(data.technologyLevel) || 1;
    const retentionRate = parseFloat(data.clientRetentionRate) || 80;
    const ownerSalary = parseFloat(data.ownerSalary) || 0;
    
    // Quality Score Calculation (0-100)
    let qualityScore = 0;
    
    // Client retention (max 20 points)
    qualityScore += Math.min((retentionRate - 80) * 0.5, 20);
    
    // Technology adoption (max 25 points)
    qualityScore += (technologyLevel - 1) * 6.25;
    
    // Service diversification based on selected services (max 20 points)
    const services = data.services || [];
    qualityScore += Math.min(services.length * 2.5, 20);
    
    // Recurring client percentage (max 20 points)
    const recurringPercentage = clients > 0 ? (recurringClients / clients) * 100 : 0;
    qualityScore += Math.min(recurringPercentage * 0.2, 20);
    
    // Employee leverage (max 15 points)
    if (employees > 5) qualityScore += 15;
    else if (employees > 2) qualityScore += 10;
    else if (employees > 0) qualityScore += 5;
    
    // Revenue Multiple Method
    let revenueMultiple = 1.0 + (qualityScore * 0.015); // 0.015 per quality point
    revenueMultiple = Math.min(Math.max(revenueMultiple, 0.5), 2.5);
    const revenueValue = revenue * revenueMultiple;
    
    // EBITDA Method
    const adjustedEBITDA = netIncome + ownerSalary + 10000; // Basic addbacks
    let ebitdaMultiple = 3.0;
    
    if (revenue > 2000000) ebitdaMultiple = 4.5;
    else if (revenue > 500000) ebitdaMultiple = 3.5;
    else ebitdaMultiple = 2.5;
    
    // Quality adjustments to EBITDA multiple
    ebitdaMultiple += (qualityScore / 100) * 1.5;
    
    const cashFlowValue = adjustedEBITDA * ebitdaMultiple;
    
    // Asset-based method
    const intangibleValue = revenue * 0.6; // 60% of revenue for client relationships
    const assetValue = 50000 + intangibleValue; // Assume $50k tangible assets
    
    // Final valuation (weighted average)
    const weightedValue = (revenueValue * 0.4) + (cashFlowValue * 0.5) + (assetValue * 0.1);
    
    return {
      methods: {
        revenue: {
          value: Math.round(revenueValue),
          multiple: revenueMultiple.toFixed(2),
          confidence: revenueValue > 100000 ? 'high' : 'medium'
        },
        cashFlow: {
          value: Math.round(cashFlowValue),
          adjustedEBITDA: Math.round(adjustedEBITDA),
          multiple: ebitdaMultiple.toFixed(2),
          confidence: adjustedEBITDA > 50000 ? 'high' : 'medium'
        },
        asset: {
          value: Math.round(assetValue),
          confidence: 'medium'
        }
      },
      finalRange: {
        low: Math.round(weightedValue * 0.8),
        mid: Math.round(weightedValue),
        high: Math.round(weightedValue * 1.2)
      },
      qualityScore: Math.round(qualityScore),
      recommendations: generateRecommendations(data, qualityScore)
    };
  };

  const generateRecommendations = (data, qualityScore) => {
    const recommendations = [];
    
    if (qualityScore < 60) {
      recommendations.push("Focus on improving client retention through better service delivery");
    }
    if (parseInt(data.technologyLevel) < 4) {
      recommendations.push("Invest in modern cloud-based technology to increase efficiency");
    }
    if (parseInt(data.totalEmployees) < 3) {
      recommendations.push("Consider hiring additional staff to reduce owner dependency");
    }
    
    return recommendations;
  };

  const onSubmit = async (data) => {
    const valuationResult = calculateDetailedValuation(data);
    setValuation(valuationResult);
    setFormDataForPDF(data);
    setIsSubmitted(true);
    
    // Submit valuation data to backend for lead tracking
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const submissionData = {
        company_name: data.firmName,
        email: data.email,
        phone: data.phone,
        valuation_type: 'detailed',
        annual_revenue: parseFloat(data.grossRevenue),
        ebitda: parseFloat(data.netIncome) + parseFloat(data.ownerSalary || 0), // Better EBITDA calculation
        estimated_value: valuationResult.finalRange.mid,
        industry: 'Professional Services',
        firm_age: new Date().getFullYear() - parseInt(data.yearEstablished),
        employee_count: parseInt(data.totalEmployees),
        growth_rate: data.priorYearRevenue ? ((parseFloat(data.grossRevenue) - parseFloat(data.priorYearRevenue)) / parseFloat(data.priorYearRevenue)) * 100 : null
      };

      await fetch(`${backendUrl}/api/valuation/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData)
      });
    } catch (error) {
      console.error('Error submitting valuation data:', error);
      // Don't stop the process if backend submission fails
    }
    
    // Save to user account if logged in
    const currentUser = getCurrentUser();
    if (currentUser && isAuthenticated()) {
      saveValuationForUser(currentUser.id, data, valuationResult, 'detailed');
    }
    
    // Simulate sending email with PDF
    try {
      const emailResult = await sendValuationEmail(data.email, data, valuationResult, 'detailed');
      if (emailResult.success) {
        setEmailSent(true);
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }
    
    console.log('Detailed form submitted:', data);
    console.log('Detailed valuation:', valuationResult);
  };

  const downloadPDF = async () => {
    if (!formDataForPDF || !valuation) return;
    
    setIsDownloading(true);
    try {
      const result = await generateValuationPDF(formDataForPDF, valuation, 'detailed');
      if (result.success) {
        console.log('PDF generated successfully');
      } else {
        alert('Error generating PDF: ' + result.error);
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF');
    } finally {
      setIsDownloading(false);
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

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-effect">
        <div className="container-max">
          <div className="flex items-center justify-between py-4 px-6">
            <Link to="/" className="text-2xl font-bold text-gradient">
              Exit Ready
            </Link>
            <Link 
              to="/calculator"
              className="text-gray-300 hover:text-white transition-colors duration-300 inline-flex items-center gap-2"
            >
              <ChevronLeft size={18} /> Back to Options
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-32 pb-20 section-padding">
        <div className="container-max max-w-4xl mx-auto">
          
          {!isSubmitted ? (
            <>
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-center mb-12"
              >
                <h1 className="text-4xl lg:text-5xl font-bold mb-6">
                  Comprehensive <span className="text-gradient">Analysis</span>
                </h1>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                  Get a detailed valuation using multiple methodologies and professional insights
                </p>
              </motion.div>

              {/* Progress Bar */}
              <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-400">Step {step} of 4</span>
                  <span className="text-sm text-gray-400">
                    {step === 1 && 'Basic Information'}
                    {step === 2 && 'Financial Details'}
                    {step === 3 && 'Practice Details'}
                    {step === 4 && 'Contact Information'}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(step / 4) * 100}%` }}
                  ></div>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="glass-effect rounded-3xl p-8 lg:p-12">
                <AnimatePresence mode="wait">
                  {/* Step 1: Basic Information */}
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-8"
                    >
                      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                        <Building className="text-blue-400" size={32} />
                        Basic Firm Information
                      </h2>

                      <div className="grid md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-sm font-semibold mb-3">Firm Name</label>
                          <input
                            {...register('firmName', { required: 'Firm name is required' })}
                            type="text"
                            placeholder="Your Firm Name"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                          {errors.firmName && <p className="text-red-400 text-sm mt-2">{errors.firmName.message}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-3">Year Established</label>
                          <input
                            {...register('yearEstablished', { required: 'Year established is required', min: 1950, max: 2024 })}
                            type="number"
                            placeholder="e.g., 2010"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                          {errors.yearEstablished && <p className="text-red-400 text-sm mt-2">{errors.yearEstablished.message}</p>}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-sm font-semibold mb-3">Legal Structure</label>
                          <select
                            {...register('legalStructure', { required: 'Legal structure is required' })}
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-blue-400 focus:outline-none transition-colors"
                          >
                            <option value="">Select Structure</option>
                            <option value="LLC">LLC</option>
                            <option value="Corporation">Corporation</option>
                            <option value="Partnership">Partnership</option>
                            <option value="Sole Proprietorship">Sole Proprietorship</option>
                          </select>
                          {errors.legalStructure && <p className="text-red-400 text-sm mt-2">{errors.legalStructure.message}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-3">Market Type</label>
                          <select
                            {...register('marketType', { required: 'Market type is required' })}
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-blue-400 focus:outline-none transition-colors"
                          >
                            <option value="">Select Market</option>
                            <option value="urban">Urban</option>
                            <option value="suburban">Suburban</option>
                            <option value="rural">Rural</option>
                          </select>
                          {errors.marketType && <p className="text-red-400 text-sm mt-2">{errors.marketType.message}</p>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={nextStep}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
                      >
                        Continue to Financial Details
                      </button>
                    </motion.div>
                  )}

                  {/* Step 2: Financial Details */}
                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-8"
                    >
                      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                        <DollarSign className="text-green-400" size={32} />
                        Financial Information
                      </h2>

                      <div className="grid md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-sm font-semibold mb-3">Annual Gross Revenue</label>
                          <input
                            {...register('grossRevenue', { required: 'Gross revenue is required', min: 50000 })}
                            type="number"
                            placeholder="e.g., 750000"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                          {errors.grossRevenue && <p className="text-red-400 text-sm mt-2">{errors.grossRevenue.message}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-3">Net Income</label>
                          <input
                            {...register('netIncome', { required: 'Net income is required' })}
                            type="number"
                            placeholder="e.g., 150000"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                          {errors.netIncome && <p className="text-red-400 text-sm mt-2">{errors.netIncome.message}</p>}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-sm font-semibold mb-3">Owner Salary</label>
                          <input
                            {...register('ownerSalary', { required: 'Owner salary is required' })}
                            type="number"
                            placeholder="e.g., 100000"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                          {errors.ownerSalary && <p className="text-red-400 text-sm mt-2">{errors.ownerSalary.message}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-3">Prior Year Revenue (Optional)</label>
                          <input
                            {...register('priorYearRevenue')}
                            type="number"
                            placeholder="e.g., 700000"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={prevStep}
                          className="flex-1 bg-gray-700 text-white py-4 rounded-xl font-semibold hover:bg-gray-600 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={nextStep}
                          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
                        >
                          Continue to Practice Details
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Practice Details */}
                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-8"
                    >
                      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                        <Settings className="text-purple-400" size={32} />
                        Practice Details
                      </h2>

                      <div className="grid md:grid-cols-3 gap-8">
                        <div>
                          <label className="block text-sm font-semibold mb-3">Total Clients</label>
                          <input
                            {...register('totalClients', { required: 'Total clients is required', min: 1 })}
                            type="number"
                            placeholder="e.g., 150"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-3">Recurring Clients</label>
                          <input
                            {...register('recurringClients', { required: 'Recurring clients is required' })}
                            type="number"
                            placeholder="e.g., 120"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-3">Total Employees</label>
                          <input
                            {...register('totalEmployees', { required: 'Total employees is required', min: 0 })}
                            type="number"
                            placeholder="e.g., 5"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-sm font-semibold mb-3">Technology Level (1-5 scale)</label>
                          <select
                            {...register('technologyLevel', { required: 'Technology level is required' })}
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-blue-400 focus:outline-none transition-colors"
                          >
                            <option value="">Select Level</option>
                            <option value="1">1 - Mostly paper-based</option>
                            <option value="2">2 - Basic desktop software</option>
                            <option value="3">3 - Some cloud solutions</option>
                            <option value="4">4 - Mostly cloud-based</option>
                            <option value="5">5 - Fully integrated cloud platform</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-3">Client Retention Rate (%)</label>
                          <input
                            {...register('clientRetentionRate', { required: 'Retention rate is required', min: 60, max: 100 })}
                            type="number"
                            placeholder="e.g., 85"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-3">Services Offered (Check all that apply)</label>
                        <div className="grid md:grid-cols-3 gap-4">
                          {[
                            'Bookkeeping', 'Tax Preparation', 'Payroll', 'Audits', 'Reviews', 
                            'Compilations', 'Business Consulting', 'Financial Planning', 'Other'
                          ].map((service) => (
                            <label key={service} className="flex items-center gap-3 p-3 glass-effect rounded-lg cursor-pointer hover:bg-white/10">
                              <input
                                type="checkbox"
                                {...register('services')}
                                value={service}
                                className="w-4 h-4 text-blue-400 bg-gray-700 border-gray-600 rounded focus:ring-blue-400"
                              />
                              <span className="text-sm">{service}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={prevStep}
                          className="flex-1 bg-gray-700 text-white py-4 rounded-xl font-semibold hover:bg-gray-600 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={nextStep}
                          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
                        >
                          Continue to Contact Info
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Contact Information */}
                  {step === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-8"
                    >
                      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                        <Mail className="text-blue-400" size={32} />
                        Get Your Comprehensive Report
                      </h2>

                      <div className="grid md:grid-cols-2 gap-8">
                        <div>
                          <label className="block text-sm font-semibold mb-3">Full Name</label>
                          <input
                            {...register('contactName', { required: 'Name is required' })}
                            type="text"
                            placeholder="John Smith"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                          {errors.contactName && <p className="text-red-400 text-sm mt-2">{errors.contactName.message}</p>}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-3">Phone Number (Optional)</label>
                          <input
                            {...register('phone')}
                            type="tel"
                            placeholder="(555) 123-4567"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-3">Email Address</label>
                        <input
                          {...register('email', { 
                            required: 'Email is required',
                            pattern: {
                              value: /^\S+@\S+$/i,
                              message: 'Please enter a valid email address'
                            }
                          })}
                          type="email"
                          placeholder="john@yourfirm.com"
                          className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                        />
                        {errors.email && <p className="text-red-400 text-sm mt-2">{errors.email.message}</p>}
                      </div>

                      <div className="bg-slate-800/50 rounded-xl p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <FileText size={20} className="text-blue-400" />
                          Your 15-Page Comprehensive Report Includes:
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <ul className="space-y-2 text-gray-300">
                            <li className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-green-400" />
                              Multiple valuation methodologies
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-green-400" />
                              Quality score breakdown
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-green-400" />
                              Industry benchmarking
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-green-400" />
                              Risk factor analysis
                            </li>
                          </ul>
                          <ul className="space-y-2 text-gray-300">
                            <li className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-green-400" />
                              Value improvement recommendations
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-green-400" />
                              Market positioning advice
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-green-400" />
                              Exit preparation timeline
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle size={16} className="text-green-400" />
                              Professional presentation
                            </li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={prevStep}
                          className="flex-1 bg-gray-700 text-white py-4 rounded-xl font-semibold hover:bg-gray-600 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-300 flex items-center justify-center gap-3"
                        >
                          Generate Analysis <Target size={20} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </>
          ) : (
            /* Detailed Results Page */
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="glass-effect rounded-3xl p-8 lg:p-12 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-8">
                  <BarChart size={40} className="text-white" />
                </div>
                
                <h1 className="text-4xl lg:text-5xl font-bold mb-6">
                  Comprehensive Valuation Analysis
                </h1>
                
                <div className="mb-8">
                  <div className="text-6xl lg:text-7xl font-bold text-gradient mb-4">
                    {formatCurrency(valuation?.finalRange?.mid)}
                  </div>
                  <div className="text-xl text-gray-300 mb-6">
                    Range: {formatCurrency(valuation?.finalRange?.low)} - {formatCurrency(valuation?.finalRange?.high)}
                  </div>
                  <div className="inline-flex items-center gap-2 bg-blue-600/20 px-4 py-2 rounded-full">
                    <span className="text-blue-400 font-semibold">Quality Score:</span>
                    <span className="text-white">{valuation?.qualityScore}/100</span>
                  </div>
                </div>
              </div>

              {/* Valuation Methods Breakdown */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="glass-effect rounded-2xl p-6">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="text-green-400" size={24} />
                    Revenue Multiple
                  </h3>
                  <div className="text-3xl font-bold text-green-400 mb-2">
                    {formatCurrency(valuation?.methods?.revenue?.value)}
                  </div>
                  <p className="text-gray-300">
                    {valuation?.methods?.revenue?.multiple}x revenue multiple
                  </p>
                  <div className="mt-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      valuation?.methods?.revenue?.confidence === 'high' ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'
                    }`}>
                      {valuation?.methods?.revenue?.confidence} confidence
                    </span>
                  </div>
                </div>

                <div className="glass-effect rounded-2xl p-6">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="text-blue-400" size={24} />
                    Cash Flow Multiple
                  </h3>
                  <div className="text-3xl font-bold text-blue-400 mb-2">
                    {formatCurrency(valuation?.methods?.cashFlow?.value)}
                  </div>
                  <p className="text-gray-300">
                    {valuation?.methods?.cashFlow?.multiple}x EBITDA
                  </p>
                  <p className="text-sm text-gray-400">
                    Adjusted EBITDA: {formatCurrency(valuation?.methods?.cashFlow?.adjustedEBITDA)}
                  </p>
                </div>

                <div className="glass-effect rounded-2xl p-6">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Building className="text-purple-400" size={24} />
                    Asset Based
                  </h3>
                  <div className="text-3xl font-bold text-purple-400 mb-2">
                    {formatCurrency(valuation?.methods?.asset?.value)}
                  </div>
                  <p className="text-gray-300">
                    Tangible + intangible assets
                  </p>
                </div>
              </div>

              {/* Recommendations */}
              {valuation?.recommendations?.length > 0 && (
                <div className="glass-effect rounded-2xl p-8">
                  <h3 className="text-2xl font-bold mb-6">Value Enhancement Recommendations</h3>
                  <div className="space-y-4">
                    {valuation.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold mt-1">
                          {index + 1}
                        </div>
                        <p className="text-gray-300">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Confirmation */}
              {emailSent && (
                <div className="glass-effect rounded-2xl p-6 mb-8">
                  <div className="flex items-center gap-3 text-green-400 mb-2">
                    <CheckCircle size={20} />
                    <h3 className="font-semibold">Report Generated Successfully</h3>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Your comprehensive valuation report has been generated and downloaded. 
                    In production, this would also be emailed to your provided address.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={downloadPDF}
                  disabled={isDownloading}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 inline-flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <Download size={20} />
                  {isDownloading ? 'Generating PDF...' : 'Download 15-Page Report'}
                </button>
                <a 
                  href="mailto:1mattcohen@gmail.com"
                  className="bg-gray-700 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-600 transition-colors inline-flex items-center justify-center gap-3"
                >
                  <Mail size={20} />
                  Schedule Consultation
                </a>
              </div>

              {/* Account Creation Prompt */}
              {!isAuthenticated() && (
                <div className="mt-8 p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl">
                  <div className="text-center">
                    <UserPlus className="mx-auto mb-3 text-blue-400" size={32} />
                    <h3 className="text-xl font-semibold mb-3">Save Your Comprehensive Analysis</h3>
                    <p className="text-gray-300 mb-4">
                      Create a free account to save this detailed valuation, access your 15-page report anytime, and track your firm's value over time.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link
                        to="/user/auth"
                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-300 inline-flex items-center justify-center gap-2"
                      >
                        <UserPlus size={18} />
                        Create Free Account
                      </Link>
                      <Link
                        to="/user/dashboard"
                        className="text-blue-400 hover:text-blue-300 px-6 py-3 rounded-xl font-semibold border border-blue-400/30 hover:border-blue-300/50 transition-all duration-300 inline-flex items-center justify-center gap-2"
                      >
                        <Eye size={18} />
                        Already Have Account?
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {isAuthenticated() && (
                <div className="mt-8 p-4 bg-green-600/20 border border-green-600/30 rounded-xl text-center">
                  <CheckCircle className="mx-auto mb-2 text-green-400" size={24} />
                  <p className="text-green-400 font-semibold">
                    Comprehensive analysis saved to your account! 
                    <Link to="/user/dashboard" className="underline ml-2">View Dashboard</Link>
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailedCalculator;