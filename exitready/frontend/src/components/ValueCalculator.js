import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Calculator, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle,
  BarChart3,
  DollarSign,
  TrendingUp,
  Target,
  AlertCircle,
  Award,
  Eye,
  Building,
  Users,
  Clock,
  Shield,
  Globe,
  Star
} from 'lucide-react';

const ValueCalculator = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [financialInputs, setFinancialInputs] = useState({
    revenue: '',
    ebitda: '',
    target_corpus: ''
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [testMode, setTestMode] = useState(true); // Toggle for prefilled answers

  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  // Sample prefilled answers for testing
  const sampleAnswers = {
    1: "Exit Ready Accounting Firm",
    2: "Exit Ready CPA",
    3: "Professional Services - Accounting",
    4: "541211",
    7: "Referral",
    8: "Testing the Market",
    9: "2 - 4 Years",
    10: "A Medium Amount",
    11: "2",
    12: "3+ years",
    13: "Complete Alignment",
    14: "Partial plan formulated",
    15: "1500000",
    18: "December",
    19: "Yes",
    20: "Yes",
    21: "Yes",
    22: "Modest YOY Steady Growth",
    23: "2 years",
    24: "Yes",
    25: "No",
    26: "Under 5%",
    27: "20 - 30",
    28: "5 - 8 years",
    29: "Over 15 years",
    30: "Basic CRM",
    31: "Some Reccuring Revenue",
    32: "None",
    33: "0"
  };

  const sampleFinancialInputs = {
    revenue: '1500000',
    ebitda: '450000',
    target_corpus: '3000000'
  };

  const steps = [
    { title: 'Company Info', subtitle: 'Basic Information', icon: Building, color: 'blue' },
    { title: 'Exit Readiness', subtitle: 'Owner & Exit Preparation', icon: Target, color: 'purple' },
    { title: 'Business Risk', subtitle: 'Risk Assessment', icon: Shield, color: 'green' },
    { title: 'Financial Data', subtitle: 'Revenue & EBITDA', icon: DollarSign, color: 'yellow' },
    { title: 'Results', subtitle: 'Your Value Analysis', icon: Award, color: 'indigo' }
  ];

  useEffect(() => {
    fetchQuestions();
    
    // Prefill answers for testing
    if (testMode) {
      setAnswers(sampleAnswers);
      setFinancialInputs(sampleFinancialInputs);
    }
  }, [testMode]);

  const fetchQuestions = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/value-calculator/questions`);
      setQuestions(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setLoading(false);
    }
  };

  const getCurrentStepQuestions = () => {
    if (currentStep === 0) {
      // Company Info step
      return questions.filter(q => q.id >= 1 && q.id <= 4);
    } else if (currentStep === 1) {
      // Exit Readiness step
      return questions.filter(q => q.id >= 7 && q.id <= 15);
    } else if (currentStep === 2) {
      // Business Risk step
      return questions.filter(q => q.id >= 18 && q.id <= 33);
    } else if (currentStep === 3) {
      // Financial Data step
      return [];
    }
    return [];
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleFinancialInputChange = (field, value) => {
    setFinancialInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleTestMode = () => {
    const newTestMode = !testMode;
    setTestMode(newTestMode);
    
    if (newTestMode) {
      // Enable test mode - prefill answers
      setAnswers(sampleAnswers);
      setFinancialInputs(sampleFinancialInputs);
    } else {
      // Disable test mode - clear all answers
      setAnswers({});
      setFinancialInputs({
        revenue: '',
        ebitda: '',
        target_corpus: ''
      });
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const calculateResults = async () => {
    setCalculating(true);
    try {
      // Prepare answers in the format expected by the API
      const formattedAnswers = Object.keys(answers).map(questionId => ({
        question_id: parseInt(questionId),
        value: answers[questionId]
      }));

      const requestData = {
        answers: formattedAnswers,
        financial_inputs: {
          revenue: parseFloat(financialInputs.revenue) || 0,
          ebitda: parseFloat(financialInputs.ebitda) || 0,
          target_corpus: parseFloat(financialInputs.target_corpus) || 0
        }
      };

      const response = await axios.post(`${backendUrl}/api/value-calculator/score`, requestData);
      setResults(response.data);
      setCurrentStep(4); // Move to results step
    } catch (error) {
      console.error('Error calculating results:', error);
      alert('Error calculating results. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  const renderQuestion = (question) => {
    const currentValue = answers[question.id] || '';
    
    if (question.input_type === 'Dropdown') {
      return (
        <div key={question.id} className="mb-6">
          <label className="block text-lg font-medium mb-3 text-espresso-black">
            {question.question}
          </label>
          <select
            value={currentValue}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full p-3 rounded-lg bg-gray-50 border border-gray-300 text-espresso-black focus:outline-none focus:ring-2 focus:ring-trust-teal"
          >
            {question.options?.map((option, index) => (
              <option key={index} value={option} className="text-gray-900">
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    } else if (question.input_type === 'Free') {
      return (
        <div key={question.id} className="mb-6">
          <label className="block text-lg font-medium mb-3 text-espresso-black">
            {question.question}
          </label>
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="w-full p-3 rounded-lg bg-gray-50 border border-gray-300 text-espresso-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-trust-teal"
            placeholder="Enter your answer..."
          />
        </div>
      );
    }
    return null;
  };

  const renderFinancialStep = () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-espresso-black mb-6">Financial Information</h3>
      
      <div className="grid gap-6">
        <div>
          <label className="block text-lg font-medium mb-3 text-espresso-black">
            Annual Revenue ($)
          </label>
          <input
            type="number"
            value={financialInputs.revenue}
            onChange={(e) => handleFinancialInputChange('revenue', e.target.value)}
            className="w-full p-4 rounded-lg bg-gray-50 border border-gray-300 text-espresso-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-trust-teal"
            placeholder="e.g., 1250000"
          />
        </div>
        
        <div>
          <label className="block text-lg font-medium mb-3 text-espresso-black">
            EBITDA ($)
          </label>
          <input
            type="number"
            value={financialInputs.ebitda}
            onChange={(e) => handleFinancialInputChange('ebitda', e.target.value)}
            className="w-full p-4 rounded-lg bg-gray-50 border border-gray-300 text-espresso-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-trust-teal"
            placeholder="e.g., 500000"
          />
        </div>
        
        <div>
          <label className="block text-lg font-medium mb-3 text-espresso-black">
            Target Retirement Corpus ($)
          </label>
          <input
            type="number"
            value={financialInputs.target_corpus}
            onChange={(e) => handleFinancialInputChange('target_corpus', e.target.value)}
            className="w-full p-4 rounded-lg bg-gray-50 border border-gray-300 text-espresso-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-trust-teal"
            placeholder="e.g., 3000000"
          />
          <p className="text-espresso-black/70 text-sm mt-2">
            Amount needed for your retirement goals
          </p>
        </div>
      </div>
      
      <div className="flex justify-between pt-6">
        <button
          onClick={prevStep}
          className="flex items-center gap-2 px-6 py-3 bg-gray-100 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-300 text-espresso-black"
        >
          <ArrowLeft size={20} /> Previous
        </button>
        
        <button
          onClick={calculateResults}
          disabled={calculating}
          className="flex items-center gap-2 btn-primary px-8 py-3 rounded-xl font-semibold disabled:opacity-50"
        >
          {calculating ? 'Calculating...' : 'Calculate Results'} 
          <BarChart3 size={20} />
        </button>
      </div>
    </div>
  );

  const renderResults = () => {
    if (!results) return null;

    const getGradeColor = (grade) => {
      switch (grade) {
        case 'A': return 'text-green-400';
        case 'B': return 'text-blue-400';
        case 'C': return 'text-yellow-400';
        case 'D': return 'text-orange-400';
        case 'F': return 'text-red-400';
        default: return 'text-gray-400';
      }
    };

    const getScoreColor = (score) => {
      if (score >= 80) return 'text-green-400';
      if (score >= 70) return 'text-blue-400';
      if (score >= 60) return 'text-yellow-400';
      if (score >= 50) return 'text-orange-400';
      return 'text-red-400';
    };

    return (
      <div className="space-y-8">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-espresso-black mb-4">Your Value Analysis</h2>
          <p className="text-xl text-espresso-black/70 max-w-3xl mx-auto leading-relaxed">Complete assessment of your firm's sellability and value potential</p>
        </div>

        {/* Sellability Score */}
        <div className="bg-gray-50 rounded-3xl p-8 text-center border border-gray-200">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Award className="text-ledger-gold" size={32} />
            <h3 className="text-2xl font-bold text-espresso-black">Sellability Score</h3>
          </div>
          
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className={`text-6xl font-bold ${getScoreColor(results.sellability_score)}`}>
              {results.sellability_score}
            </div>
            <div className="text-4xl text-gray-400">/</div>
            <div className="text-4xl text-gray-400">100</div>
            <div className={`text-4xl font-bold ${getGradeColor(results.sellability_grade)} ml-4`}>
              {results.sellability_grade}
            </div>
          </div>
          
          <p className="text-espresso-black/70 text-lg">
            {results.sellability_score >= 80 ? 'Excellent sellability - highly attractive to buyers' :
             results.sellability_score >= 70 ? 'Good sellability - attractive with minor improvements' :
             results.sellability_score >= 60 ? 'Average sellability - some improvements needed' :
             results.sellability_score >= 50 ? 'Below average - significant improvements required' :
             'Poor sellability - major restructuring needed'}
          </p>
        </div>

        {/* Mathematical Calculations Section */}
        <div className="bg-gray-50 rounded-3xl p-8 border border-gray-200">
          <h3 className="text-2xl font-bold text-espresso-black mb-6 flex items-center gap-3">
            <Calculator className="text-trust-teal" size={28} />
            Mathematical Calculations
          </h3>
          
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Sellability Score Calculation */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h4 className="text-xl font-bold text-espresso-black mb-4">Sellability Score Calculation</h4>
              <div className="space-y-3 text-sm">
                <div className="text-espresso-black/70">
                  <strong>Total Weighted Score:</strong> {results.per_question?.reduce((sum, q) => sum + (q.weighted_score || 0), 0).toFixed(2)}
                </div>
                <div className="text-espresso-black/70">
                  <strong>Total Weight:</strong> {results.per_question?.reduce((sum, q) => sum + (q.weight || 0), 0).toFixed(2)}
                </div>
                <div className="text-espresso-black/70">
                  <strong>Average Score:</strong> {(results.per_question?.reduce((sum, q) => sum + (q.weighted_score || 0), 0) / results.per_question?.reduce((sum, q) => sum + (q.weight || 0), 0)).toFixed(2)}
                </div>
                <div className="text-ledger-gold font-semibold">
                  <strong>Final Score:</strong> {results.sellability_score} = (Total Weighted Score ÷ Total Weight) × 20
                </div>
              </div>
            </div>

            {/* Enterprise Value Calculation */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h4 className="text-xl font-bold text-espresso-black mb-4">Enterprise Value Calculation</h4>
              <div className="space-y-3 text-sm">
                <div className="text-espresso-black/70">
                  <strong>EBITDA:</strong> ${results.valuation_details?.ebitda?.toLocaleString() || 'N/A'}
                </div>
                <div className="text-espresso-black/70">
                  <strong>Base Multiple:</strong> {((results.valuation_details?.multiple || 1) + ((results.sellability_score - 50) / 100)).toFixed(2)}x (from industry range)
                </div>
                <div className="text-espresso-black/70">
                  <strong>Sellability Adjustment:</strong> {((results.sellability_score - 50) / 100).toFixed(2)} (score - 50) ÷ 100
                </div>
                <div className="text-espresso-black/70">
                  <strong>Adjusted Multiple:</strong> {results.valuation_details?.multiple}x
                </div>
                <div className="text-trust-teal font-semibold">
                  <strong>Enterprise Value:</strong> ${results.enterprise_value.toLocaleString()} = EBITDA × Adjusted Multiple
                </div>
              </div>
            </div>

            {/* Revenue Multiple Calculation */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h4 className="text-xl font-bold text-espresso-black mb-4">Revenue Multiple Calculation</h4>
              <div className="space-y-3 text-sm">
                <div className="text-espresso-black/70">
                  <strong>Enterprise Value:</strong> ${results.enterprise_value.toLocaleString()}
                </div>
                <div className="text-espresso-black/70">
                  <strong>Annual Revenue:</strong> ${results.valuation_details?.revenue?.toLocaleString() || 'N/A'}
                </div>
                <div className="text-ledger-gold font-semibold">
                  <strong>Revenue Multiple:</strong> {(results.enterprise_value / (results.valuation_details?.revenue || 1)).toFixed(1)}x = Enterprise Value ÷ Annual Revenue
                </div>
                <div className="text-espresso-black/60 text-xs">
                  This shows how many times annual revenue the business is worth
                </div>
              </div>
            </div>

            {/* Net Proceeds Calculation */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h4 className="text-xl font-bold text-espresso-black mb-4">Net Proceeds Calculation</h4>
              <div className="space-y-3 text-sm">
                <div className="text-espresso-black/70">
                  <strong>Enterprise Value:</strong> ${results.enterprise_value.toLocaleString()}
                </div>
                <div className="text-espresso-black/70">
                  <strong>Fees & Taxes Rate:</strong> {(results.valuation_details?.fees_rate * 100).toFixed(1)}%
                </div>
                <div className="text-espresso-black/70">
                  <strong>Fees & Taxes Amount:</strong> ${(results.enterprise_value * results.valuation_details?.fees_rate).toLocaleString()}
                </div>
                <div className="text-trail-green font-semibold">
                  <strong>Net Proceeds:</strong> ${results.net_proceeds.toLocaleString()} = Enterprise Value × (1 - Fees Rate)
                </div>
              </div>
            </div>

            {/* Wealth Gap Calculation */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 lg:col-span-2">
              <h4 className="text-xl font-bold text-espresso-black mb-4">Wealth Gap Analysis</h4>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3 text-sm">
                  <div className="text-espresso-black/70">
                    <strong>Net Proceeds:</strong> ${results.net_proceeds.toLocaleString()}
                  </div>
                  <div className="text-espresso-black/70">
                    <strong>Target Retirement Corpus:</strong> ${(financialInputs.target_corpus ? parseFloat(financialInputs.target_corpus) : 0).toLocaleString()}
                  </div>
                  <div className={`font-semibold ${results.wealth_gap > 0 ? "text-red-500" : "text-trail-green"}`}>
                    <strong>Wealth Gap:</strong> {results.wealth_gap > 0 ? '-' : '+'}${Math.abs(results.wealth_gap).toLocaleString()} = Target - Net Proceeds
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="text-espresso-black/60">
                    {results.wealth_gap > 0 ? 'You need additional value enhancement' : 'You exceed your retirement target'}
                  </div>
                  <div className="text-espresso-black/50">
                    <strong>Revenue Multiple Context:</strong> At {(results.enterprise_value / (results.valuation_details?.revenue || 1)).toFixed(1)}x revenue, this represents a {(results.enterprise_value / (results.valuation_details?.revenue || 1)) >= 2 ? 'strong' : (results.enterprise_value / (results.valuation_details?.revenue || 1)) >= 1.5 ? 'good' : 'modest'} valuation relative to industry standards.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Per-Question Scoring Details */}
        <div className="bg-gray-50 rounded-3xl p-8 border border-gray-200">
          <h3 className="text-2xl font-bold text-espresso-black mb-6 flex items-center gap-3">
            <Eye className="text-trust-teal" size={28} />
            Detailed Question Scoring
          </h3>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {results.per_question?.map((question, index) => (
              <div key={index} className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="grid lg:grid-cols-12 gap-4 items-center">
                  <div className="lg:col-span-6">
                    <p className="text-espresso-black font-medium">{question.question}</p>
                    <p className="text-espresso-black/60 text-sm">{question.value}</p>
                  </div>
                  <div className="lg:col-span-2 text-center">
                    <div className="text-espresso-black font-semibold">Raw Score</div>
                    <div className="text-trust-teal">{question.raw_score?.toFixed(1) || 'N/A'}</div>
                  </div>
                  <div className="lg:col-span-2 text-center">
                    <div className="text-espresso-black font-semibold">Weight</div>
                    <div className="text-ledger-gold">{question.weight?.toFixed(1) || 'N/A'}</div>
                  </div>
                  <div className="lg:col-span-2 text-center">
                    <div className="text-espresso-black font-semibold">Weighted Score</div>
                    <div className="text-trail-green">{question.weighted_score?.toFixed(1) || 'N/A'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Value Metrics */}
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <Building className="text-trust-teal" size={24} />
              <h4 className="text-xl font-bold text-espresso-black">Enterprise Value</h4>
            </div>
            <div className="text-3xl font-bold text-trust-teal mb-2">
              ${results.enterprise_value.toLocaleString()}
            </div>
            <p className="text-espresso-black/70 text-sm">
              Based on {results.valuation_details?.multiple}x EBITDA multiple
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="text-ledger-gold" size={24} />
              <h4 className="text-xl font-bold text-espresso-black">Revenue Multiple</h4>
            </div>
            <div className="text-3xl font-bold text-ledger-gold mb-2">
              {(results.enterprise_value / (results.valuation_details?.revenue || 1)).toFixed(1)}x
            </div>
            <p className="text-espresso-black/70 text-sm">
              Sale price as multiple of gross revenue
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="text-trail-green" size={24} />
              <h4 className="text-xl font-bold text-espresso-black">Net Proceeds</h4>
            </div>
            <div className="text-3xl font-bold text-trail-green mb-2">
              ${results.net_proceeds.toLocaleString()}
            </div>
            <p className="text-espresso-black/70 text-sm">
              After fees and taxes ({(results.valuation_details?.fees_rate * 100).toFixed(1)}%)
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <Target className={results.wealth_gap > 0 ? "text-red-500" : "text-trail-green"} size={24} />
              <h4 className="text-xl font-bold text-espresso-black">Wealth Gap</h4>
            </div>
            <div className={`text-3xl font-bold mb-2 ${results.wealth_gap > 0 ? "text-red-500" : "text-trail-green"}`}>
              {results.wealth_gap > 0 ? '-' : '+'}${Math.abs(results.wealth_gap).toLocaleString()}
            </div>
            <p className="text-espresso-black/70 text-sm">
              {results.wealth_gap > 0 ? 'Shortfall vs. retirement target' : 'Surplus above retirement target'}
            </p>
          </div>
        </div>

        {/* Key Insights */}
        <div className="bg-gray-50 rounded-3xl p-8 border border-gray-200">
          <h3 className="text-2xl font-bold text-espresso-black mb-6 flex items-center gap-3">
            <Star className="text-ledger-gold" size={28} />
            Key Insights
          </h3>
          
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-semibold text-espresso-black mb-3">Strengths</h4>
              <div className="space-y-2">
                {results.sellability_score >= 70 && (
                  <div className="flex items-center gap-2 text-trail-green">
                    <CheckCircle size={16} />
                    <span className="text-sm">Strong overall sellability score</span>
                  </div>
                )}
                {results.valuation_details?.multiple >= 1.5 && (
                  <div className="flex items-center gap-2 text-trail-green">
                    <CheckCircle size={16} />
                    <span className="text-sm">Above-average valuation multiple</span>
                  </div>
                )}
                {results.wealth_gap <= 0 && (
                  <div className="flex items-center gap-2 text-trail-green">
                    <CheckCircle size={16} />
                    <span className="text-sm">Sale proceeds meet retirement goals</span>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold text-espresso-black mb-3">Areas for Improvement</h4>
              <div className="space-y-2">
                {results.sellability_score < 70 && (
                  <div className="flex items-center gap-2 text-orange-500">
                    <AlertCircle size={16} />
                    <span className="text-sm">Focus on improving sellability factors</span>
                  </div>
                )}
                {results.wealth_gap > 0 && (
                  <div className="flex items-center gap-2 text-orange-500">
                    <AlertCircle size={16} />
                    <span className="text-sm">Consider value enhancement strategies</span>
                  </div>
                )}
                {results.valuation_details?.multiple < 1.2 && (
                  <div className="flex items-center gap-2 text-orange-500">
                    <AlertCircle size={16} />
                    <span className="text-sm">Improve operational efficiency for higher multiples</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
          <button
            onClick={() => window.location.reload()}
            className="btn-primary px-8 py-4 rounded-full font-semibold inline-flex items-center gap-3"
          >
            Start New Analysis <ArrowRight size={20} />
          </button>
          <Link 
            to="/tools"
            className="bg-gray-100 hover:bg-gray-200 text-espresso-black px-8 py-4 rounded-full font-semibold transition-all duration-300 inline-flex items-center gap-3"
          >
            Explore Other Tools
          </Link>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-trust-teal mx-auto mb-4"></div>
          <p className="text-espresso-black text-xl">Loading Value Calculator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <img src="/logo-teal.svg" alt="Audit Trail Mix" className="h-10 w-10 mr-3" />
                <span className="text-xl font-bold text-espresso-black">Audit Trail Mix</span>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={toggleTestMode}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    testMode 
                      ? 'bg-trust-teal text-white' 
                      : 'bg-gray-200 text-espresso-black'
                  }`}
                >
                  Test Mode: {testMode ? 'ON' : 'OFF'}
                </button>
                <a href="/exitready" className="text-espresso-black hover:text-trust-teal transition-colors">
                  Exit Ready Platform →
                </a>
              </div>
            </div>
          </div>
        </nav>

      {/* Header */}
      <section className="pt-32 pb-12">
        <div className="container-max">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 text-espresso-black">
              Value Calculator Suite
            </h1>
            <p className="text-xl text-espresso-black/80 max-w-3xl mx-auto leading-relaxed">
              Complete value assessment including sellability scoring, value acceleration planning, and wealth gap analysis.
            </p>
          </motion.div>

          {/* Progress Indicator */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                
                return (
                  <div key={index} className="flex flex-col items-center relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
                      isCompleted ? 'bg-green-500' : 
                      isCurrent ? `bg-${step.color}-500` : 'bg-gray-600'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle size={24} className="text-white" />
                      ) : (
                        <StepIcon size={24} className="text-white" />
                      )}
                    </div>
                    <div className="text-center">
                      <div className={`font-semibold text-sm ${isCurrent ? 'text-espresso-black' : 'text-espresso-black/60'}`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-espresso-black/50">{step.subtitle}</div>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`absolute top-6 left-12 w-24 h-0.5 ${
                        index < currentStep ? 'bg-green-500' : 'bg-gray-600'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-50 rounded-3xl p-8 lg:p-12 border border-gray-200">
              {currentStep === 4 ? (
                renderResults()
              ) : currentStep === 3 ? (
                renderFinancialStep()
              ) : (
                <div>
                  <h2 className="text-3xl font-bold text-espresso-black mb-8">
                    {steps[currentStep].title}
                  </h2>
                  
                  <div className="space-y-6 mb-8">
                    {getCurrentStepQuestions().map(renderQuestion)}
                  </div>
                  
                  <div className="flex justify-between">
                    <button
                      onClick={prevStep}
                      disabled={currentStep === 0}
                      className="flex items-center gap-2 px-6 py-3 bg-gray-100 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-espresso-black"
                    >
                      <ArrowLeft size={20} /> Previous
                    </button>
                    
                    <button
                      onClick={nextStep}
                      className="flex items-center gap-2 btn-primary px-8 py-3 rounded-xl font-semibold"
                    >
                      Next <ArrowRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ValueCalculator;