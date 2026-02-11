import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Upload,
  FileText,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Download,
  ArrowLeft
} from 'lucide-react';

const QOEBasic = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [projectId, setProjectId] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Step 1: Create project
  useEffect(() => {
    createProject();
  }, []);

  const createProject = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/qoe/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          package_type: 'basic',
          client_name: `Basic Package ${new Date().toISOString().split('T')[0]}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const project = await response.json();
      setProjectId(project.id);
      setProjectData(project);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: "Upload Data", icon: Upload },
    { number: 2, title: "Map Accounts", icon: BarChart3 },
    { number: 3, title: "Add-backs", icon: FileText },
    { number: 4, title: "Generate Reports", icon: Download }
  ];

  if (loading && !projectId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white text-xl">Setting up your QOE project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="glass-effect rounded-xl p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <Link 
            to="/qoe"
            className="btn-primary px-6 py-3 rounded-full text-white font-semibold inline-flex items-center gap-2"
          >
            <ArrowLeft size={20} /> Back to QOE
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="p-6 lg:p-8">
        <div className="container-max flex justify-between items-center">
          <Link 
            to="/qoe"
            className="text-white hover:text-blue-400 transition-colors duration-300 inline-flex items-center gap-2"
          >
            <ArrowLeft size={20} /> Back to QOE
          </Link>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-white">Basic QOE Package</h1>
            <p className="text-gray-400">Project ID: {projectId}</p>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <section className="px-6 lg:px-8 mb-8">
        <div className="container-max">
          <div className="flex items-center justify-center mb-8">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg ${
                  currentStep >= step.number 
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' 
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {currentStep > step.number ? (
                    <CheckCircle size={24} />
                  ) : (
                    step.number
                  )}
                </div>
                <div className="ml-3 mr-8">
                  <p className={`font-semibold ${currentStep >= step.number ? 'text-white' : 'text-gray-400'}`}>
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-1 mx-4 ${
                    currentStep > step.number ? 'bg-blue-500' : 'bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Step Content */}
      <section className="px-6 lg:px-8 pb-20">
        <div className="container-max">
          {currentStep === 1 && (
            <QOEUploadStep 
              projectId={projectId} 
              onNext={() => setCurrentStep(2)}
              onDataUpdate={setProjectData}
            />
          )}
          {currentStep === 2 && (
            <QOEMappingStep 
              projectId={projectId} 
              projectData={projectData}
              onNext={() => setCurrentStep(3)}
              onDataUpdate={setProjectData}
            />
          )}
          {currentStep === 3 && (
            <QOEAddbacksStep 
              projectId={projectId} 
              projectData={projectData}
              onNext={() => setCurrentStep(4)}
              onDataUpdate={setProjectData}
            />
          )}
          {currentStep === 4 && (
            <QOEReportsStep 
              projectId={projectId} 
              projectData={projectData}
              packageType="basic"
            />
          )}
        </div>
      </section>
    </div>
  );
};

// Step Components
const QOEUploadStep = ({ projectId, onNext, onDataUpdate }) => {
  const [files, setFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState({});

  const fileTypes = [
    { 
      key: 'general_ledger', 
      title: 'General Ledger', 
      description: 'CSV file with your complete general ledger transactions',
      required: true
    },
    { 
      key: 'customer_revenue', 
      title: 'Customer Revenue', 
      description: 'CSV file with revenue broken down by customer',
      required: false
    }
  ];

  const handleFileSelect = (fileType, file) => {
    setFiles(prev => ({
      ...prev,
      [fileType]: file
    }));
  };

  const handleUpload = async (fileType) => {
    if (!files[fileType]) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', files[fileType]);
      formData.append('file_type', fileType);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/qoe/projects/${projectId}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setUploadResults(prev => ({
        ...prev,
        [fileType]: result
      }));

    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const canProceed = uploadResults.general_ledger;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="glass-effect rounded-2xl p-8 lg:p-12"
    >
      <h2 className="text-3xl font-bold text-white mb-6">Upload Your Financial Data</h2>
      <p className="text-gray-300 mb-8">
        Upload your financial files to begin the QOE analysis. We'll process and analyze your data to identify key insights.
      </p>

      <div className="space-y-6 mb-8">
        {fileTypes.map((fileType) => (
          <div key={fileType.key} className="border border-gray-600 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {fileType.title} {fileType.required && <span className="text-red-400">*</span>}
                </h3>
                <p className="text-gray-400">{fileType.description}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm ${
                fileType.required ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                {fileType.required ? 'Required' : 'Optional'}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleFileSelect(fileType.key, e.target.files[0])}
                className="hidden"
                id={`file-${fileType.key}`}
              />
              <label
                htmlFor={`file-${fileType.key}`}
                className="btn-secondary px-4 py-2 rounded-lg cursor-pointer inline-flex items-center gap-2"
              >
                <Upload size={18} /> Choose File
              </label>
              
              {files[fileType.key] && (
                <>
                  <span className="text-gray-300">{files[fileType.key].name}</span>
                  <button
                    onClick={() => handleUpload(fileType.key)}
                    disabled={uploading}
                    className="btn-primary px-4 py-2 rounded-lg inline-flex items-center gap-2"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </>
              )}

              {uploadResults[fileType.key] && (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle size={18} />
                  <span>Uploaded ({uploadResults[fileType.key].rows_processed} rows)</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <div className="text-gray-400">
          {canProceed ? (
            <span className="text-green-400">✓ Ready to proceed</span>
          ) : (
            <span>Upload required files to continue</span>
          )}
        </div>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`px-8 py-4 rounded-full font-semibold text-lg inline-flex items-center gap-3 ${
            canProceed 
              ? 'btn-primary text-white' 
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          Next: Map Accounts <ArrowRight size={20} />
        </button>
      </div>
    </motion.div>
  );
};

