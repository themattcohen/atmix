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

def test_create_payment_intent():
    """Test the create-payment-intent endpoint with valid customer information"""
    print("\n=== Testing Create Payment Intent API ===")
    
    # Test data as specified in the requirements
    test_data = {
        "customer_info": {
            "name": "John Doe",
            "email": "john@testcompany.com", 
            "phone": "(555) 123-4567",
            "company": "Test Company LLC",
            "consultation_topic": "Business valuation guidance"
        },
        "amount": 25000  # $250.00 in cents
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
        
        # Now check if the booking was saved to MongoDB by querying the consultation-bookings endpoint
        bookings_response = requests.get(f"{API_URL}/consultation-bookings")
        
        if bookings_response.status_code == 200:
            bookings = bookings_response.json()
            print(f"Retrieved {len(bookings)} consultation bookings")
            
            # Look for our booking
            booking_found = False
            for booking in bookings:
                if (booking.get("customer_info", {}).get("email") == test_data["customer_info"]["email"] and
                    booking.get("amount") == test_data["amount"]):
                    booking_found = True
                    print(f"Found our booking in the database:")
                    print(f"  - ID: {booking.get('id')}")
                    print(f"  - Status: {booking.get('status')}")
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
            "booking_saved": booking_found
        }
    else:
        print(f"Failed to create payment intent: {response.text}")
        return {
            "success": False,
            "error": response.text
        }

def test_consultation_bookings_endpoint():
    """Test the consultation-bookings endpoint"""
    print("\n=== Testing Consultation Bookings Endpoint ===")
    
    response = requests.get(f"{API_URL}/consultation-bookings")
    print(f"Consultation bookings status code: {response.status_code}")
    
    if response.status_code == 200:
        bookings = response.json()
        print(f"Retrieved {len(bookings)} consultation bookings")
        
        # Check if we have any bookings to verify fields
        if len(bookings) > 0:
            first_booking = bookings[0]
            print(f"Sample booking fields: {', '.join(first_booking.keys())}")
            
            # Check if all required fields are present
            required_fields = ['id', 'customer_info', 'amount', 'stripe_payment_intent_id', 'status', 'created_at']
            all_fields_present = all(field in first_booking for field in required_fields)
            
            if all_fields_present:
                print("All required fields are present in the bookings")
                
                # Check customer_info structure
                customer_info = first_booking.get('customer_info', {})
                print(f"Customer info fields: {', '.join(customer_info.keys())}")
                
                customer_required_fields = ['name', 'email', 'phone', 'company', 'consultation_topic']
                customer_fields_present = all(field in customer_info for field in customer_required_fields)
                
                if customer_fields_present:
                    print("All required customer info fields are present")
                else:
                    print("Some required customer info fields are missing")
                    print(f"Missing fields: {[field for field in customer_required_fields if field not in customer_info]}")
            else:
                print("Some required fields are missing from the bookings")
                print(f"Missing fields: {[field for field in required_fields if field not in first_booking]}")
                customer_fields_present = False
        else:
            print("No bookings found (empty array returned)")
            all_fields_present = False
            customer_fields_present = False
        
        return {
            "success": True,
            "count": len(bookings),
            "all_fields_present": all_fields_present if len(bookings) > 0 else None,
            "customer_fields_present": customer_fields_present if len(bookings) > 0 else None
        }
    else:
        print(f"Failed to get consultation bookings: {response.text}")
        return {
            "success": False,
            "error": response.text
        }

