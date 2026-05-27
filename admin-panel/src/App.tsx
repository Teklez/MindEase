import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Stats from "./pages/Stats";
import Users from "./pages/Users";
import Groups from "./pages/Groups";
import Resources from "./pages/Resources";
import Assessments from "./pages/Assessments";
import Badges from "./pages/Badges";
import { getToken } from "./lib/api";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAdmin>
            <Layout />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="/stats" replace />} />
        <Route path="stats" element={<Stats />} />
        <Route path="users" element={<Users />} />
        <Route path="groups" element={<Groups />} />
        <Route path="resources" element={<Resources />} />
        <Route path="assessments" element={<Assessments />} />
        <Route path="badges" element={<Badges />} />
      </Route>
    </Routes>
  );
}
