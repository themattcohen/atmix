"""
Pydantic models for file upload endpoints
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class FileUploadResponse(BaseModel):
    """Response model for file upload"""
    success: bool
    session_id: str
    filename: str
    message: str
    rows_processed: Optional[int] = None
    columns_detected: Optional[List[str]] = None


class UploadStatusResponse(BaseModel):
    """Response model for upload status check"""
    session_id: str
    gl_uploaded: bool
    ar_uploaded: bool
    gl_filename: Optional[str] = None
    ar_filename: Optional[str] = None
    gl_rows: Optional[int] = None
    ar_rows: Optional[int] = None
    ready_for_mapping: bool
    created_at: datetime
    last_accessed: datetime


class ValidationError(BaseModel):
    """Model for validation errors"""
    field: str
    message: str


class FileValidationResult(BaseModel):
    """Result of file validation"""
    is_valid: bool
    errors: List[ValidationError] = []
    warnings: List[str] = []
    detected_columns: List[str] = []
    row_count: int = 0
