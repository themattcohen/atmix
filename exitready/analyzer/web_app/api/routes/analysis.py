"""
Comprehensive analysis API routes
Handles all 5 phases of analysis
"""
import sys
from pathlib import Path
from typing import Dict, List, Optional
import pandas as pd
import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
import json
from json import JSONEncoder
import numpy as np

# Add parent directories to path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from web_app.utils.shared_instances import session_manager

# Import from parent directory with proper error handling
try:
    from data_processor import DataProcessor
    from red_flag_analyzer import RedFlagAnalyzer
except ImportError:
    # If running from web_app directory
    sys.path.append(str(Path(__file__).parent.parent.parent))
    from data_processor import DataProcessor
    from red_flag_analyzer import RedFlagAnalyzer

router = APIRouter()


class NumpyEncoder(JSONEncoder):
    """Custom JSON encoder that handles numpy types"""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, pd.Timestamp):
            return obj.strftime('%Y-%m-%d')
        elif isinstance(obj, pd.Period):
            return str(obj)
        elif hasattr(obj, 'item'):  # Handle numpy scalars
            return obj.item()
        return super(NumpyEncoder, self).default(obj)


def convert_numpy_types(obj):
    """Convert numpy types to native Python types for JSON serialization"""
    import numpy as np
    import pandas as pd
    
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, pd.Timestamp):
        return obj.strftime('%Y-%m-%d')
    elif isinstance(obj, pd.Period):
        return str(obj)
    elif hasattr(obj, 'item'):  # Handle numpy scalars
        return obj.item()
    elif isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_numpy_types(item) for item in obj)
    else:
        return obj


def generate_analysis_results(session_id: str) -> Dict:
    """Generate comprehensive analysis results"""
    session = session_manager.get_session(session_id)
    if not session or session.gl_data is None:
        raise HTTPException(status_code=400, detail="No data available for analysis")
    
    # Create basic AR data structure if none exists
    ar_data = session.ar_data if session.ar_data is not None else pd.DataFrame({
        'client_name': [],
        'month_end_date': [],
        'original_amount': [],
        'current_balance': [],
        'days_outstanding': []
    })
    
    # Generate monthly financials
    processor = DataProcessor()
    processor.gl_data = session.gl_data
    monthly_financials = processor.rebuild_monthly_financials(session.gl_data)
    
    try:
        # Run red flag analysis with error handling
        analyzer = RedFlagAnalyzer(session.gl_data, ar_data, monthly_financials)
        red_flags = analyzer.run_all_analyses()
    except Exception as e:
        print(f"Red flag analysis error: {str(e)}")
        # If red flag analysis fails, create some basic flags from the financial data
        red_flags = []
        
        if monthly_financials:
            latest_date = max(monthly_financials.keys())
            latest_financials = monthly_financials[latest_date]
            
            # Create basic analysis flags
            revenue = abs(latest_financials['p_and_l'].get('revenue', 0))
            net_income = latest_financials['p_and_l'].get('net_income', 0)
            
            if revenue > 0:
                net_margin = net_income / revenue
                if net_margin > 0.3:
                    red_flags.append({
                        'flag': 'High Profit Margin',
                        'severity': 'Medium',
                        'detail': f'Net profit margin of {net_margin:.1%} is unusually high',
                        'impact': 'May indicate revenue recognition or expense deferral issues',
                        'action': 'Review revenue recognition policies and expense accruals',
                        'amount': float(net_income),
                        'period': latest_date.strftime('%B %Y')
                    })
            
            # Check balance sheet balance
            if not latest_financials['balance_sheet'].get('is_balanced', True):
                balance_diff = latest_financials['balance_sheet'].get('balance_check', 0)
                red_flags.append({
                    'flag': 'Balance Sheet Imbalance',
                    'severity': 'High',
                    'detail': f'Balance sheet does not balance by ${abs(balance_diff):,.2f}',
                    'impact': 'Indicates data quality or accounting errors',
                    'action': 'Review all transactions and account mappings for accuracy',
                    'amount': float(abs(balance_diff)),
                    'period': latest_date.strftime('%B %Y')
                })
        
        # If no financial data, create a basic flag about data quality
        else:
            red_flags.append({
                'flag': 'Insufficient Financial Data',
                'severity': 'High',
                'detail': 'Unable to generate monthly financial statements from provided data',
                'impact': 'Cannot perform comprehensive financial analysis',
                'action': 'Verify data completeness and account mapping accuracy',
                'amount': 0.0,
                'period': 'N/A'
            })
    
    # Categorize flags by analysis phase
    phase_categories = {
        1: ['revenue', 'timing', 'recognition', 'volatility', 'margin'],
        2: ['client', 'concentration', 'dependency', 'churn'],
        3: ['receivable', 'collection', 'dso', 'aging', 'bad debt'],
        4: ['operational', 'utilization', 'compensation', 'seasonality', 'efficiency'],
        5: ['fraud', 'manipulation', 'unusual', 'bunching', 'writeoff']
    }
    
    # Group flags by phase
    phase_results = {1: [], 2: [], 3: [], 4: [], 5: []}
    for flag in red_flags:
        assigned = False
        for phase_id, keywords in phase_categories.items():
            if any(keyword in flag['flag'].lower() for keyword in keywords):
                phase_results[phase_id].append(flag)
                assigned = True
                break
        if not assigned:
            phase_results[4].append(flag)  # Default to operational analysis
    
    # Get summary statistics
    summary = {
        'total': len(red_flags),
        'high': len([f for f in red_flags if f['severity'] == 'High']),
        'medium': len([f for f in red_flags if f['severity'] == 'Medium']),
        'low': len([f for f in red_flags if f['severity'] == 'Low'])
    }
    
    priority_flags = red_flags[:10]  # Top 10 flags
    
    # Group flags by category
    revenue_flags = [f for f in red_flags if any(keyword in f['flag'].lower() for keyword in ['revenue', 'margin', 'profit'])]
    balance_flags = [f for f in red_flags if any(keyword in f['flag'].lower() for keyword in ['balance', 'imbalance'])]
    operational_flags = [f for f in red_flags if f not in revenue_flags and f not in balance_flags]
    
    flags_by_category = {
        'Revenue Quality': revenue_flags,
        'Balance Sheet Issues': balance_flags,
        'Operational Risk': operational_flags
    }
    
    return convert_numpy_types({
        'session_id': session_id,
        'summary': summary,
        'phase_results': phase_results,
        'all_flags': red_flags,
        'priority_flags': priority_flags,
        'flags_by_category': flags_by_category
    })


