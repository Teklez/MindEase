import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api, clearToken, type Me } from "../lib/api";
import { IconStats, IconUsers, IconGroups, IconBook, IconClipboard, IconAward } from "./Icons";

export default function Layout() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api.me().then((res) => {
      if (res.ok) {
        if (!res.data.is_admin) {
          clearToken();
          navigate("/login");
          return;
        }
        setMe(res.data);
      }
    });
  }, [navigate]);

  function handleLogout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>MindEase</h1>
          <span>Admin Panel</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/stats" className={({ isActive }) => isActive ? "active" : ""}>
            <IconStats /> Overview
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => isActive ? "active" : ""}>
            <IconUsers /> Users
          </NavLink>
          <NavLink to="/groups" className={({ isActive }) => isActive ? "active" : ""}>
            <IconGroups /> Groups
          </NavLink>
          <NavLink to="/resources" className={({ isActive }) => isActive ? "active" : ""}>
            <IconBook /> Resources
          </NavLink>
          <NavLink to="/assessments" className={({ isActive }) => isActive ? "active" : ""}>
            <IconClipboard /> Assessments
          </NavLink>
          <NavLink to="/badges" className={({ isActive }) => isActive ? "active" : ""}>
            <IconAward /> Badges
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          {me && (
            <div className="sidebar-user">
              <div className="name">{me.display_name}</div>
              <div>{me.email}</div>
            </div>
          )}
          <button onClick={handleLogout}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
