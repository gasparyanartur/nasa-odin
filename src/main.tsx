import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './styles.css';
import './field/field.css';
import './environment/environment.css';
import './contexts.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
