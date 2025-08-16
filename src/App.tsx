import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import StoreLoginPage from "./pages/StoreLoginPage";
import StoreDashboard from "./pages/StoreDashboard";
import DebugPage from "./pages/DebugPage";

import QuickDiagnostic from "./pages/QuickDiagnostic";
import DataDiagnostic from "./pages/DataDiagnostic";
import TestEdgeFunctions from "./pages/TestEdgeFunctions";
import SimpleEdgeTest from "./pages/SimpleEdgeTest";
import ArabicTextTestPage from "./pages/ArabicTextTestPage";
import TestStoreCreator from "./pages/TestStoreCreator";
import TestOrderUpdate from "./pages/TestOrderUpdate";
import TestEdgeFunctionFix from "./pages/TestEdgeFunctionFix";
import DatabaseSetup from "./pages/DatabaseSetup";
import DatabaseDiagnostic from "./pages/DatabaseDiagnostic";
import DatabaseDebugPage from "./pages/DatabaseDebugPage";
import StoreOrderResponseDemo from "./pages/StoreOrderResponseDemo";
import ProductNameDebug from "./pages/ProductNameDebug";
import ProductNameAnalysis from "./pages/ProductNameAnalysis";
import FixProductNames from "./pages/FixProductNames";
import StoreResponseDebug from "./pages/StoreResponseDebug";
import StoreResponseFlowTest from "./pages/StoreResponseFlowTest";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <LanguageProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/home-space-stars94" element={<Index />} />
          <Route path="/admin-login" element={<AdminLoginPage />} />
          <Route path="/admin-aa-smn-justme9003" element={<AdminDashboard />} />
          <Route path="/store-login-space9003" element={<StoreLoginPage />} />
          <Route path="/store-dashboard" element={<StoreDashboard />} />
          <Route path="/debug-data" element={<DebugPage />} />

          <Route path="/test-edge-functions" element={<TestEdgeFunctions />} />
          <Route path="/simple-edge-test" element={<SimpleEdgeTest />} />
          <Route path="/quick-diagnostic" element={<QuickDiagnostic />} />
          <Route path="/data-diagnostic" element={<DataDiagnostic />} />
          <Route path="/arabic-text-test" element={<ArabicTextTestPage />} />
          <Route path="/test-store-creator" element={<TestStoreCreator />} />
          <Route path="/test-order-update" element={<TestOrderUpdate />} />
          <Route path="/test-edge-function-fix" element={<TestEdgeFunctionFix />} />
          <Route path="/database-setup" element={<DatabaseSetup />} />
          <Route path="/database-diagnostic" element={<DatabaseDiagnostic />} />
          <Route path="/database-debug" element={<DatabaseDebugPage />} />
          <Route path="/store-order-response-demo" element={<StoreOrderResponseDemo />} />
          <Route path="/product-name-debug" element={<ProductNameDebug />} />
          <Route path="/product-name-analysis" element={<ProductNameAnalysis />} />
          <Route path="/fix-product-names" element={<FixProductNames />} />
          <Route path="/store-response-debug" element={<StoreResponseDebug />} />
          <Route path="/store-response-flow-test" element={<StoreResponseFlowTest />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
          </BrowserRouter>
        </LanguageProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
