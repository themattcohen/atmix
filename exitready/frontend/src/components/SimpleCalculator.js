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
  Phone,
  FileText,
  Download,
  CheckCircle,
  UserPlus,
  Eye
} from 'lucide-react';
import { generateValuationPDF, sendValuationEmail } from '../utils/pdfGenerator';
import { getCurrentUser, saveValuationForUser, isAuthenticated } from '../utils/userAuth';

const SimpleCalculator = () => {
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

  // Watch form values for real-time calculation
  const formData = watch();

  // Simple valuation calculation
  const calculateValuation = (data) => {
    const revenue = parseFloat(data.grossRevenue) || 0;
    const netIncome = parseFloat(data.netIncome) || 0;
    const clients = parseInt(data.totalClients) || 0;
    
    // Basic revenue multiple (0.8x to 1.5x based on factors)
    let revenueMultiple = 1.0;
    
    // Adjust based on profit margin
    const profitMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0;
    if (profitMargin > 20) revenueMultiple += 0.3;
    else if (profitMargin > 15) revenueMultiple += 0.2;
    else if (profitMargin > 10) revenueMultiple += 0.1;
    
    // Adjust based on client count (indicates scale)
    if (clients > 200) revenueMultiple += 0.2;
    else if (clients > 100) revenueMultiple += 0.1;
    
    const baseValue = revenue * revenueMultiple;
    
    return {
      low: Math.round(baseValue * 0.85),
      mid: Math.round(baseValue),
      high: Math.round(baseValue * 1.15),
      multiple: revenueMultiple.toFixed(2)
    };
  };

  const onSubmit = async (data) => {
    const valuationResult = calculateValuation(data);
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
        valuation_type: 'simple',
        annual_revenue: parseFloat(data.grossRevenue),
        ebitda: parseFloat(data.netIncome), // Using net income as proxy for EBITDA in simple calc
        estimated_value: valuationResult.mid,
        industry: 'Professional Services', // Default for accounting firms
        firm_age: parseInt(data.yearsInBusiness),
        employee_count: Math.round(parseInt(data.totalClients) / 50), // Rough estimate
        growth_rate: null // Not collected in simple calc
      };

      const response = await fetch(`${backendUrl}/api/valuation/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Valuation submitted to backend:', result);
      }
    } catch (error) {
      console.error('Error submitting valuation data:', error);
      // Don't stop the process if backend submission fails
    }
    
    // Save to user account if logged in (both localStorage and backend)
    const currentUser = getCurrentUser();
    if (currentUser && isAuthenticated()) {
      // Save locally
      saveValuationForUser(currentUser.id, data, valuationResult, 'simple');
      
      // TODO: Also save to backend user account when user accounts are properly integrated
    }
    
    // Simulate sending email with PDF
    try {
      const emailResult = await sendValuationEmail(data.email, data, valuationResult, 'simple');
      if (emailResult.success) {
        setEmailSent(true);
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }
    
    console.log('Form submitted:', data);
    console.log('Valuation:', valuationResult);
  };

  const downloadPDF = async () => {
    if (!formDataForPDF || !valuation) return;
    
    setIsDownloading(true);
    try {
      const result = await generateValuationPDF(formDataForPDF, valuation, 'simple');
      if (result.success) {
        // PDF is automatically downloaded by the function
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
                  Quick Firm Valuation Calculator
                </h1>
                <p className="text-xl text-gray-300 max-w-4xl mx-auto mb-8">
                  Get a reliable estimate of your accounting firm's value using our industry-standard revenue multiple method. 
                  This calculator provides the same approach used by business brokers and is perfect for a quick assessment.
                </p>
                
                {/* How it works explanation */}
                <div className="glass-effect rounded-2xl p-6 max-w-3xl mx-auto mb-8">
                  <h2 className="text-xl font-semibold mb-4 flex items-center justify-center gap-2">
                    <Calculator size={24} className="text-blue-400" />
                    How This Valuation Works
                  </h2>
                  <div className="text-left space-y-3 text-gray-300">
                    <p><strong>1. Revenue Multiple Method:</strong> We use the proven industry approach of applying a multiple to your annual revenue</p>
                    <p><strong>2. Quality Adjustments:</strong> Your multiple is adjusted based on profit margins, client base, and operational factors</p>
                    <p><strong>3. Market-Based Results:</strong> Final valuation reflects current market conditions for accounting firm sales</p>
                  </div>
                </div>
              </motion.div>

              {/* Progress Bar */}
              <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-400">Step {step} of 2</span>
                  <span className="text-sm text-gray-400">{step === 1 ? 'Firm Details' : 'Contact Info'}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(step / 2) * 100}%` }}
                  ></div>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="glass-effect rounded-3xl p-8 lg:p-12">
                <AnimatePresence mode="wait">
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
                        Tell Us About Your Firm
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
                          <label className="block text-sm font-semibold mb-3">Years in Business</label>
                          <input
                            {...register('yearsInBusiness', { required: 'Years in business is required', min: 1 })}
                            type="number"
                            placeholder="e.g., 15"
                            className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                          />
                          {errors.yearsInBusiness && <p className="text-red-400 text-sm mt-2">{errors.yearsInBusiness.message}</p>}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-3 flex items-center gap-2">
                          <DollarSign size={18} className="text-green-400" />
                          Annual Gross Revenue
                        </label>
                        <input
                          {...register('grossRevenue', { required: 'Gross revenue is required', min: 50000 })}
                          type="number"
                          placeholder="e.g., 750000"
                          className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                        />
                        {errors.grossRevenue && <p className="text-red-400 text-sm mt-2">{errors.grossRevenue.message}</p>}
                        <p className="text-gray-400 text-sm mt-2">Enter your most recent year's gross revenue</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-3 flex items-center gap-2">
                          <DollarSign size={18} className="text-green-400" />
                          Net Income (Profit)
                        </label>
                        <input
                          {...register('netIncome', { required: 'Net income is required' })}
                          type="number"
                          placeholder="e.g., 150000"
                          className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                        />
                        {errors.netIncome && <p className="text-red-400 text-sm mt-2">{errors.netIncome.message}</p>}
                        <p className="text-gray-400 text-sm mt-2">Net profit after all expenses</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-3 flex items-center gap-2">
                          <Users size={18} className="text-blue-400" />
                          Total Number of Clients
                        </label>
                        <input
                          {...register('totalClients', { required: 'Total clients is required', min: 1 })}
                          type="number"
                          placeholder="e.g., 150"
                          className="w-full bg-slate-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
                        />
                        {errors.totalClients && <p className="text-red-400 text-sm mt-2">{errors.totalClients.message}</p>}
                      </div>

                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-300 flex items-center justify-center gap-3"
                      >
                        Continue to Contact Info
                      </button>
                    </motion.div>
                  )}

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
                        <Mail className="text-blue-400" size={32} />
                        Get Your Valuation Report
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
                        <p className="text-gray-400 text-sm mt-2">We'll send your valuation report to this email</p>
                      </div>

                      <div className="bg-slate-800/50 rounded-xl p-6">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <FileText size={20} className="text-blue-400" />
                          What You'll Receive
                        </h3>
                        <ul className="space-y-2 text-gray-300">
                          <li className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-400" />
                            Instant valuation range for your firm
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-400" />
                            Professional PDF report via email
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-400" />
                            Key factors affecting your value
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-400" />
                            Tips for maximizing your sale price
                          </li>
                        </ul>
                      </div>

                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="flex-1 bg-gray-700 text-white py-4 rounded-xl font-semibold hover:bg-gray-600 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-300 flex items-center justify-center gap-3"
                        >
                          Get My Valuation <Calculator size={20} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </>
          ) : (
            /* Results Page */
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <div className="glass-effect rounded-3xl p-8 lg:p-12 mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8">
                  <CheckCircle size={40} className="text-white" />
                </div>
                
                <h1 className="text-4xl lg:text-5xl font-bold mb-6">
                  Your Firm's Estimated Value
                </h1>
                
                <div className="mb-8">
                  <div className="text-6xl lg:text-7xl font-bold text-gradient mb-4">
                    {formatCurrency(valuation?.mid)}
                  </div>
                  <div className="text-xl text-gray-300 mb-6">
                    Range: {formatCurrency(valuation?.low)} - {formatCurrency(valuation?.high)}
                  </div>
                  <div className="inline-flex items-center gap-2 bg-blue-600/20 px-4 py-2 rounded-full">
                    <span className="text-blue-400 font-semibold">Revenue Multiple:</span>
                    <span className="text-white">{valuation?.multiple}x</span>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-6 mb-8">
                  <h3 className="text-xl font-semibold mb-4">Key Insights</h3>
                  <div className="text-left space-y-3 text-gray-300">
                    <p>• Your valuation is based on a {valuation?.multiple}x revenue multiple</p>
                    <p>• This puts you in the {valuation?.multiple > 1.2 ? 'above-average' : 'typical'} range for accounting firms</p>
                    <p>• A detailed analysis could identify additional value drivers</p>
                  </div>
                  {emailSent && (
                    <div className="mt-4 p-3 bg-green-600/20 border border-green-600/30 rounded-lg">
                      <p className="text-green-400 text-sm">
                        ✓ Report has been generated and downloaded. In production, this would also be emailed to you.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button 
                    onClick={downloadPDF}
                    disabled={isDownloading}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 inline-flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    <Download size={20} />
                    {isDownloading ? 'Generating PDF...' : 'Download Full Report'}
                  </button>
                  <Link 
                    to="/calculator/detailed"
                    className="bg-gray-700 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-600 transition-colors inline-flex items-center justify-center gap-3"
                  >
                    Get Detailed Analysis
                  </Link>
                </div>

                {/* Account Creation Prompt */}
                {!isAuthenticated() && (
                  <div className="mt-8 p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl">
                    <div className="text-center">
                      <UserPlus className="mx-auto mb-3 text-blue-400" size={32} />
                      <h3 className="text-xl font-semibold mb-3">Save Your Valuation</h3>
                      <p className="text-gray-300 mb-4">
                        Create a free account to save this valuation, access your reports anytime, and track your firm's progress over time.
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
                      Valuation saved to your account! 
                      <Link to="/user/dashboard" className="underline ml-2">View Dashboard</Link>
                    </p>
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className="text-gray-400 mb-4">
                  Want to discuss your results? Contact Matt directly:
                </p>
                <a 
                  href="mailto:1mattcohen@gmail.com"
                  className="text-blue-400 hover:text-blue-300 font-semibold"
                >
                  1mattcohen@gmail.com
                </a>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleCalculator;