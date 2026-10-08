import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';
// Keep the shared editor overrides as their own Vite module so edits trigger HMR.
import './styles/meal-editor-refresh.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
