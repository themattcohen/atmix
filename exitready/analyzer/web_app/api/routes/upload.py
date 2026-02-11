"""
File upload API routes
Handles GL and AR file uploads with validation
"""
import os
import sys
from pathlib import Path
from typing import Optional
import pandas as pd
import aiofiles

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse

# Add parent directories to path
sys.path.append(str(Path(__file__).parent.parent.parent.parent))

from web_app.api.models.upload_models import FileUploadResponse, UploadStatusResponse, FileValidationResult, ValidationError
from web_app.utils.shared_instances import session_manager

# Import from parent directory with proper error handling
try:
    from data_processor import DataProcessor
except ImportError:
    # If running from web_app directory
    sys.path.append(str(Path(__file__).parent.parent.parent))
    from data_processor import DataProcessor

router = APIRouter()

# Required columns for GL and AR files
REQUIRED_GL_COLUMNS = ['Date', 'Amount']  # Minimum required
OPTIONAL_GL_COLUMNS = ['Account', 'Account Number', 'Description', 'Reference']

REQUIRED_AR_COLUMNS = ['Customer', 'Amount', 'Date']  # Minimum required  
OPTIONAL_AR_COLUMNS = ['Invoice', 'Due Date', 'Days Outstanding']


async def save_upload_file(upload_file: UploadFile, destination: Path) -> None:
    """Save uploaded file to destination"""
    async with aiofiles.open(destination, 'wb') as out_file:
        content = await upload_file.read()
        await out_file.write(content)


def validate_excel_file(file_path: Path, file_type: str) -> FileValidationResult:
    """Validate Excel file structure - basic validation only"""
    result = FileValidationResult(is_valid=True)
    
    try:
        # Read Excel file
        df = pd.read_excel(file_path)
        result.row_count = len(df)
        result.detected_columns = df.columns.tolist()
        
        # Check if file is empty
        if df.empty:
            result.is_valid = False
            result.errors.append(ValidationError(
                field="file",
                message="The uploaded file is empty"
            ))
            return result
        
        # Basic validation - just check we have some columns
        if len(df.columns) < 2:
            result.is_valid = False
            result.errors.append(ValidationError(
                field="file",
                message="File must contain at least 2 columns"
            ))
        
        # Note: Column mapping will be handled in the next step
        result.warnings.append("Column mapping required - proceed to next step")
                
    except Exception as e:
        result.is_valid = False
        result.errors.append(ValidationError(
            field="file",
            message=f"Error reading Excel file: {str(e)}"
        ))
    
    return result