const QOEMappingStep = ({ projectId, projectData, onNext, onDataUpdate }) => {
  const [mappings, setMappings] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Extract accounts from uploaded general ledger
    if (projectData?.files_uploaded?.general_ledger) {
      const glData = projectData.files_uploaded.general_ledger.data;
      const uniqueAccounts = [...new Set(glData.map(row => row.account || row.Account || row.account_name || row.AccountName || Object.values(row)[0]))];
      setAccounts(uniqueAccounts.filter(Boolean));
      
      // Initialize mappings
      const initialMappings = uniqueAccounts.filter(Boolean).map(account => ({
        original_account: account,
        mapped_account: account,
        account_category: 'Other'
      }));
      setMappings(initialMappings);
    }
    setLoading(false);
  }, [projectData]);

  const accountCategories = [
    'Revenue',
    'Cost of Goods Sold',
    'Operating Expenses',
    'Payroll Expenses',
    'Owner Compensation',
    'Professional Services',
    'Rent & Utilities',
    'Marketing & Advertising',
    'Other Expenses',
    'Assets',
    'Liabilities',
    'Equity',
    'Other'
  ];

  const handleMappingChange = (index, field, value) => {
    setMappings(prev => prev.map((mapping, i) => 
      i === index ? { ...mapping, [field]: value } : mapping
    ));
  };

  const saveMappings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/qoe/projects/${projectId}/mappings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mappings)
      });

      if (!response.ok) {
        throw new Error('Failed to save mappings');
      }

      onNext();
    } catch (err) {
      console.error('Error saving mappings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && accounts.length === 0) {
    return <div className="text-center py-20">Loading accounts...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="glass-effect rounded-2xl p-8 lg:p-12"
    >
      <h2 className="text-3xl font-bold text-white mb-6">Map Chart of Accounts</h2>
      <p className="text-gray-300 mb-8">
        Map your accounts to standardized categories for better analysis and reporting.
      </p>

      <div className="max-h-96 overflow-y-auto mb-8">
        <table className="w-full">
          <thead className="bg-gray-800/50 sticky top-0">
            <tr>
              <th className="text-left p-3 text-white">Original Account</th>
              <th className="text-left p-3 text-white">Category</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping, index) => (
              <tr key={index} className="border-b border-gray-700">
                <td className="p-3 text-gray-300">{mapping.original_account}</td>
                <td className="p-3">
                  <select
                    value={mapping.account_category}
                    onChange={(e) => handleMappingChange(index, 'account_category', e.target.value)}
                    className="bg-gray-700 text-white rounded px-3 py-2 w-full"
                  >
                    {accountCategories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-gray-400">
          {mappings.length} accounts mapped
        </div>
        <button
          onClick={saveMappings}
          disabled={loading}
          className="btn-primary px-8 py-4 rounded-full text-white font-semibold text-lg inline-flex items-center gap-3"
        >
          {loading ? 'Saving...' : 'Next: Identify Add-backs'} <ArrowRight size={20} />
        </button>
      </div>
    </motion.div>
  );
};

const QOEAddbacksStep = ({ projectId, projectData, onNext, onDataUpdate }) => {
  const [addbacks, setAddbacks] = useState([]);
  const [loading, setLoading] = useState(false);

  const addbackCategories = [
    'owner_compensation',
    'personal_expenses', 
    'one_time',
    'non_recurring'
  ];

  const addNewAddback = () => {
    setAddbacks(prev => [...prev, {
      description: '',
      amount: 0,
      category: 'owner_compensation',
      explanation: '',
      frequency: 'annual'
    }]);
  };

  const updateAddback = (index, field, value) => {
    setAddbacks(prev => prev.map((addback, i) => 
      i === index ? { ...addback, [field]: value } : addback
    ));
  };

  const removeAddback = (index) => {
    setAddbacks(prev => prev.filter((_, i) => i !== index));
  };

  const saveAddbacks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/qoe/projects/${projectId}/addbacks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addbacks)
      });

      if (!response.ok) {
        throw new Error('Failed to save add-backs');
      }

      onNext();
    } catch (err) {
      console.error('Error saving add-backs:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalAddbacks = addbacks.reduce((sum, addback) => sum + (parseFloat(addback.amount) || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="glass-effect rounded-2xl p-8 lg:p-12"
    >
      <h2 className="text-3xl font-bold text-white mb-6">Identify Add-backs</h2>
      <p className="text-gray-300 mb-8">
        Identify expenses that should be added back to show normalized EBITDA and true profitability.
      </p>

      <div className="mb-6">
        <button
          onClick={addNewAddback}
          className="btn-primary px-4 py-2 rounded-lg inline-flex items-center gap-2"
        >
          <FileText size={18} /> Add New Add-back
        </button>
      </div>

      <div className="space-y-4 mb-8 max-h-96 overflow-y-auto">
        {addbacks.map((addback, index) => (
          <div key={index} className="border border-gray-600 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <input
                  type="text"
                  value={addback.description}
                  onChange={(e) => updateAddback(index, 'description', e.target.value)}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                  placeholder="e.g., Owner's personal vehicle expenses"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Amount ($)</label>
                <input
                  type="number"
                  value={addback.amount}
                  onChange={(e) => updateAddback(index, 'amount', e.target.value)}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                <select
                  value={addback.category}
                  onChange={(e) => updateAddback(index, 'category', e.target.value)}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  <option value="owner_compensation">Owner Compensation</option>
                  <option value="personal_expenses">Personal Expenses</option>
                  <option value="one_time">One-time Expenses</option>
                  <option value="non_recurring">Non-recurring Expenses</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => removeAddback(index)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Explanation</label>
              <textarea
                value={addback.explanation}
                onChange={(e) => updateAddback(index, 'explanation', e.target.value)}
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
                rows="2"
                placeholder="Explain why this should be added back..."
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 mb-8">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-white">Total Add-backs:</span>
          <span className="text-2xl font-bold text-green-400">${totalAddbacks.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-gray-400">
          {addbacks.length} add-backs identified
        </div>
        <button
          onClick={saveAddbacks}
          disabled={loading}
          className="btn-primary px-8 py-4 rounded-full text-white font-semibold text-lg inline-flex items-center gap-3"
        >
          {loading ? 'Saving...' : 'Next: Generate Reports'} <ArrowRight size={20} />
        </button>
      </div>
    </motion.div>
  );
};

const QOEReportsStep = ({ projectId, projectData, packageType }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

  useEffect(() => {
    generateAnalysis();
  }, []);

  const generateAnalysis = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/qoe/projects/${projectId}/analyze`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to generate analysis');
      }

      const result = await response.json();
      setAnalysis(result.analysis);
    } catch (err) {
      console.error('Error generating analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (reportType) => {
    try {
      setGenerating(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/qoe/projects/${projectId}/reports/${reportType}`);
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const result = await response.json();
      alert(`Report would be downloaded: ${result.message}`);
    } catch (err) {
      console.error('Error downloading report:', err);
      alert('Error generating report');
    } finally {
      setGenerating(false);
    }
  };

  const downloadExcelReport = async () => {
    setIsDownloadingExcel(true);
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      window.open(`${backendUrl}/api/qoe/projects/${projectId}/excel-export`, '_blank');
    } catch (error) {
      console.error('Error downloading Excel report:', error);
    }
    setIsDownloadingExcel(false);
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
        <p className="text-white text-xl">Generating your QOE analysis...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-8"
    >
      {/* Analysis Results */}
      <div className="glass-effect rounded-2xl p-8 lg:p-12">
        <h2 className="text-3xl font-bold text-white mb-6">QOE Analysis Complete</h2>
        
        {analysis && (
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-800/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Add-back Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Total Add-backs:</span>
                  <span className="text-green-400 font-semibold">${analysis.addback_summary?.total_addbacks?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Number of Add-backs:</span>
                  <span className="text-white">{analysis.addback_summary?.addback_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Normalized EBITDA:</span>
                  <span className="text-blue-400 font-semibold">${analysis.normalized_ebitda?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Red Flags</h3>
              {analysis.red_flags?.length > 0 ? (
                <ul className="space-y-2">
                  {analysis.red_flags.map((flag, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertCircle className="text-yellow-400 mt-1 flex-shrink-0" size={16} />
                      <div>
                        <div className="text-yellow-400 font-medium">{flag.category}</div>
                        <div className="text-gray-300 text-sm">{flag.description}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-green-400">No significant red flags identified</p>
              )}
            </div>
          </div>
        )}

        <div className="bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Recommendations</h3>
          {analysis?.recommendations?.length > 0 && (
            <ul className="space-y-2">
              {analysis.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="text-green-400 mt-1 flex-shrink-0" size={16} />
                  <span className="text-gray-300">{recommendation}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Report Downloads */}
      <div className="glass-effect rounded-2xl p-8 lg:p-12">
        <h2 className="text-3xl font-bold text-white mb-6">Download Reports</h2>
        <p className="text-gray-300 mb-8">
          Your QOE package is ready! Download the reports you need for buyer presentations.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-gray-600 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="text-blue-400" size={24} />
              <h3 className="text-xl font-semibold text-white">Executive Summary</h3>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              Professional PDF summary highlighting key financial metrics and normalized EBITDA.
            </p>
            <button
              onClick={() => downloadReport('executive_summary')}
              disabled={generating}
              className="btn-primary w-full py-3 rounded-lg inline-flex items-center justify-center gap-2"
            >
              <Download size={18} /> Download PDF Report
            </button>
          </div>

          <div className="border border-gray-600 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="text-green-400" size={24} />
              <h3 className="text-xl font-semibold text-white">Excel Analysis</h3>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              Detailed Excel workbook with financial analysis, add-backs, and supporting calculations.
            </p>
            <button
              onClick={() => downloadReport('excel_analysis')}
              disabled={generating}
              className="btn-primary w-full py-3 rounded-lg inline-flex items-center justify-center gap-2"
            >
              <Download size={18} /> Download Excel Analysis
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/qoe"
            className="btn-secondary px-8 py-4 rounded-full text-white font-semibold text-lg inline-flex items-center gap-3"
          >
            Start New QOE Package
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default QOEBasic;