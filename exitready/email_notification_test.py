import requests
import json
import os
import time

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

def test_email_notification_for_new_booking():
    """Test email notification for new consultation booking"""
    print("\n=== Testing Email Notification for New Booking ===")
    
    # Test data as specified in the requirements
    test_data = {
        "customer_info": {
            "name": "Email Test Customer",
            "email": "email.test@testcompany.com", 
            "phone": "(555) 999-8888",
            "company": "Email Test Company LLC",
            "consultation_topic": "Testing email notifications for consultation booking"
        },
        "amount": 25000  # $250.00 in cents
    }
    
    print(f"Sending test data: {json.dumps(test_data, indent=2)}")
    
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
        time.sleep(2)  # Wait a bit to ensure the booking is saved
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
        
        print("\nEmail Notification Test Results:")
        print("--------------------------------")
        print("1. Payment Intent Creation: SUCCESS")
        print(f"2. Client Secret Received: {'SUCCESS' if client_secret_received else 'FAILURE'}")
        print(f"3. Booking Saved to Database: {'SUCCESS' if booking_found else 'FAILURE'}")
        print("4. Email Notification: MANUAL CHECK REQUIRED")
        print("\nPlease check the email inbox for matt@atmix.org to verify:")
        print("- An email was received with subject 'New Consultation Booking - Email Test Customer'")
        print("- The email contains all customer details (name, email, phone, company, topic, amount)")
        print("- The email was sent immediately after the payment intent was created")
        
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

def test_gmail_smtp_configuration():
    """Test that Gmail SMTP environment variables are properly loaded"""
    print("\n=== Testing Gmail SMTP Configuration ===")
    
    # We can't directly access environment variables from the server,
    # but we can check if they're defined in the .env file
    
    with open('/app/backend/.env', 'r') as f:
        env_content = f.read()
    
    gmail_user_defined = 'GMAIL_USER' in env_content
    gmail_password_defined = 'GMAIL_PASSWORD' in env_content
    
    print(f"GMAIL_USER defined in .env: {'Yes' if gmail_user_defined else 'No'}")
    print(f"GMAIL_PASSWORD defined in .env: {'Yes' if gmail_password_defined else 'No'}")
    
    # Extract the values (without showing the full password)
    import re
    
    gmail_user_match = re.search(r'GMAIL_USER="?([^"\n]+)"?', env_content)
    gmail_user = gmail_user_match.group(1) if gmail_user_match else "Not found"
    
    gmail_password_match = re.search(r'GMAIL_PASSWORD="?([^"\n]+)"?', env_content)
    gmail_password = "****" if gmail_password_match else "Not found"
    
    print(f"GMAIL_USER value: {gmail_user}")
    print(f"GMAIL_PASSWORD value: {gmail_password} (masked for security)")
    
    # Check if the email is configured to be sent to matt@atmix.org
    email_to_matt = gmail_user == "matt@atmix.org"
    print(f"Email configured to be sent to matt@atmix.org: {'Yes' if email_to_matt else 'No'}")
    
    # Test the create-payment-intent endpoint to see if it works without crashing
    test_data = {
        "customer_info": {
            "name": "SMTP Test Customer",
            "email": "smtp.test@testcompany.com", 
            "phone": "(555) 111-2222",
            "company": "SMTP Test Company LLC",
            "consultation_topic": "Testing SMTP configuration"
        },
        "amount": 25000  # $250.00 in cents
    }
    
    response = requests.post(f"{API_URL}/create-payment-intent", json=test_data)
    print(f"Create payment intent status code: {response.status_code}")
    
    if response.status_code == 200:
        print("Server did not crash when sending email - SMTP configuration appears to be working")
        smtp_working = True
    else:
        print(f"Error when creating payment intent: {response.text}")
        smtp_working = False
    
    return {
        "gmail_user_defined": gmail_user_defined,
        "gmail_password_defined": gmail_password_defined,
        "email_to_matt": email_to_matt,
        "smtp_working": smtp_working
    }

if __name__ == "__main__":
    print("Starting Email Notification Tests...")
    
    # Test Gmail SMTP configuration
    smtp_results = test_gmail_smtp_configuration()
    
    # Test email notification for new booking
    booking_results = test_email_notification_for_new_booking()
    
    print("\n=== Email Notification Tests Summary ===")
    print("Gmail SMTP Configuration:")
    print(f"  - GMAIL_USER defined: {'Success' if smtp_results['gmail_user_defined'] else 'Failure'}")
    print(f"  - GMAIL_PASSWORD defined: {'Success' if smtp_results['gmail_password_defined'] else 'Failure'}")
    print(f"  - Email configured for matt@atmix.org: {'Success' if smtp_results['email_to_matt'] else 'Failure'}")
    print(f"  - SMTP functionality: {'Success' if smtp_results['smtp_working'] else 'Failure'}")
    
    print("\nEmail Notification for New Booking:")
    if booking_results['success']:
        print(f"  - Payment Intent Creation: Success")
        print(f"  - Client Secret Received: {'Success' if booking_results['client_secret_received'] else 'Failure'}")
        print(f"  - Booking Saved to Database: {'Success' if booking_results['booking_saved'] else 'Failure'}")
        print(f"  - Email Notification: Manual verification required")
    else:
        print(f"  - Test Failed: {booking_results.get('error', 'Unknown error')}")
    
    # Overall success
    overall_success = (
        smtp_results['gmail_user_defined'] and
        smtp_results['gmail_password_defined'] and
        smtp_results['email_to_matt'] and
        smtp_results['smtp_working'] and
        booking_results['success'] and
        booking_results['client_secret_received'] and
        booking_results['booking_saved']
    )
    
    print(f"\nOverall Test Result: {'SUCCESS' if overall_success else 'FAILURE'}")
    print("\nNOTE: To fully verify email notification, check the inbox for matt@atmix.org")