@router.post("/gl", response_model=FileUploadResponse)
async def upload_gl_file(file: UploadFile = File(...)):
    """Upload and process GL file"""
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    # Create new session
    session_id = session_manager.create_session()
    
    # Save file temporarily
    upload_dir = Path("web_app/static/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{session_id}_gl_{file.filename}"
    
    try:
        # Save the uploaded file
        await save_upload_file(file, file_path)
        
        # Validate file structure
        validation_result = validate_excel_file(file_path, "GL")
        if not validation_result.is_valid:
            # Clean up file and session
            file_path.unlink()
            session_manager.delete_session(session_id)
            
            error_messages = [err.message for err in validation_result.errors]
            raise HTTPException(status_code=400, detail=f"File validation failed: {'; '.join(error_messages)}")
        
        # Read and process the file
        df = pd.read_excel(file_path)
        
        # Store in session
        session_manager.set_gl_data(session_id, df, file.filename)
        
        # Clean up temporary file
        file_path.unlink()
        
        return FileUploadResponse(
            success=True,
            session_id=session_id,
            filename=file.filename,
            message=f"GL file uploaded successfully. {len(validation_result.warnings)} warnings.",
            rows_processed=validation_result.row_count,
            columns_detected=validation_result.detected_columns
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up on error
        if file_path.exists():
            file_path.unlink()
        if session_id:
            session_manager.delete_session(session_id)
        
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.post("/ar", response_model=FileUploadResponse)
async def upload_ar_file(session_id: str, file: UploadFile = File(...)):
    """Upload and process AR file for existing session"""
    # Validate session exists
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
    
    # Save file temporarily
    upload_dir = Path("web_app/static/uploads")
    file_path = upload_dir / f"{session_id}_ar_{file.filename}"
    
    try:
        # Save the uploaded file
        await save_upload_file(file, file_path)
        
        # Validate file structure
        validation_result = validate_excel_file(file_path, "AR")
        if not validation_result.is_valid:
            # Clean up file
            file_path.unlink()
            
            error_messages = [err.message for err in validation_result.errors]
            raise HTTPException(status_code=400, detail=f"File validation failed: {'; '.join(error_messages)}")
        
        # Read and process the file
        df = pd.read_excel(file_path)
        
        # Store in session
        session_manager.set_ar_data(session_id, df, file.filename)
        
        # Clean up temporary file
        file_path.unlink()
        
        return FileUploadResponse(
            success=True,
            session_id=session_id,
            filename=file.filename,
            message=f"AR file uploaded successfully. {len(validation_result.warnings)} warnings.",
            rows_processed=validation_result.row_count,
            columns_detected=validation_result.detected_columns
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up on error
        if file_path.exists():
            file_path.unlink()
        
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.get("/status/{session_id}", response_model=UploadStatusResponse)
async def get_upload_status(session_id: str):
    """Get upload status for a session"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return UploadStatusResponse(
        session_id=session_id,
        gl_uploaded=session.gl_data is not None,
        ar_uploaded=session.ar_data is not None,
        gl_filename=session.gl_filename,
        ar_filename=session.ar_filename,
        gl_rows=len(session.gl_data) if session.gl_data is not None else None,
        ar_rows=len(session.ar_data) if session.ar_data is not None else None,
        ready_for_mapping=session.gl_data is not None,
        created_at=session.created_at,
        last_accessed=session.last_accessed
    )


@router.get("/debug/{session_id}")
async def debug_session_data(session_id: str):
    """Debug endpoint to see session data details"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    debug_info = {
        "session_id": session_id,
        "gl_data_exists": session.gl_data is not None,
        "ar_data_exists": session.ar_data is not None,
        "coa_mappings_exists": session.coa_mappings is not None,
        "coa_mappings_count": len(session.coa_mappings) if session.coa_mappings else 0
    }
    
    if session.gl_data is not None:
        debug_info["gl_data_shape"] = list(session.gl_data.shape)
        debug_info["gl_data_columns"] = list(session.gl_data.columns)
        debug_info["gl_data_dtypes"] = {col: str(dtype) for col, dtype in session.gl_data.dtypes.items()}
        
        # Check for standard_account column specifically
        if 'standard_account' in session.gl_data.columns:
            debug_info["standard_account_sample"] = session.gl_data['standard_account'].head(10).tolist()
            debug_info["standard_account_unique_count"] = session.gl_data['standard_account'].nunique()
            debug_info["standard_account_empty_count"] = (session.gl_data['standard_account'] == '').sum()
        
        # Check for account_name column
        if 'account_name' in session.gl_data.columns:
            debug_info["account_name_unique_count"] = session.gl_data['account_name'].nunique()
            debug_info["account_name_sample"] = session.gl_data['account_name'].head(10).tolist()
    
    if session.coa_mappings:
        debug_info["coa_mappings_sample"] = dict(list(session.coa_mappings.items())[:5])
    
    return debug_info


@router.get("/column-info/{session_id}")
async def get_column_info(session_id: str):
    """Get column information and preview data for mapping"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.gl_data is None:
        raise HTTPException(status_code=400, detail="No GL data uploaded for this session")
    
    df = session.gl_data
    
    # Get preview data (first 5 rows) and handle NaN values
    preview_df = df.head(5).fillna('')  # Replace NaN with empty strings
    preview_data = preview_df.to_dict('records')
    
    return {
        "filename": session.gl_filename or "Unknown",
        "row_count": len(df),
        "columns": df.columns.tolist(),
        "preview_data": preview_data
    }


@router.post("/apply-mapping/{session_id}")
async def apply_column_mapping(session_id: str, request: dict):
    """Apply column mapping to transform the data"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.gl_data is None:
        raise HTTPException(status_code=400, detail="No GL data uploaded for this session")
    
    try:
        df = session.gl_data.copy()
        mapping = request.get("column_mapping", {})
        amount_type = request.get("amount_type", "single")
        
        # Create standardized DataFrame with DataProcessor-expected columns
        standardized_df = pd.DataFrame()
        
        # Map date column to transaction_date (expected by DataProcessor)
        if "date_column" in mapping:
            standardized_df["transaction_date"] = pd.to_datetime(df[mapping["date_column"]], errors='coerce')
        
        # Map amount column(s) to debit_amount/credit_amount (expected by DataProcessor)
        if amount_type == "single" and "amount_column" in mapping:
            amounts = pd.to_numeric(df[mapping["amount_column"]], errors='coerce').fillna(0)
            # Convert single amount to debit/credit format
            standardized_df["debit_amount"] = amounts.apply(lambda x: x if x > 0 else 0)
            standardized_df["credit_amount"] = amounts.apply(lambda x: -x if x < 0 else 0)
            standardized_df["net_amount"] = amounts
        elif amount_type == "separate":
            debit_col = mapping.get("debit_column")
            credit_col = mapping.get("credit_column")
            
            if debit_col and credit_col:
                standardized_df["debit_amount"] = pd.to_numeric(df[debit_col], errors='coerce').fillna(0)
                standardized_df["credit_amount"] = pd.to_numeric(df[credit_col], errors='coerce').fillna(0)
                standardized_df["net_amount"] = standardized_df["debit_amount"] - standardized_df["credit_amount"]
        
        # Map account column to account_name (expected by DataProcessor)
        if "account_column" in mapping:
            standardized_df["account_name"] = df[mapping["account_column"]].astype(str)
        
        # Map optional columns
        if "description_column" in mapping:
            standardized_df["description"] = df[mapping["description_column"]].astype(str)
        else:
            standardized_df["description"] = ""
        
        if "reference_column" in mapping:
            standardized_df["reference"] = df[mapping["reference_column"]].astype(str)
        else:
            standardized_df["reference"] = ""
        
        # Add required columns expected by DataProcessor
        if "account_number" not in standardized_df.columns:
            # Generate account numbers based on account names
            unique_names = standardized_df["account_name"].unique() if "account_name" in standardized_df.columns else []
            name_to_num = {name: f"ACC{str(i+1).zfill(4)}" for i, name in enumerate(unique_names)}
            if "account_name" in standardized_df.columns:
                standardized_df["account_number"] = standardized_df["account_name"].map(name_to_num)
            else:
                standardized_df["account_number"] = ""
        
        if "transaction_id" not in standardized_df.columns:
            standardized_df["transaction_id"] = standardized_df.index.astype(str)
        
        # Store the standardized data back in session
        session_manager.update_session(session_id, gl_data=standardized_df)
        
        return {
            "success": True,
            "message": "Column mapping applied successfully",
            "rows_processed": len(standardized_df),
            "mapped_columns": list(mapping.keys()),
            "expected_columns_created": ["transaction_date", "account_name", "debit_amount", "credit_amount", "net_amount"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error applying column mapping: {str(e)}")
