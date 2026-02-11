import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

const PaymentForm = ({ customerInfo, hours, totalAmount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    if (!stripe || !elements) {
      setIsLoading(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/consultation-success`,
      },
    });

    if (error) {
      onError(error.message);
    } else {
      onSuccess();
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-espresso-black mb-2">Payment Details</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Duration:</span>
            <span>{hours} hour{hours !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex justify-between">
            <span>Rate:</span>
            <span>$250/hour</span>
          </div>
          <div className="flex justify-between font-semibold text-lg border-t pt-1">
            <span>Total:</span>
            <span className="text-trust-teal">${totalAmount}</span>
          </div>
        </div>
      </div>

      <PaymentElement />

      <button
        type="submit"
        disabled={!stripe || isLoading}
        className="w-full bg-trust-teal text-white py-3 px-4 rounded-md hover:bg-trust-teal/90 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Processing Payment...' : `Pay $${totalAmount} via ACH`}
      </button>
    </form>
  );
};

const ConsultationBooking = () => {
  const [clientSecret, setClientSecret] = useState('');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    consultation_topic: ''
  });
  const [hours, setHours] = useState(1);
  const [step, setStep] = useState('info'); // 'info', 'payment', 'success'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Calculate total amount based on hours
  const hourlyRate = 250;
  const totalAmount = hours * hourlyRate;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCustomerInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleHoursChange = (e) => {
    const value = parseFloat(e.target.value);
    if (value >= 0.5 && value <= 8) {
      setHours(value);
    }
  };

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
        setError('Please fill in all required fields');
        setIsLoading(false);
        return;
      }

      // Validate hours
      if (hours < 0.5 || hours > 8) {
        setError('Consultation duration must be between 0.5 and 8 hours');
        setIsLoading(false);
        return;
      }

      // Create payment intent
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_info: customerInfo,
          hours: hours
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create payment intent');
      }

      const result = await response.json();
      setClientSecret(result.client_secret);
      setStep('payment');
      
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setStep('success');
    setSuccess(true);
  };

  const handlePaymentError = (errorMessage) => {
    setError(errorMessage);
  };

  // Success view
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <svg className="mx-auto h-16 w-16 text-trail-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-espresso-black mb-4">Payment Processing!</h2>
            <p className="text-gray-600 mb-6">
              Your ACH payment for {hours} hour{hours !== 1 ? 's' : ''} (${totalAmount}) is being processed.
            </p>
            <div className="bg-ledger-gold bg-opacity-20 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-espresso-black mb-2">What Happens Next?</h3>
              <ul className="text-sm text-gray-700 space-y-2 text-left">
                <li>• <strong>ACH Processing:</strong> Payment takes 2-5 business days to complete</li>
                <li>• <strong>Confirmation:</strong> You'll receive email confirmation when payment clears</li>
                <li>• <strong>Scheduling:</strong> We'll contact you within 24 hours to schedule your consultation</li>
                <li>• <strong>Session Prep:</strong> We'll send preparation materials before your session</li>
              </ul>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-trust-teal text-white px-6 py-3 rounded-lg hover:bg-trust-teal/90 transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Payment view
  if (step === 'payment' && clientSecret) {
    const appearance = {
      theme: 'stripe',
      variables: {
        colorPrimary: '#147E7E',
      },
    };

    const options = {
      clientSecret,
      appearance,
    };

    return (
      <div className="min-h-screen bg-white">
        {/* Navigation */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <img src="/logo-teal.svg" alt="Audit Trail Mix" className="h-10 w-10 mr-3" />
                <span className="text-xl font-bold text-espresso-black">Audit Trail Mix</span>
              </div>
              <div className="flex space-x-4">
                <a href="/" className="text-espresso-black hover:text-trust-teal transition-colors">Home</a>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-espresso-black mb-4">
              Complete Payment
            </h1>
            <p className="text-xl text-gray-600">
              Secure ACH payment for your consultation
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <Elements options={options} stripe={stripePromise}>
              <PaymentForm 
                customerInfo={customerInfo}
                hours={hours}
                totalAmount={totalAmount}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </Elements>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
                {error}
              </div>
            )}

            <div className="text-center mt-6">
              <button
                onClick={() => setStep('info')}
                className="text-trust-teal hover:text-trust-teal/80 underline"
              >
                ← Back to Information
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src="/logo-teal.svg" alt="Audit Trail Mix" className="h-10 w-10 mr-3" />
              <span className="text-xl font-bold text-espresso-black">Audit Trail Mix</span>
            </div>
            <div className="flex space-x-4">
              <a href="/" className="text-espresso-black hover:text-trust-teal transition-colors">Home</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-espresso-black mb-4">
            Book Your Consultation
          </h1>
        </div>

        {/* Consultation Details */}
        <div className="bg-trust-teal bg-opacity-10 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-espresso-black mb-4">What You'll Get</h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <svg className="h-5 w-5 text-trust-teal mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>One-on-one consultation with our expert</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-trust-teal mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Personalized analysis of your business situation</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-trust-teal mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Strategic recommendations and action plan</span>
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-trust-teal mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Follow-up summary with key insights</span>
            </li>
          </ul>
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-espresso-black mb-6">Your Information</h2>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleInfoSubmit} className="space-y-6">
            {/* Duration Selection */}
            <div>
              <label htmlFor="hours" className="block text-sm font-medium text-gray-700 mb-2">
                Consultation Duration *
              </label>
              <div className="relative">
                <input
                  type="number"
                  id="hours"
                  name="hours"
                  value={hours}
                  onChange={handleHoursChange}
                  min="0.5"
                  max="8"
                  step="0.5"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-trust-teal focus:border-trust-teal pr-16"
                />
                <span className="absolute right-3 top-2 text-gray-500 text-sm">hours</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Minimum 0.5 hours (30 minutes), Maximum 8 hours
              </p>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={customerInfo.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-trust-teal focus:border-trust-teal"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={customerInfo.email}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-trust-teal focus:border-trust-teal"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={customerInfo.phone}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-trust-teal focus:border-trust-teal"
              />
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={customerInfo.company}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-trust-teal focus:border-trust-teal"
              />
            </div>

            <div>
              <label htmlFor="consultation_topic" className="block text-sm font-medium text-gray-700 mb-2">
                What would you like to discuss?
              </label>
              <textarea
                id="consultation_topic"
                name="consultation_topic"
                value={customerInfo.consultation_topic}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-trust-teal focus:border-trust-teal"
                placeholder="Brief description of your consultation needs..."
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-espresso-black mb-2">Consultation Summary</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Duration:</span>
                  <span className="font-medium">{hours} hour{hours !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Rate:</span>
                  <span className="font-medium">$250/hour</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-trust-teal">${totalAmount}</span>
                  </div>
                </div>
              </div>
              <div className="bg-trust-teal bg-opacity-10 rounded-lg p-3 mt-3">
                <p className="text-sm text-gray-700">
                  <strong>Payment Process:</strong> After submitting this form, we'll contact you within 24 hours to schedule your consultation and provide secure payment instructions.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-trust-teal text-white py-3 px-4 rounded-md hover:bg-trust-teal/90 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Payment...' : `Continue to Payment - $${totalAmount}`}
            </button>
          </form>
        </div>

        {/* Security & Process */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>🔒 Secure booking process with professional consultation scheduling</p>
          <p>💰 Payment instructions provided after initial contact</p>
          <p>📞 We'll contact you within 24 hours to finalize scheduling and payment</p>
        </div>
      </div>
    </div>
  );
};

export default ConsultationBooking;