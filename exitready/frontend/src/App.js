import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AuditTrailMixLanding from "./components/AuditTrailMixLanding";
import LandingPage from "./components/LandingPage";
import CalculatorChoice from "./components/CalculatorChoice";
import SimpleCalculator from "./components/SimpleCalculator";
import DetailedCalculator from "./components/DetailedCalculator";
import AdminDashboard from "./components/AdminDashboard";
import PDFPreview from "./components/PDFPreview";
import ContentManager from "./components/ContentManager";
import UserAuth from "./components/UserAuth";
import UserDashboard from "./components/UserDashboard";
import QOEChoice from "./components/QOEChoice";
import QOEBasic from "./components/QOEBasic";
import QOEComprehensive from "./components/QOEComprehensive";
import QOESettings from "./components/QOESettings";
import RedFlagsLeadMagnet from "./components/RedFlagsLeadMagnet";
import AdminMain from "./components/AdminMain";
import ScrollToTop from "./components/ScrollToTop";
import Tools from "./components/Tools";
import Assessment from "./components/Assessment";
import ValueCalculator from "./components/ValueCalculator";
import ValueCalculatorAdmin from "./components/ValueCalculatorAdmin";
import TestComponent from "./components/TestComponent";
import ConsultationBooking from "./components/ConsultationBooking";

function App() {
  return (
    <div className="App">
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<AuditTrailMixLanding />} />
          <Route path="/exitready" element={<LandingPage />} />
          <Route path="/auth" element={<UserAuth />} />
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/calculator" element={<CalculatorChoice />} />
          <Route path="/calculator/simple" element={<SimpleCalculator />} />
          <Route path="/calculator/detailed" element={<DetailedCalculator />} />
          <Route path="/value-calculator" element={<ValueCalculator />} />
          <Route path="/consultation" element={<ConsultationBooking />} />
          <Route path="/qoe" element={<QOEChoice />} />
          <Route path="/qoe/basic" element={<QOEBasic />} />
          <Route path="/qoe/comprehensive" element={<QOEComprehensive />} />
          <Route path="/qoe/settings" element={<QOESettings />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/red-flags-assessment" element={<RedFlagsLeadMagnet />} />
          <Route path="/admin" element={<AdminMain />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/value-calculator" element={<ValueCalculatorAdmin />} />
          <Route path="/admin/content" element={<ContentManager />} />
          <Route path="/pdf-preview" element={<PDFPreview />} />
          <Route path="*" element={<div style={{color: 'white', padding: '20px'}}>Route: {window.location.pathname} - Component not found</div>} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;