def test_stripe_environment_variables():
    """Test that Stripe environment variables are properly loaded"""
    print("\n=== Testing Stripe Environment Variables ===")
    
    # We can't directly access environment variables from the server,
    # but we can infer if they're working by testing the payment intent creation
    
    # Simple test data
    test_data = {
        "customer_info": {
            "name": "Environment Test",
            "email": "env.test@example.com", 
            "phone": "(555) 987-6543",
            "company": "Environment Test LLC",
            "consultation_topic": "Testing environment variables"
        },
        "amount": 10000  # $100.00 in cents
    }
    
    response = requests.post(f"{API_URL}/create-payment-intent", json=test_data)
    print(f"Create payment intent status code: {response.status_code}")
    
    if response.status_code == 200:
        print("Stripe API key is properly configured (payment intent created successfully)")
        stripe_api_key_configured = True
    else:
        print(f"Stripe API key may not be properly configured: {response.text}")
        stripe_api_key_configured = False
    
    # Test webhook endpoint with a dummy request (we can't fully test without a real Stripe signature)
    webhook_response = requests.post(f"{API_URL}/stripe-webhook", json={"type": "test"})
    print(f"Stripe webhook endpoint status code: {webhook_response.status_code}")
    
    # If webhook secret is not configured, we should get a 400 error about invalid signature
    # If it's configured but the signature is invalid, we'll also get a 400
    # So we're just checking that the endpoint exists and responds
    webhook_endpoint_accessible = webhook_response.status_code in [400, 401, 403]
    
    if webhook_endpoint_accessible:
        print("Stripe webhook endpoint is accessible")
    else:
        print(f"Stripe webhook endpoint may not be properly configured: {webhook_response.text}")
    
    return {
        "stripe_api_key_configured": stripe_api_key_configured,
        "webhook_endpoint_accessible": webhook_endpoint_accessible
    }

def run_consultation_tests():
    """Run all consultation booking system tests"""
    print("Starting Consultation Booking System Tests...")
    
    # Test Stripe environment variables
    env_results = test_stripe_environment_variables()
    
    # Test create payment intent
    payment_intent_results = test_create_payment_intent()
    
    # Test consultation bookings endpoint
    bookings_results = test_consultation_bookings_endpoint()
    
    print("\n=== Consultation Booking System Test Summary ===")
    print(f"Stripe Environment Variables:")
    print(f"  - API Key Configured: {'Success' if env_results['stripe_api_key_configured'] else 'Failure'}")
    print(f"  - Webhook Endpoint Accessible: {'Success' if env_results['webhook_endpoint_accessible'] else 'Failure'}")
    
    if payment_intent_results['success']:
        print(f"Create Payment Intent API:")
        print(f"  - API Call: Success")
        print(f"  - Client Secret Received: {'Success' if payment_intent_results['client_secret_received'] else 'Failure'}")
        print(f"  - Booking Saved to MongoDB: {'Success' if payment_intent_results['booking_saved'] else 'Failure'}")
    else:
        print(f"Create Payment Intent API: Failure - {payment_intent_results.get('error', 'Unknown error')}")
    
    if bookings_results['success']:
        print(f"Consultation Bookings Endpoint:")
        print(f"  - API Call: Success")
        print(f"  - Retrieved {bookings_results['count']} bookings")
        
        if bookings_results['count'] > 0:
            print(f"  - All Required Fields Present: {'Success' if bookings_results['all_fields_present'] else 'Failure'}")
            print(f"  - All Customer Info Fields Present: {'Success' if bookings_results['customer_fields_present'] else 'Failure'}")
    else:
        print(f"Consultation Bookings Endpoint: Failure - {bookings_results.get('error', 'Unknown error')}")
    
    # Return overall success status
    overall_success = (
        env_results['stripe_api_key_configured'] and
        env_results['webhook_endpoint_accessible'] and
        payment_intent_results['success'] and
        payment_intent_results['client_secret_received'] and
        payment_intent_results['booking_saved'] and
        bookings_results['success'] and
        (bookings_results['all_fields_present'] if bookings_results['count'] > 0 else True) and
        (bookings_results['customer_fields_present'] if bookings_results['count'] > 0 else True)
    )
    
    print(f"\nOverall Test Result: {'SUCCESS' if overall_success else 'FAILURE'}")
    return overall_success

if __name__ == "__main__":
    run_consultation_tests()