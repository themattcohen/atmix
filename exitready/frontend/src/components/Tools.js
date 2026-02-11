import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Calculator,
  FileText,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  Star,
  TrendingUp,
  Users,
  Clock,
  Award,
  Target,
  CheckCircle,
  Shield
} from 'lucide-react';

const Tools = () => {
  const tools = [
    {
      id: 'valuation',
      title: 'Firm Valuation Calculator',
      subtitle: 'Get Your Firm\'s Market Value',
      description: 'Professional-grade valuation using industry-standard multiples and quality adjustments. Choose between quick estimates or comprehensive analysis.',
      icon: Calculator,
      color: 'from-blue-500 to-cyan-500',
      link: '/calculator',
      features: [
        'Revenue multiple analysis',
        'Quality score adjustments',
        'Professional PDF reports',
        'Market benchmarking'
      ],
      badge: 'Popular'
    },
    {
      id: 'value-calculator',
      title: 'Value Calculator Suite',
      subtitle: 'Sellability Score & Value Planning',
      description: 'Complete value assessment including sellability scoring, value acceleration planning, and wealth gap analysis. Interactive multi-step wizard with detailed insights.',
      icon: BarChart3,
      color: 'from-purple-500 to-indigo-500',
      link: '/value-calculator',
      features: [
        'Sellability score (0-100)',
        'Value acceleration planning',
        'Wealth gap analysis',
        'Interactive results dashboard'
      ],
      badge: 'New'
    },
    {
      id: 'qoe',
      title: 'Quality of Earnings (QOE)',
      subtitle: 'Buyer-Ready Financial Packages',
      description: 'Transform your financial data into institutional-grade QOE packages that buyers expect. Choose basic or comprehensive analysis.',
      icon: FileText,
      color: 'from-green-500 to-emerald-500',
      link: '/qoe',
      features: [
        'Financial normalization',
        'Add-back analysis',
        'Account mapping',
        'Excel & PDF exports'
      ],
      badge: 'Professional'
    },
    {
      id: 'assessment',
      title: '23 Red Flags Assessment',
      subtitle: 'Personalized Risk Analysis',
      description: 'Take our comprehensive assessment to identify specific risks in your firm and get a customized action plan for your exit preparation.',
      icon: AlertTriangle,
      color: 'from-red-500 to-orange-500',
      link: '/assessment',
      features: [
        'Personalized risk scoring',
        'Custom recommendations',
        'Bespoke PDF report',
        'Action plan included'
      ],
      badge: 'Updated'
    }
  ];

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
              to="/exitready"
              className="text-espresso-black hover:text-trust-teal transition-colors duration-300"
            >
              Exit Ready Platform →
            </Link>
          </div>
        </div>
      </nav>

      {/* Header Section */}
      <section className="pt-32 pb-20">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 text-espresso-black">
              Professional Tools Suite
            </h1>
            <p className="text-xl text-espresso-black/70 max-w-3xl mx-auto leading-relaxed">
              Access our complete toolkit of professional-grade tools for accounting firm growth, 
              valuation, and strategic planning. Built for efficiency and results.
            </p>
          </motion.div>

          {/* Tools Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {tools.map((tool, index) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="relative group"
              >
                <div className="bg-gray-50 rounded-3xl p-8 h-full hover:transform hover:scale-105 transition-all duration-300 border border-gray-200">
                  {/* Badge */}
                  {tool.badge && (
                    <div className="absolute -top-3 -right-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      {tool.badge}
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`w-16 h-16 bg-gradient-to-r ${tool.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <tool.icon className="text-white" size={28} />
                  </div>

                  {/* Content */}
                  <h3 className="text-2xl font-bold mb-2 text-espresso-black">{tool.title}</h3>
                  <p className="text-trust-teal font-medium mb-4">{tool.subtitle}</p>
                  <p className="text-espresso-black/70 mb-6 leading-relaxed">{tool.description}</p>

                  {/* Features */}
                  <ul className="space-y-2 mb-8">
                    {tool.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-espresso-black/70">
                        <CheckCircle className="text-trail-green flex-shrink-0" size={16} />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Link
                    to={tool.link}
                    className={`w-full btn-primary py-3 rounded-xl font-semibold inline-flex items-center justify-center gap-2 group-hover:bg-gradient-to-r group-hover:${tool.color} transition-all duration-300`}
                  >
                    Get Started <ArrowRight size={18} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-20 text-center"
          >
            <div className="bg-gray-50 rounded-3xl p-8 lg:p-12 max-w-4xl mx-auto border border-gray-200">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Shield className="text-trust-teal" size={32} />
                <h2 className="text-3xl font-bold text-espresso-black">Battle-Tested Process</h2>
              </div>
              <p className="text-xl text-espresso-black/70 mb-8 leading-relaxed">
                These tools aren't theoretical - they're the exact same processes I used during my own 7-figure accounting firm exit. 
                Every feature has been refined through real deal experience.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link 
                  to="/red-flags-assessment"
                  className="btn-primary px-8 py-4 rounded-full font-semibold inline-flex items-center gap-3"
                >
                  Start with Free PDF <ArrowRight size={20} />
                </Link>
                <Link 
                  to="/"
                  className="bg-gray-100 hover:bg-gray-200 text-espresso-black px-8 py-4 rounded-full font-semibold transition-all duration-300 inline-flex items-center gap-3"
                >
                  Learn More About Exit Ready
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Tools;