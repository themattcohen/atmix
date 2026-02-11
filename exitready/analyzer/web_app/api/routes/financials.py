"""
Financial statements API routes
Handles P&L and Balance Sheet generation with add-backs
"""
import sys
from pathlib import Path
from typing import Dict, List, Optional
import pandas as pd
import io
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

# Add parent directories to path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from web_app.utils.shared_instances import session_manager

# Import from parent directory with proper error handling
try:
    from data_processor import DataProcessor
except ImportError:
    # If running from web_app directory
    sys.path.append(str(Path(__file__).parent.parent.parent))
    from data_processor import DataProcessor

router = APIRouter()


def format_financial_data(data: Dict) -> Dict:
    """Format financial data for frontend display"""
    import numpy as np
    formatted = {}
    
    for key, value in data.items():
        if isinstance(value, (int, float, np.integer, np.floating)):
            # Convert numpy types to Python native types
            float_value = float(value)
            formatted[key] = {
                'value': float_value,
                'formatted': f"${float_value:,.2f}" if float_value != 0 else "$0.00"
            }
        elif isinstance(value, (bool, np.bool_)):
            # Convert numpy bool to Python bool
            formatted[key] = bool(value)
        else:
            formatted[key] = value
    
    return formatted


def generate_pnl_data(gl_data: pd.DataFrame, adjusted: bool = False) -> Dict:
    """Generate P&L statement data"""
    processor = DataProcessor()
    processor.gl_data = gl_data
    
    # Generate monthly financials
    monthly_financials = processor.rebuild_monthly_financials(gl_data)
    
    if not monthly_financials:
        return {}
    
    # Get latest month's P&L
    latest_date = max(monthly_financials.keys())
    pnl_data = monthly_financials[latest_date]['p_and_l']
    
    # Format for display
    formatted_pnl = {
        'period': latest_date.strftime('%B %Y'),
        'revenue': pnl_data.get('revenue', 0),
        'cogs': pnl_data.get('cogs', 0),
        'gross_profit': pnl_data.get('gross_profit', 0),
        'operating_expenses': pnl_data.get('operating_expenses', 0),
        'other_income': pnl_data.get('other_income', 0),
        'other_expenses': pnl_data.get('other_expenses', 0),
        'net_income': pnl_data.get('net_income', 0),
    }
    
    return format_financial_data(formatted_pnl)


def generate_bs_data(gl_data: pd.DataFrame, adjusted: bool = False) -> Dict:
    """Generate Balance Sheet data"""
    processor = DataProcessor()
    processor.gl_data = gl_data
    
    # Generate monthly financials
    monthly_financials = processor.rebuild_monthly_financials(gl_data)
    
    if not monthly_financials:
        return {}
    
    # Get latest month's Balance Sheet
    latest_date = max(monthly_financials.keys())
    bs_data = monthly_financials[latest_date]['balance_sheet']
    
    # Format for display
    formatted_bs = {
        'period': latest_date.strftime('%B %Y'),
        'assets': bs_data.get('assets', 0),
        'liabilities': bs_data.get('liabilities', 0),
        'equity_base': bs_data.get('equity_base', 0),
        'retained_earnings': bs_data.get('retained_earnings', 0),
        'total_equity': bs_data.get('total_equity', 0),
        'total_assets': bs_data.get('total_assets', 0),
        'total_liabilities_and_equity': bs_data.get('total_liabilities_and_equity', 0),
        'is_balanced': bs_data.get('is_balanced', False),
        'balance_check': bs_data.get('balance_check', 0),
    }
    
    return format_financial_data(formatted_bs)


