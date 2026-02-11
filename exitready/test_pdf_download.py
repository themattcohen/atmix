
import requests
import os

# Get the backend URL from the frontend .env file
with open('/app/frontend/.env', 'r') as f:
    for line in f:
        if line.startswith('REACT_APP_BACKEND_URL='):
            BACKEND_URL = line.strip().split('=')[1].strip('"\'')
            break

# Ensure the URL doesn't have quotes
BACKEND_URL = BACKEND_URL.strip('"\'')
API_URL = f"{BACKEND_URL}/api"

print(f"Using API URL: {API_URL}")

def test_lead_magnet_pdf():
    """Test lead magnet PDF download API"""
    print("\n=== Testing Lead Magnet PDF Download API ===")
    
    response = requests.get(f"{API_URL}/lead-magnet/red-flags-pdf")
    print(f"PDF download status code: {response.status_code}")
    
    if response.status_code == 200:
        # Check content type
        content_type = response.headers.get('Content-Type')
        print(f"Content-Type: {content_type}")
        
        # Check content disposition (filename)
        content_disposition = response.headers.get('Content-Disposition')
        print(f"Content-Disposition: {content_disposition}")
        
        # Check if the response is a PDF (starts with %PDF)
        is_pdf = response.content[:4] == b'%PDF'
        print(f"Is PDF format: {is_pdf}")
        
        # Check file size
        file_size = len(response.content)
        print(f"File size: {file_size} bytes")
        
        # Save the PDF for inspection
        with open('/tmp/red-flags.pdf', 'wb') as f:
            f.write(response.content)
        print(f"PDF saved to /tmp/red-flags.pdf for inspection")
        
        return {
            "success": True,
            "is_pdf": is_pdf,
            "content_type_correct": content_type == "application/pdf",
            "filename_correct": "filename=23-red-flags-assessment.pdf" in content_disposition if content_disposition else False,
            "file_size": file_size
        }
    else:
        print(f"Failed to download PDF: {response.text}")
        return {
            "success": False
        }

if __name__ == "__main__":
    pdf_results = test_lead_magnet_pdf()
    
    print("\n=== PDF Download Test Summary ===")
    if pdf_results['success']:
        print(f"PDF Download: Success")
        print(f"Is PDF Format: {'Yes' if pdf_results['is_pdf'] else 'No'}")
        print(f"Content Type Correct: {'Yes' if pdf_results['content_type_correct'] else 'No'}")
        print(f"Filename Correct: {'Yes' if pdf_results['filename_correct'] else 'No'}")
        print(f"File Size: {pdf_results['file_size']} bytes")
    else:
        print(f"PDF Download: Failure")
