import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateValuationPDF = async (formData, valuation, reportType = 'simple') => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Helper function to add new page when needed
    const checkAndAddPage = (requiredSpace = 30) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Helper function to add section headers
    const addSectionHeader = (title, color = [59, 130, 246]) => {
      checkAndAddPage(25);
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 5, yPosition + 8);
      yPosition += 25;
      doc.setTextColor(0, 0, 0);
    };

    // Helper function to add body text with word wrapping
    const addBodyText = (text, fontSize = 10, fontStyle = 'normal') => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
      lines.forEach(line => {
        checkAndAddPage();
        doc.text(line, margin, yPosition);
        yPosition += fontSize * 0.5;
      });
      yPosition += 5;
    };

    // Page 1: Cover Page
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 60, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('Exit Ready', margin, 30);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Accounting Firm Valuation Report', margin, 45);

    yPosition = 80;
    doc.setTextColor(0, 0, 0);

    if (reportType === 'detailed') {
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Comprehensive Valuation Analysis', margin, yPosition);
      yPosition += 20;
      
      doc.setFontSize(18);
      doc.setFont('helvetica', 'normal');
      doc.text(`${formData.firmName || 'Your Accounting Firm'}`, margin, yPosition);
      yPosition += 40;
    } else {
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Quick Valuation Report', margin, yPosition);
      yPosition += 20;
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text(`${formData.firmName || 'Your Accounting Firm'}`, margin, yPosition);
      yPosition += 30;
    }

    // Date and prepared for
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Prepared for: ${formData.contactName || 'N/A'}`, margin, yPosition);
    yPosition += 10;
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 10;
    doc.text(`Contact: ${formData.email || 'N/A'}`, margin, yPosition);

    if (reportType === 'detailed') {
      yPosition += 40;
      
      // Executive summary box
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 60, 'F');
      doc.setDrawColor(59, 130, 246);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 60, 'S');
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Executive Summary', margin + 10, yPosition + 15);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const summaryText = `Based on our comprehensive analysis of ${formData.firmName || 'your firm'}, we estimate the current market value to be ${formatCurrency(valuation.finalRange.mid)}, with a range of ${formatCurrency(valuation.finalRange.low)} to ${formatCurrency(valuation.finalRange.high)}. This valuation reflects your firm's quality score of ${valuation.qualityScore}/100 and considers multiple valuation methodologies including revenue multiples, cash flow analysis, and asset-based approaches.`;
      
      const summaryLines = doc.splitTextToSize(summaryText, pageWidth - 4 * margin);
      let summaryY = yPosition + 30;
      summaryLines.forEach(line => {
        doc.text(line, margin + 10, summaryY);
        summaryY += 6;
      });

      // Start Page 2 for detailed report
      doc.addPage();
      yPosition = margin;

      // Table of Contents
      addSectionHeader('Table of Contents');
      
      const tocItems = [
        '1. Executive Summary ......................................................... 1',
        '2. Firm Overview ............................................................. 3',
        '3. Financial Analysis ........................................................ 4',
        '4. Valuation Methodologies .................................................. 5',
        '   4.1 Revenue Multiple Method .............................................. 6',
        '   4.2 Cash Flow Multiple Method ............................................ 7',
        '   4.3 Asset-Based Method ................................................... 8',
        '5. Quality Score Analysis ................................................... 9',
        '6. Industry Benchmarking ................................................... 10',
        '7. Risk Factor Assessment .................................................. 11',
        '8. Value Enhancement Recommendations ........................................ 12',
        '9. Market Positioning ...................................................... 13',
        '10. Exit Preparation Timeline .............................................. 14',
        '11. Next Steps ............................................................. 15'
      ];
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      tocItems.forEach(item => {
        doc.text(item, margin + 10, yPosition);
        yPosition += 8;
      });

      // Page 3: Firm Overview
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Firm Overview');
      
      addBodyText(`${formData.firmName || 'Your firm'} represents a ${formData.legalStructure || 'professional'} accounting practice established in ${formData.yearEstablished || 'N/A'}, serving clients in a ${formData.marketType || 'diverse'} market environment.`, 11, 'normal');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Firm Metrics:', margin, yPosition);
      yPosition += 15;
      
      const firmMetrics = [
        `Annual Gross Revenue: ${formatCurrency(formData.grossRevenue)}`,
        `Net Income: ${formatCurrency(formData.netIncome)}`,
        `Total Client Base: ${formData.totalClients || 'N/A'} clients`,
        `Recurring Clients: ${formData.recurringClients || 'N/A'} (${formData.recurringClients && formData.totalClients ? Math.round((formData.recurringClients / formData.totalClients) * 100) : 'N/A'}%)`,
        `Employee Count: ${formData.totalEmployees || 'N/A'} staff members`,
        `Technology Level: ${formData.technologyLevel || 'N/A'}/5 (${getTechnologyDescription(formData.technologyLevel)})`,
        `Client Retention Rate: ${formData.clientRetentionRate || 'N/A'}%`
      ];
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      firmMetrics.forEach(metric => {
        doc.text(`• ${metric}`, margin + 10, yPosition);
        yPosition += 8;
      });

      yPosition += 10;
      addBodyText('This comprehensive analysis evaluates your firm across multiple dimensions including financial performance, operational efficiency, market position, and strategic value drivers to provide an accurate market valuation.', 10);

      // Page 4: Financial Analysis
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Financial Analysis');
      
      addBodyText('A thorough financial analysis forms the foundation of any credible business valuation. Our analysis examines your firm\'s historical performance, profitability metrics, and financial health indicators.', 11);
      
      const profitMargin = formData.grossRevenue > 0 ? ((formData.netIncome / formData.grossRevenue) * 100).toFixed(1) : 'N/A';
      const revenuePerClient = formData.totalClients > 0 ? (formData.grossRevenue / formData.totalClients).toFixed(0) : 'N/A';
      const revenuePerEmployee = formData.totalEmployees > 0 ? (formData.grossRevenue / formData.totalEmployees).toFixed(0) : 'N/A';
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Financial Performance Metrics:', margin, yPosition);
      yPosition += 15;
      
      const financialMetrics = [
        `Profit Margin: ${profitMargin}% ${getProfitMarginBenchmark(profitMargin)}`,
        `Revenue per Client: ${formatCurrency(revenuePerClient)} ${getRevenuePerClientBenchmark(revenuePerClient)}`,
        `Revenue per Employee: ${formatCurrency(revenuePerEmployee)} ${getRevenuePerEmployeeBenchmark(revenuePerEmployee)}`,
        `Owner Compensation: ${formatCurrency(formData.ownerSalary)} (${formData.grossRevenue > 0 ? ((formData.ownerSalary / formData.grossRevenue) * 100).toFixed(1) : 'N/A'}% of revenue)`
      ];
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      financialMetrics.forEach(metric => {
        doc.text(`• ${metric}`, margin + 10, yPosition);
        yPosition += 8;
      });

      yPosition += 10;
      addBodyText('Industry benchmarks suggest that successful accounting firms typically maintain profit margins between 15-25%, with revenue per client ranging from $2,000-$8,000 depending on service mix and market positioning.', 10);

      // Page 5: Valuation Methodologies Overview
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Valuation Methodologies');
      
      addBodyText('Professional business valuation requires the application of multiple methodologies to arrive at a credible value range. We employ three primary approaches, each providing unique insights into your firm\'s value from different perspectives.', 11);
      
      yPosition += 5;
      
      const methodologies = [
        {
          title: '1. Revenue Multiple Method',
          description: 'This approach values your firm based on a multiple of annual gross revenue, adjusted for quality factors such as client retention, service mix, technology adoption, and market position. Revenue multiples for accounting firms typically range from 0.5x to 2.5x depending on these quality factors.'
        },
        {
          title: '2. Cash Flow Multiple Method (EBITDA)',
          description: 'This method focuses on your firm\'s earnings capacity by applying a multiple to Earnings Before Interest, Taxes, Depreciation, and Amortization (EBITDA). This approach is particularly relevant for profitable firms with strong cash flow generation. Multiples typically range from 2.5x to 6.0x depending on firm size and risk factors.'
        },
        {
          title: '3. Asset-Based Method',
          description: 'This approach combines the value of tangible assets (equipment, furniture, cash) with intangible assets (client relationships, brand value, intellectual property). For service businesses like accounting firms, intangible assets often represent the majority of total value.'
        }
      ];
      
      methodologies.forEach(method => {
        checkAndAddPage(30);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(method.title, margin, yPosition);
        yPosition += 12;
        
        addBodyText(method.description, 10);
        yPosition += 5;
      });

      // Page 6: Revenue Multiple Method Detail
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Revenue Multiple Method - Detailed Analysis');
      
      addBodyText('The revenue multiple method provides a market-based approach to valuation by comparing your firm to industry standards and applying quality adjustments.', 11);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Base Multiple Calculation:', margin, yPosition);
      yPosition += 15;
      
      const revenueAnalysis = [
        `Base Industry Multiple: 1.0x (starting point for accounting firms)`,
        `Quality Score Adjustment: +${((valuation.qualityScore / 100) * 1.5).toFixed(2)}x (based on ${valuation.qualityScore}/100 quality score)`,
        `Final Revenue Multiple: ${valuation.methods.revenue.multiple}x`,
        `Applied to Revenue: ${formatCurrency(formData.grossRevenue)}`,
        `Revenue Method Value: ${formatCurrency(valuation.methods.revenue.value)}`
      ];
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      revenueAnalysis.forEach(item => {
        doc.text(`• ${item}`, margin + 10, yPosition);
        yPosition += 8;
      });

      yPosition += 10;
      addBodyText('Quality factors that influenced your multiple include client retention rate, technology adoption level, service diversification, geographic market, and employee leverage. Firms with higher quality scores command premium multiples due to reduced buyer risk and stronger growth potential.', 10);

      // Page 7: Cash Flow Multiple Method Detail
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Cash Flow Multiple Method - Detailed Analysis');
      
      addBodyText('The cash flow multiple method focuses on your firm\'s ability to generate sustainable earnings for a new owner. This method is often considered the most reliable for profitable service businesses.', 11);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('EBITDA Calculation:', margin, yPosition);
      yPosition += 15;
      
      const ebitdaCalculation = [
        `Net Income: ${formatCurrency(formData.netIncome)}`,
        `Add: Owner Salary: ${formatCurrency(formData.ownerSalary)}`,
        `Add: Estimated Addbacks: ${formatCurrency(10000)} (depreciation, personal expenses)`,
        `Adjusted EBITDA: ${formatCurrency(valuation.methods.cashFlow.adjustedEBITDA)}`
      ];
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      ebitdaCalculation.forEach(item => {
        doc.text(`• ${item}`, margin + 10, yPosition);
        yPosition += 8;
      });

      yPosition += 10;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Multiple Determination:', margin, yPosition);
      yPosition += 15;
      
      const multipleFactors = [
        `Base Multiple (by firm size): ${getBaseSizeMultiple(formData.grossRevenue)}x`,
        `Quality Adjustments: +${((valuation.qualityScore / 100) * 1.5).toFixed(2)}x`,
        `Final EBITDA Multiple: ${valuation.methods.cashFlow.multiple}x`,
        `Cash Flow Method Value: ${formatCurrency(valuation.methods.cashFlow.value)}`
      ];
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      multipleFactors.forEach(item => {
        doc.text(`• ${item}`, margin + 10, yPosition);
        yPosition += 8;
      });

      yPosition += 10;
      addBodyText('EBITDA multiples vary significantly based on firm size, with larger firms commanding higher multiples due to increased stability and reduced owner dependency. Quality factors and risk mitigation strategies can further enhance multiples.', 10);

      // Page 8: Asset-Based Method Detail
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Asset-Based Method - Detailed Analysis');
      
      addBodyText('The asset-based approach provides a foundation value by considering both tangible and intangible assets. For accounting firms, client relationships represent the primary intangible asset.', 11);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Asset Valuation Components:', margin, yPosition);
      yPosition += 15;
      
      const assetComponents = [
        `Tangible Assets (estimated): ${formatCurrency(50000)}`,
        `Client Relationships: ${formatCurrency(valuation.methods.asset.value - 50000)}`,
        `Brand Value & Goodwill: Included in client relationships`,
        `Total Asset-Based Value: ${formatCurrency(valuation.methods.asset.value)}`
      ];
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      assetComponents.forEach(item => {
        doc.text(`• ${item}`, margin + 10, yPosition);
        yPosition += 8;
      });

      yPosition += 10;
      addBodyText('Client relationship value is typically calculated as a percentage of annual revenue (40-80%) based on client retention rates, contract terms, and relationship strength. Higher retention rates and longer client tenure support higher intangible asset values.', 10);

      // Page 9: Quality Score Analysis
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Quality Score Analysis');
      
      addBodyText(`Your firm achieved a quality score of ${valuation.qualityScore}/100, which directly impacts valuation multiples and buyer interest. This score is calculated across multiple dimensions:`, 11);
      
      yPosition += 5;
      
      const qualityFactors = [
        { factor: 'Client Retention Rate', weight: '20%', score: getQualityComponentScore(formData.clientRetentionRate, 80, 20), impact: 'High' },
        { factor: 'Technology Adoption', weight: '25%', score: getQualityComponentScore(formData.technologyLevel, 1, 25, 5), impact: 'High' },
        { factor: 'Service Diversification', weight: '20%', score: getServiceDiversificationScore(formData.services), impact: 'Medium' },
        { factor: 'Employee Leverage', weight: '15%', score: getEmployeeLeverageScore(formData.totalEmployees), impact: 'Medium' },
        { factor: 'Market Position', weight: '10%', score: getMarketPositionScore(formData.marketType), impact: 'Low' },
        { factor: 'Growth Indicators', weight: '10%', score: getGrowthScore(formData.grossRevenue, formData.priorYearRevenue), impact: 'Medium' }
      ];
      
      // Quality score table
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const tableHeaders = ['Quality Factor', 'Weight', 'Score', 'Impact'];
      let tableY = yPosition;
      
      // Table header
      tableHeaders.forEach((header, index) => {
        doc.text(header, margin + (index * 40), tableY);
      });
      tableY += 10;
      
      // Table data
      doc.setFont('helvetica', 'normal');
      qualityFactors.forEach(factor => {
        doc.text(factor.factor, margin, tableY);
        doc.text(factor.weight, margin + 40, tableY);
        doc.text(factor.score.toString(), margin + 80, tableY);
        doc.text(factor.impact, margin + 120, tableY);
        tableY += 8;
      });
      
      yPosition = tableY + 15;
      
      addBodyText('Quality score improvements directly translate to higher valuation multiples. A 10-point increase in quality score typically results in a 15-30% increase in firm value, making quality enhancement initiatives highly valuable.', 10);

      // Page 10: Industry Benchmarking
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Industry Benchmarking');
      
      addBodyText('Understanding how your firm compares to industry benchmarks provides important context for valuation and identifies areas for improvement.', 11);
      
      yPosition += 5;
      
      const benchmarks = [
        { metric: 'Revenue Multiple', yourFirm: `${valuation.methods.revenue.multiple}x`, industry: '0.8x - 1.8x', position: getBenchmarkPosition(parseFloat(valuation.methods.revenue.multiple), 0.8, 1.8) },
        { metric: 'EBITDA Multiple', yourFirm: `${valuation.methods.cashFlow.multiple}x`, industry: '2.5x - 4.5x', position: getBenchmarkPosition(parseFloat(valuation.methods.cashFlow.multiple), 2.5, 4.5) },
        { metric: 'Profit Margin', yourFirm: `${profitMargin}%`, industry: '15% - 25%', position: getBenchmarkPosition(parseFloat(profitMargin), 15, 25) },
        { metric: 'Client Retention', yourFirm: `${formData.clientRetentionRate || 'N/A'}%`, industry: '85% - 95%', position: getBenchmarkPosition(formData.clientRetentionRate, 85, 95) }
      ];
      
      // Benchmark table
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const benchmarkHeaders = ['Metric', 'Your Firm', 'Industry Range', 'Position'];
      let benchmarkY = yPosition;
      
      benchmarkHeaders.forEach((header, index) => {
        doc.text(header, margin + (index * 40), benchmarkY);
      });
      benchmarkY += 10;
      
      doc.setFont('helvetica', 'normal');
      benchmarks.forEach(benchmark => {
        doc.text(benchmark.metric, margin, benchmarkY);
        doc.text(benchmark.yourFirm, margin + 40, benchmarkY);
        doc.text(benchmark.industry, margin + 80, benchmarkY);
        doc.text(benchmark.position, margin + 120, benchmarkY);
        benchmarkY += 8;
      });
      
      yPosition = benchmarkY + 15;
      
      addBodyText('Industry data shows that firms in the top quartile for quality metrics typically sell for 40-60% higher multiples than average firms. Focus on areas where your firm scores below industry benchmarks for maximum value enhancement.', 10);

      // Page 11: Risk Factor Assessment
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Risk Factor Assessment');
      
      addBodyText('Buyers evaluate risk factors that could impact future performance. Understanding and mitigating these risks can significantly improve your firm\'s marketability and value.', 11);
      
      const riskFactors = identifyRiskFactors(formData, valuation);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Identified Risk Factors:', margin, yPosition);
      yPosition += 15;
      
      riskFactors.forEach((risk, index) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${risk.title}`, margin, yPosition);
        yPosition += 8;
        
        doc.setFont('helvetica', 'normal');
        addBodyText(risk.description, 9);
        addBodyText(`Mitigation Strategy: ${risk.mitigation}`, 9, 'italic');
        yPosition += 5;
      });

      // Page 12: Value Enhancement Recommendations
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Value Enhancement Recommendations');
      
      addBodyText('Based on our analysis, the following recommendations could increase your firm\'s value by 20-40% over 12-24 months:', 11);
      
      yPosition += 5;
      
      valuation.recommendations.forEach((recommendation, index) => {
        checkAndAddPage(20);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${recommendation}`, margin, yPosition);
        yPosition += 12;
        
        // Add detailed explanation for each recommendation
        const explanations = getRecommendationExplanations(formData, valuation);
        if (explanations[index]) {
          addBodyText(explanations[index], 10);
        }
        yPosition += 5;
      });

      // Page 13: Market Positioning
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Market Positioning Strategy');
      
      addBodyText('Positioning your firm optimally in the market is crucial for attracting premium buyers and achieving maximum value.', 11);
      
      const positioningStrategies = [
        {
          title: 'Service Specialization',
          content: 'Focus on high-value services like advisory, business valuations, and strategic consulting. These services command higher multiples and create stronger client relationships.'
        },
        {
          title: 'Technology Leadership',
          content: 'Invest in cutting-edge accounting technology and automation. Tech-forward firms are valued 20-30% higher due to operational efficiency and scalability.'
        },
        {
          title: 'Niche Market Dominance',
          content: 'Develop expertise in specific industries or client types. Specialized firms often achieve premium valuations due to their unique market position.'
        },
        {
          title: 'Scalable Operations',
          content: 'Build systems and processes that can operate without constant owner involvement. Scalable firms are more attractive to strategic buyers.'
        }
      ];
      
      positioningStrategies.forEach(strategy => {
        checkAndAddPage(25);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(strategy.title, margin, yPosition);
        yPosition += 10;
        
        addBodyText(strategy.content, 10);
        yPosition += 5;
      });

      // Page 14: Exit Preparation Timeline
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Exit Preparation Timeline');
      
      addBodyText('A successful exit requires 18-36 months of preparation. Here\'s a recommended timeline for optimizing your firm\'s value and marketability:', 11);
      
      const timeline = [
        {
          period: 'Months 1-6: Foundation Building',
          tasks: [
            'Complete financial audit and cleanup',
            'Implement robust accounting systems',
            'Document all key processes and procedures',
            'Begin management team development'
          ]
        },
        {
          period: 'Months 7-12: Value Enhancement',
          tasks: [
            'Execute technology upgrades',
            'Diversify service offerings',
            'Strengthen client relationships and contracts',
            'Implement quality control systems'
          ]
        },
        {
          period: 'Months 13-18: Market Preparation',
          tasks: [
            'Develop management succession plan',
            'Create comprehensive due diligence package',
            'Optimize financial performance metrics',
            'Build strategic buyer relationships'
          ]
        },
        {
          period: 'Months 19-24: Exit Execution',
          tasks: [
            'Engage professional advisors (broker, attorney, accountant)',
            'Prepare marketing materials and presentations',
            'Begin confidential marketing process',
            'Negotiate and close transaction'
          ]
        }
      ];
      
      timeline.forEach(phase => {
        checkAndAddPage(30);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(phase.period, margin, yPosition);
        yPosition += 12;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        phase.tasks.forEach(task => {
          doc.text(`• ${task}`, margin + 10, yPosition);
          yPosition += 7;
        });
        yPosition += 8;
      });

      // Page 15: Next Steps and Contact Information
      doc.addPage();
      yPosition = margin;
      
      addSectionHeader('Next Steps');
      
      addBodyText('This comprehensive analysis provides the foundation for your exit planning journey. The next steps depend on your timeline and objectives:', 11);
      
      yPosition += 5;
      
      const nextSteps = [
        'Review and prioritize value enhancement recommendations',
        'Develop a 12-24 month action plan for implementation',
        'Consider engaging professional advisors for specialized areas',
        'Schedule quarterly progress reviews to track improvements',
        'Begin building relationships with potential strategic buyers'
      ];
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      nextSteps.forEach((step, index) => {
        doc.text(`${index + 1}. ${step}`, margin + 10, yPosition);
        yPosition += 10;
      });
      
      yPosition += 20;
      
      // Contact section
      doc.setFillColor(59, 130, 246);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 60, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Ready to Get Exit Ready?', margin + 10, yPosition + 20);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Contact Matt Cohen for personalized exit planning guidance:', margin + 10, yPosition + 35);
      doc.text('Email: 1mattcohen@gmail.com', margin + 10, yPosition + 50);
      
      doc.setTextColor(0, 0, 0);
    }

    // Simple calculator content (improved formatting)
    if (reportType === 'simple') {
      yPosition = 80;

      // Executive Summary Box - Better formatted
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 70, 'F');
      doc.setDrawColor(59, 130, 246);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 70, 'S');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Quick Valuation Report', margin + 10, yPosition + 15);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const summaryText = `Based on your firm's annual revenue of ${formatCurrency(formData.grossRevenue)} and net income of ${formatCurrency(formData.netIncome)}, we estimate your firm's current market value at ${formatCurrency(valuation.mid)}. This quick assessment uses a ${valuation.multiple}x revenue multiple based on industry standards for accounting firms.`;
      
      const summaryLines = doc.splitTextToSize(summaryText, pageWidth - 4 * margin);
      let summaryY = yPosition + 30;
      summaryLines.forEach(line => {
        doc.text(line, margin + 10, summaryY);
        summaryY += 6;
      });

      yPosition += 90;

      // Firm Information Section
      addSectionHeader('Firm Information');
      
      const firmInfo = [
        ['Firm Name', formData.firmName || 'N/A'],
        ['Contact Person', formData.contactName || 'N/A'],
        ['Email', formData.email || 'N/A'],
        ['Years in Business', formData.yearsInBusiness || 'N/A'],
        ['Total Clients', formData.totalClients || 'N/A'],
        ['Phone', formData.phone || 'N/A']
      ];

      // Create a nice table layout
      const tableStartY = yPosition;
      const rowHeight = 8;
      const col1Width = 80;
      const col2Width = 100;

      firmInfo.forEach((row, index) => {
        const currentY = tableStartY + (index * rowHeight);
        
        // Alternate row backgrounds for better readability
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, currentY - 2, pageWidth - 2 * margin, rowHeight, 'F');
        }
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text(row[0] + ':', margin + 5, currentY + 4);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(row[1], margin + col1Width, currentY + 4);
      });

      yPosition = tableStartY + (firmInfo.length * rowHeight) + 20;

      // Financial Summary Section
      addSectionHeader('Financial Summary');
      
      const profitMargin = formData.grossRevenue > 0 ? ((formData.netIncome / formData.grossRevenue) * 100).toFixed(1) : 'N/A';
      const revenuePerClient = formData.totalClients > 0 ? (formData.grossRevenue / formData.totalClients).toFixed(0) : 'N/A';
      
      const financialInfo = [
        ['Annual Gross Revenue', formatCurrency(formData.grossRevenue)],
        ['Annual Net Income', formatCurrency(formData.netIncome)],
        ['Profit Margin', profitMargin + '%'],
        ['Revenue per Client', formatCurrency(revenuePerClient)]
      ];

      const finTableStartY = yPosition;
      
      financialInfo.forEach((row, index) => {
        const currentY = finTableStartY + (index * rowHeight);
        
        if (index % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, currentY - 2, pageWidth - 2 * margin, rowHeight, 'F');
        }
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text(row[0] + ':', margin + 5, currentY + 4);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(row[1], margin + col1Width, currentY + 4);
      });

      yPosition = finTableStartY + (financialInfo.length * rowHeight) + 20;

      // Valuation Results - Prominent display
      addSectionHeader('Valuation Results');

      // Main valuation display with better styling
      doc.setFillColor(59, 130, 246);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Estimated Firm Value', margin + 10, yPosition + 18);
      
      doc.setFontSize(24);
      doc.text(formatCurrency(valuation.mid), margin + 10, yPosition + 35);
      
      // Revenue multiple on right side
      const rightSideX = pageWidth - margin - 100;
      doc.setFontSize(14);
      doc.text('Revenue Multiple', rightSideX, yPosition + 18);
      doc.setFontSize(20);
      doc.setTextColor(187, 247, 208); // Light green
      doc.text(`${valuation.multiple}x`, rightSideX, yPosition + 35);

      yPosition += 60;
      doc.setTextColor(0, 0, 0);

      // Valuation Range
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 25, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 25, 'S');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Valuation Range:', margin + 10, yPosition + 12);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`${formatCurrency(valuation.low)} - ${formatCurrency(valuation.high)}`, margin + 10, yPosition + 20);

      yPosition += 35;

      // Methodology Section - Improved
      addSectionHeader('Valuation Methodology');
      
      addBodyText('This quick valuation uses the Revenue Multiple Method, the most common approach for valuing accounting firms. Here\'s how we calculated your firm\'s value:', 11);
      
      yPosition += 5;
      
      const methodologySteps = [
        `1. Base Revenue Multiple: Industry standard of 1.0x for accounting firms`,
        `2. Quality Adjustments: Based on profit margin (${profitMargin}%) and client metrics`,
        `3. Final Multiple: ${valuation.multiple}x applied to your annual revenue`,
        `4. Result: ${formatCurrency(formData.grossRevenue)} × ${valuation.multiple} = ${formatCurrency(valuation.mid)}`
      ];

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      methodologySteps.forEach(step => {
        doc.text(step, margin + 10, yPosition);
        yPosition += 8;
      });

      yPosition += 10;

      // Key Insights Section
      addSectionHeader('Key Insights & Next Steps');
      
      const multiple = parseFloat(valuation.multiple);
      const insights = [
        `• Your ${valuation.multiple}x revenue multiple ${multiple > 1.2 ? 'exceeds' : 'is within'} the typical range for accounting firms (0.8x - 1.8x)`,
        `• ${profitMargin !== 'N/A' && parseFloat(profitMargin) > 20 ? 'Strong' : 'Improving'} profit margins are ${profitMargin !== 'N/A' && parseFloat(profitMargin) > 20 ? 'positively' : 'negatively'} impacting your valuation`,
        `• Consider a detailed analysis to identify specific value enhancement opportunities`,
        `• Focus on client retention and service diversification to increase future multiples`,
        `• Proper financial documentation can improve buyer interest and final sale price`
      ];

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      insights.forEach(insight => {
        const lines = doc.splitTextToSize(insight, pageWidth - 2 * margin);
        lines.forEach(line => {
          checkAndAddPage();
          doc.text(line, margin, yPosition);
          yPosition += 7;
        });
        yPosition += 2;
      });

      yPosition += 15;

      // Call to Action Section - Improved styling
      doc.setFillColor(16, 185, 129);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, 50, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Ready for a Comprehensive Analysis?', margin + 10, yPosition + 18);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Get a detailed 15-page valuation report with personalized recommendations', margin + 10, yPosition + 32);
      doc.text('and exit planning strategies. Contact Matt Cohen at Exit Ready.', margin + 10, yPosition + 42);
    }

    // Add footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Generated by Exit Ready - Professional Accounting Firm Valuation', margin, doc.internal.pageSize.getHeight() - 15);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, doc.internal.pageSize.getHeight() - 15);
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, margin, doc.internal.pageSize.getHeight() - 10);
    }

    // Save the PDF
    const fileName = `${formData.firmName || 'AccountingFirm'}_Valuation_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    return { success: true, fileName };
  } catch (error) {
    console.error('PDF generation error:', error);
    return { success: false, error: error.message };
  }
};

// Helper functions for enhanced PDF content
const getTechnologyDescription = (level) => {
  const descriptions = {
    1: 'Paper-based',
    2: 'Basic desktop',
    3: 'Some cloud',
    4: 'Mostly cloud',
    5: 'Fully integrated'
  };
  return descriptions[level] || 'Not specified';
};

const getProfitMarginBenchmark = (margin) => {
  if (margin === 'N/A') return '';
  const m = parseFloat(margin);
  if (m > 25) return '(Excellent)';
  if (m > 20) return '(Above Average)';
  if (m > 15) return '(Average)';
  return '(Below Average)';
};

const getRevenuePerClientBenchmark = (rpc) => {
  if (rpc === 'N/A') return '';
  const r = parseFloat(rpc);
  if (r > 6000) return '(Excellent)';
  if (r > 4000) return '(Above Average)';
  if (r > 2000) return '(Average)';
  return '(Below Average)';
};

const getRevenuePerEmployeeBenchmark = (rpe) => {
  if (rpe === 'N/A') return '';
  const r = parseFloat(rpe);
  if (r > 200000) return '(Excellent)';
  if (r > 150000) return '(Above Average)';
  if (r > 100000) return '(Average)';
  return '(Below Average)';
};

const getBaseSizeMultiple = (revenue) => {
  if (revenue > 2000000) return '4.5';
  if (revenue > 500000) return '3.5';
  return '2.5';
};

const getQualityComponentScore = (value, baseline, maxPoints, scale = 1) => {
  if (!value) return 0;
  if (scale > 1) {
    return Math.min(((value - 1) / (scale - 1)) * maxPoints, maxPoints);
  }
  return Math.min(Math.max((value - baseline) * 0.5, 0), maxPoints);
};

const getServiceDiversificationScore = (services) => {
  if (!services || !services.length) return 0;
  return Math.min(services.length * 2.5, 20);
};

const getEmployeeLeverageScore = (employees) => {
  if (!employees) return 0;
  if (employees > 5) return 15;
  if (employees > 2) return 10;
  if (employees > 0) return 5;
  return 0;
};

const getMarketPositionScore = (marketType) => {
  const scores = { urban: 10, suburban: 7, rural: 3 };
  return scores[marketType] || 0;
};

const getGrowthScore = (currentRevenue, priorRevenue) => {
  if (!currentRevenue || !priorRevenue) return 5;
  const growthRate = ((currentRevenue - priorRevenue) / priorRevenue) * 100;
  return Math.min(Math.max(growthRate * 0.2, 0), 10);
};

const getBenchmarkPosition = (value, min, max) => {
  if (!value || value === 'N/A') return 'N/A';
  if (value > max) return 'Above Range';
  if (value < min) return 'Below Range';
  return 'Within Range';
};

const identifyRiskFactors = (formData, valuation) => {
  const risks = [];
  
  if (!formData.totalEmployees || formData.totalEmployees < 3) {
    risks.push({
      title: 'Owner Dependency Risk',
      description: 'Limited staff may indicate high owner dependency, which reduces firm value and limits buyer interest.',
      mitigation: 'Hire and train additional staff, develop management team, document processes to reduce owner involvement.'
    });
  }
  
  if (formData.clientRetentionRate < 85) {
    risks.push({
      title: 'Client Retention Risk',
      description: 'Below-average client retention suggests potential service quality or relationship management issues.',
      mitigation: 'Implement client feedback systems, improve service delivery, strengthen client relationships through regular communication.'
    });
  }
  
  if (formData.technologyLevel < 3) {
    risks.push({
      title: 'Technology Obsolescence Risk',
      description: 'Outdated technology systems may limit efficiency and competitiveness in the market.',
      mitigation: 'Invest in modern cloud-based accounting software, implement automation tools, train staff on new technologies.'
    });
  }
  
  return risks;
};

const getRecommendationExplanations = (formData, valuation) => {
  return [
    'Technology investments typically yield 3:1 ROI through efficiency gains and higher client fees. Cloud-based systems also make your firm more attractive to younger buyers.',
    'Adding advisory services can increase revenue per client by 40-60% while creating stickier client relationships that command premium valuations.',
    'Process documentation reduces training time, improves consistency, and demonstrates to buyers that the firm can operate without constant owner oversight.',
    'Client retention above 90% can increase valuation multiples by 0.2-0.4x due to predictable revenue streams and reduced business development costs.'
  ];
};

// Mock email sending function
export const sendValuationEmail = async (email, formData, valuation, reportType = 'simple') => {
  try {
    console.log('Sending email to:', email);
    console.log('Form data:', formData);
    console.log('Valuation:', valuation);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const pdfResult = await generateValuationPDF(formData, valuation, reportType);
    
    return { 
      success: true, 
      message: `Report generated and downloaded. In production, this would also be emailed to ${email}`,
      pdfGenerated: pdfResult.success
    };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

const formatCurrency = (value) => {
  if (!value) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};