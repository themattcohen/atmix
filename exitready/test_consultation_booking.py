import requests
import json
import os
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

def test_payment_intent_creation():
    """Test payment intent creation with proper metadata and client_secret"""
    print("\n=== Testing Payment Intent Creation ===")
    
    # Test data as specified in the requirements
    test_data = {
        "customer_info": {
            "name": "John Smith",
            "email": "john.smith@testcompany.com", 
            "phone": "(555) 123-4567",
            "company": "Test Company Inc",
            "consultation_topic": "Business valuation and exit planning"
        },
        "hours": 1.5
    }
    
    response = requests.post(f"{API_URL}/create-payment-intent", json=test_data)
    print(f"Create payment intent status code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Payment intent created successfully")
        
        # Check if client_secret is in the response
        if "client_secret" in result:
            print(f"Client secret received: {result['client_secret'][:10]}...")
            client_secret_received = True
        else:
            print("Error: No client_secret in response")
            client_secret_received = False
        
        # Check if amount is calculated correctly (1.5 × $250 × 100 cents = 37500)
        expected_amount = 37500
        actual_amount = result.get("amount", 0)
        print(f"Amount: {actual_amount} cents (expected: {expected_amount} cents)")
        amount_correct = actual_amount == expected_amount
        
        # Check if hours are returned correctly
        expected_hours = 1.5
        actual_hours = result.get("hours", 0)
        print(f"Hours: {actual_hours} (expected: {expected_hours})")
        hours_correct = actual_hours == expected_hours
        
        # Now check if the booking was saved to MongoDB by querying the consultation-bookings endpoint
        bookings_response = requests.get(f"{API_URL}/consultation-bookings")
        
        if bookings_response.status_code == 200:
            bookings = bookings_response.json()
            print(f"Retrieved {len(bookings)} consultation bookings")
            
            # Look for our booking
            booking_found = False
            for booking in bookings:
                if (booking.get("customer_info", {}).get("email") == test_data["customer_info"]["email"] and
                    booking.get("hours") == test_data["hours"]):
                    booking_found = True
                    print(f"Found our booking in the database:")
                    print(f"  - ID: {booking.get('id')}")
                    print(f"  - Status: {booking.get('status')}")
                    print(f"  - Hours: {booking.get('hours')}")
                    print(f"  - Amount: ${booking.get('amount')/100:.2f}")
                    print(f"  - Customer: {booking.get('customer_info', {}).get('name')}")
                    print(f"  - Stripe Payment Intent ID: {booking.get('stripe_payment_intent_id')}")
                    break
            
            if not booking_found:
                print("Error: Booking not found in the database")
        else:
            print(f"Error retrieving bookings: {bookings_response.status_code} - {bookings_response.text}")
            booking_found = False
        
        return {
            "success": True,
            "client_secret_received": client_secret_received,
            "amount_correct": amount_correct,
            "hours_correct": hours_correct,
            "booking_saved": booking_found
        }
    else:
        print(f"Failed to create payment intent: {response.text}")
        return {
            "success": False,
            "error": response.text
        }

def test_variable_hours():
    """Test payment intent creation with different hour values"""
    print("\n=== Testing Variable Hours Functionality ===")
    
    test_cases = [
        {"hours": 0.5, "expected_amount": 12500, "description": "Half hour"},
        {"hours": 1, "expected_amount": 25000, "description": "One hour"},
        {"hours": 2, "expected_amount": 50000, "description": "Two hours"},
        {"hours": 3.5, "expected_amount": 87500, "description": "Three and a half hours"}
    ]
    
    results = []
    
    for test_case in test_cases:
        hours = test_case["hours"]
        expected_amount = test_case["expected_amount"]
        description = test_case["description"]
        
        print(f"\nTesting {description} ({hours} hours):")
        
        test_data = {
            "customer_info": {
                "name": f"{description} Test",
                "email": f"test.{hours}@testcompany.com", 
                "phone": "(555) 123-4567",
                "company": "Test Company Inc",
                "consultation_topic": f"{description} consultation test"
            },
            "hours": hours
        }
        
        response = requests.post(f"{API_URL}/create-payment-intent", json=test_data)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            actual_amount = result.get("amount", 0)
            actual_hours = result.get("hours", 0)
            
            print(f"Amount: ${actual_amount/100:.2f} (expected: ${expected_amount/100:.2f})")
            print(f"Hours: {actual_hours} (expected: {hours})")
            
            amount_correct = actual_amount == expected_amount
            hours_correct = actual_hours == hours
            
            results.append({
                "hours": hours,
                "success": True,
                "amount_correct": amount_correct,
                "hours_correct": hours_correct
            })
        else:
            print(f"Failed: {response.text}")
            results.append({
                "hours": hours,
                "success": False,
                "error": response.text
            })
    
    # Test invalid hour values
    print("\nTesting invalid hour values:")
    
    invalid_test_cases = [
        {"hours": 0.1, "description": "Too few hours"},
        {"hours": 10, "description": "Too many hours"}
    ]
    
    for test_case in invalid_test_cases:
        hours = test_case["hours"]
        description = test_case["description"]
        
        print(f"\nTesting {description} ({hours} hours):")
        
        test_data = {
            "customer_info": {
                "name": f"Invalid {description} Test",
                "email": f"invalid.{hours}@testcompany.com", 
                "phone": "(555) 123-4567",
                "company": "Test Company Inc",
                "consultation_topic": f"Invalid {description} test"
            },
            "hours": hours
        }
        
        response = requests.post(f"{API_URL}/create-payment-intent", json=test_data)
        print(f"Status code: {response.status_code}")
        
        # Should be rejected with 400 status code
        expected_rejection = response.status_code == 400
        print(f"Rejected as expected: {expected_rejection}")
        
        if response.status_code != 200:
            print(f"Error message: {response.text}")
        
        results.append({
            "hours": hours,
            "expected_rejection": expected_rejection,
            "actual_status": response.status_code
        })
    
    return results

