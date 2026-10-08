import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import MobileTabBar from "../components/MobileTabBar.jsx";
import MaterialCard from "../components/MaterialCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { CardSkeleton } from "../components/Loader.jsx";
import PwaPrompts, { OfflineBanner } from "../components/PwaPrompts.jsx";
import Pager from "../components/Pager.jsx";
import { Search } from "lucide-react";
import { searchMaterials, getPendingMaterials } from "../services/materialService.js";
import { useAuth } from "../context/AuthContext.jsx";
import { navItemsFor } from "../config/navItems.jsx";

// Course Reps get a badge on "Student Approvals" everywhere in the app, not
// just on the dashboard. Only fetched when AppShell derives the nav itself.
function useRepPendingCount(user, enabled) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled || user?.role !== "rep" || user.repType === "class") return;
    let live = true;
    getPendingMaterials({ limit: 1 }).then((res) => live && setCount(res.pagination.total)).catch(() => {});
    return () => { live = false; };
  }, [enabled, user?._id, user?.role, user?.repType]);
  return count;
}

// Shared shell for every logged-in role: offline banner, top nav with global
// search, role-specific sidebar (bottom tabs on mobile) and the PWA surfaces.
// `sidebarItems` is optional: when omitted, the nav is derived from the
// signed-in user's role, so pages shared by students and reps (Explore,
// Bookmarks, AI Assistant...) show the right menu for whoever opened them.
export default function AppShell({ sidebarItems: itemsProp, children }) {
  const { user } = useAuth();
  const pendingCount = useRepPendingCount(user, !itemsProp);
  const sidebarItems = itemsProp || navItemsFor(user, pendingCount);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const [resultsPagination, setResultsPagination] = useState(null);
  const [resultsPage, setResultsPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { setResultsPage(1); }, [search]);

  useEffect(() => {
    if (!search.trim()) {
      setResults(null);
      setResultsPagination(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      searchMaterials(search, { page: resultsPage })
        .then((res) => { setResults(res.materials); setResultsPagination(res.pagination); })
        .catch(() => { setResults([]); setResultsPagination(null); })
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [search, resultsPage]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <OfflineBanner />
      <Navbar search={search} setSearch={setSearch} />

      <div className="mx-auto flex max-w-7xl">
        {sidebarItems && <Sidebar items={sidebarItems} />}
        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
          {search.trim() ? (
            <div className="animate-rise-in">
              <p className="mb-4 text-sm lv-meta">
                {loading ? "Searching..." : `${resultsPagination?.total ?? results?.length ?? 0} result(s) for "${search}"`}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {loading ? (
                  <CardSkeleton count={4} />
                ) : (
                  <>
                    {results?.map((m) => (
                      <MaterialCard
                        key={m._id}
                        material={m}
                        onOpen={() => {
                          setSearch("");
                          navigate(`/material/${m._id}`);
                        }}
                      />
                    ))}
                    {results?.length === 0 && (
                      <EmptyState
                        icon={<Search className="h-7 w-7" />}
                        title="No matches"
                        message="Try the course code instead of the full title, or check a different session."
                      />
                    )}
                  </>
                )}
              </div>
              {!loading && <Pager pagination={resultsPagination} onPageChange={setResultsPage} />}
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {sidebarItems && <MobileTabBar items={sidebarItems} />}
      <PwaPrompts />
    </div>
  );
}
