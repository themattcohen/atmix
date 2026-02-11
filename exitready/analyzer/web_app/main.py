"""
FastAPI Web Application for Accounting Analyzer
Main application entry point
"""
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn

# Add parent directory to path to import accounting analyzer modules
sys.path.append(str(Path(__file__).parent.parent))

# Import API routes
from web_app.api.routes import upload, mapping, financials, analysis

# Import utilities
from web_app.utils.shared_instances import session_manager

# Initialize FastAPI app
app = FastAPI(
    title="Accounting Analyzer",
    description="Web interface for comprehensive accounting analysis",
    version="1.0.0"
)

# Mount static files
app.mount("/static", StaticFiles(directory=str(Path(__file__).parent / "static")), name="static")

# Setup templates
templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))

# Include API routers
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(mapping.router, prefix="/api/mapping", tags=["mapping"])
app.include_router(financials.router, prefix="/api/financials", tags=["financials"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])

# Page routes
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Home page - file upload interface"""
    return templates.TemplateResponse("upload.html", {"request": request})

@app.get("/column-mapping/{session_id}", response_class=HTMLResponse)
async def column_mapping_page(request: Request, session_id: str):
    """Column mapping page"""
    # Verify session exists
    session = session_manager.get_session(session_id)
    if not session:
        return RedirectResponse(url="/")
    
    return templates.TemplateResponse("column_mapping.html", {
        "request": request,
        "session_id": session_id
    })

@app.get("/mapping/{session_id}", response_class=HTMLResponse)
async def mapping_page(request: Request, session_id: str):
    """Chart of Accounts mapping page"""
    # Verify session exists
    session = session_manager.get_session(session_id)
    if not session:
        return RedirectResponse(url="/")
    
    return templates.TemplateResponse("mapping.html", {
        "request": request,
        "session_id": session_id
    })

@app.get("/dashboard/{session_id}", response_class=HTMLResponse)
async def dashboard_page(request: Request, session_id: str):
    """Financial statements dashboard page"""
    # Verify session exists
    session = session_manager.get_session(session_id)
    if not session:
        return RedirectResponse(url="/")
    
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "session_id": session_id
    })

@app.get("/analysis/{session_id}", response_class=HTMLResponse)
async def analysis_page(request: Request, session_id: str):
    """Comprehensive analysis page"""
    # Verify session exists
    session = session_manager.get_session(session_id)
    if not session:
        return RedirectResponse(url="/")
    
    return templates.TemplateResponse("analysis.html", {
        "request": request,
        "session_id": session_id
    })

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

# Debug endpoint
@app.get("/debug/sessions")
async def debug_sessions():
    """Debug endpoint to check active sessions"""
    return {
        "active_sessions": list(session_manager.sessions.keys()),
        "session_count": len(session_manager.sessions)
    }

@app.get("/debug/create-test-session")
async def create_test_session():
    """Create a test session with sample GL data"""
    import pandas as pd
    
    # Create sample GL data spanning multiple months
    test_data = {
        'transaction_date': [
            '2024-01-01', '2024-01-01', '2024-01-15', '2024-01-31',  # January
            '2024-02-01', '2024-02-15', '2024-02-28',               # February  
            '2024-03-01', '2024-03-15', '2024-03-31'                # March
        ],
        'account_name': [
            'Service Revenue', 'Accounts Receivable', 'Cash', 'Office Supplies',
            'Service Revenue', 'Cash', 'Rent Expense', 
            'Service Revenue', 'Professional Fees', 'Cash'
        ],
        'description': [
            'Invoice 001', 'Invoice 001', 'Payment received', 'Office supplies',
            'Invoice 002', 'Payment 002', 'Monthly rent',
            'Invoice 003', 'Consulting', 'Payment 003'
        ],
        'debit_amount': [0, 5000, 3000, 150, 0, 2000, 2000, 0, 0, 4000],
        'credit_amount': [5000, 0, 0, 0, 3000, 0, 0, 3500, 1500, 0],
        'account_number': ['4100', '1200', '1000', '6100', '4100', '1000', '7100', '4100', '4200', '1000']
    }
    
    df = pd.DataFrame(test_data)
    df['transaction_date'] = pd.to_datetime(df['transaction_date'])
    df['net_amount'] = df['debit_amount'] - df['credit_amount']
    df['transaction_id'] = df.index.astype(str)
    
    # Add standard COA mapping with proper account structure
    standard_mapping = {
        '4100': {'standard_account': '4100', 'standard_name': 'Service Revenue'},
        '4200': {'standard_account': '4200', 'standard_name': 'Professional Fees'},
        '1200': {'standard_account': '1200', 'standard_name': 'Accounts Receivable - Trade'},
        '1000': {'standard_account': '1000', 'standard_name': 'Cash - Operating Account'},
        '6100': {'standard_account': '6100', 'standard_name': 'Office Supplies'},
        '7100': {'standard_account': '7100', 'standard_name': 'Rent Expense'}
    }
    
    df['standard_account'] = df['account_number'].map(lambda x: standard_mapping.get(x, {}).get('standard_account', x))
    df['standard_name'] = df['account_number'].map(lambda x: standard_mapping.get(x, {}).get('standard_name', ''))
    
    # Create session
    session_id = session_manager.create_session()
    session_manager.set_gl_data(session_id, df, "test_data.xlsx")
    
    return {
        "session_id": session_id,
        "message": "Test session created with sample data",
        "redirect_url": f"/dashboard/{session_id}"
    }




# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    # Ensure upload directory exists
    upload_dir = Path(__file__).parent / "static" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Clean old sessions on startup
    session_manager.cleanup_expired_sessions()

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    # Clean up any temporary files
    upload_dir = Path(__file__).parent / "static" / "uploads"
    if upload_dir.exists():
        for file in upload_dir.iterdir():
            if file.is_file():
                try:
                    file.unlink()
                except Exception:
                    pass

if __name__ == "__main__":
    # Run the application
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
