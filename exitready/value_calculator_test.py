import requests
import json
import unittest
import os
from pprint import pprint

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

class ValueCalculatorTests(unittest.TestCase):
    """Tests for the Value Calculator backend endpoints"""

    def test_01_initialization(self):
        """Test the initialization endpoint to verify seed data is loaded correctly"""
        print("\n=== Testing Value Calculator Initialization ===")
        
        # Call the initialization endpoint
        response = requests.get(f"{API_URL}/value-calculator/init")
        self.assertEqual(response.status_code, 200, "Initialization endpoint should return 200 OK")
        
        # Verify the response contains the expected data
        data = response.json()
        print(f"Initialization response: {data}")
        
        self.assertIn("message", data, "Response should contain a message")
        self.assertEqual(data["message"], "Value calculator initialized successfully", 
                         "Initialization message should indicate success")
        
        # Verify the counts of seed data
        self.assertGreater(data["questions"], 0, "Should have loaded questions")
        self.assertGreater(data["options"], 0, "Should have loaded options")
        self.assertGreater(data["tax_params"], 0, "Should have loaded tax parameters")
        self.assertGreater(data["naics"], 0, "Should have loaded NAICS codes")
        self.assertGreater(data["multiples"], 0, "Should have loaded multiples")
        
        print("✅ Initialization test passed")

    def test_02_get_questions(self):
        """Test the questions endpoint to verify questions are returned with proper structure"""
        print("\n=== Testing Value Calculator Questions API ===")
        
        # Call the questions endpoint
        response = requests.get(f"{API_URL}/value-calculator/questions")
        self.assertEqual(response.status_code, 200, "Questions endpoint should return 200 OK")
        
        # Verify the response contains questions
        questions = response.json()
        self.assertIsInstance(questions, list, "Response should be a list of questions")
        self.assertGreater(len(questions), 0, "Should return at least one question")
        
        # Verify the structure of a question
        first_question = questions[0]
        self.assertIn("id", first_question, "Question should have an id")
        self.assertIn("question", first_question, "Question should have a question text")
        self.assertIn("input_type", first_question, "Question should have an input type")
        
        # Verify dropdown questions have options
        dropdown_questions = [q for q in questions if q["input_type"] == "Dropdown"]
        if dropdown_questions:
            self.assertIn("options", dropdown_questions[0], "Dropdown questions should have options")
            self.assertIsInstance(dropdown_questions[0]["options"], list, "Options should be a list")
        
        print(f"Found {len(questions)} questions, including {len(dropdown_questions)} dropdown questions")
        print("✅ Questions API test passed")

    def test_03_scoring_calculation(self):
        """Test the scoring calculation endpoint with sample data"""
        print("\n=== Testing Value Calculator Scoring API ===")
        
        # Prepare sample data for scoring
        sample_data = {
            "run_id": "test-run-123",
            "answers": [
                {"question_id": 9, "value": "2 - 4 Years"},  # Timeline for exit
                {"question_id": 10, "value": "A Medium Amount"},  # Preparation for exit
                {"question_id": 11, "value": "1"},  # Number of owners
                {"question_id": 12, "value": "5+ years"},  # Key employee tenure
                {"question_id": 13, "value": "Complete Alignment"},  # Owner alignment
                {"question_id": 14, "value": "Yes"},  # Plan for life after selling
                {"question_id": 15, "value": "1.5"}  # Annual Revenue in millions
            ],
            "financial_inputs": {
                "revenue": 1500000,
                "ebitda": 300000,
                "target_corpus": 2000000
            }
        }
        
        # Call the scoring endpoint
        response = requests.post(
            f"{API_URL}/value-calculator/score", 
            json=sample_data
        )
        self.assertEqual(response.status_code, 200, "Scoring endpoint should return 200 OK")
        
        # Verify the response structure
        result = response.json()
        print("Scoring response:")
        pprint(result)
        
        # Check required fields
        self.assertIn("run_id", result, "Response should include run_id")
        self.assertEqual(result["run_id"], "test-run-123", "run_id should match the request")
        
        self.assertIn("sellability_score", result, "Response should include sellability_score")
        self.assertIsInstance(result["sellability_score"], (int, float), "sellability_score should be a number")
        
        self.assertIn("sellability_grade", result, "Response should include sellability_grade")
        self.assertIn(result["sellability_grade"], ["A", "B", "C", "D", "F"], 
                     "sellability_grade should be a valid grade")
        
        self.assertIn("enterprise_value", result, "Response should include enterprise_value")
        self.assertIsInstance(result["enterprise_value"], (int, float), "enterprise_value should be a number")
        
        self.assertIn("net_proceeds", result, "Response should include net_proceeds")
        self.assertIsInstance(result["net_proceeds"], (int, float), "net_proceeds should be a number")
        
        self.assertIn("wealth_gap", result, "Response should include wealth_gap")
        self.assertIsInstance(result["wealth_gap"], (int, float), "wealth_gap should be a number")
        
        self.assertIn("per_question", result, "Response should include per_question scores")
        self.assertIsInstance(result["per_question"], list, "per_question should be a list")
        
        self.assertIn("valuation_details", result, "Response should include valuation_details")
        self.assertIsInstance(result["valuation_details"], dict, "valuation_details should be a dictionary")
        
        # Verify the calculation logic
        self.assertGreater(result["enterprise_value"], 0, "Enterprise value should be positive")
        self.assertLess(result["net_proceeds"], result["enterprise_value"], 
                       "Net proceeds should be less than enterprise value due to fees")
        
        # Calculate wealth gap manually to verify
        expected_wealth_gap = sample_data["financial_inputs"]["target_corpus"] - result["net_proceeds"]
        self.assertAlmostEqual(result["wealth_gap"], expected_wealth_gap, delta=1.0, 
                              msg="Wealth gap calculation should match expected formula")
        
        print("✅ Scoring calculation test passed")

    def test_04_error_handling(self):
        """Test error handling for the Value Calculator endpoints"""
        print("\n=== Testing Value Calculator Error Handling ===")
        
        # Test with missing required fields
        invalid_data = {
            "run_id": "test-error-123",
            # Missing answers
            "financial_inputs": {
                "revenue": 1500000,
                "ebitda": 300000
            }
        }
        
        response = requests.post(
            f"{API_URL}/value-calculator/score", 
            json=invalid_data
        )
        
        self.assertNotEqual(response.status_code, 200, 
                           "Should not return 200 OK for invalid data")
        
        # Test with invalid question IDs
        invalid_question_data = {
            "run_id": "test-error-456",
            "answers": [
                {"question_id": 9999, "value": "Invalid"}  # Non-existent question ID
            ],
            "financial_inputs": {
                "revenue": 1500000,
                "ebitda": 300000
            }
        }
        
        response = requests.post(
            f"{API_URL}/value-calculator/score", 
            json=invalid_question_data
        )
        
        # This might return 200 if the API ignores invalid question IDs
        # or might return an error if it validates question IDs
        print(f"Response for invalid question ID: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print("API handled invalid question ID gracefully")
            pprint(result)
        else:
            print(f"API rejected invalid question ID with status {response.status_code}")
            print(response.text)
        
        # Test with invalid financial inputs (negative values)
        invalid_financial_data = {
            "run_id": "test-error-789",
            "answers": [
                {"question_id": 9, "value": "2 - 4 Years"}
            ],
            "financial_inputs": {
                "revenue": -1500000,  # Negative revenue
                "ebitda": -300000     # Negative EBITDA
            }
        }
        
        response = requests.post(
            f"{API_URL}/value-calculator/score", 
            json=invalid_financial_data
        )
        
        # The API should handle negative values in some way
        print(f"Response for negative financial values: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print("API handled negative financial values")
            pprint(result)
            
            # Check if the API handled negative values appropriately
            # (e.g., by setting enterprise value to 0 or returning an error message)
            if result["enterprise_value"] < 0:
                print("⚠️ Warning: API returned negative enterprise value for negative inputs")
            
        else:
            print(f"API rejected negative financial values with status {response.status_code}")
            print(response.text)
        
        print("✅ Error handling tests completed")


if __name__ == "__main__":
    # Initialize the calculator before running tests
    print("Initializing Value Calculator before tests...")
    init_response = requests.get(f"{API_URL}/value-calculator/init")
    if init_response.status_code == 200:
        print("Initialization successful")
    else:
        print(f"Initialization failed with status {init_response.status_code}")
        print(init_response.text)
    
    # Run the tests
    unittest.main(argv=['first-arg-is-ignored'], exit=False)