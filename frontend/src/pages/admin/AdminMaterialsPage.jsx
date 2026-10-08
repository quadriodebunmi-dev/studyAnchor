import React, { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import AppShell from "../AppShell.jsx";
import { useAdminNavItems } from "./AdminDashboard.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import Pager from "../../components/Pager.jsx";
import { fileTypeLabel } from "../../components/MaterialCard.jsx";
import { listAllMaterials, removeMaterial } from "../../services/adminService.js";
import { useToast } from "../../components/Toast.jsx";

export default function AdminMaterialsPage() {
  const navItems = useAdminNavItems();
  const [materials, setMaterials] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const showToast = useToast();

  function refresh(p = page) {
    listAllMaterials({ page: p }).then((res) => { setMaterials(res.materials); setPagination(res.pagination); });
  }
  useEffect(() => { setMaterials(null); refresh(page); }, [page]);

  async function handleRemove(id) {
    await removeMaterial(id);
    showToast("Material removed", "success");
    refresh(page);
  }

  if (!materials) return <AppShell sidebarItems={navItems}><InlineLoader /></AppShell>;

  return (
    <AppShell sidebarItems={navItems}>
      <h1 className="text-2xl font-bold">All Materials</h1>
      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        {materials.map((m) => (
          <div key={m._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{m.title} <span className="text-xs font-normal text-slate-400">({fileTypeLabel(m.fileType)})</span></p>
              <button onClick={() => handleRemove(m._id)}><Trash2 className="w-4 h-4 text-danger" /></button>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">By {m.uploadedBy?.name} · {m.courseId?.code} · {m.downloads} downloads</p>
          </div>
        ))}
      </div>
      <Pager pagination={pagination} onPageChange={setPage} />
    </AppShell>
  );
}