@router.get("/pl/{session_id}")
async def get_profit_loss(session_id: str, adjusted: bool = False):
    """Get P&L statement (original or adjusted)"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.gl_data is None:
        raise HTTPException(status_code=400, detail="No GL data available")
    
    try:
        pnl_data = generate_pnl_data(session.gl_data, adjusted)
        return {
            "session_id": session_id,
            "type": "profit_loss",
            "adjusted": adjusted,
            "data": pnl_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating P&L: {str(e)}")


@router.get("/bs/{session_id}")
async def get_balance_sheet(session_id: str, adjusted: bool = False):
    """Get Balance Sheet (original or adjusted)"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.gl_data is None:
        raise HTTPException(status_code=400, detail="No GL data available")
    
    try:
        bs_data = generate_bs_data(session.gl_data, adjusted)
        return {
            "session_id": session_id,
            "type": "balance_sheet",
            "adjusted": adjusted,
            "data": bs_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating Balance Sheet: {str(e)}")


@router.get("/transactions/{session_id}")
async def get_transactions_for_addbacks(session_id: str):
    """Get transactions that can be used for add-backs"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.gl_data is None:
        raise HTTPException(status_code=400, detail="No GL data available")
    
    try:
        gl_data = session.gl_data
        
        # Get expense transactions (debit amounts > 0)
        expense_transactions = gl_data[gl_data['debit_amount'] > 0].copy()
        
        # Categorize transactions based on account names and descriptions
        one_time_expenses = []
        owner_adjustments = []
        non_recurring_revenue = []
        
        for _, row in expense_transactions.iterrows():
            transaction = {
                'transaction_id': str(row.get('transaction_id', '')),
                'date': row['transaction_date'].strftime('%Y-%m-%d'),
                'account_name': row['account_name'],
                'description': row.get('description', ''),
                'amount': float(row['debit_amount']),
                'formatted_amount': f"${row['debit_amount']:,.2f}"
            }
            
            # Simple categorization based on keywords
            desc_lower = str(row.get('description', '')).lower()
            account_lower = str(row['account_name']).lower()
            
            if any(keyword in desc_lower for keyword in ['one-time', 'onetime', 'legal', 'consulting', 'setup']):
                one_time_expenses.append(transaction)
            elif any(keyword in desc_lower for keyword in ['owner', 'personal', 'draw', 'distribution']):
                owner_adjustments.append(transaction)
            else:
                one_time_expenses.append(transaction)  # Default to one-time
        
        # Get revenue transactions that might be non-recurring
        revenue_transactions = gl_data[gl_data['credit_amount'] > 0].copy()
        for _, row in revenue_transactions.iterrows():
            desc_lower = str(row.get('description', '')).lower()
            if any(keyword in desc_lower for keyword in ['grant', 'one-time', 'settlement', 'bonus']):
                transaction = {
                    'transaction_id': str(row.get('transaction_id', '')),
                    'date': row['transaction_date'].strftime('%Y-%m-%d'),
                    'account_name': row['account_name'],
                    'description': row.get('description', ''),
                    'amount': float(row['credit_amount']),
                    'formatted_amount': f"${row['credit_amount']:,.2f}"
                }
                non_recurring_revenue.append(transaction)
        
        return {
            "session_id": session_id,
            "one_time_expenses": one_time_expenses[:20],  # Limit to prevent overwhelming UI
            "owner_adjustments": owner_adjustments[:20],
            "non_recurring_revenue": non_recurring_revenue[:20]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting transactions: {str(e)}")


@router.post("/addbacks/{session_id}")
async def update_addbacks(session_id: str, addbacks: Dict[str, List[str]]):
    """Update add-backs selection for adjusted financials"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Update session with selected add-backs
        session.addbacks = addbacks
        return {"message": "Add-backs updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating add-backs: {str(e)}")


@router.get("/export/pl/{session_id}")
async def export_pl_excel(session_id: str, adjusted: bool = False):
    """Export P&L statement to Excel"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.gl_data is None:
        raise HTTPException(status_code=400, detail="No GL data available")
    
    try:
        processor = DataProcessor()
        processor.gl_data = session.gl_data
        
        # Generate P&L matrix
        pnl_matrix = processor.build_pnl_matrix()
        
        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            pnl_matrix.to_excel(writer, sheet_name='P&L Statement', index=False)
            
            # Format the worksheet
            workbook = writer.book
            worksheet = writer.sheets['P&L Statement']
            
            # Add formatting
            money_format = workbook.add_format({'num_format': '$#,##0.00'})
            header_format = workbook.add_format({'bold': True, 'bg_color': '#4472C4', 'font_color': 'white'})
            
            # Format headers
            for col_num, value in enumerate(pnl_matrix.columns.values):
                worksheet.write(0, col_num, value, header_format)
            
            # Format money columns
            for col_num in range(2, len(pnl_matrix.columns)):
                worksheet.set_column(col_num, col_num, 12, money_format)
        
        output.seek(0)
        
        filename = f"PL_Statement_{session_id[:8]}.xlsx"
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(
            io.BytesIO(output.read()),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers=headers
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting P&L: {str(e)}")


@router.get("/export/bs/{session_id}")
async def export_bs_excel(session_id: str, adjusted: bool = False):
    """Export Balance Sheet to Excel"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.gl_data is None:
        raise HTTPException(status_code=400, detail="No GL data available")
    
    try:
        processor = DataProcessor()
        processor.gl_data = session.gl_data
        
        # Generate Balance Sheet matrix
        bs_matrix = processor.build_bs_matrix()
        
        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            bs_matrix.to_excel(writer, sheet_name='Balance Sheet', index=False)
            
            # Format the worksheet
            workbook = writer.book
            worksheet = writer.sheets['Balance Sheet']
            
            # Add formatting
            money_format = workbook.add_format({'num_format': '$#,##0.00'})
            header_format = workbook.add_format({'bold': True, 'bg_color': '#28a745', 'font_color': 'white'})
            summary_format = workbook.add_format({'bold': True, 'bg_color': '#f8f9fa'})
            
            # Format headers
            for col_num, value in enumerate(bs_matrix.columns.values):
                worksheet.write(0, col_num, value, header_format)
            
            # Format money columns
            for col_num in range(3, len(bs_matrix.columns)):
                worksheet.set_column(col_num, col_num, 12, money_format)
        
        output.seek(0)
        
        filename = f"Balance_Sheet_{session_id[:8]}.xlsx"
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(
            io.BytesIO(output.read()),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers=headers
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting Balance Sheet: {str(e)}")
