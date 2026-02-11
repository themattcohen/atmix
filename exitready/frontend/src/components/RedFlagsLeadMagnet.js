import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Download, AlertTriangle, Shield, FileText, Mail, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const RedFlagsLeadMagnet = () => {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isGmail = email.toLowerCase().includes('@gmail.com');
    return emailRegex.test(email) && !isGmail;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !company) {
      setError('Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please use your business email address (Gmail addresses are not accepted)');
      return;
    }

    setIsSubmitting(true);

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      console.log('Backend URL:', backendUrl); // Debug log
      
      if (!backendUrl) {
        throw new Error('Backend URL not configured');
      }
      
      const requestBody = {
        email,
        company,
        lead_magnet: '23 Red Flags Assessment'
      };
      console.log('Request body:', requestBody); // Debug log
      
      const response = await fetch(`${backendUrl}/api/lead-magnet/red-flags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status); // Debug log
      
      if (response.ok) {
        setSubmitted(true);
        // Trigger PDF download
        window.open(`${backendUrl}/api/lead-magnet/red-flags-pdf`, '_blank');
      } else {
        const errorText = await response.text();
        console.error('Server error:', errorText); // Debug log
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.error('Form submission error:', error); // Debug log
      setError(`Something went wrong. Please try again. ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="glass-effect rounded-3xl p-8 lg:p-12 max-w-2xl mx-auto text-center"
        >
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-white" size={36} />
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-6">Success! Check Your Email</h1>
          <p className="text-xl text-gray-300 mb-8">
            Your PDF is being sent to <strong>{email}</strong> right now. 
            You should also see it downloading automatically.
          </p>
          <div className="bg-blue-600/20 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold mb-3">What's Next?</h3>
            <ul className="text-left space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-1 flex-shrink-0" size={16} />
                <span>Review the 23 red flags and assess your firm</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-1 flex-shrink-0" size={16} />
                <span>Take the personalized assessment to get your risk score</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-1 flex-shrink-0" size={16} />
                <span>Get a custom action plan based on your responses</span>
              </li>
            </ul>
          </div>
          <Link 
            to="/assessment"
            className="btn-primary px-8 py-4 rounded-full text-white font-semibold text-lg inline-flex items-center gap-3 pulse-glow"
          >
            Take Your Personalized Assessment <ArrowRight size={20} />
          </Link>
          <p className="text-gray-400 text-sm mt-6">
            <Link to="/" className="hover:text-blue-400 transition-colors">← Back to Exit Ready</Link>
          </p>
        </motion.div>
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
            <Link to="/" className="text-gray-300 hover:text-white transition-colors">
              <X size={24} />
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-32 pb-20">
        <div className="container-max">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                  <AlertTriangle className="text-white" size={24} />
                </div>
                <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-medium">
                  FREE ASSESSMENT
                </span>
              </div>
              
              <h1 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                The <span className="text-red-400">23 Red Flags</span> That Kill Accounting Firm Sales
              </h1>
              
              <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                Discover the hidden issues that derail exits before they happen. This comprehensive 
                checklist reveals the deal-killing problems that most firm owners don't even know they have.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
                  <span className="text-gray-300">Financial presentation red flags that scare buyers away</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
                  <span className="text-gray-300">Client concentration risks that reduce valuations</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
                  <span className="text-gray-300">Operational dependencies that kill deals</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
                  <span className="text-gray-300">Step-by-step action plan to fix critical issues</span>
                </div>
              </div>

              <div className="bg-blue-600/20 rounded-2xl p-6">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Shield className="text-blue-400" size={20} />
                  Battle-Tested by Real Experience
                </h3>
                <p className="text-gray-300 text-sm">
                  This assessment comes from someone who actually went through a 7-figure accounting firm exit. 
                  These aren't theoretical concerns - they're real issues that came up during my own sale process.
                </p>
              </div>
            </motion.div>

            {/* Right Column - Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="glass-effect rounded-3xl p-8 lg:p-10"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download className="text-white" size={24} />
                </div>
                <h2 className="text-2xl font-bold mb-2">Get Your Free Assessment</h2>
                <p className="text-gray-300">
                  Enter your business details to receive the complete 23 Red Flags checklist PDF
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Business Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@yourfirm.com"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Professional email required (Gmail addresses not accepted)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Company/Firm Name
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your Accounting Firm Name"
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
                  disabled={isSubmitting}
                  className="w-full btn-primary py-4 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Preparing Your PDF...
                    </>
                  ) : (
                    <>
                      <Mail size={20} />
                      Send Me the 23 Red Flags Assessment
                    </>
                  )}
                </button>

                <div className="text-center">
                  <p className="text-xs text-gray-400">
                    🔒 Your information is secure and will never be shared. 
                    You'll receive the PDF immediately and occasional updates about exit preparation.
                  </p>
                </div>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-700">
                <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <FileText size={16} />
                    <span>Professional PDF</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Download size={16} />
                    <span>Instant Download</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Shield size={16} />
                    <span>No Spam</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <section className="py-20 bg-slate-900/50">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">
              What's Inside the Assessment
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                title: "Financial Presentation",
                count: "5 Red Flags",
                description: "Revenue recognition, reporting consistency, documentation gaps"
              },
              {
                title: "Client Concentration",
                count: "5 Red Flags", 
                description: "Revenue concentration, industry risk, retention issues"
              },
              {
                title: "Operational Dependencies",
                count: "5 Red Flags",
                description: "Owner dependencies, process documentation, single points of failure"
              },
              {
                title: "Systems & Compliance",
                count: "8 Red Flags",
                description: "Technology, security, legal issues, strategic positioning"
              }
            ].map((category, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="glass-effect rounded-2xl p-6 text-center"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="text-white" size={20} />
                </div>
                <h3 className="font-semibold mb-2">{category.title}</h3>
                <div className="text-red-400 font-bold mb-2">{category.count}</div>
                <p className="text-gray-300 text-sm">{category.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default RedFlagsLeadMagnet;