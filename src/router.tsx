import Dashboard from "./pages/Dashboard";
import ScoreEntry from "./pages/ScoreEntry";
import Students from "./pages/Students";
import Assessments from "./pages/Assessments";
import StudentAnalysis from "./pages/StudentAnalysis";
import ClassAnalysis from "./pages/ClassAnalysis";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

export const routers = [
  {
    path: "/",
    name: "dashboard",
    element: <Dashboard />,
  },
  {
    path: "/scores",
    name: "scores",
    element: <ScoreEntry />,
  },
  {
    path: "/students",
    name: "students",
    element: <Students />,
  },
  {
    path: "/assessments",
    name: "assessments",
    element: <Assessments />,
  },
  {
    path: "/analysis",
    name: "student-analysis",
    element: <StudentAnalysis />,
  },
  {
    path: "/class",
    name: "class-analysis",
    element: <ClassAnalysis />,
  },
  {
    path: "/reports",
    name: "reports",
    element: <Reports />,
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
