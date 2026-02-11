import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Download, 
  FileText, 
  Eye,
  ChevronLeft,
  Calculator
} from 'lucide-react';
import { generateValuationPDF } from '../utils/pdfGenerator';

const PDFPreview = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  // Sample data for Simple Calculator PDF
  const sampleSimpleData = {
    firmName: "ABC Accounting Services LLC",
    yearsInBusiness: 12,
    grossRevenue: 850000,
    netIncome: 127500,
    totalClients: 180,
    contactName: "John Smith",
    email: "john@abcaccounting.com",
    phone: "(555) 123-4567"
  };

  const sampleSimpleValuation = {
    low: 680000,
    mid: 850000,
    high: 1020000,
    multiple: "1.0"
  };

  // Sample data for Detailed Calculator PDF
  const sampleDetailedData = {
    firmName: "Premier Tax & Advisory Group",
    yearEstablished: 2008,
    legalStructure: "LLC",
    marketType: "suburban",
    grossRevenue: 1250000,
    netIncome: 200000,
    ownerSalary: 150000,
    priorYearRevenue: 1100000,
    totalClients: 250,
    recurringClients: 220,
    totalEmployees: 8,
    technologyLevel: 4,
    clientRetentionRate: 92,
    services: ["Bookkeeping", "Tax Preparation", "Payroll", "Business Consulting", "Reviews"],
    contactName: "Sarah Johnson",
    email: "sarah@premiertax.com",
    phone: "(555) 987-6543"
  };

  const sampleDetailedValuation = {
    methods: {
      revenue: {
        value: 1562500,
        multiple: "1.25",
        confidence: "high"
      },
      cashFlow: {
        value: 1400000,
        adjustedEBITDA: 360000,
        multiple: "3.89",
        confidence: "high"
      },
      asset: {
        value: 800000,
        confidence: "medium"
      }
    },
    finalRange: {
      low: 1168000,
      mid: 1456000,
      high: 1747200
    },
    qualityScore: 78,
    recommendations: [
      "Continue investing in technology to maintain competitive advantage",
      "Consider expanding service offerings to increase revenue per client",
      "Document key processes to reduce owner dependency",
      "Maintain high client retention rate as a key value driver"
    ]
  };

  const generateSimplePDF = async () => {
    setIsGenerating(true);
    try {
      const result = await generateValuationPDF(sampleSimpleData, sampleSimpleValuation, 'simple');
      if (result.success) {
        console.log('Simple PDF generated successfully');
      } else {
        alert('Error generating PDF: ' + result.error);
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateDetailedPDF = async () => {
    setIsGenerating(true);
    try {
      const result = await generateValuationPDF(sampleDetailedData, sampleDetailedValuation, 'detailed');
      if (result.success) {
        console.log('Detailed PDF generated successfully');
      } else {
        alert('Error generating PDF: ' + result.error);
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Error generating PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-effect">
        <div className="container-max">
          <div className="flex items-center justify-between py-4 px-6">
            <Link to="/" className="text-2xl font-bold text-gradient">
              Exit Ready
            </Link>
            <Link 
              to="/"
              className="text-gray-300 hover:text-white transition-colors duration-300 inline-flex items-center gap-2"
            >
              <ChevronLeft size={18} /> Back to Home
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-32 pb-20 section-padding">
        <div className="container-max max-w-4xl mx-auto">
          
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              PDF Report <span className="text-gradient">Preview</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Generate sample PDF reports to see exactly what your users will receive
            </p>
          </motion.div>

          {/* PDF Preview Options */}
          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Simple Calculator PDF */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="glass-effect rounded-3xl p-8"
            >
              <div className="mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center mb-6">
                  <FileText size={32} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Simple Calculator PDF</h2>
                <p className="text-gray-300 text-lg leading-relaxed mb-6">
                  Preview the PDF report generated by the Quick Valuation calculator. 
                  This is a concise report perfect for initial lead capture.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <h3 className="font-semibold text-lg">Sample Data Used:</h3>
                <div className="bg-slate-800/50 rounded-xl p-4 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>Firm: {sampleSimpleData.firmName}</div>
                    <div>Years: {sampleSimpleData.yearsInBusiness}</div>
                    <div>Revenue: ${sampleSimpleData.grossRevenue.toLocaleString()}</div>
                    <div>Net Income: ${sampleSimpleData.netIncome.toLocaleString()}</div>
                    <div>Clients: {sampleSimpleData.totalClients}</div>
                    <div>Valuation: ${sampleSimpleValuation.mid.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <button 
                onClick={generateSimplePDF}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-300 inline-flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Download size={20} />
                {isGenerating ? 'Generating...' : 'Generate Simple PDF'}
              </button>
            </motion.div>

            {/* Detailed Calculator PDF */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="glass-effect rounded-3xl p-8"
            >
              <div className="mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
                  <Calculator size={32} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Detailed Calculator PDF</h2>
                <p className="text-gray-300 text-lg leading-relaxed mb-6">
                  Preview the comprehensive 15-page PDF report with detailed 
                  analysis, multiple valuation methods, and recommendations.
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <h3 className="font-semibold text-lg">Sample Data Used:</h3>
                <div className="bg-slate-800/50 rounded-xl p-4 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>Firm: {sampleDetailedData.firmName}</div>
                    <div>Est: {sampleDetailedData.yearEstablished}</div>
                    <div>Revenue: ${sampleDetailedData.grossRevenue.toLocaleString()}</div>
                    <div>Net Income: ${sampleDetailedData.netIncome.toLocaleString()}</div>
                    <div>Clients: {sampleDetailedData.totalClients}</div>
                    <div>Quality Score: {sampleDetailedValuation.qualityScore}/100</div>
                  </div>
                  <div className="mt-3 text-center font-semibold text-blue-400">
                    Valuation: ${sampleDetailedValuation.finalRange.mid.toLocaleString()}
                  </div>
                </div>
              </div>

              <button 
                onClick={generateDetailedPDF}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 inline-flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Download size={20} />
                {isGenerating ? 'Generating...' : 'Generate Detailed PDF'}
              </button>
            </motion.div>
          </div>

          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-12 glass-effect rounded-2xl p-8 text-center"
          >
            <h3 className="text-2xl font-bold mb-6 flex items-center justify-center gap-3">
              <Eye className="text-blue-400" size={28} />
              How to Preview PDFs
            </h3>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="space-y-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <h4 className="font-semibold">Click Generate</h4>
                <p className="text-gray-300 text-sm">Click either PDF generation button above to create a sample report</p>
              </div>
              <div className="space-y-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <h4 className="font-semibold">PDF Downloads</h4>
                <p className="text-gray-300 text-sm">The PDF will automatically download to your computer's Downloads folder</p>
              </div>
              <div className="space-y-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                <h4 className="font-semibold">Review Content</h4>
                <p className="text-gray-300 text-sm">Open the PDF to see exactly what your users will receive, including branding and layout</p>
              </div>
            </div>
          </motion.div>

          {/* Features List */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-8 glass-effect rounded-2xl p-8"
          >
            <h3 className="text-xl font-bold mb-6">PDF Report Features</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-400">Simple Calculator PDF Includes:</h4>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Exit Ready professional branding and header</li>
                  <li>• Firm information and contact details</li>
                  <li>• Financial summary (revenue, net income, clients)</li>
                  <li>• Estimated valuation range with multiple</li>
                  <li>• Basic methodology explanation</li>
                  <li>• Key insights and recommendations</li>
                  <li>• Professional footer with report date</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-purple-400">Detailed Calculator PDF Includes:</h4>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Everything from the simple report, plus:</li>
                  <li>• Comprehensive valuation methodology breakdown</li>
                  <li>• Revenue Multiple, Cash Flow, and Asset-based methods</li>
                  <li>• Quality score analysis (0-100 points)</li>
                  <li>• Detailed recommendations for value enhancement</li>
                  <li>• Multiple pages with professional formatting</li>
                  <li>• Industry benchmarking insights</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PDFPreview;