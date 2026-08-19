import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import App from "./App";
import Quote from "./pages/Quote";
import Apply from "./pages/Apply";
import Policies from "./pages/Policies";
import "./styles.css";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/quote" replace /> },
      { path: "quote", element: <Quote /> },
      { path: "apply", element: <Apply /> },
      { path: "policies", element: <Policies /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
