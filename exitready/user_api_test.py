import requests
import json
import os
import time
from datetime import datetime

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

def test_user_registration():
    """Test user registration API with various scenarios"""
    print("\n=== Testing User Registration API ===")
    
    # Test with valid user data
    valid_user = {
        "name": "Test User",
        "email": "testuser@example.com",
        "password": "securepassword123"
    }
    
    response = requests.post(f"{API_URL}/users/register", json=valid_user)
    print(f"Valid user registration status code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Registration successful: {result['message']}")
        print(f"User data: {result['user']}")
        valid_registration_success = True
    else:
        print(f"Failed to register valid user: {response.text}")
        valid_registration_success = False
    
    # Test duplicate email registration (should fail)
    duplicate_user = {
        "name": "Duplicate User",
        "email": "testuser@example.com",  # Same email as above
        "password": "anotherpassword456"
    }
    
    response = requests.post(f"{API_URL}/users/register", json=duplicate_user)
    print(f"Duplicate email registration status code: {response.status_code}")
    print(f"Error message: {response.text}")
    
    # This should fail with a 400 status code
    duplicate_rejection_success = response.status_code == 400
    
    # Test with missing email field
    missing_email_user = {
        "name": "Missing Email User",
        "password": "password789"
    }
    
    response = requests.post(f"{API_URL}/users/register", json=missing_email_user)
    print(f"Missing email registration status code: {response.status_code}")
    print(f"Error message: {response.text}")
    
    missing_email_rejection_success = response.status_code != 200
    
    # Test with missing name field
    missing_name_user = {
        "email": "missingname@example.com",
        "password": "password789"
    }
    
    response = requests.post(f"{API_URL}/users/register", json=missing_name_user)
    print(f"Missing name registration status code: {response.status_code}")
    print(f"Error message: {response.text}")
    
    missing_name_rejection_success = response.status_code != 200
    
    # Test with missing password field
    missing_password_user = {
        "name": "Missing Password User",
        "email": "missingpassword@example.com"
    }
    
    response = requests.post(f"{API_URL}/users/register", json=missing_password_user)
    print(f"Missing password registration status code: {response.status_code}")
    print(f"Error message: {response.text}")
    
    missing_password_rejection_success = response.status_code != 200
    
    # Return overall success status
    return {
        "valid_registration": valid_registration_success,
        "duplicate_rejection": duplicate_rejection_success,
        "missing_email_rejection": missing_email_rejection_success,
        "missing_name_rejection": missing_name_rejection_success,
        "missing_password_rejection": missing_password_rejection_success
    }

def test_user_login():
    """Test user login API with various scenarios"""
    print("\n=== Testing User Login API ===")
    
    # First, register a test user if not already registered
    test_user = {
        "name": "Login Test User",
        "email": "logintest@example.com",
        "password": "loginpassword123"
    }
    
    # Try to register the test user (ignore if already exists)
    requests.post(f"{API_URL}/users/register", json=test_user)
    
    # Test with valid login credentials
    valid_login_data = {
        "email": "logintest@example.com",
        "password": "loginpassword123"
    }
    
    response = requests.post(f"{API_URL}/users/login", json=valid_login_data)
    
    print(f"Valid login status code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Login successful: {result['message']}")
        print(f"User data: {result['user']}")
        valid_login_success = True
    else:
        print(f"Failed to login with valid credentials: {response.text}")
        valid_login_success = False
    
    # Test with invalid email
    invalid_email_data = {
        "email": "nonexistent@example.com",
        "password": "loginpassword123"
    }
    
    response = requests.post(f"{API_URL}/users/login", json=invalid_email_data)
    print(f"Invalid email login status code: {response.status_code}")
    print(f"Error message: {response.text}")
    
    # This should fail with a 401 status code
    invalid_email_rejection_success = response.status_code == 401
    
    # Test with invalid password
    invalid_password_data = {
        "email": "logintest@example.com",
        "password": "wrongpassword"
    }
    
    response = requests.post(f"{API_URL}/users/login", json=invalid_password_data)
    print(f"Invalid password login status code: {response.status_code}")
    print(f"Error message: {response.text}")
    
    # This should fail with a 401 status code
    invalid_password_rejection_success = response.status_code == 401
    
    # Test with missing email field
    missing_email_login = {
        "password": "loginpassword123"
    }
    
    response = requests.post(f"{API_URL}/users/login", json=missing_email_login)
    print(f"Missing email login status code: {response.status_code}")
    print(f"Error message: {response.text}")
    
    missing_email_login_rejection_success = response.status_code != 200
    
    # Test with missing password field
    missing_password_login = {
        "email": "logintest@example.com"
    }
    
    response = requests.post(f"{API_URL}/users/login", json=missing_password_login)
    print(f"Missing password login status code: {response.status_code}")
    print(f"Error message: {response.text}")
    
    missing_password_login_rejection_success = response.status_code != 200
    
    # Return overall success status
    return {
        "valid_login": valid_login_success,
        "invalid_email_rejection": invalid_email_rejection_success,
        "invalid_password_rejection": invalid_password_rejection_success,
        "missing_email_rejection": missing_email_login_rejection_success,
        "missing_password_rejection": missing_password_login_rejection_success
    }

