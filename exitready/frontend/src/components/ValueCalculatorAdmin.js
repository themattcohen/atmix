import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Settings, 
  Save,
  Plus,
  Trash2,
  Edit,
  Eye,
  Calculator,
  Database,
  FileText,
  BarChart3,
  DollarSign,
  Target,
  AlertCircle,
  CheckCircle,
  ArrowLeft
} from 'lucide-react';

const ValueCalculatorAdmin = () => {
  const [activeTab, setActiveTab] = useState('questions');
  const [questions, setQuestions] = useState([]);
  const [options, setOptions] = useState([]);
  const [taxParams, setTaxParams] = useState([]);
  const [naicsModifiers, setNaicsModifiers] = useState([]);
  const [multiples, setMultiples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingParam, setEditingParam] = useState(null);
  const [editingMultiple, setEditingMultiple] = useState(null);
  const [editingNaics, setEditingNaics] = useState(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const tabs = [
    { id: 'questions', label: 'Questions & Weights', icon: FileText },
    { id: 'options', label: 'Answer Options', icon: Settings },
    { id: 'multiples', label: 'EBITDA Multiples', icon: BarChart3 },
    { id: 'tax-params', label: 'Tax Parameters', icon: Calculator },
    { id: 'naics', label: 'NAICS Codes', icon: Database }
  ];

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      const [questionsRes, optionsRes, taxParamsRes, naicsRes, multiplesRes] = await Promise.all([
        axios.get(`${backendUrl}/api/value-calculator/questions`),
        axios.get(`${backendUrl}/api/value-questions/all`).catch(() => ({ data: [] })),
        axios.get(`${backendUrl}/api/value-tax-params/all`).catch(() => ({ data: [] })),
        axios.get(`${backendUrl}/api/value-naics/all`).catch(() => ({ data: [] })),
        axios.get(`${backendUrl}/api/value-multiples/all`).catch(() => ({ data: [] }))
      ]);

      setQuestions(questionsRes.data);
      
      // Extract options from questions data
      const allOptions = [];
      questionsRes.data.forEach(q => {
        if (q.options) {
          q.options.forEach(option => {
            allOptions.push({ question_id: q.id, option_text: option });
          });
        }
      });
      setOptions(allOptions);

      // Set other data with fallback to empty arrays
      setTaxParams(taxParamsRes.data || []);
      setNaicsModifiers(naicsRes.data || []);
      setMultiples(multiplesRes.data || []);

    } catch (error) {
      console.error('Error fetching admin data:', error);
      setMessage('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data, endpoint) => {
    try {
      setSaving(true);
      await axios.post(`${backendUrl}/api/${endpoint}`, data);
      setMessage('Data saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving data:', error);
      setMessage('Error saving data');
    } finally {
      setSaving(false);
    }
  };

  const updateQuestion = (questionId, field, value) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, [field]: value } : q
    ));
  };

  const updateTaxParam = (paramIndex, field, value) => {
    setTaxParams(prev => prev.map((param, index) => 
      index === paramIndex ? { ...param, [field]: value } : param
    ));
  };

  const updateMultiple = (multipleIndex, field, value) => {
    setMultiples(prev => prev.map((mult, index) => 
      index === multipleIndex ? { ...mult, [field]: parseFloat(value) || 0 } : mult
    ));
  };

  const updateNaics = (naicsIndex, field, value) => {
    setNaicsModifiers(prev => prev.map((naics, index) => 
      index === naicsIndex ? { ...naics, [field]: value } : naics
    ));
  };

  const addOption = (questionId) => {
    const newOption = prompt('Enter new option text:');
    if (newOption && newOption.trim()) {
      setOptions(prev => [...prev, { question_id: questionId, option_text: newOption.trim() }]);
    }
  };

  const removeOption = (questionId, optionText) => {
    if (window.confirm('Are you sure you want to remove this option?')) {
      setOptions(prev => prev.filter(opt => 
        !(opt.question_id === questionId && opt.option_text === optionText)
      ));
    }
  };

  const saveQuestions = async () => {
    await handleSave(questions, 'value-questions/update');
    await handleSave(options, 'value-options/update');
    await fetchAllData();
  };

  const saveTaxParams = async () => {
    await handleSave(taxParams, 'value-tax-params/update');
    await fetchAllData();
  };

  const saveMultiples = async () => {
    await handleSave(multiples, 'value-multiples/update');
    await fetchAllData();
  };

  const renderQuestionsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-espresso-black">Questions & Scoring Weights</h3>
        <div className="flex gap-4">
          <button
            onClick={saveQuestions}
            disabled={saving}
            className="btn-primary px-6 py-2 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => fetchAllData()}
            className="bg-gray-100 hover:bg-gray-200 text-espresso-black px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div key={question.id} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
            <div className="grid lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-1">
                <div className="text-espresso-black font-bold text-lg">#{question.id}</div>
                <div className="text-espresso-black/60 text-xs">Question ID</div>
              </div>
              
              <div className="lg:col-span-5">
                {editingQuestion === question.id ? (
                  <div className="space-y-3">
                    <textarea
                      value={question.question}
                      onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                      className="w-full p-3 rounded-lg bg-white border border-gray-300 text-espresso-black resize-none focus:ring-2 focus:ring-trust-teal"
                      rows="3"
                    />
                    <div className="flex gap-2">
                      <select
                        value={question.input_type}
                        onChange={(e) => updateQuestion(question.id, 'input_type', e.target.value)}
                        className="p-2 rounded bg-white border border-gray-300 text-espresso-black focus:ring-2 focus:ring-trust-teal"
                      >
                        <option value="Free">Free Text</option>
                        <option value="Dropdown">Dropdown</option>
                      </select>
                      <input
                        type="text"
                        value={question.step || ''}
                        onChange={(e) => updateQuestion(question.id, 'step', e.target.value)}
                        placeholder="Step name"
                        className="p-2 rounded bg-white border border-gray-300 text-espresso-black flex-1 focus:ring-2 focus:ring-trust-teal"
                      />
                    </div>
                    <textarea
                      value={question.scoring_formula || ''}
                      onChange={(e) => updateQuestion(question.id, 'scoring_formula', e.target.value)}
                      placeholder="Scoring formula"
                      className="w-full p-2 rounded bg-white border border-gray-300 text-espresso-black font-mono text-xs focus:ring-2 focus:ring-trust-teal"
                      rows="2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingQuestion(null)}
                        className="btn-primary px-4 py-1 rounded text-sm"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-espresso-black font-medium mb-2">{question.question}</div>
                    <div className="text-espresso-black/60 text-sm mb-2">
                      Type: <span className="text-trust-teal">{question.input_type}</span>
                      {question.step && (
                        <span className="ml-2">Step: <span className="text-trail-green">{question.step}</span></span>
                      )}
                    </div>
                    {question.scoring_formula && (
                      <div className="text-espresso-black/60 text-xs">
                        Formula: <span className="text-ledger-gold font-mono">{question.scoring_formula}</span>
                      </div>
                    )}
                    <button
                      onClick={() => setEditingQuestion(question.id)}
                      className="mt-2 text-trust-teal hover:text-trust-teal/80 text-sm flex items-center gap-1"
                    >
                      <Edit size={14} /> Edit Question
                    </button>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                <div className="text-center">
                  <div className="text-espresso-black font-semibold">Weight</div>
                  <input
                    type="number"
                    value={question.weight === 'Off' ? '0' : question.weight || '0'}
                    onChange={(e) => updateQuestion(question.id, 'weight', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded bg-white border border-gray-300 text-center font-bold text-lg text-espresso-black focus:ring-2 focus:ring-trust-teal"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="text-center">
                  <div className="text-espresso-black font-semibold">Scored</div>
                  <select
                    value={question.scored ? 'true' : 'false'}
                    onChange={(e) => updateQuestion(question.id, 'scored', e.target.value === 'true')}
                    className="w-full p-2 rounded bg-white border border-gray-300 text-center text-espresso-black focus:ring-2 focus:ring-trust-teal"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="text-center">
                  <div className="text-espresso-black font-semibold">Options</div>
                  <div className="text-trust-teal text-lg font-bold">
                    {question.options ? question.options.length : 0}
                  </div>
                  {question.input_type === 'Dropdown' && (
                    <button
                      onClick={() => addOption(question.id)}
                      className="text-trail-green hover:text-trail-green/80 text-xs mt-1"
                    >
                      <Plus size={12} className="inline mr-1" />
                      Add Option
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Show options if available */}
            {question.options && question.options.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-white font-medium mb-2">Answer Options:</div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {question.options.map((option, idx) => (
                    <div key={idx} className="bg-black/20 rounded-lg p-2 text-gray-300 text-sm flex items-center justify-between">
                      <span className="flex-1">{option}</span>
                      <button
                        onClick={() => removeOption(question.id, option)}
                        className="text-red-400 hover:text-red-300 ml-2"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderOptionsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Answer Options by Question</h3>
      </div>

      <div className="space-y-4">
        {/* Group options by question_id */}
        {Object.entries(
          options.reduce((acc, option) => {
            if (!acc[option.question_id]) {
              acc[option.question_id] = [];
            }
            acc[option.question_id].push(option);
            return acc;
          }, {})
        ).map(([questionId, questionOptions]) => {
          const question = questions.find(q => q.id === parseInt(questionId));
          return (
            <div key={questionId} className="glass-effect rounded-xl p-6">
              <div className="mb-4">
                <h4 className="text-xl font-bold text-white mb-2">
                  Question #{questionId}: {question?.question || 'Unknown Question'}
                </h4>
                <div className="text-gray-400 text-sm">
                  {questionOptions.length} options available
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {questionOptions.map((option, idx) => (
                  <div key={idx} className="bg-black/20 rounded-lg p-3 text-gray-300">
                    {option.option_text}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderMultiplesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">EBITDA Multiples by Revenue Band</h3>
        <button
          onClick={saveMultiples}
          disabled={saving}
          className="btn-primary px-6 py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {multiples.map((multiple, index) => (
          <div key={index} className="glass-effect rounded-xl p-6 text-center">
            <input
              type="text"
              value={multiple.band}
              onChange={(e) => updateMultiple(index, 'band', e.target.value)}
              className="text-2xl font-bold text-white mb-2 bg-transparent border-b border-white/20 focus:border-blue-400 focus:outline-none text-center w-full"
            />
            <div className="text-gray-400 mb-4">Revenue Band</div>
            
            <div className="space-y-3">
              <div>
                <input
                  type="number"
                  value={multiple.multiple_min}
                  onChange={(e) => updateMultiple(index, 'multiple_min', e.target.value)}
                  className="text-green-400 text-2xl font-bold bg-transparent border-b border-white/20 focus:border-green-400 focus:outline-none text-center w-full"
                  step="0.1"
                />
                <div className="text-gray-400 text-sm">Minimum Multiple</div>
              </div>
              
              <div className="text-gray-500">to</div>
              
              <div>
                <input
                  type="number"
                  value={multiple.multiple_max}
                  onChange={(e) => updateMultiple(index, 'multiple_max', e.target.value)}
                  className="text-red-400 text-2xl font-bold bg-transparent border-b border-white/20 focus:border-red-400 focus:outline-none text-center w-full"
                  step="0.1"
                />
                <div className="text-gray-400 text-sm">Maximum Multiple</div>
              </div>
              
              <div className="pt-3 border-t border-white/10">
                <div className="text-blue-400 text-xl font-bold">
                  {((multiple.multiple_min + multiple.multiple_max) / 2).toFixed(1)}x
                </div>
                <div className="text-gray-400 text-sm">Average Used</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTaxParamsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Financial Parameters & Assumptions</h3>
        <button
          onClick={saveTaxParams}
          disabled={saving}
          className="btn-primary px-6 py-2 rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {taxParams.map((param, index) => (
          <div key={index} className="glass-effect rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Calculator className="text-blue-400" size={24} />
              <input
                type="text"
                value={param.param}
                onChange={(e) => updateTaxParam(index, 'param', e.target.value)}
                className="text-xl font-bold text-white bg-transparent border-b border-white/20 focus:border-blue-400 focus:outline-none flex-1"
              />
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-sm">Excel Cell Reference</div>
                <input
                  type="text"
                  value={param.cell}
                  onChange={(e) => updateTaxParam(index, 'cell', e.target.value)}
                  className="text-yellow-400 font-mono text-lg bg-transparent border-b border-white/20 focus:border-yellow-400 focus:outline-none w-full"
                />
              </div>
              
              <div>
                <div className="text-gray-400 text-sm">Current Value</div>
                <input
                  type="number"
                  value={param.value}
                  onChange={(e) => updateTaxParam(index, 'value', parseFloat(e.target.value) || 0)}
                  className="text-green-400 text-2xl font-bold bg-transparent border-b border-white/20 focus:border-green-400 focus:outline-none w-full"
                  step="0.001"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Display: {param.value < 1 ? (param.value * 100).toFixed(1) + '%' : param.value.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderNaicsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">NAICS Industry Codes</h3>
      </div>

      <div className="space-y-4">
        {naicsModifiers.map((naics, index) => (
          <div key={index} className="glass-effect rounded-xl p-6">
            <div className="grid lg:grid-cols-3 gap-4 items-center">
              <div>
                <div className="text-white font-bold text-lg">{naics.naics_code}</div>
                <div className="text-gray-400 text-sm">NAICS Code</div>
              </div>
              
              <div>
                <div className="text-blue-400 font-medium">{naics.industry_name}</div>
                <div className="text-gray-400 text-sm">Industry Name</div>
              </div>
              
              <div>
                <div className="text-gray-300 text-sm">{naics.industry_naics_codes}</div>
                <div className="text-gray-400 text-xs">Full Description</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading Admin Panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-effect">
        <div className="container-max">
          <div className="flex items-center justify-between py-4 px-6">
            <Link to="/" className="flex items-center space-x-2 text-trust-teal">
              <img src="/logo-teal.svg" alt="Audit Trail Mix Logo" className="w-8 h-8" />
              <span className="text-2xl font-bold font-mono">Audit Trail Mix Admin</span>
            </Link>
            <Link 
              to="/admin"
              className="text-gray-300 hover:text-white transition-colors duration-300 flex items-center gap-2"
            >
              <ArrowLeft size={20} /> Back to Admin
            </Link>
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
            <h1 className="text-4xl lg:text-6xl font-bold mb-6">
              Value Calculator Admin
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Manage all aspects of the Value Calculator including questions, weights, scoring parameters, and validation rules.
            </p>
          </motion.div>

          {/* Message */}
          {message && (
            <div className={`max-w-4xl mx-auto mb-6 p-4 rounded-lg ${
              message.includes('Error') ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'
            }`}>
              {message}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="max-w-6xl mx-auto mb-8">
            <div className="flex flex-wrap gap-2 justify-center">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                      activeTab === tab.id
                        ? 'bg-blue-500 text-white'
                        : 'glass-effect text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <TabIcon size={20} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-6xl mx-auto">
            {activeTab === 'questions' && renderQuestionsTab()}
            {activeTab === 'options' && renderOptionsTab()}
            {activeTab === 'multiples' && renderMultiplesTab()}
            {activeTab === 'tax-params' && renderTaxParamsTab()}
            {activeTab === 'naics' && renderNaicsTab()}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ValueCalculatorAdmin;