@router.get("/overview/{session_id}")
async def get_analysis_overview(session_id: str):
    """Get overview of all 5 analysis phases"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Generate real analysis results using the actual RedFlagAnalyzer
        results = generate_analysis_results(session_id)
        
        # Build phase overview from real results
        phase_names = {
            1: "Revenue Analysis", 
            2: "Client Risk Analysis", 
            3: "Collections Analysis", 
            4: "Operational Analysis", 
            5: "Fraud Analysis"
        }
        
        phases = []
        for phase_id in [1, 2, 3, 4, 5]:
            phase_flags = results['phase_results'][phase_id]
            high_count = len([f for f in phase_flags if f['severity'] == 'High'])
            medium_count = len([f for f in phase_flags if f['severity'] == 'Medium'])
            low_count = len([f for f in phase_flags if f['severity'] == 'Low'])
            
            phases.append({
                'id': phase_id,
                'name': phase_names[phase_id],
                'status': 'completed',
                'flag_count': len(phase_flags),
                'high_risk_count': high_count,
                'medium_risk_count': medium_count,
                'low_risk_count': low_count,
                'top_flag': phase_flags[0] if phase_flags else None
            })
        
        return {
            'session_id': session_id,
            'phases': phases,
            'summary': results['summary'],
            'priority_flags': results['priority_flags']
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating analysis: {str(e)}")


@router.get("/phase/{session_id}/{phase_id}")
async def get_phase_analysis(session_id: str, phase_id: int):
    """Get specific phase analysis details"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if phase_id not in [1, 2, 3, 4, 5]:
        raise HTTPException(status_code=400, detail="Invalid phase ID")
    
    try:
        results = generate_analysis_results(session_id)
        phase_flags = results['phase_results'][phase_id]
        
        # Add explanations for each phase
        phase_explanations = {
            1: {
                'title': 'Revenue Analysis',
                'description': 'Analyzes revenue quality, timing, recognition patterns, and sustainability indicators',
                'metrics': ['Revenue volatility', 'Month-end spikes', 'Growth trends', 'Margin analysis']
            },
            2: {
                'title': 'Client Risk Analysis',
                'description': 'Evaluates client concentration risk, dependency levels, and customer base stability',
                'metrics': ['Client concentration ratios', 'Customer dependency', 'Churn analysis', 'Revenue diversification']
            },
            3: {
                'title': 'Collections Analysis',
                'description': 'Reviews accounts receivable aging, collection efficiency, and bad debt indicators',
                'metrics': ['Days Sales Outstanding', 'AR aging trends', 'Collection rates', 'Bad debt provisions']
            },
            4: {
                'title': 'Operational Analysis',
                'description': 'Examines operational efficiency, utilization rates, and expense management',
                'metrics': ['Utilization rates', 'Compensation ratios', 'Seasonality patterns', 'Operational efficiency']
            },
            5: {
                'title': 'Fraud Analysis',
                'description': 'Detects potential fraud indicators, unusual patterns, and manipulation risks',
                'metrics': ['Expense timing', 'Unusual patterns', 'Write-off analysis', 'Manipulation indicators']
            }
        }
        
        return {
            'session_id': session_id,
            'phase_id': phase_id,
            'explanation': phase_explanations[phase_id],
            'flags': phase_flags,
            'flag_count': len(phase_flags),
            'high_risk_count': len([f for f in phase_flags if f['severity'] == 'High']),
            'medium_risk_count': len([f for f in phase_flags if f['severity'] == 'Medium']),
            'low_risk_count': len([f for f in phase_flags if f['severity'] == 'Low'])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating phase analysis: {str(e)}")


@router.get("/export/{session_id}")
async def export_analysis(session_id: str, format: str = "excel"):
    """Export analysis results to Excel or PDF"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        results = generate_analysis_results(session_id)
        
        if format.lower() == "excel":
            # Create Excel file in memory
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                # Summary sheet
                summary_data = []
                for phase_id, flags in results['phase_results'].items():
                    phase_names = {1: "Revenue Analysis", 2: "Client Risk Analysis", 3: "Collections Analysis", 4: "Operational Analysis", 5: "Fraud Analysis"}
                    summary_data.append({
                        'Phase': phase_names[phase_id],
                        'Total Flags': len(flags),
                        'High Risk': len([f for f in flags if f['severity'] == 'High']),
                        'Medium Risk': len([f for f in flags if f['severity'] == 'Medium']),
                        'Low Risk': len([f for f in flags if f['severity'] == 'Low'])
                    })
                
                summary_df = pd.DataFrame(summary_data)
                summary_df.to_excel(writer, sheet_name='Summary', index=False)
                
                # Detailed flags sheet
                flags_df = pd.DataFrame(results['all_flags'])
                if not flags_df.empty:
                    flags_df = flags_df[['flag', 'severity', 'detail', 'impact', 'action', 'amount', 'period']]
                    flags_df.to_excel(writer, sheet_name='All Flags', index=False)
                
                # Priority flags sheet
                priority_df = pd.DataFrame(results['priority_flags'])
                if not priority_df.empty:
                    priority_df = priority_df[['flag', 'severity', 'detail', 'impact', 'action', 'amount', 'period']]
                    priority_df.to_excel(writer, sheet_name='Priority Flags', index=False)
                
                # Format workbook
                workbook = writer.book
                
                # Create formats
                header_format = workbook.add_format({'bold': True, 'bg_color': '#4472C4', 'font_color': 'white'})
                high_format = workbook.add_format({'bg_color': '#ffcccc'})
                medium_format = workbook.add_format({'bg_color': '#fff4cc'})
                low_format = workbook.add_format({'bg_color': '#ccffcc'})
                
                # Format sheets
                for sheet_name in writer.sheets:
                    worksheet = writer.sheets[sheet_name]
                    
                    # Auto-adjust column widths
                    for column in worksheet.get_columns():
                        worksheet.set_column(column[0], column[0], 15)
            
            output.seek(0)
            
            filename = f"Analysis_Report_{session_id[:8]}.xlsx"
            headers = {'Content-Disposition': f'attachment; filename="{filename}"'}
            
            return StreamingResponse(
                io.BytesIO(output.read()),
                media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                headers=headers
            )
        
        else:
            raise HTTPException(status_code=400, detail="PDF export not yet implemented")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting analysis: {str(e)}")


@router.get("/search/{session_id}")
async def search_flags(session_id: str, query: str = "", severity: str = ""):
    """Search and filter red flags"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        results = generate_analysis_results(session_id)
        flags = results['all_flags']
        
        # Apply filters
        if query:
            flags = [f for f in flags if query.lower() in f['flag'].lower() or query.lower() in f['detail'].lower()]
        
        if severity:
            flags = [f for f in flags if f['severity'].lower() == severity.lower()]
        
        return {
            'session_id': session_id,
            'query': query,
            'severity_filter': severity,
            'results': flags,
            'total_results': len(flags)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching flags: {str(e)}")
