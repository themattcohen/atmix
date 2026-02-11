# Accounting Red Flag Analyzer

A comprehensive Python-based tool for analyzing accounting data to identify potential red flags, fraud indicators, and business risks. This tool performs multi-phase analysis of financial data including revenue quality, client risk, cash flow patterns, operational metrics, and fraud detection.

## Features

### Core Analysis Phases
- **Phase 1: Revenue Quality Analysis** - Revenue timing, recognition quality, volatility patterns, period-end spikes
- **Phase 2: Client Risk Analysis** - Client concentration, churn analysis, payment patterns, volatility
- **Phase 3: Collection & Cash Flow Analysis** - AR aging, collection efficiency, DSO trends, cash flow quality
- **Phase 4: Operational Risk Analysis** - Expense timing, compensation analysis, utilization metrics, seasonality
- **Phase 5: Fraud & Compliance Analysis** - Round amounts, manual entries, unusual transactions, period-end adjustments

### Key Capabilities
- **Chart of Accounts (COA) Mapping** - Automatic mapping to standardized COA with user overrides
- **Multi-format Data Import** - Excel, CSV support for GL and AR data
- **Configurable Thresholds** - Customizable analysis parameters via YAML configuration
- **Comprehensive Reporting** - Detailed Excel reports with severity levels and actionable recommendations
- **Client Analysis** - Advanced churn detection, concentration risk assessment, payment behavior analysis
- **Fraud Detection** - Pattern recognition for potential fraudulent activities

## Recent Updates

### Client Analysis Mathematical Fix (June 2025)
Fixed critical issue in client analysis where major client thresholds (5%) were incorrectly calculated using all-time revenue instead of recent period revenue. Now properly uses last 3 months for:
- Client volatility analysis major client determination
- Payment pattern analysis major client flagging
- More accurate identification of current business dependencies

## Project Structure

```
accounting-analyzer/
├── data/
│   ├── ar_sample.xlsx          # Sample accounts receivable data
│   ├── gl_sample.xlsx          # Sample general ledger data
│   ├── standard_coa.csv        # Standard chart of accounts
│   └── coa_user_overrides.csv  # User-defined COA overrides
├── output/
│   └── comprehensive_red_flags.xlsx  # Generated analysis report
├── config/
│   ├── analysis_thresholds.yaml      # Configurable analysis parameters
│   └── mapping_settings.yaml         # COA mapping settings
├── core/
│   └── flag_details.py        # Red flag detail definitions
├── phase1_revenue_analysis.py  # Revenue quality analysis
├── phase2_client_analysis.py   # Client risk analysis (FIXED)
├── phase2_churn_analysis.py    # Advanced churn detection
├── phase3_collection_analysis.py # Collection and cash flow
├── phase4_operational_analysis.py # Operational risk metrics
├── phase5_fraud_analysis.py    # Fraud detection algorithms
├── master_red_flag_analyzer.py # Main analysis orchestrator
├── data_processor.py          # Data loading and processing
├── chart_mapper.py            # COA mapping logic
└── requirements.txt           # Project dependencies
```

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd accounting-analyzer
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Quick Start
Run the comprehensive analysis with sample data:
```bash
python master_red_flag_analyzer.py
```

### Data Requirements
Place your data files in the `data/` directory:
- **GL Data**: Excel file with columns: `date`, `account_number`, `account_name`, `description`, `debit`, `credit`, `amount`
- **AR Data**: Excel file with columns: `client_name`, `month_end_date`, `original_amount`, `current_balance`, `days_outstanding`

### Configuration
Customize analysis parameters in `config/analysis_thresholds.yaml`:
```yaml
phase1:
  revenue_concentration_warning: 0.30   # 30% revenue concentration threshold
  revenue_concentration_critical: 0.50

phase2:
  collection_days_warning: 50
  collection_days_critical: 75

churn:
  logo_churn_warn: 0.05   # 5% client churn warning
  logo_churn_crit: 0.10   # 10% client churn critical
```

### Sample Data Generation
Generate sample data for testing:
```bash
python create_sample_data.py
```

## Analysis Output

The tool generates a comprehensive Excel report (`output/comprehensive_red_flags.xlsx`) with:
- **Summary Dashboard** - High-level risk overview
- **Detailed Findings** - Specific red flags with severity levels
- **Recommendations** - Actionable steps for each identified risk
- **Supporting Data** - Underlying calculations and metrics

### Red Flag Severity Levels
- **Critical** - Immediate attention required, high business risk
- **High** - Significant concern, should be addressed promptly  
- **Medium** - Moderate risk, monitor and investigate
- **Low** - Minor concern, periodic review recommended

## Key Analysis Features

### Client Concentration Risk
- Single client dependency analysis (>15% revenue threshold)
- Top 3/5 client concentration monitoring
- Client base diversification assessment

### Churn Analysis
- Logo churn rate calculation and trending
- Revenue churn impact assessment
- Client retention pattern analysis
- Seasonal churn detection

### Revenue Quality
- Period-end revenue spike detection
- Revenue recognition timing analysis
- Service line concentration risks
- Month-end bunching patterns

### Cash Flow Analysis
- Days Sales Outstanding (DSO) trending
- Collection efficiency metrics
- AR aging deterioration detection
- Working capital trend analysis

### Fraud Detection
- Round dollar amount analysis
- Manual journal entry pattern detection
- Unusual transaction identification
- Period-end adjustment scrutiny

## Testing

Run the test suite:
```bash
python -m pytest tests/
```

Individual component testing:
```bash
python test_churn_analysis.py
python test_data_processor.py
python test_red_flag_analyzer.py
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-analysis`)
3. Commit your changes (`git commit -am 'Add new analysis feature'`)
4. Push to the branch (`git push origin feature/new-analysis`)
5. Create a Pull Request

## Dependencies

- pandas >= 1.3.0
- numpy >= 1.21.0
- openpyxl >= 3.0.7
- pyyaml >= 5.4.0
- xlsxwriter >= 1.4.0

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions, issues, or feature requests, please create an issue in the repository or contact the development team.
