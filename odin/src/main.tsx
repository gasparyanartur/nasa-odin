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
import './marswalk/marswalk.css';
import TourProvider from './tour/Tour';
import './tour/tour.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><TourProvider><App /></TourProvider></React.StrictMode>);
