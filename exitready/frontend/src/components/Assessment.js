import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Download,
  Mail,
  Award
} from 'lucide-react';

const Assessment = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [email, setEmail] = useState('');
  const [firmName, setFirmName] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const questions = [
    {
      id: 'financial_reporting',
      category: 'Financial Presentation',
      question: 'How would you describe your monthly financial reporting consistency?',
      type: 'radio',
      options: [
        { value: 'excellent', label: 'Consistent monthly closes, same format, always on time', score: 0 },
        { value: 'good', label: 'Usually consistent, occasional delays or format changes', score: 1 },
        { value: 'fair', label: 'Sometimes inconsistent, missing months or varying formats', score: 3 },
        { value: 'poor', label: 'Very inconsistent, often late or missing months', score: 5 }
      ]
    },
    {
      id: 'revenue_recognition',
      category: 'Financial Presentation',
      question: 'How do you handle revenue recognition and accruals?',
      type: 'radio',
      options: [
        { value: 'accrual_consistent', label: 'Consistent accrual method, properly documented', score: 0 },
        { value: 'accrual_occasional', label: 'Mostly accrual with some inconsistencies', score: 2 },
        { value: 'mixed_methods', label: 'Mix of cash and accrual methods', score: 4 },
        { value: 'cash_only', label: 'Cash basis only, no accruals', score: 3 }
      ]
    },
    {
      id: 'personal_expenses',
      category: 'Financial Presentation',
      question: 'How are owner personal expenses handled in your business?',
      type: 'radio',
      options: [
        { value: 'separate', label: 'Completely separate, no personal expenses through business', score: 0 },
        { value: 'documented', label: 'Some personal expenses but clearly documented and tracked', score: 1 },
        { value: 'mixed_some', label: 'Personal expenses mixed in, not always documented', score: 3 },
        { value: 'mixed_significant', label: 'Significant personal expenses, unclear documentation', score: 5 }
      ]
    },
    {
      id: 'client_concentration',
      category: 'Client Risk',
      question: 'What percentage of your revenue comes from your largest single client?',
      type: 'radio',
      options: [
        { value: 'under_10', label: 'Less than 10%', score: 0 },
        { value: '10_15', label: '10-15%', score: 1 },
        { value: '15_25', label: '15-25%', score: 3 },
        { value: 'over_25', label: 'More than 25%', score: 5 }
      ]
    },
    {
      id: 'client_retention',
      category: 'Client Risk',
      question: 'How would you describe your client retention over the past 2 years?',
      type: 'radio',
      options: [
        { value: 'excellent', label: 'Lost less than 5% of clients, very stable', score: 0 },
        { value: 'good', label: 'Lost 5-10% of clients, mostly normal turnover', score: 1 },
        { value: 'concerning', label: 'Lost 10-20% of clients, some larger departures', score: 3 },
        { value: 'problematic', label: 'Lost more than 20% or several large clients', score: 5 }
      ]
    },
    {
      id: 'owner_dependency',
      category: 'Operational Risk',
      question: 'How many clients work exclusively with you and have no relationship with other staff?',
      type: 'radio',
      options: [
        { value: 'minimal', label: 'Less than 10% of clients', score: 0 },
        { value: 'some', label: '10-25% of clients', score: 2 },
        { value: 'significant', label: '25-50% of clients', score: 4 },
        { value: 'majority', label: 'More than 50% of clients', score: 5 }
      ]
    },
    {
      id: 'process_documentation',
      category: 'Operational Risk',
      question: 'How well are your critical business processes documented?',
      type: 'radio',
      options: [
        { value: 'comprehensive', label: 'Comprehensive written procedures for all key processes', score: 0 },
        { value: 'most_processes', label: 'Most processes documented, some gaps', score: 1 },
        { value: 'basic_only', label: 'Only basic processes documented', score: 3 },
        { value: 'minimal', label: 'Little to no documentation, most knowledge is in my head', score: 5 }
      ]
    },
    {
      id: 'staff_cross_training',
      category: 'Operational Risk',
      question: 'If your key employee (other than yourself) left tomorrow, how would it impact operations?',
      type: 'radio',
      options: [
        { value: 'minimal_impact', label: 'Minimal impact, we have good cross-training', score: 0 },
        { value: 'manageable', label: 'Some disruption but manageable', score: 2 },
        { value: 'significant', label: 'Significant disruption, would take months to recover', score: 4 },
        { value: 'catastrophic', label: 'Would be catastrophic, operations would suffer severely', score: 5 }
      ]
    },
    {
      id: 'technology_systems',
      category: 'Systems & Technology',
      question: 'How would you describe your technology infrastructure?',
      type: 'radio',
      options: [
        { value: 'modern', label: 'Modern, cloud-based, integrated systems', score: 0 },
        { value: 'mostly_current', label: 'Mostly current, some older systems', score: 1 },
        { value: 'mixed', label: 'Mix of old and new, integration issues', score: 3 },
        { value: 'outdated', label: 'Outdated systems, manual processes', score: 5 }
      ]
    },
    {
      id: 'growth_trend',
      category: 'Strategic Position',
      question: 'What has been your revenue trend over the past 3 years?',
      type: 'radio',
      options: [
        { value: 'strong_growth', label: 'Consistent growth of 10%+ annually', score: 0 },
        { value: 'moderate_growth', label: 'Moderate growth of 5-10% annually', score: 1 },
        { value: 'flat', label: 'Relatively flat, minimal growth', score: 3 },
        { value: 'declining', label: 'Declining revenue', score: 5 }
      ]
    }
  ];

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isGmail = email.toLowerCase().includes('@gmail.com');
    return emailRegex.test(email) && !isGmail;
  };

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowEmailForm(true);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const calculateResults = () => {
    const categories = {
      'Financial Presentation': 0,
      'Client Risk': 0,
      'Operational Risk': 0,
      'Systems & Technology': 0,
      'Strategic Position': 0
    };

    let totalScore = 0;
    const maxScore = questions.length * 5;

    questions.forEach(question => {
      const answer = answers[question.id];
      if (answer) {
        const option = question.options.find(opt => opt.value === answer);
        if (option) {
          categories[question.category] += option.score;
          totalScore += option.score;
        }
      }
    });

    const riskLevel = totalScore <= maxScore * 0.2 ? 'Low' :
                     totalScore <= maxScore * 0.4 ? 'Moderate' :
                     totalScore <= maxScore * 0.6 ? 'High' : 'Critical';

    return { categories, totalScore, maxScore, riskLevel };
  };

  const handleSubmit = async () => {
    setError('');

    if (!email || !firmName) {
      setError('Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please use your business email address (Gmail addresses are not accepted)');
      return;
    }

    setIsSubmitting(true);

    try {
      const results = calculateResults();
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      
      const submissionData = {
        email,
        firm_name: firmName,
        answers,
        results,
        assessment_type: '23_red_flags',
        submitted_at: new Date().toISOString()
      };

      const response = await fetch(`${backendUrl}/api/assessment/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      if (response.ok) {
        setSubmitted(true);
        // Trigger PDF download of bespoke results
        window.open(`${backendUrl}/api/assessment/results-pdf?email=${encodeURIComponent(email)}`, '_blank');
      } else {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status}`);
      }
    } catch (error) {
      console.error('Assessment submission error:', error);
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
            <Award className="text-white" size={36} />
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-6">Assessment Complete!</h1>
          <p className="text-xl text-gray-300 mb-8">
            Your personalized 23 Red Flags Assessment results are being sent to <strong>{email}</strong> right now. 
            You should also see them downloading automatically.
          </p>
          <div className="bg-blue-600/20 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold mb-3">Your Results Include:</h3>
            <ul className="text-left space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-1 flex-shrink-0" size={16} />
                <span>Personalized risk scores for each category</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-1 flex-shrink-0" size={16} />
                <span>Custom recommendations based on your responses</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="text-green-400 mt-1 flex-shrink-0" size={16} />
                <span>Priority action plan for your specific firm</span>
              </li>
            </ul>
          </div>
          <Link 
            to="/tools"
            className="btn-primary px-8 py-4 rounded-full text-white font-semibold text-lg inline-flex items-center gap-3 pulse-glow"
          >
            Explore More Tools <ArrowRight size={20} />
          </Link>
          <p className="text-gray-400 text-sm mt-6">
            <Link to="/" className="hover:text-blue-400 transition-colors">← Back to Exit Ready</Link>
          </p>
        </motion.div>
      </div>
    );
  }

  if (showEmailForm) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="glass-effect rounded-3xl p-8 lg:p-12 max-w-2xl mx-auto"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Download className="text-white" size={24} />
            </div>
            <h2 className="text-3xl font-bold mb-4">Get Your Personalized Results</h2>
            <p className="text-gray-300">
              You've completed all 10 questions! Enter your details to receive your custom assessment report.
            </p>
          </div>

          <div className="space-y-6">
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
                Firm Name
              </label>
              <input
                type="text"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
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
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full btn-primary py-4 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Generating Your Results...
                </>
              ) : (
                <>
                  <Mail size={20} />
                  Get My Personalized Assessment
                </>
              )}
            </button>

            <div className="flex justify-center">
              <button
                onClick={() => setShowEmailForm(false)}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={16} />
                Back to Review Answers
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-white">
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
        <div className="container-max max-w-4xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">
                Question {currentQuestion + 1} of {questions.length}
              </span>
              <span className="text-sm text-gray-400">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Question Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="glass-effect rounded-3xl p-8 lg:p-12 mb-8"
            >
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="text-orange-400" size={24} />
                  <span className="text-orange-400 font-medium">{currentQ.category}</span>
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold mb-4">
                  {currentQ.question}
                </h2>
              </div>

              <div className="space-y-4">
                {currentQ.options.map((option, index) => (
                  <motion.label
                    key={option.value}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`block cursor-pointer p-4 rounded-xl border-2 transition-all duration-300 hover:border-blue-500 ${
                      answers[currentQ.id] === option.value
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-gray-600 bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name={currentQ.id}
                        value={option.value}
                        checked={answers[currentQ.id] === option.value}
                        onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        answers[currentQ.id] === option.value
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-400'
                      }`}>
                        {answers[currentQ.id] === option.value && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <span className="text-gray-300">{option.label}</span>
                    </div>
                  </motion.label>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center">
            <button
              onClick={prevQuestion}
              disabled={currentQuestion === 0}
              className="glass-effect px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-all duration-300 inline-flex items-center gap-2"
            >
              <ArrowLeft size={20} />
              Previous
            </button>

            <button
              onClick={nextQuestion}
              disabled={!answers[currentQ.id]}
              className="btn-primary px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {currentQuestion === questions.length - 1 ? 'Complete Assessment' : 'Next Question'}
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assessment;