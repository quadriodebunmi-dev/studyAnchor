import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, DownloadCloud } from "lucide-react";
import AppShell from "../AppShell.jsx";
import MaterialCard from "../../components/MaterialCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { InlineLoader, CardSkeleton } from "../../components/Loader.jsx";
import { Select } from "../../components/FormFields.jsx";
import Button from "../../components/Button.jsx";
import Pager from "../../components/Pager.jsx";
import { getCourse } from "../../services/courseService.js";
import { downloadAllMaterials } from "../../services/materialService.js";
import { useToast } from "../../components/Toast.jsx";

export default function CoursePage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [materials, setMaterials] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [sort, setSort] = useState("date");
  const [page, setPage] = useState(1);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const navigate = useNavigate();
  const showToast = useToast();

  // New course: reset to page 1. Sort change: also reset to page 1.
  useEffect(() => { setPage(1); }, [id, sort]);

  useEffect(() => {
    setMaterials(null);
    getCourse(id, { sort, page }).then((data) => {
      setCourse(data.course);
      setMaterials(data.materials);
      setPagination(data.pagination);
    });
  }, [id, sort, page]);

  async function handleDownloadAll() {
    if (!pagination || pagination.total === 0) { showToast("Nothing to download for this course yet.", "info"); return; }
    setDownloadingAll(true);
    try {
      // Zips every material in the course, not just the current page.
      await downloadAllMaterials({ courseId: id });
      showToast("Your zip download has started.", "success");
    } catch (err) {
      showToast(err.message || "Couldn't download this course's materials.", "error");
    } finally {
      setDownloadingAll(false);
    }
  }

  if (!course) return <AppShell><InlineLoader /></AppShell>;

  return (
    <AppShell>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs mb-3 text-slate-500 dark:text-slate-400"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <p className="text-[11px] font-semibold text-primary">{course.code}</p>
          <h1 className="text-lg font-bold">{course.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{course.department} · {course.level} Level · {course.semester}{course.session && ` · ${course.session} Session`}</p>
        </div>
        <Button variant="outline" className="text-sm" disabled={downloadingAll} onClick={handleDownloadAll}>
          <DownloadCloud className="w-3.5 h-3.5" /> {downloadingAll ? "Preparing zip..." : "Download all"}
        </Button>
      </div>
      <div className="mt-3 flex justify-end">
        <Select className="text-sm" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="date">Sort by date</option>
          <option value="downloads">Sort by most downloaded</option>
        </Select>
      </div>
      {!materials ? (
        <div className="mt-3 grid sm:grid-cols-2 gap-3"><CardSkeleton count={4} /></div>
      ) : (
        <>
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            {materials.map((m) => (
              <MaterialCard key={m._id} material={m} onOpen={() => navigate(`/material/${m._id}`)} />
            ))}
            {materials.length === 0 && <EmptyState icon={<FileText className="w-6 h-6" />} title="No materials yet" message="Nothing has been uploaded for this course." />}
          </div>
          <Pager pagination={pagination} onPageChange={setPage} />
        </>
      )}
    </AppShell>
  );
}