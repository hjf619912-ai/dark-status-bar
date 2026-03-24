import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import '@phosphor-icons/fill/style.css';
import '@phosphor-icons/bold/style.css';
import '@phosphor-icons/regular/style.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
