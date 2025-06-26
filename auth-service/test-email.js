/**
 * Test script for email functionality using Brevo
 * Run this to test the email sending capabilities
 */

const testEmailEndpoint = async () => {
  const domain = 'example.com'; // Replace with your actual domain
  const authServiceUrl = `https://${domain}/auth/email/send`;
  
  const testData = {
    email: 'test@example.com', // Replace with your test email
    subject: 'Test Email from Auth Service (Brevo)',
    message: 'This is a test email to verify the Brevo email functionality is working correctly.'
  };

  try {
    console.log('Testing Brevo email endpoint...');
    console.log('URL:', authServiceUrl);
    console.log('Data:', testData);

    const response = await fetch(authServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response body:', result);

    if (response.ok) {
      console.log('✅ Brevo email test successful!');
    } else {
      console.log('❌ Brevo email test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing Brevo email endpoint:', error);
  }
};

const testSignupWithEmail = async () => {
  const domain = 'example.com'; // Replace with your actual domain
  const authServiceUrl = `https://${domain}/auth/signup`;
  
  const testData = {
    email: 'test-signup@example.com', // Replace with your test email
    password: 'testpassword123',
    firstName: 'Test',
    lastName: 'User'
  };

  try {
    console.log('Testing signup with email...');
    console.log('URL:', authServiceUrl);
    console.log('Data:', { ...testData, password: '[HIDDEN]' });

    const response = await fetch(authServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response body:', result);

    if (response.ok) {
      console.log('✅ Signup with email test successful!');
      console.log('Email sent:', result.emailSent);
      if (result.emailError) {
        console.log('Email error:', result.emailError);
      }
    } else {
      console.log('❌ Signup with email test failed!');
    }
  } catch (error) {
    console.error('❌ Error testing signup with email:', error);
  }
};

// Run tests if this script is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  console.log('Running email tests...');
  
  // Uncomment the test you want to run:
  testEmailEndpoint();
  // testSignupWithEmail();
  
  console.log('Tests completed. Uncomment the test functions above to run them.');
} else {
  // Browser environment
  console.log('Email test functions available:');
  console.log('- testEmailEndpoint()');
  console.log('- testSignupWithEmail()');
} 