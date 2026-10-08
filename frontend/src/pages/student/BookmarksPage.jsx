import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark } from "lucide-react";
import AppShell from "../AppShell.jsx";
import MaterialCard from "../../components/MaterialCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { CardSkeleton } from "../../components/Loader.jsx";
import Pager from "../../components/Pager.jsx";
import { myBookmarks } from "../../services/materialService.js";

export default function BookmarksPage() {
  const [materials, setMaterials] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    setMaterials(null);
    myBookmarks({ page }).then((res) => { setMaterials(res.materials); setPagination(res.pagination); });
  }, [page]);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Bookmarks</h1>
      {!materials ? (
        <div className="mt-6 grid sm:grid-cols-2 gap-4"><CardSkeleton count={4} /></div>
      ) : (
        <>
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {materials.map((m) => (
              <MaterialCard key={m._id} material={m} isBookmarked onOpen={() => navigate(`/material/${m._id}`)} />
            ))}
            {materials.length === 0 && <EmptyState icon={<Bookmark className="w-8 h-8" />} title="No bookmarks yet" message="Save materials for quick access later." />}
          </div>
          <Pager pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </AppShell>
  );
}
