import React from 'react'; // Import React library
import { createRoot } from 'react-dom/client'; // Import createRoot from react-dom/client for rendering
import { Provider } from 'react-redux'; // Import Provider from react-redux to connect React with Redux
import store from './store'; // Import the Redux store
import App from './App.js'; // Import the main App component

const container = document.getElementById('root'); // Get the root element from the HTML
const root = createRoot(container); // Create a root for React rendering

// Render the App component wrapped with Provider to make the Redux store available to the entire app
root.render(
  <Provider store={store}>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </Provider>
);