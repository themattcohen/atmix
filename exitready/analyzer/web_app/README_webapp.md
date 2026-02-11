# Accounting Analyzer Web Application

A FastAPI-based web interface for the comprehensive accounting analysis system.

## Overview

This web application provides a user-friendly interface for:
- Uploading GL and AR Excel files
- Mapping chart of accounts with fuzzy logic suggestions
- Viewing financial statements (P&L and Balance Sheet)
- Performing comprehensive 5-phase analysis
- Exporting results

## Current Implementation Status

### ✅ Completed Components

1. **Core Infrastructure**
   - FastAPI application setup with routing
   - Session management system (in-memory)
   - Pydantic models for API validation
   - Bootstrap-based responsive UI
   - Custom CSS styling

2. **File Upload System**
   - GL file upload with validation
   - AR file upload (optional)
   - Excel format validation
   - Column requirements checking

3. **COA Mapping Interface**
   - Fuzzy logic integration for suggestions
   - Interactive mapping table with dropdowns
   - Confidence scoring display
   - Bulk update functionality

4. **Page Templates**
   - Base template with navigation
   - Upload page with drag-and-drop support
   - Mapping page with editable table
   - Dashboard placeholder
   - Analysis page placeholder

### 🚧 To Be Implemented

1. **Financial Dashboard**
   - P&L statement generation
   - Balance sheet display
   - Add-backs functionality
   - Original vs adjusted toggle

2. **Analysis Integration**
   - Connect all 5 phase analyzers
   - Display detailed results
   - Risk categorization
   - Export functionality

3. **Additional Features**
   - PDF export option
   - Data persistence
   - User authentication
   - Multi-company support

## Installation

1. Navigate to the web_app directory:
   ```bash
   cd web_app
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements_web.txt
   ```

## Running the Application

1. From the web_app directory, run:
   ```bash
   python main.py
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

3. The application will start with the file upload page.

## API Documentation

Once running, access the interactive API documentation at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Application Flow

1. **Upload Files**: Start by uploading your GL file (required) and optionally an AR file
2. **Map Accounts**: Review and edit the fuzzy-matched account mappings
3. **View Financials**: See P&L and Balance Sheet with add-back options
4. **Analyze**: Review comprehensive analysis across 5 phases
5. **Export**: Download results as Excel or PDF

## Project Structure

```
web_app/
├── main.py                 # FastAPI application entry
├── api/
│   ├── routes/            # API endpoint handlers
│   │   ├── upload.py      # File upload endpoints
│   │   ├── mapping.py     # COA mapping endpoints
│   │   ├── financials.py  # Financial statements
│   │   └── analysis.py    # Analysis endpoints
│   └── models/            # Pydantic models
├── static/                # Static assets
│   ├── css/              # Stylesheets
│   ├── js/               # JavaScript files
│   └── uploads/          # Temporary file storage
├── templates/             # Jinja2 HTML templates
├── utils/                 # Utility modules
│   └── session_manager.py # Session handling
└── requirements_web.txt   # Python dependencies
```

## Development Notes

### Adding New Features

1. **New API Endpoint**: Add route in `api/routes/`
2. **New Page**: Create template in `templates/`
3. **New Model**: Define in `api/models/`
4. **Styling**: Update `static/css/style.css`

### Session Management

Sessions are stored in memory with a 24-hour timeout. For production:
- Consider Redis for session storage
- Implement proper authentication
- Add database persistence

### Error Handling

The application includes:
- File validation with user-friendly errors
- API error responses with details
- Frontend toast notifications
- Loading states for async operations

## Testing

Run the application and test the workflow:

1. Upload the sample GL file from `data/gl_sample.xlsx`
2. Check the mapping suggestions accuracy
3. Verify navigation between pages
4. Test error handling with invalid files

## Next Steps

1. **Complete Financial Dashboard**
   - Integrate DataProcessor for statement generation
   - Implement add-backs selection UI
   - Add financial metrics calculations

2. **Full Analysis Integration**
   - Connect MasterRedFlagAnalyzer
   - Create analysis result models
   - Build detailed analysis cards

3. **Export Functionality**
   - Excel export using existing code
   - PDF generation with charts
   - Custom report templates

4. **Production Readiness**
   - Add authentication system
   - Implement proper logging
   - Add rate limiting
   - Deploy with proper WSGI server

## Contributing

When adding new features:
1. Follow the existing code structure
2. Add proper type hints
3. Include error handling
4. Update this README
5. Test with sample data

## License

This web application is part of the Accounting Analyzer system.
