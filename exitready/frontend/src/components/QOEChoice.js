import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Upload,
  FileText,
  BarChart3,
  Shield,
  CheckCircle,
  Calendar,
  DollarSign,
  TrendingUp
} from 'lucide-react';

const QOEChoice = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="p-6 lg:p-8">
        <div className="container-max">
          <Link 
            to="/"
            className="text-espresso-black hover:text-trust-teal transition-colors duration-300 inline-flex items-center gap-2"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 lg:px-8 pb-20">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl lg:text-7xl font-bold mb-8 text-espresso-black">
              <span className="text-trust-teal">Quality of Earnings</span>
              <br />Package Generator
            </h1>
            <p className="text-xl lg:text-2xl text-espresso-black/80 mb-6 max-w-4xl mx-auto leading-relaxed">
              Transform your financial data into buyer-ready QOE packages that highlight your firm's strengths 
              and address potential concerns proactively.
            </p>
            <p className="text-lg text-espresso-black/60 max-w-3xl mx-auto">
              Perfect for accounting firms with $1-10M revenue preparing for due diligence conversations.
            </p>
          </motion.div>

          {/* Process Overview */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12 text-espresso-black">
              Simple 4-Step Process
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  step: "1",
                  title: "Upload Data",
                  description: "General ledger, customer revenue, and client lists",
                  icon: Upload,
                  color: "bg-trust-teal"
                },
                {
                  step: "2", 
                  title: "Map Accounts",
                  description: "Intelligent mapping to standardized chart of accounts",
                  icon: BarChart3,
                  color: "bg-ledger-gold"
                },
                {
                  step: "3",
                  title: "Identify Add-backs",
                  description: "Categorize owner add-backs and normalize EBITDA",
                  icon: TrendingUp,
                  color: "bg-trail-green"
                },
                {
                  step: "4",
                  title: "Generate Package",
                  description: "Professional reports ready for buyer review",
                  icon: FileText,
                  color: "bg-trust-teal"
                }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  className="bg-white rounded-xl p-6 text-center relative border border-trust-teal/10 hover:border-trust-teal/30 transition-colors"
                >
                  <div className={`w-16 h-16 ${item.color} rounded-full flex items-center justify-center mx-auto mb-4 relative z-10`}>
                    <item.icon className="text-white" size={24} />
                  </div>
                  <div className={`absolute top-3 right-3 w-8 h-8 ${item.color} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-3 text-espresso-black">{item.title}</h3>
                  <p className="text-espresso-black/70 text-sm">{item.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Package Options */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid lg:grid-cols-2 gap-8 mb-16"
          >
            {/* Basic Package */}
            <div className="bg-white rounded-2xl p-8 lg:p-10 border border-trust-teal/10 hover:border-trust-teal/30 transition-colors">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-trust-teal rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText className="text-white" size={32} />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold mb-4 text-espresso-black">
                  Basic QOE Package
                </h3>
                <p className="text-espresso-black/70 mb-6">
                  Essential financial analysis and add-back identification for straightforward firm sales.
                </p>
                <div className="text-4xl font-bold text-trust-teal mb-2">$997</div>
                <p className="text-espresso-black/60 text-sm">One-time fee</p>
              </div>

              <ul className="space-y-4 mb-8">
                {[
                  "General ledger upload and mapping",
                  "Basic add-back identification", 
                  "EBITDA normalization analysis",
                  "Executive summary report",
                  "Excel financial analysis package",
                  "Revenue concentration analysis"
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="text-trail-green mt-1 flex-shrink-0" size={18} />
                    <span className="text-espresso-black/80 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link 
                to="/qoe/basic"
                className="bg-trust-teal hover:bg-trust-teal/90 w-full py-4 rounded-full text-white font-semibold text-lg inline-flex items-center justify-center gap-3 transition-colors"
              >
                Start Basic Package <ArrowRight size={20} />
              </Link>
            </div>

            {/* Comprehensive Package */}
            <div className="bg-white rounded-2xl p-8 lg:p-10 border border-trust-teal/10 hover:border-trust-teal/30 transition-colors relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-ledger-gold text-espresso-black px-3 py-1 rounded-full text-sm font-bold">
                Most Popular
              </div>
              
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-trail-green rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="text-white" size={32} />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold mb-4 text-espresso-black">
                  Comprehensive QOE Package
                </h3>
                <p className="text-espresso-black/70 mb-6">
                  Complete due diligence-ready package with advanced analysis and buyer presentation materials.
                </p>
                <div className="text-4xl font-bold text-trail-green mb-2">$1,997</div>
                <p className="text-espresso-black/60 text-sm">One-time fee</p>
              </div>

              <ul className="space-y-4 mb-8">
                {[
                  "Everything in Basic Package",
                  "Customer revenue analysis and anonymization",
                  "Advanced vendor and expense categorization",
                  "Red flags assessment and mitigation strategies", 
                  "Professional buyer presentation deck",
                  "Benchmarking against industry standards",
                  "Owner interview and add-back validation",
                  "Buyer Q&A preparation guide"
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="text-trail-green mt-1 flex-shrink-0" size={18} />
                    <span className="text-espresso-black/80 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link 
                to="/qoe/comprehensive"
                className="bg-trail-green hover:bg-trail-green/90 w-full py-4 rounded-full text-white font-semibold text-lg inline-flex items-center justify-center gap-3 transition-colors"
              >
                Start Comprehensive Package <ArrowRight size={20} />
              </Link>
            </div>
          </motion.div>

          {/* Value Proposition */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="bg-white rounded-2xl p-8 lg:p-12 text-center border border-trust-teal/10"
          >
            <h2 className="text-3xl lg:text-4xl font-bold mb-6 text-espresso-black">
              Why Start with a QOE Package?
            </h2>
            <p className="text-xl text-espresso-black/80 mb-8 max-w-4xl mx-auto">
              Lead buyer conversations from a position of strength. Address potential concerns proactively 
              and demonstrate the professional quality that serious buyers expect.
            </p>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Shield,
                  title: "Address Concerns Early",
                  description: "Identify and explain potential red flags before buyers discover them"
                },
                {
                  icon: TrendingUp,
                  title: "Show True Profitability", 
                  description: "Normalize EBITDA with proper add-backs to reveal your firm's real value"
                },
                {
                  icon: Calendar,
                  title: "Speed Up Due Diligence",
                  description: "Buyers get answers faster, leading to smoother negotiations"
                }
              ].map((benefit, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 bg-trust-teal rounded-full flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="text-white" size={24} />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-espresso-black">{benefit.title}</h3>
                  <p className="text-espresso-black/70">{benefit.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default QOEChoice;