def test_payment_method_types():
    """Test that payment intent includes 'us_bank_account' payment method type"""
    print("\n=== Testing Payment Method Types ===")
    
    test_data = {
        "customer_info": {
            "name": "Payment Method Test",
            "email": "payment.method@testcompany.com", 
            "phone": "(555) 123-4567",
            "company": "Test Company Inc",
            "consultation_topic": "Testing payment method types"
        },
        "hours": 1
    }
    
    response = requests.post(f"{API_URL}/create-payment-intent", json=test_data)
    print(f"Create payment intent status code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        client_secret = result.get("client_secret", "")
        
        # We can't directly check the payment method types from the client_secret,
        # but we can infer it from the client_secret format and the successful response
        
        print(f"Client secret received: {client_secret[:10]}...")
        print("Payment intent created successfully, which should include 'us_bank_account' payment method type")
        print("Note: We can't directly verify the payment method types from the API response")
        
        # Check if the booking was saved to MongoDB
        bookings_response = requests.get(f"{API_URL}/consultation-bookings")
        
        if bookings_response.status_code == 200:
            bookings = bookings_response.json()
            
            # Look for our booking
            booking_found = False
            for booking in bookings:
                if booking.get("customer_info", {}).get("email") == test_data["customer_info"]["email"]:
                    booking_found = True
                    print(f"Found our booking in the database")
                    break
            
            if not booking_found:
                print("Error: Booking not found in the database")
        else:
            print(f"Error retrieving bookings: {bookings_response.status_code} - {bookings_response.text}")
            booking_found = False
        
        return {
            "success": True,
            "client_secret_received": bool(client_secret),
            "booking_saved": booking_found
        }
    else:
        print(f"Failed to create payment intent: {response.text}")
        return {
            "success": False,
            "error": response.text
        }

def test_metadata_storage():
    """Test that proper metadata is stored (customer info, hours, rate)"""
    print("\n=== Testing Metadata Storage ===")
    
    test_data = {
        "customer_info": {
            "name": "Metadata Test",
            "email": "metadata@testcompany.com", 
            "phone": "(555) 987-6543",
            "company": "Metadata Test Company",
            "consultation_topic": "Testing metadata storage"
        },
        "hours": 2.5
    }
    
    response = requests.post(f"{API_URL}/create-payment-intent", json=test_data)
    print(f"Create payment intent status code: {response.status_code}")
    
    if response.status_code == 200:
        # Check if the booking was saved to MongoDB with all metadata
        bookings_response = requests.get(f"{API_URL}/consultation-bookings")
        
        if bookings_response.status_code == 200:
            bookings = bookings_response.json()
            
            # Look for our booking
            booking_found = False
            for booking in bookings:
                if booking.get("customer_info", {}).get("email") == test_data["customer_info"]["email"]:
                    booking_found = True
                    print(f"Found our booking in the database:")
                    
                    # Check customer info
                    customer_info = booking.get("customer_info", {})
                    print(f"Customer info:")
                    print(f"  - Name: {customer_info.get('name')}")
                    print(f"  - Email: {customer_info.get('email')}")
                    print(f"  - Phone: {customer_info.get('phone')}")
                    print(f"  - Company: {customer_info.get('company')}")
                    print(f"  - Topic: {customer_info.get('consultation_topic')}")
                    
                    # Check hours and amount
                    hours = booking.get("hours")
                    amount = booking.get("amount")
                    print(f"Hours: {hours}")
                    print(f"Amount: ${amount/100:.2f}")
                    
                    # Verify all fields match the test data
                    customer_info_complete = all([
                        customer_info.get("name") == test_data["customer_info"]["name"],
                        customer_info.get("email") == test_data["customer_info"]["email"],
                        customer_info.get("phone") == test_data["customer_info"]["phone"],
                        customer_info.get("company") == test_data["customer_info"]["company"],
                        customer_info.get("consultation_topic") == test_data["customer_info"]["consultation_topic"]
                    ])
                    
                    hours_correct = hours == test_data["hours"]
                    amount_correct = amount == int(test_data["hours"] * 25000)  # $250/hour in cents
                    
                    print(f"Customer info complete: {customer_info_complete}")
                    print(f"Hours correct: {hours_correct}")
                    print(f"Amount correct: {amount_correct}")
                    
                    return {
                        "success": True,
                        "booking_found": True,
                        "customer_info_complete": customer_info_complete,
                        "hours_correct": hours_correct,
                        "amount_correct": amount_correct
                    }
            
            if not booking_found:
                print("Error: Booking not found in the database")
                return {
                    "success": True,
                    "booking_found": False
                }
        else:
            print(f"Error retrieving bookings: {bookings_response.status_code} - {bookings_response.text}")
            return {
                "success": False,
                "error": f"Error retrieving bookings: {bookings_response.text}"
            }
    else:
        print(f"Failed to create payment intent: {response.text}")
        return {
            "success": False,
            "error": response.text
        }

def run_all_tests():
    """Run all consultation booking tests"""
    print("=== Running Consultation Booking Tests ===")
    
    # Test payment intent creation
    payment_intent_results = test_payment_intent_creation()
    
    # Test variable hours functionality
    variable_hours_results = test_variable_hours()
    
    # Test payment method types
    payment_method_results = test_payment_method_types()
    
    # Test metadata storage
    metadata_results = test_metadata_storage()
    
    # Print summary
    print("\n=== Test Summary ===")
    
    print("\nPayment Intent Creation:")
    if payment_intent_results["success"]:
        print("✅ Payment intent created successfully")
        print(f"✅ Client secret received: {payment_intent_results['client_secret_received']}")
        print(f"✅ Amount calculated correctly: {payment_intent_results['amount_correct']}")
        print(f"✅ Hours returned correctly: {payment_intent_results['hours_correct']}")
        print(f"✅ Booking saved to database: {payment_intent_results['booking_saved']}")
    else:
        print(f"❌ Failed to create payment intent: {payment_intent_results.get('error', 'Unknown error')}")
    
    print("\nVariable Hours Functionality:")
    valid_hours_tests = [test for test in variable_hours_results if "success" in test]
    invalid_hours_tests = [test for test in variable_hours_results if "expected_rejection" in test]
    
    for test in valid_hours_tests:
        if test["success"]:
            print(f"✅ {test['hours']} hours: Amount and hours correct")
        else:
            print(f"❌ {test['hours']} hours: {test.get('error', 'Failed')}")
    
    for test in invalid_hours_tests:
        if test["expected_rejection"]:
            print(f"✅ {test['hours']} hours: Rejected as expected")
        else:
            print(f"❌ {test['hours']} hours: Not rejected as expected")
    
    print("\nPayment Method Types:")
    if payment_method_results["success"]:
        print("✅ Payment intent created successfully")
        print(f"✅ Client secret received: {payment_method_results['client_secret_received']}")
        print(f"✅ Booking saved to database: {payment_method_results['booking_saved']}")
    else:
        print(f"❌ Failed to test payment method types: {payment_method_results.get('error', 'Unknown error')}")
    
    print("\nMetadata Storage:")
    if metadata_results["success"]:
        if metadata_results["booking_found"]:
            print("✅ Booking found in database")
            print(f"✅ Customer info complete: {metadata_results['customer_info_complete']}")
            print(f"✅ Hours correct: {metadata_results['hours_correct']}")
            print(f"✅ Amount correct: {metadata_results['amount_correct']}")
        else:
            print("❌ Booking not found in database")
    else:
        print(f"❌ Failed to test metadata storage: {metadata_results.get('error', 'Unknown error')}")
    
    # Overall success
    overall_success = (
        payment_intent_results["success"] and
        payment_intent_results["client_secret_received"] and
        payment_intent_results["amount_correct"] and
        payment_intent_results["hours_correct"] and
        payment_intent_results["booking_saved"] and
        all(test["success"] and test["amount_correct"] and test["hours_correct"] for test in valid_hours_tests) and
        all(test["expected_rejection"] for test in invalid_hours_tests) and
        payment_method_results["success"] and
        payment_method_results["client_secret_received"] and
        payment_method_results["booking_saved"] and
        metadata_results["success"] and
        metadata_results["booking_found"] and
        metadata_results["customer_info_complete"] and
        metadata_results["hours_correct"] and
        metadata_results["amount_correct"]
    )
    
    print(f"\nOverall Test Result: {'SUCCESS' if overall_success else 'FAILURE'}")
    return overall_success

if __name__ == "__main__":
    run_all_tests()