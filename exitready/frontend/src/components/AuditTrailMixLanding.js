import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Settings, 
  Users, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight,
  Calculator,
  FileText,
  AlertTriangle,
  BarChart3,
  Shield,
  Building,
  DollarSign,
  Target,
  Play,
  ExternalLink,
  CheckCircle
} from 'lucide-react';

const AuditTrailMixLanding = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const testimonials = [
    {
      quote: "Audit Trail Mix transformed our workflow. We're saving 15+ hours per week on routine tasks.",
      author: "Sarah Chen, CPA",
      firm: "Peak Financial Group"
    },
    {
      quote: "The automation features alone paid for themselves in the first month. Game-changer for our firm.",
      author: "Michael Rodriguez",
      firm: "Precision Accounting Partners"
    },
    {
      quote: "Finally, a platform that understands what accounting firms actually need. Love the broker support!",
      author: "Jennifer Liu, CPA",
      firm: "Metropolitan Tax Services"
    }
  ];

  const tools = [
    { name: 'Firm Valuation Calculator', link: '/calculator', icon: Calculator },
    { name: 'Value Calculator Suite', link: '/value-calculator', icon: BarChart3 },
    { name: 'Quality of Earnings (QOE)', link: '/qoe', icon: FileText },
    { name: '23 Red Flags Assessment', link: '/assessment', icon: AlertTriangle },
    { name: 'Exit Ready Platform', link: '/exitready', icon: Target },
    { name: 'Book Consultation', link: '/consultation', icon: Users },
    { name: 'Tools Dashboard', link: '/tools', icon: Settings },
    { name: 'Admin Panel', link: '/admin', icon: Shield }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-sm border-b border-trust-teal/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <img src="/logo-teal.svg" alt="Audit Trail Mix Logo" className="w-10 h-10" />
              <span className="text-2xl font-bold text-espresso-black font-mono">Audit Trail Mix</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-espresso-black hover:text-trust-teal transition-colors">Features</a>
              <a href="#how-it-works" className="text-espresso-black hover:text-trust-teal transition-colors">How It Works</a>
              <a href="#pricing" className="text-espresso-black hover:text-trust-teal transition-colors">Pricing</a>
              <Link to="/exitready" className="text-espresso-black hover:text-trust-teal transition-colors">Exit Ready</Link>
              <a 
                href="#pricing" 
                className="bg-trust-teal text-off-white px-6 py-2 rounded-lg hover:bg-trust-teal/90 transition-colors font-semibold"
              >
                Book Discovery Call
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-center mb-8">
              <img src="/logo-teal.svg" alt="Audit Trail Mix Logo" className="w-20 h-20 mr-4" />
              <h1 className="text-5xl lg:text-7xl font-bold text-trust-teal font-mono">
                Audit Trail Mix
              </h1>
            </div>
            
            <h2 className="text-3xl lg:text-5xl font-bold text-espresso-black mb-6 leading-tight">
              Crunch Every Trail, Skip the Crumbs.
            </h2>
            
            <p className="text-xl text-espresso-black/80 mb-8 max-w-4xl mx-auto leading-relaxed">
              Audit Trail Mix empowers accounting firms to conquer busywork, surface insights, and capitalize on opportunities.
              We combine automation, expert advisory, and broker-level deal support into one streamlined toolkit—so firms can focus on strategic growth, stronger client relationships, and higher profitability.
            </p>
            
            <button 
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              className="bg-trust-teal text-off-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-trust-teal/90 transition-all duration-300 inline-flex items-center gap-3 shadow-lg hover:shadow-xl"
            >
              See What's in the Mix <ArrowRight size={24} />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Value Props - "The Mix" */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-espresso-black mb-4">The Mix</h2>
            <p className="text-xl text-espresso-black/70">Three powerful ingredients for accounting firm success</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bg-white rounded-2xl p-8 border border-trust-teal/10 hover:border-ledger-gold/30 hover:bg-ledger-gold/5 transition-all duration-300 group"
            >
              <div className="w-16 h-16 bg-trust-teal/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-trust-teal/20 transition-colors">
                <Settings className="text-trust-teal" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-espresso-black mb-2">Automation</h3>
              <h4 className="text-lg font-semibold text-trust-teal mb-4">Eliminate Repetitive Tasks</h4>
              <p className="text-espresso-black/70 leading-relaxed">
                Transform manual workflows with intelligent automation that handles data entry, reconciliation, and reporting. 
                Free your team from busywork to focus on high-value client advisory services and strategic planning.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-2xl p-8 border border-trust-teal/10 hover:border-ledger-gold/30 hover:bg-ledger-gold/5 transition-all duration-300 group"
            >
              <div className="w-16 h-16 bg-trust-teal/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-trust-teal/20 transition-colors">
                <Users className="text-trust-teal" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-espresso-black mb-2">Advisory</h3>
              <h4 className="text-lg font-semibold text-trust-teal mb-4">Expert Guidance & Insights</h4>
              <p className="text-espresso-black/70 leading-relaxed">
                Access specialized expertise and market insights to guide your firm's growth strategy. 
                Receive tailored recommendations for client engagement, service expansion, and operational optimization.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-white rounded-2xl p-8 border border-trust-teal/10 hover:border-ledger-gold/30 hover:bg-ledger-gold/5 transition-all duration-300 group"
            >
              <div className="w-16 h-16 bg-trust-teal/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-trust-teal/20 transition-colors">
                <TrendingUp className="text-trust-teal" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-espresso-black mb-2">Broker Support</h3>
              <h4 className="text-lg font-semibold text-trust-teal mb-4">Deal Flow & Opportunities</h4>
              <p className="text-espresso-black/70 leading-relaxed">
                Connect with acquisition opportunities and exit strategies through our professional network. 
                Whether buying, selling, or merging, access broker-level support to maximize firm value and growth potential.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-espresso-black mb-4">How It Works</h2>
            <p className="text-xl text-espresso-black/70">Three simple steps to transform your firm</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <div className="w-24 h-24 bg-trust-teal rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl font-bold text-off-white font-mono">1</span>
              </div>
              <h3 className="text-2xl font-bold text-espresso-black mb-4">Connect Systems</h3>
              <p className="text-espresso-black/70 leading-relaxed">
                Seamlessly integrate your existing accounting software, CRM, and data sources. 
                Our platform connects with popular tools to create a unified workflow.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 0 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center"
            >
              <div className="w-24 h-24 bg-ledger-gold rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl font-bold text-espresso-black font-mono">2</span>
              </div>
              <h3 className="text-2xl font-bold text-espresso-black mb-4">Tailor Workflows</h3>
              <p className="text-espresso-black/70 leading-relaxed">
                Customize automation rules and advisory frameworks to match your firm's unique processes. 
                Configure alerts, reports, and insights that matter to your business.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-center"
            >
              <div className="w-24 h-24 bg-trail-green rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl font-bold text-off-white font-mono">3</span>
              </div>
              <h3 className="text-2xl font-bold text-espresso-black mb-4">Scale & Profit</h3>
              <p className="text-espresso-black/70 leading-relaxed">
                Watch your firm operate more efficiently while capturing new growth opportunities. 
                Focus on strategic initiatives that drive profitability and client satisfaction.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-espresso-black mb-4">Trusted by Leading Firms</h2>
          </div>

          {/* Client Logos */}
          <div className="flex items-center justify-center space-x-12 mb-16 grayscale opacity-60">
            <div className="w-32 h-16 bg-espresso-black/10 rounded-lg flex items-center justify-center">
              <span className="font-bold text-espresso-black">Peak Financial</span>
            </div>
            <div className="w-32 h-16 bg-espresso-black/10 rounded-lg flex items-center justify-center">
              <span className="font-bold text-espresso-black">Precision CPA</span>
            </div>
            <div className="w-32 h-16 bg-espresso-black/10 rounded-lg flex items-center justify-center">
              <span className="font-bold text-espresso-black">Metro Tax</span>
            </div>
            <div className="w-32 h-16 bg-espresso-black/10 rounded-lg flex items-center justify-center">
              <span className="font-bold text-espresso-black">Elite Advisors</span>
            </div>
          </div>

          {/* Testimonial Slider */}
          <div className="relative max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border border-trust-teal/10 shadow-lg">
              <motion.div
                key={currentTestimonial}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <p className="text-xl text-espresso-black italic mb-6 leading-relaxed">
                  "{testimonials[currentTestimonial].quote}"
                </p>
                <div>
                  <p className="font-semibold text-espresso-black">
                    {testimonials[currentTestimonial].author}
                  </p>
                  <p className="text-trust-teal">
                    {testimonials[currentTestimonial].firm}
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={prevTestimonial}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white border border-trust-teal/20 rounded-full flex items-center justify-center hover:bg-trust-teal hover:text-off-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextTestimonial}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white border border-trust-teal/20 rounded-full flex items-center justify-center hover:bg-trust-teal hover:text-off-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>

            {/* Dots Indicator */}
            <div className="flex justify-center mt-6 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentTestimonial ? 'bg-trust-teal' : 'bg-trust-teal/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section id="pricing" className="py-20 bg-trail-green">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold text-off-white mb-4">
              Custom solutions start at $2,497/month
            </h2>
            <p className="text-xl text-off-white/90 mb-8">
              Tailored to your firm's size, needs, and growth goals
            </p>
            <a
              href="https://calendly.com/audit-trail-mix"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-ledger-gold text-espresso-black px-8 py-4 rounded-xl text-lg font-semibold hover:bg-ledger-gold/90 transition-all duration-300 inline-flex items-center gap-3 shadow-lg hover:shadow-xl"
            >
              Book a Discovery Call <ExternalLink size={20} />
            </a>
          </motion.div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-espresso-black mb-4">Available Tools & Platforms</h2>
            <p className="text-xl text-espresso-black/70">Access our complete suite of accounting firm tools</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool, index) => {
              const IconComponent = tool.icon;
              return (
                <motion.div
                  key={tool.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Link
                    to={tool.link}
                    className="block bg-off-white border border-trust-teal/10 rounded-xl p-6 hover:border-trust-teal/30 hover:bg-trust-teal/5 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-trust-teal/10 rounded-lg flex items-center justify-center group-hover:bg-trust-teal/20 transition-colors">
                        <IconComponent className="text-trust-teal" size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-espresso-black group-hover:text-trust-teal transition-colors">
                          {tool.name}
                        </h3>
                        <p className="text-espresso-black/60 text-sm">Click to access</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-espresso-black text-off-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-6 md:mb-0">
              <img src="/logo-teal.svg" alt="Audit Trail Mix Logo" className="w-10 h-10" />
              <span className="text-xl font-bold font-mono">Audit Trail Mix</span>
            </div>

            <div className="flex items-center space-x-8 mb-6 md:mb-0">
              <Link to="/privacy" className="hover:text-trust-teal transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-trust-teal transition-colors">Terms</Link>
              <Link to="/contact" className="hover:text-trust-teal transition-colors">Contact</Link>
            </div>

            <div className="flex items-center space-x-4">
              <a href="#" className="w-10 h-10 bg-trust-teal/20 rounded-lg flex items-center justify-center hover:bg-trust-teal transition-colors">
                <span className="text-sm font-bold">in</span>
              </a>
              <a href="#" className="w-10 h-10 bg-trust-teal/20 rounded-lg flex items-center justify-center hover:bg-trust-teal transition-colors">
                <span className="text-sm font-bold">X</span>
              </a>
            </div>
          </div>

          <div className="border-t border-trust-teal/20 mt-8 pt-8 text-center text-off-white/60">
            <p>&copy; 2024 Audit Trail Mix. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AuditTrailMixLanding;