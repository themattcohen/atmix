import requests
import json
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

def test_value_calculator_admin_endpoints():
    """Test the value calculator admin CRUD endpoints"""
    print("\n=== Testing Value Calculator Admin Endpoints ===")
    
    # Test getting all questions
    questions_response = requests.get(f"{API_URL}/value-questions/all")
    questions_success = questions_response.status_code == 200
    print(f"Get all questions status code: {questions_response.status_code}")
    
    if questions_success:
        questions = questions_response.json()
        print(f"Retrieved {len(questions)} questions")
    else:
        print(f"❌ Failed to get questions: {questions_response.text}")
    
    # Test getting all options
    options_response = requests.get(f"{API_URL}/value-options/all")
    options_success = options_response.status_code == 200
    print(f"Get all options status code: {options_response.status_code}")
    
    if options_success:
        options = options_response.json()
        print(f"Retrieved {len(options)} options")
    else:
        print(f"❌ Failed to get options: {options_response.text}")
    
    # Test getting all tax parameters
    tax_params_response = requests.get(f"{API_URL}/value-tax-params/all")
    tax_params_success = tax_params_response.status_code == 200
    print(f"Get all tax parameters status code: {tax_params_response.status_code}")
    
    if tax_params_success:
        tax_params = tax_params_response.json()
        print(f"Retrieved {len(tax_params)} tax parameters")
    else:
        print(f"❌ Failed to get tax parameters: {tax_params_response.text}")
    
    # Test getting all NAICS modifiers
    naics_response = requests.get(f"{API_URL}/value-naics/all")
    naics_success = naics_response.status_code == 200
    print(f"Get all NAICS modifiers status code: {naics_response.status_code}")
    
    if naics_success:
        naics = naics_response.json()
        print(f"Retrieved {len(naics)} NAICS modifiers")
    else:
        print(f"❌ Failed to get NAICS modifiers: {naics_response.text}")
    
    # Test getting all multiples
    multiples_response = requests.get(f"{API_URL}/value-multiples/all")
    multiples_success = multiples_response.status_code == 200
    print(f"Get all multiples status code: {multiples_response.status_code}")
    
    if multiples_success:
        multiples = multiples_response.json()
        print(f"Retrieved {len(multiples)} multiples")
    else:
        print(f"❌ Failed to get multiples: {multiples_response.text}")
    
    # Test updating questions (we'll just send back the same questions we retrieved)
    if questions_success and len(questions_response.json()) > 0:
        update_questions_response = requests.post(f"{API_URL}/value-questions/update", json=questions_response.json())
        update_questions_success = update_questions_response.status_code == 200
        print(f"Update questions status code: {update_questions_response.status_code}")
        
        if update_questions_success:
            result = update_questions_response.json()
            print(f"Updated {result.get('count', 0)} questions")
        else:
            print(f"❌ Failed to update questions: {update_questions_response.text}")
    else:
        update_questions_success = False
        print("⚠️ Skipping question update test due to no questions retrieved")
    
    # Test updating options (we'll just send back the same options we retrieved)
    if options_success and len(options_response.json()) > 0:
        update_options_response = requests.post(f"{API_URL}/value-options/update", json=options_response.json())
        update_options_success = update_options_response.status_code == 200
        print(f"Update options status code: {update_options_response.status_code}")
        
        if update_options_success:
            result = update_options_response.json()
            print(f"Updated {result.get('count', 0)} options")
        else:
            print(f"❌ Failed to update options: {update_options_response.text}")
    else:
        update_options_success = False
        print("⚠️ Skipping options update test due to no options retrieved")
    
    # Return overall success status
    all_get_endpoints_success = questions_success and options_success and tax_params_success and naics_success and multiples_success
    all_update_endpoints_success = update_questions_success and update_options_success
    
    print(f"\nValue Calculator Admin Endpoints Test Results:")
    print(f"  - GET Endpoints: {'SUCCESS' if all_get_endpoints_success else 'FAILURE'}")
    print(f"  - UPDATE Endpoints: {'SUCCESS' if all_update_endpoints_success else 'FAILURE'}")
    
    return {
        "get_endpoints_success": all_get_endpoints_success,
        "update_endpoints_success": all_update_endpoints_success,
        "questions_count": len(questions_response.json()) if questions_success else 0,
        "options_count": len(options_response.json()) if options_success else 0,
        "tax_params_count": len(tax_params_response.json()) if tax_params_success else 0,
        "naics_count": len(naics_response.json()) if naics_success else 0,
        "multiples_count": len(multiples_response.json()) if multiples_success else 0
    }

if __name__ == "__main__":
    # Test admin endpoints
    admin_results = test_value_calculator_admin_endpoints()
    
    print("\n=== Value Calculator Admin Endpoints Test Summary ===")
    print(f"GET Endpoints: {'SUCCESS' if admin_results['get_endpoints_success'] else 'FAILURE'}")
    print(f"UPDATE Endpoints: {'SUCCESS' if admin_results['update_endpoints_success'] else 'FAILURE'}")
    print(f"Questions Count: {admin_results['questions_count']}")
    print(f"Options Count: {admin_results['options_count']}")
    print(f"Tax Parameters Count: {admin_results['tax_params_count']}")
    print(f"NAICS Codes Count: {admin_results['naics_count']}")
    print(f"Multiples Count: {admin_results['multiples_count']}")
    
    # Overall success
    overall_success = admin_results['get_endpoints_success'] and admin_results['update_endpoints_success']
    print(f"\nOverall Test Result: {'SUCCESS' if overall_success else 'FAILURE'}")