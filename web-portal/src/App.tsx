import { NavLink, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          AAA Life <span>QuickTerm</span>
        </div>
        <nav className="nav">
          <NavLink to="/quote">Get a Quote</NavLink>
          <NavLink to="/apply">Apply</NavLink>
          <NavLink to="/policies">My Policies</NavLink>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        Illustrative rates only — not a real insurance product.
      </footer>
    </div>
  );
}