def test_admin_users_endpoint():
    """Test admin users endpoint to verify it returns registered users in correct format"""
    print("\n=== Testing Admin Users Endpoint ===")
    
    response = requests.get(f"{API_URL}/admin/users")
    print(f"Admin users endpoint status code: {response.status_code}")
    
    if response.status_code == 200:
        users = response.json()
        count = len(users)
        print(f"Retrieved {count} users")
        
        # Check if we have any users to verify fields
        if count > 0:
            first_user = users[0]
            print(f"Sample user fields: {', '.join(first_user.keys())}")
            
            # Check if all required fields are present
            required_fields = ['id', 'name', 'email', 'created_at']
            all_fields_present = all(field in first_user for field in required_fields)
            
            if all_fields_present:
                print("All required fields are present in the user data")
            else:
                print("Some required fields are missing from the user data")
                print(f"Missing fields: {[field for field in required_fields if field not in first_user]}")
            
            # Check if password is NOT exposed
            password_not_exposed = 'password' not in first_user
            if password_not_exposed:
                print("Password is not exposed in the response (good)")
            else:
                print("WARNING: Password is exposed in the response")
        else:
            print("No users found (empty array returned)")
            all_fields_present = False
            password_not_exposed = True
        
        return {
            "success": True,
            "count": count,
            "all_fields_present": all_fields_present,
            "password_not_exposed": password_not_exposed
        }
    else:
        print(f"Failed to get admin users: {response.text}")
        return {
            "success": False
        }

def run_user_api_tests():
    """Run all user API tests"""
    print("Starting User API Tests...")
    
    # Test user registration
    registration_results = test_user_registration()
    
    # Test user login
    login_results = test_user_login()
    
    # Test admin users endpoint
    admin_users_results = test_admin_users_endpoint()
    
    print("\n=== User API Test Summary ===")
    print(f"User Registration API:")
    print(f"  - Valid Registration: {'Success' if registration_results['valid_registration'] else 'Failure'}")
    print(f"  - Duplicate Email Rejection: {'Success' if registration_results['duplicate_rejection'] else 'Failure'}")
    print(f"  - Missing Email Validation: {'Success' if registration_results['missing_email_rejection'] else 'Failure'}")
    print(f"  - Missing Name Validation: {'Success' if registration_results['missing_name_rejection'] else 'Failure'}")
    print(f"  - Missing Password Validation: {'Success' if registration_results['missing_password_rejection'] else 'Failure'}")
    
    print(f"User Login API:")
    print(f"  - Valid Login: {'Success' if login_results['valid_login'] else 'Failure'}")
    print(f"  - Invalid Email Rejection: {'Success' if login_results['invalid_email_rejection'] else 'Failure'}")
    print(f"  - Invalid Password Rejection: {'Success' if login_results['invalid_password_rejection'] else 'Failure'}")
    print(f"  - Missing Email Validation: {'Success' if login_results['missing_email_rejection'] else 'Failure'}")
    print(f"  - Missing Password Validation: {'Success' if login_results['missing_password_rejection'] else 'Failure'}")
    
    print(f"Admin Users Endpoint:")
    if admin_users_results['success']:
        print(f"  - Retrieved {admin_users_results['count']} users")
        print(f"  - All Required Fields Present: {'Yes' if admin_users_results['all_fields_present'] else 'No'}")
        print(f"  - Password Not Exposed: {'Yes' if admin_users_results['password_not_exposed'] else 'No'}")
    else:
        print(f"  - Failed to access endpoint")
    
    # Return overall success status
    registration_success = (
        registration_results['valid_registration'] and 
        registration_results['duplicate_rejection'] and 
        registration_results['missing_email_rejection'] and
        registration_results['missing_name_rejection'] and
        registration_results['missing_password_rejection']
    )
    
    login_success = (
        login_results['valid_login'] and 
        login_results['invalid_email_rejection'] and 
        login_results['invalid_password_rejection'] and
        login_results['missing_email_rejection'] and
        login_results['missing_password_rejection']
    )
    
    admin_users_success = (
        admin_users_results['success'] and
        admin_users_results['all_fields_present'] and
        admin_users_results['password_not_exposed']
    )
    
    overall_success = registration_success and login_success and admin_users_success
    
    print(f"\nOverall User API Test Result: {'SUCCESS' if overall_success else 'FAILURE'}")
    
    return overall_success

if __name__ == "__main__":
    run_user_api_tests()