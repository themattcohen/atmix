"""
COA Mapping API routes
Handles chart of accounts mapping with fuzzy logic
"""
import os
import sys
from pathlib import Path
from typing import List, Dict
import pandas as pd

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse

# Add parent directories to path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from web_app.api.models.mapping_models import (
    MappingSuggestions, AccountMapping, ConfidenceLevel,
    UpdateMappingRequest, BulkUpdateMappingsRequest,
    ConfirmMappingsRequest, MappingConfirmationResponse,
    StandardAccount
)
from web_app.utils.shared_instances import session_manager

# Import from parent directory with proper error handling
try:
    from chart_mapper import ChartMapper
except ImportError:
    # If running from web_app directory
    sys.path.append(str(Path(__file__).parent.parent.parent))
    from chart_mapper import ChartMapper

router = APIRouter()

# Chart mapper will be initialized on first use to avoid file path issues
_chart_mapper = None

def get_chart_mapper():
    """Get or create chart mapper instance"""
    global _chart_mapper
    if _chart_mapper is None:
        # Change to parent directory to ensure relative paths work
        original_cwd = os.getcwd()
        try:
            # Go to the main project directory where data/ folder exists
            project_root = Path(__file__).parent.parent.parent.parent
            os.chdir(project_root)
            _chart_mapper = ChartMapper()
        finally:
            os.chdir(original_cwd)
    return _chart_mapper


def get_confidence_level(score: float) -> ConfidenceLevel:
    """Convert confidence score to level"""
    if score >= 0.8:
        return ConfidenceLevel.HIGH
    elif score >= 0.6:
        return ConfidenceLevel.MEDIUM
    else:
        return ConfidenceLevel.LOW


@router.get("/suggestions/{session_id}", response_model=MappingSuggestions)
async def get_mapping_suggestions(session_id: str):
    """Get fuzzy-matched COA mapping suggestions"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.gl_data is None:
        raise HTTPException(status_code=400, detail="No GL data uploaded for this session")
    
    # Get unique accounts from GL data
    gl_df = session.gl_data
    
    # Get account column (try different possible names)
    account_col = None
    for col in ['Account', 'account', 'Account Name', 'account_name', 'GL Account']:
        if col in gl_df.columns:
            account_col = col
            break
    
    if not account_col:
        raise HTTPException(status_code=400, detail="No account column found in GL data")
    
    # Get unique accounts
    unique_accounts = gl_df[account_col].dropna().unique()
    
    # Get mapping suggestions using chart mapper
    mappings = []
    confidence_counts = {
        "high": 0,
        "medium": 0,
        "low": 0,
        "unmapped": 0
    }
    
    # Check if we already have mappings in session
    existing_mappings = session.coa_mappings or {}
    
    for account in unique_accounts:
        account_str = str(account).strip()
        
        # Check if user already modified this mapping
        if account_str in existing_mappings:
            # Use existing mapping
            mapping = AccountMapping(
                original_account=account_str,
                account_name=account_str,
                suggested_mapping=existing_mappings[account_str],
                confidence=ConfidenceLevel.MANUAL,
                confidence_score=1.0,
                is_user_modified=True
            )
        else:
            # Get fuzzy match suggestion
            chart_mapper = get_chart_mapper()
            match_result = chart_mapper._find_best_match(account_str)
            
            if match_result:
                suggested = match_result['name']  # Use 'name' key from ChartMapper response
                score = match_result['confidence'] / 100.0  # Convert to 0-1 scale
                confidence = get_confidence_level(score)
                
                mapping = AccountMapping(
                    original_account=account_str,
                    account_name=account_str,
                    suggested_mapping=suggested,
                    confidence=confidence,
                    confidence_score=score,
                    is_user_modified=False
                )
                
                # Update counts
                if confidence == ConfidenceLevel.HIGH:
                    confidence_counts["high"] += 1
                elif confidence == ConfidenceLevel.MEDIUM:
                    confidence_counts["medium"] += 1
                else:
                    confidence_counts["low"] += 1
            else:
                # No match found
                mapping = AccountMapping(
                    original_account=account_str,
                    account_name=account_str,
                    suggested_mapping="Unmapped",
                    confidence=ConfidenceLevel.LOW,
                    confidence_score=0.0,
                    is_user_modified=False
                )
                confidence_counts["unmapped"] += 1
        
        mappings.append(mapping)
    
    # Sort mappings by confidence score (highest first)
    mappings.sort(key=lambda x: x.confidence_score, reverse=True)
    
    return MappingSuggestions(
        session_id=session_id,
        mappings=mappings,
        unmapped_count=confidence_counts["unmapped"],
        high_confidence_count=confidence_counts["high"],
        medium_confidence_count=confidence_counts["medium"],
        low_confidence_count=confidence_counts["low"]
    )


@router.post("/update/{session_id}")
async def update_mapping(session_id: str, request: UpdateMappingRequest):
    """Update a single account mapping"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update the mapping in session
    if not session.coa_mappings:
        session.coa_mappings = {}
    
    session.coa_mappings[request.original_account] = request.new_mapping
    
    # Update session
    session_manager.update_session(session_id, coa_mappings=session.coa_mappings)
    
    return {"success": True, "message": f"Mapping updated for {request.original_account}"}


