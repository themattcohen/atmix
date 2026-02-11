import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Clock, 
  Target, 
  Calculator, 
  ArrowRight, 
  TrendingUp,
  FileText,
  ChevronLeft
} from 'lucide-react';

const CalculatorChoice = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-sm border-b border-trust-teal/10">
        <div className="container-max">
          <div className="flex items-center justify-between py-4 px-6">
            <Link to="/" className="flex items-center space-x-2 text-trust-teal">
              <img src="/logo-teal.svg" alt="Audit Trail Mix Logo" className="w-8 h-8" />
              <span className="text-2xl font-bold font-mono">Audit Trail Mix</span>
            </Link>
            <Link 
              to="/"
              className="text-espresso-black hover:text-trust-teal transition-colors duration-300 inline-flex items-center gap-2"
            >
              <ChevronLeft size={18} /> Back to Home
            </Link>
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
            className="text-center mb-16"
          >
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-espresso-black">
              Choose Your <span className="text-trust-teal">Valuation Path</span>
            </h1>
            <p className="text-xl text-espresso-black/70 max-w-3xl mx-auto leading-relaxed">
              We can get as deep into your firm's analysis as you want. For those just exploring, 
              we recommend starting with the simple calculator. Ready for a comprehensive analysis? 
              Choose the detailed option.
            </p>
          </motion.div>

          {/* Calculator Options */}
          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            
            {/* Simple Calculator */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-white rounded-3xl p-8 lg:p-10 border border-trust-teal/10 hover:border-trust-teal/30 transition-colors relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 bg-trail-green text-white px-3 py-1 text-sm font-semibold rounded-bl-xl">
                RECOMMENDED
              </div>
              
              <div className="mb-8">
                <div className="w-16 h-16 bg-trail-green rounded-2xl flex items-center justify-center mb-6">
                  <Clock size={32} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4 text-espresso-black">Quick Valuation</h2>
                <p className="text-espresso-black/70 text-lg leading-relaxed mb-6">
                  Perfect for getting a ballpark estimate of your firm's value. 
                  Great for those just starting to think about an exit or wanting 
                  a quick market reality check.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-trail-green rounded-full"></div>
                  <span className="text-espresso-black/70">2-3 minutes to complete</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-trail-green rounded-full"></div>
                  <span className="text-espresso-black/70">Basic financial inputs</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-trail-green rounded-full"></div>
                  <span className="text-espresso-black/70">Instant ballpark valuation</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-trail-green rounded-full"></div>
                  <span className="text-espresso-black/70">Free PDF summary report</span>
                </div>
              </div>

              <Link 
                to="/calculator/simple"
                className="w-full bg-trail-green text-white py-4 rounded-xl font-semibold text-lg hover:bg-trail-green/90 transition-all duration-300 inline-flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
              >
                Start Quick Valuation <ArrowRight size={20} />
              </Link>
            </motion.div>

            {/* Detailed Calculator */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="bg-white rounded-3xl p-8 lg:p-10 border border-trust-teal/10 hover:border-trust-teal/30 transition-colors relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-trust-teal/5"></div>
              
              <div className="relative z-10 mb-8">
                <div className="w-16 h-16 bg-trust-teal rounded-2xl flex items-center justify-center mb-6">
                  <Target size={32} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4 text-espresso-black">Comprehensive Analysis</h2>
                <p className="text-espresso-black/70 text-lg leading-relaxed mb-6">
                  In-depth analysis using multiple valuation methodologies. 
                  Perfect for serious sellers who want precise valuations and 
                  detailed insights into value drivers.
                </p>
              </div>

              <div className="relative z-10 space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-trust-teal rounded-full"></div>
                  <span className="text-espresso-black/70">7-10 minutes for full analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-trust-teal rounded-full"></div>
                  <span className="text-espresso-black/70">Detailed financial breakdown</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-trust-teal rounded-full"></div>
                  <span className="text-espresso-black/70">Multiple valuation methods</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-trust-teal rounded-full"></div>
                  <span className="text-espresso-black/70">15-page detailed PDF report</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-trust-teal rounded-full"></div>
                  <span className="text-espresso-black/70">Value improvement recommendations</span>
                </div>
              </div>

              <Link 
                to="/calculator/detailed"
                className="relative z-10 w-full bg-trust-teal text-white py-4 rounded-xl font-semibold text-lg hover:bg-trust-teal/90 transition-all duration-300 inline-flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
              >
                Start Detailed Analysis <Target size={20} />
              </Link>
            </motion.div>
          </div>

          {/* Benefits Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-20 text-center"
          >
            <h2 className="text-3xl font-bold mb-8 text-espresso-black">What You'll Get</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Calculator,
                  title: "Instant Valuation",
                  description: "Get your firm's estimated value range immediately using proven industry methodologies"
                },
                {
                  icon: FileText,
                  title: "Professional Report",
                  description: "Receive a branded PDF report with detailed analysis and recommendations"
                },
                {
                  icon: TrendingUp,
                  title: "Value Optimization",
                  description: "Discover specific strategies to increase your firm's value before selling"
                }
              ].map((benefit, index) => (
                <div key={index} className="bg-white rounded-2xl p-6 border border-trust-teal/10">
                  <benefit.icon size={40} className="text-trust-teal mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-3 text-espresso-black">{benefit.title}</h3>
                  <p className="text-espresso-black/70">{benefit.description}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-16 bg-white rounded-2xl p-8 text-center border border-trust-teal/10"
          >
            <h3 className="text-2xl font-bold mb-6 text-espresso-black">Trusted by Accounting Professionals</h3>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-trust-teal mb-2">500+</div>
                <div className="text-espresso-black/70">Firms Valued</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-trust-teal mb-2">$50M+</div>
                <div className="text-espresso-black/70">Total Transaction Value</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-trust-teal mb-2">98%</div>
                <div className="text-espresso-black/70">Accuracy Rate</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorChoice;