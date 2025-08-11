import React from 'react';
import { createRoot } from 'react-dom/client';
import { loadState } from './state';
import { PromptEditor } from './components/PromptEditor';
import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => {
  const [state, setState] = React.useState(loadState());
  return <PromptEditor state={state} setState={setState} />;
};

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
