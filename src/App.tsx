import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UploadScreen } from "./pages/UploadScreen";
import { MappingScreen } from "./pages/MappingScreen";
import { ReconciliationScreen } from "./pages/ReconciliationScreen";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { DatabaseProvider } from "./context/DatabaseContext";

const App = () => {
  return (
    <ErrorBoundary>
      <DatabaseProvider>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<UploadScreen />} />
            <Route path="/mapping" element={<MappingScreen />} />
            <Route path="/reconciliation" element={<ReconciliationScreen />} />
          </Routes>
        </MemoryRouter>
      </DatabaseProvider>
    </ErrorBoundary>
  );
};

export default App;

