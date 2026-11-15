import React from 'react';
import { createRoot } from 'react-dom/client';
import './design/tokens.css';
import App from './App';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './styles.css';
import './field/field.css';
import './environment/environment.css';
import './contexts.css';
import './design/skin.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
