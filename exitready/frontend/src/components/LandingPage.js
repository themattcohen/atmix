import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  Shield, 
  TrendingUp, 
  FileText, 
  Calculator,
  CheckCircle,
  X,
  Star,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LogIn,
  User,
  Upload,
  BarChart3,
  AlertTriangle,
  Target,
  Clock,
  Zap,
  Award,
  BookOpen,
  Phone,
  Download
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { siteContent } from '../content/siteContent';
import { getCurrentUser, isAuthenticated, logoutUser } from '../utils/userAuth';

const LandingPage = () => {
  const { landingPage } = siteContent;
  const currentUser = getCurrentUser();
  const userLoggedIn = isAuthenticated();
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleLogout = () => {
    logoutUser();
    window.location.reload(); // Refresh to update navigation
  };

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };
  
  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-effect">
        <div className="container-max">
          <div className="flex items-center justify-between py-4 px-6">
            <motion.div 
              className="text-2xl font-bold text-gradient"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              {siteContent.branding.companyName}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex items-center gap-4"
            >
              {userLoggedIn ? (
                // Logged in navigation
                <>
                  <span className="text-gray-300 text-sm">
                    Welcome, {currentUser?.name}
                  </span>
                  <Link 
                    to="/user/dashboard"
                    className="text-gray-300 hover:text-white transition-colors duration-300 inline-flex items-center gap-2"
                  >
                    <User size={16} />
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-gray-400 hover:text-gray-300 transition-colors duration-300 text-sm"
                  >
                    Logout
                  </button>
                </>
              ) : (
                // Guest navigation
                <>
                  <Link 
                    to="/user/auth"
                    className="text-gray-300 hover:text-white transition-colors duration-300 inline-flex items-center gap-2"
                  >
                    <LogIn size={16} />
                    Login
                  </Link>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 hero-glow"></div>
        <div className="container-max relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center lg:text-left"
            >
              <h1 className="text-4xl lg:text-6xl xl:text-7xl font-bold mb-6 leading-tight">
                {landingPage.hero.headline}
              </h1>
              <p className="text-xl lg:text-2xl text-gray-300 mb-6 leading-relaxed">
                {landingPage.hero.subheadline}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6">
                <Link 
                  to="/red-flags-assessment"
                  className="btn-primary px-8 py-4 rounded-full text-white font-semibold text-lg inline-flex items-center justify-center gap-3 pulse-glow"
                >
                  {landingPage.hero.primaryCTA} <ArrowRight size={20} />
                </Link>
                <button 
                  onClick={() => scrollToSection('solution')}
                  className="glass-effect px-8 py-4 rounded-full text-white font-semibold text-lg hover:bg-white/10 transition-all duration-300 inline-flex items-center justify-center gap-3"
                >
                  {landingPage.hero.secondaryCTA} <ChevronDown size={20} />
                </button>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-2 text-green-400">
                <CheckCircle size={18} />
                <span className="text-sm">{landingPage.hero.trustIndicator}</span>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="floating-animation">
                <img 
                  src="https://images.unsplash.com/photo-1555212697-194d092e3b8f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG9yZ2FuaXphdGlvbnxlbnwwfHx8Ymx1ZXwxNzQ4ODA2NTI0fDA&ixlib=rb-4.1.0&q=85"
                  alt="Professional organized workspace transformation"
                  className="rounded-2xl shadow-2xl w-full max-w-lg mx-auto"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Credibility Bar */}
      <section className="py-12 bg-slate-900/50">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-4 gap-6 text-center"
          >
            {landingPage.credibilityBar.items.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex items-center justify-center gap-2"
              >
                <div className="text-blue-400">
                  {index === 0 && <Award size={20} />}
                  {index === 1 && <TrendingUp size={20} />}
                  {index === 2 && <Shield size={20} />}
                  {index === 3 && <CheckCircle size={20} />}
                </div>
                <span className="text-gray-300 font-medium text-sm lg:text-base">{item}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="section-padding">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              {landingPage.problemSection.headline}
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              {landingPage.problemSection.subtitle}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {landingPage.problemSection.problems.map((problem, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="glass-effect rounded-2xl p-8 card-hover text-center"
              >
                <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  {index === 0 && <BookOpen className="text-white" size={24} />}
                  {index === 1 && <AlertTriangle className="text-white" size={24} />}
                  {index === 2 && <X className="text-white" size={24} />}
                </div>
                <h3 className="text-2xl font-semibold mb-4">{problem.title}</h3>
                <p className="text-gray-300 leading-relaxed">{problem.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-red-600/20 to-orange-600/20 rounded-3xl p-8 text-center"
          >
            <p className="text-xl lg:text-2xl font-semibold text-gray-200 italic">
              {landingPage.problemSection.callout}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Personal Story Section */}
      <section className="section-padding bg-slate-900/50">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              {landingPage.personalStory.headline}
            </h2>
            <p className="text-lg text-gray-400 italic mb-8">
              {landingPage.personalStory.subheadline}
            </p>
            <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
              {landingPage.personalStory.story.intro}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {landingPage.personalStory.story.phases.map((phase, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="glass-effect rounded-2xl p-8"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                    index === 0 ? 'bg-red-500' : index === 1 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}>
                    {index === 0 ? '✗' : index === 1 ? '⚡' : '✓'}
                  </div>
                  <h3 className="text-xl font-semibold">{phase.title}</h3>
                </div>
                <ul className="space-y-3">
                  {phase.points.map((point, pointIndex) => (
                    <li key={pointIndex} className="text-gray-300 flex items-start gap-2">
                      <span className="text-gray-500 mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-3xl p-8 text-center"
          >
            <p className="text-xl lg:text-2xl font-semibold text-gray-200 italic">
              "{landingPage.personalStory.story.conclusion}"
            </p>
          </motion.div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="solution" className="section-padding">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              {landingPage.solutionSection.headline}
            </h2>
            <p className="text-xl text-gray-300 max-w-4xl mx-auto">
              {landingPage.solutionSection.subheadline}
            </p>
          </motion.div>

          <div className="space-y-12">
            {landingPage.solutionSection.phases.map((phase, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className={`grid lg:grid-cols-2 gap-12 items-center ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                      {index + 1}
                    </div>
                    <h3 className="text-2xl lg:text-3xl font-bold">{phase.title}</h3>
                  </div>
                  <p className="text-xl text-gray-300 mb-6 leading-relaxed">
                    {phase.description}
                  </p>
                  <div className="space-y-3">
                    <p className="font-semibold text-lg mb-4">What you get:</p>
                    {phase.benefits.map((benefit, benefitIndex) => (
                      <div key={benefitIndex} className="flex items-start gap-3">
                        <CheckCircle className="text-green-400 mt-1 flex-shrink-0" size={20} />
                        <span className="text-gray-300">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                  <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-2xl p-8 text-center">
                    <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      {index === 0 && <Target className="text-white" size={36} />}
                      {index === 1 && <FileText className="text-white" size={36} />}
                      {index === 2 && <Shield className="text-white" size={36} />}
                      {index === 3 && <TrendingUp className="text-white" size={36} />}
                    </div>
                    <h4 className="text-xl font-semibold mb-4">Phase {index + 1}</h4>
                    <p className="text-gray-300">{phase.title}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Unique Value Proposition */}
      <section className="section-padding bg-slate-900/50">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              {landingPage.uniqueValueProp.headline}
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Traditional Consultants */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="glass-effect rounded-2xl p-8"
            >
              <h3 className="text-2xl font-bold mb-6 text-center">{landingPage.uniqueValueProp.comparison.traditional.title}</h3>
              <div className="space-y-4">
                {landingPage.uniqueValueProp.comparison.traditional.points.map((point, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <X className="text-red-400 flex-shrink-0" size={20} />
                    <span className="text-gray-300">{point.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Exit Ready System */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="glass-effect rounded-2xl p-8 border border-blue-500/30"
            >
              <h3 className="text-2xl font-bold mb-6 text-center text-gradient">{landingPage.uniqueValueProp.comparison.exitReady.title}</h3>
              <div className="space-y-4">
                {landingPage.uniqueValueProp.comparison.exitReady.points.map((point, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
                    <span className="text-gray-300">{point.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-3xl p-8 text-center"
          >
            <p className="text-xl lg:text-2xl font-semibold text-gray-200 italic">
              "{landingPage.uniqueValueProp.callout}"
            </p>
          </motion.div>
        </div>
      </section>

      {/* Lessons Learned */}
      <section className="section-padding">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              {landingPage.lessonsLearned.headline}
            </h2>
            <p className="text-xl text-gray-300 max-w-4xl mx-auto">
              {landingPage.lessonsLearned.subheadline}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {landingPage.lessonsLearned.insights.map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="glass-effect rounded-2xl p-6 card-hover cursor-pointer"
                onClick={() => setExpandedLesson(expandedLesson === index ? null : index)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{insight.title}</h3>
                  {expandedLesson === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                <AnimatePresence>
                  {expandedLesson === index && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="text-gray-300 leading-relaxed">{insight.description}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="section-padding">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              {landingPage.socialProof.headline}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {landingPage.socialProof.testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="glass-effect rounded-2xl p-8"
              >
                <div className="flex justify-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="text-yellow-400 fill-current" size={20} />
                  ))}
                </div>
                <blockquote className="text-lg italic mb-6 text-gray-300">
                  "{testimonial.quote}"
                </blockquote>
                <div className="text-center">
                  <div className="font-semibold">{testimonial.author}</div>
                  <div className="text-gray-400 text-sm">{testimonial.company}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="glass-effect rounded-2xl p-8"
            >
              <h3 className="text-xl font-bold mb-4">Professional Credentials</h3>
              <ul className="space-y-3">
                {landingPage.socialProof.credentials.map((credential, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Award className="text-blue-400 flex-shrink-0" size={16} />
                    <span className="text-gray-300">{credential}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="glass-effect rounded-2xl p-8"
            >
              <h3 className="text-xl font-bold mb-4">Process Validation</h3>
              <ul className="space-y-3">
                {landingPage.socialProof.validation.map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="text-green-400 flex-shrink-0" size={16} />
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section-padding bg-slate-900/50">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              {landingPage.faqSection.headline}
            </h2>
          </motion.div>

          <div className="max-w-4xl mx-auto space-y-4">
            {landingPage.faqSection.faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="glass-effect rounded-xl overflow-hidden"
              >
                <button
                  className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-white/5 transition-all duration-300"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                >
                  <span className="font-semibold text-lg">{faq.question}</span>
                  {expandedFaq === index ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                </button>
                <AnimatePresence>
                  {expandedFaq === index && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-8 pb-6"
                    >
                      <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Urgency Section */}
      <section className="section-padding bg-slate-900/50">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              {landingPage.urgencySection.headline}
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 mb-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="glass-effect rounded-2xl p-8 border border-green-500/30"
            >
              <h3 className="text-2xl font-bold mb-6 text-green-400">{landingPage.urgencySection.timeline.ideal.title}</h3>
              <ul className="space-y-4">
                {landingPage.urgencySection.timeline.ideal.points.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="text-green-400 mt-1 flex-shrink-0" size={20} />
                    <span className="text-gray-300">{point}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="glass-effect rounded-2xl p-8 border border-red-500/30"
            >
              <h3 className="text-2xl font-bold mb-6 text-red-400">{landingPage.urgencySection.timeline.rushed.title}</h3>
              <ul className="space-y-4">
                {landingPage.urgencySection.timeline.rushed.points.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <X className="text-red-400 mt-1 flex-shrink-0" size={20} />
                    <span className="text-gray-300">{point}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-3xl p-8 text-center"
          >
            <Clock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-200 italic">
              {landingPage.urgencySection.callout}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="section-padding bg-gradient-to-r from-blue-600 to-cyan-600">
        <div className="container-max text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 text-white">
              {landingPage.finalCTA.headline}
            </h2>
            <p className="text-xl mb-12 opacity-90 max-w-3xl mx-auto text-white">
              {landingPage.finalCTA.description}
            </p>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {landingPage.finalCTA.options.map((option, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white/10 rounded-2xl p-8 backdrop-blur-lg"
                >
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    {index === 0 && <Calculator className="text-white" size={24} />}
                    {index === 1 && <Phone className="text-white" size={24} />}
                    {index === 2 && <Download className="text-white" size={24} />}
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-white">{option.title}</h3>
                  <p className="text-white/80 mb-6">{option.description}</p>
                  <Link
                    to={index === 0 ? "/red-flags-assessment" : index === 1 ? "#contact" : "#download"}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                      option.isPrimary 
                        ? 'bg-white text-blue-600 hover:bg-gray-100 shadow-xl' 
                        : 'border-2 border-white text-white hover:bg-white hover:text-blue-600'
                    }`}
                  >
                    {option.buttonText} <ArrowRight size={18} />
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-white/80">
              {landingPage.finalCTA.trustIndicators.map((indicator, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  <span className="text-sm">{indicator}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12">
        <div className="container-max">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="text-2xl font-bold text-gradient mb-4">{siteContent.branding.companyName}</div>
              <p className="text-gray-400">
                {siteContent.branding.tagline}
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Services</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Exit Readiness Assessment</li>
                <li>Financial Cleanup</li>
                <li>Strategic Positioning</li>
                <li>Exit Preparation</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <p className="text-gray-400 mb-2">{siteContent.contact.email}</p>
              <p className="text-gray-400">{landingPage.contact.tagline}</p>
            </div>
          </div>
          
          <div className="border-t border-gray-700 pt-8 text-center text-gray-400">
            <p>&copy; 2024 {siteContent.branding.companyName}. All rights reserved.</p>
            <p className="mt-2 text-sm italic">Professional accounting firm exit preparation by someone who's actually done it.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;