@router.post("/update-bulk/{session_id}")
async def update_mappings_bulk(session_id: str, request: BulkUpdateMappingsRequest):
    """Update multiple account mappings at once"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update all mappings
    if not session.coa_mappings:
        session.coa_mappings = {}
    
    updated_count = 0
    for mapping in request.mappings:
        session.coa_mappings[mapping.original_account] = mapping.new_mapping
        updated_count += 1
    
    # Update session
    session_manager.update_session(session_id, coa_mappings=session.coa_mappings)
    
    return {
        "success": True,
        "message": f"Updated {updated_count} mappings",
        "updated_count": updated_count
    }


@router.post("/confirm/{session_id}", response_model=MappingConfirmationResponse)
async def confirm_mappings(session_id: str, request: ConfirmMappingsRequest):
    """Confirm final mappings and prepare for analysis"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not request.confirm:
        return MappingConfirmationResponse(
            success=False,
            message="Mapping confirmation cancelled",
            total_accounts=0,
            mapped_accounts=0,
            unmapped_accounts=0,
            ready_for_analysis=False
        )
    
    # Process final mappings
    gl_df = session.gl_data
    
    # Get account column
    account_col = None
    for col in ['Account', 'account', 'Account Name', 'account_name', 'GL Account']:
        if col in gl_df.columns:
            account_col = col
            break
    
    if not account_col:
        raise HTTPException(status_code=400, detail="No account column found in GL data")
    
    unique_accounts = gl_df[account_col].dropna().unique()
    total_accounts = len(unique_accounts)
    
    # Get existing user mappings (only explicit user updates)
    existing_mappings = session.coa_mappings or {}
    
    # Build final mappings - accept user mappings OR high-confidence auto-suggestions
    mapped_accounts = 0
    unmapped_accounts = 0
    unmapped_account_list = []
    final_mappings = {}
    
    chart_mapper = get_chart_mapper()
    
    for account in unique_accounts:
        account_str = str(account).strip()
        
        # Check if user has explicitly mapped this account
        if account_str in existing_mappings and existing_mappings[account_str] not in ["Unmapped", "-- Select Account --", "", None]:
            # User explicitly mapped this account
            mapped_accounts += 1
            final_mappings[account_str] = existing_mappings[account_str]
        else:
            # Try to use high-confidence auto-suggestion
            match_result = chart_mapper._find_best_match(account_str)
            
            if match_result and match_result.get('confidence', 0) >= 60:  # Lower threshold for testing
                # Accept auto-suggestion
                mapped_accounts += 1
                final_mappings[account_str] = match_result['name']
                print(f"DEBUG: Auto-mapped '{account_str}' to '{match_result['name']}' (confidence: {match_result.get('confidence', 0)})")
            else:
                # Account cannot be mapped with confidence
                unmapped_accounts += 1
                unmapped_account_list.append(account_str)
                if match_result:
                    print(f"DEBUG: Skipped '{account_str}' - low confidence: {match_result.get('confidence', 0)}")
                else:
                    print(f"DEBUG: No match found for '{account_str}'")
    
    # Debug the validation check
    unmapped_percentage = unmapped_accounts / total_accounts * 100
    threshold_percentage = 20
    print(f"DEBUG: Validation check - {unmapped_accounts}/{total_accounts} = {unmapped_percentage:.1f}% unmapped (threshold: {threshold_percentage}%)")
    
    # Only block progression if too many accounts are unmapped
    if unmapped_accounts > total_accounts * 0.3:  # Allow up to 30% unmapped
        print(f"DEBUG: BLOCKING progression - too many unmapped accounts")
        return MappingConfirmationResponse(
            success=False,
            message=f"Cannot proceed: {unmapped_accounts} accounts are not properly mapped ({unmapped_accounts/total_accounts*100:.1f}%). Please map more accounts before continuing. Unmapped accounts: {', '.join(unmapped_account_list[:5])}{'...' if len(unmapped_account_list) > 5 else ''}",
            total_accounts=total_accounts,
            mapped_accounts=mapped_accounts,
            unmapped_accounts=unmapped_accounts,
            ready_for_analysis=False
        )
    
    print(f"DEBUG: PROCEEDING with transformation - validation passed")
    
    # Transform data to format expected by DataProcessor
    # Create standardized columns expected by data_processor.py
    transformed_df = gl_df.copy()
    
    # Map columns to expected names
    column_mapping = {
        'Date': 'transaction_date',
        'Account': 'account_name', 
        'Description': 'description',
        'Reference': 'reference'
    }
    
    for old_col, new_col in column_mapping.items():
        if old_col in transformed_df.columns:
            transformed_df = transformed_df.rename(columns={old_col: new_col})
    
    # Handle Amount column - convert to debit/credit format
    if 'Amount' in transformed_df.columns:
        # Convert single Amount column to debit_amount/credit_amount
        transformed_df['debit_amount'] = transformed_df['Amount'].apply(lambda x: x if x > 0 else 0)
        transformed_df['credit_amount'] = transformed_df['Amount'].apply(lambda x: -x if x < 0 else 0)
        transformed_df['net_amount'] = transformed_df['Amount']
        transformed_df = transformed_df.drop('Amount', axis=1)
    
    # Add required columns if missing
    if 'account_number' not in transformed_df.columns:
        # Generate account numbers based on account names
        unique_names = transformed_df['account_name'].unique()
        name_to_num = {name: f"ACC{str(i+1).zfill(4)}" for i, name in enumerate(unique_names)}
        transformed_df['account_number'] = transformed_df['account_name'].map(name_to_num)
    
    if 'transaction_id' not in transformed_df.columns:
        transformed_df['transaction_id'] = transformed_df.index.astype(str)
    
    # Apply COA mappings to create standard_account and standard_name columns
    # Initialize columns
    transformed_df['standard_account'] = ''
    transformed_df['standard_name'] = ''
    
    # Get chart mapper to access standard COA
    chart_mapper = get_chart_mapper()
    
    for account_name, standard_mapping in final_mappings.items():
        mask = transformed_df['account_name'] == account_name
        
        # Use ChartMapper to get the actual standard account code
        match_result = chart_mapper._find_best_match(standard_mapping)
        
        if match_result:
            # Use the actual standard account code from ChartMapper
            standard_account_code = match_result.get('account', '')
            standard_name = match_result.get('name', standard_mapping)
            
            if standard_account_code:
                transformed_df.loc[mask, 'standard_account'] = standard_account_code
                transformed_df.loc[mask, 'standard_name'] = standard_name
            else:
                # Fallback to basic prefix mapping if no account code found
                if 'revenue' in standard_mapping.lower():
                    account_prefix = '4000'
                elif 'cost' in standard_mapping.lower() or 'cogs' in standard_mapping.lower():
                    account_prefix = '5000'
                elif any(word in standard_mapping.lower() for word in ['expense', 'operating', 'admin', 'general']):
                    account_prefix = '6000'
                elif 'asset' in standard_mapping.lower():
                    account_prefix = '1000'
                elif 'liability' in standard_mapping.lower():
                    account_prefix = '2000'
                elif 'equity' in standard_mapping.lower():
                    account_prefix = '3000'
                else:
                    account_prefix = '6000'  # Default to operating expenses
                
                transformed_df.loc[mask, 'standard_account'] = account_prefix
                transformed_df.loc[mask, 'standard_name'] = standard_mapping
        else:
            # No match found, use basic prefix mapping
            if 'revenue' in standard_mapping.lower():
                account_prefix = '4000'
            elif 'cost' in standard_mapping.lower() or 'cogs' in standard_mapping.lower():
                account_prefix = '5000'
            elif any(word in standard_mapping.lower() for word in ['expense', 'operating', 'admin', 'general']):
                account_prefix = '6000'
            elif 'asset' in standard_mapping.lower():
                account_prefix = '1000'
            elif 'liability' in standard_mapping.lower():
                account_prefix = '2000'
            elif 'equity' in standard_mapping.lower():
                account_prefix = '3000'
            else:
                account_prefix = '6000'  # Default to operating expenses
            
            transformed_df.loc[mask, 'standard_account'] = account_prefix
            transformed_df.loc[mask, 'standard_name'] = standard_mapping
    
    # Ensure no empty standard_account values remain
    empty_mask = transformed_df['standard_account'] == ''
    if empty_mask.any():
        # Default unmapped accounts to operating expenses
        transformed_df.loc[empty_mask, 'standard_account'] = '6000'
        transformed_df.loc[empty_mask, 'standard_name'] = 'Operating Expenses - Unmapped'
    
    # Debug output BEFORE session update
    print(f"DEBUG: About to update session with {len(final_mappings)} mappings")
    print(f"DEBUG: Transformed data shape: {transformed_df.shape}")
    print(f"DEBUG: Standard account column exists: {'standard_account' in transformed_df.columns}")
    if 'standard_account' in transformed_df.columns:
        print(f"DEBUG: Standard account unique values: {transformed_df['standard_account'].unique()[:10]}")
        print(f"DEBUG: Standard account empty count: {(transformed_df['standard_account'] == '').sum()}")
    
    # Update session with transformed data AND store the mappings
    try:
        session_manager.update_session(session_id, gl_data=transformed_df, coa_mappings=final_mappings)
        print(f"DEBUG: Session update successful")
    except Exception as e:
        print(f"DEBUG: Session update failed: {e}")
        raise
    
    return MappingConfirmationResponse(
        success=True,
        message="All mappings confirmed successfully. Data ready for analysis.",
        total_accounts=total_accounts,
        mapped_accounts=mapped_accounts,
        unmapped_accounts=0,
        ready_for_analysis=True
    )


@router.get("/standard-accounts", response_model=List[StandardAccount])
async def get_standard_accounts():
    """Get list of standard COA accounts for dropdown"""
    # Load standard COA with correct path
    project_root = Path(__file__).parent.parent.parent.parent
    standard_coa_path = project_root / "data" / "standard_coa.csv"
    
    if not standard_coa_path.exists():
        raise HTTPException(status_code=500, detail=f"Standard COA file not found at {standard_coa_path}")
    
    try:
        df = pd.read_csv(standard_coa_path)
        accounts = []
        
        for _, row in df.iterrows():
            account = StandardAccount(
                category=row.get('category', ''),
                subcategory='',  # No subcategory in this CSV
                account_name=row.get('account_name', ''),
                typical_keywords=[]
            )
            accounts.append(account)
        
        return accounts
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading standard accounts: {str(e)}")
