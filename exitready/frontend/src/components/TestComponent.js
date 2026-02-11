import React from 'react';
import { Link } from 'react-router-dom';

const TestComponent = () => {
  return (
    <div style={{ padding: '20px', color: 'white', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <h1>Test Component - Route is Working!</h1>
      <p>This is a simple test component to verify routing is working.</p>
      <p>Current URL: {window.location.pathname}</p>
      <Link to="/" style={{ color: 'lightblue' }}>← Back to Home</Link>
    </div>
  );
};

export default TestComponent;