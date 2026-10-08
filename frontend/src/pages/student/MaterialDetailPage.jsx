import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Eye, EyeOff, Bookmark, BookmarkCheck, Sparkles, Loader2, Flag, X, Copy, Check, BookOpenText, Bot, Lock, ClipboardCheck } from "lucide-react";
import AppShell from "../AppShell.jsx";
import Button from "../../components/Button.jsx";
import Badge from "../../components/Badge.jsx";
import { InlineLoader } from "../../components/Loader.jsx";
import { getMaterial, downloadMaterial, triggerFileDownload, toggleBookmark, reportMaterial } from "../../services/materialService.js";
import { generateQuiz, generateTheoryQuiz } from "../../services/quizService.js";
import { useToast } from "../../components/Toast.jsx";
import { markMaterialOpened } from "../../hooks/useStudyProgress.js";

const card = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";
const muted = "text-slate-500 dark:text-slate-400";
const REPORT_REASONS = ["Wrong or unrelated content", "File won't open or is broken", "Inappropriate or offensive", "Duplicate of another material", "Other"];

// Office formats (docx/pptx/xlsx) can't be rendered natively by a browser,
// so they're embedded through Google's public document viewer. pdf and
// images render directly.
function OFFICE_VIEWER_URL(fileUrl) {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
}

function FilePreview({ material }) {
  const frame = "w-full h-[calc(100dvh-8rem)] sm:h-[70vh] rounded-lg border border-slate-200 dark:border-slate-800";
  if (material.fileType === "image") {
    return <img src={material.fileUrl} alt={material.title} className="mx-auto max-h-[calc(100dvh-8rem)] w-full rounded-lg bg-slate-100 object-contain dark:bg-slate-800 sm:max-h-[70vh]" />;
  }
  const src = material.fileType === "pdf" ? material.fileUrl : OFFICE_VIEWER_URL(material.fileUrl);
  return <iframe title={material.title} src={src} className={frame} />;
}

// Full-screen on phones, centred dialog on larger screens. Closes on Escape
// or a tap outside, and stops the page behind from scrolling.
function Modal({ title, onClose, wide, children }) {
  const panel = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex h-full w-full flex-col bg-white outline-none dark:bg-slate-900 sm:h-auto sm:max-h-[92vh] sm:rounded-xl ${wide ? "sm:max-w-3xl" : "sm:max-w-sm"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-2.5 dark:border-slate-800">
          <p className="truncate text-sm font-semibold">{title}</p>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-3.5">{children}</div>
      </div>
    </div>
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div>
      <p className={`mb-1 text-[11px] ${muted}`}>{label}</p>
      <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}
            className={`min-w-[2.25rem] rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${value === o ? "bg-white text-primary shadow-sm dark:bg-slate-900" : muted}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// Copy-to-clipboard button for theory questions and answers.
function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — fail silently, nothing to recover from here.
    }
  }
  return (
    <button onClick={handleCopy} title={`Copy ${label}`} className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-medium ${muted} hover:bg-slate-100 dark:hover:bg-slate-800`}>
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? "Copied" : `Copy ${label}`}</span>
    </button>
  );
}

function formatAllForCopy(questions) {
  return questions.map((q, i) => `Q${i + 1}. ${q.question}\nA. ${q.answer}`).join("\n\n");
}

function ReportForm({ onSubmit, onCancel }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const needsDetails = reason === "Other";
  const ready = reason && (!needsDetails || details.trim());

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    await onSubmit(details.trim() ? `${reason}: ${details.trim()}` : reason);
    setSending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className={`text-xs ${muted}`}>What's the issue with this material?</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reason">
        {REPORT_REASONS.map((r) => (
          <button
            key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}
            className={`rounded-full border px-2.5 py-1 text-xs ${reason === r ? "border-primary bg-primary/10 text-primary" : "border-slate-200 dark:border-slate-700"}`}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        value={details} onChange={(e) => setDetails(e.target.value)} rows={3}
        placeholder={needsDetails ? "Tell us what's wrong" : "More details (optional)"}
        aria-label="More details"
        className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs dark:border-slate-700"
      />
      <div className="flex justify-end gap-2">
        <Button className="text-sm" type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button className="text-sm" type="submit" disabled={!ready || sending}>{sending ? "Sending..." : "Send report"}</Button>
      </div>
    </form>
  );
}

export default function MaterialDetailPage() {
  const { id } = useParams();
  const [material, setMaterial] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState("Medium");
  const [genLoading, setGenLoading] = useState(false);
  const [theoryLoading, setTheoryLoading] = useState(false);
  const [theoryQuestions, setTheoryQuestions] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const navigate = useNavigate();
  const showToast = useToast();

  useEffect(() => {
    let cancelled = false;
    getMaterial(id)
      .then((m) => { if (!cancelled) { setMaterial(m); setBookmarked(Boolean(m?.isBookmarked)); } })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    // Counts toward the "opened so far" figure and the course progress bars.
    markMaterialOpened(id);
    return () => { cancelled = true; };
  }, [id]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { fileUrl, fileName } = await downloadMaterial(id);
      await triggerFileDownload(fileUrl, fileName);
      showToast("Download started", "success");
    } catch (err) {
      showToast(err.message || "Couldn't download this file.", "error");
    } finally {
      setDownloading(false);
    }
  }

  async function handleBookmark() {
    try {
      const isBookmarked = await toggleBookmark(id);
      setBookmarked(isBookmarked);
      showToast(isBookmarked ? "Bookmark saved" : "Removed bookmark", "success");
    } catch (err) {
      showToast(err.message || "Couldn't update your bookmark.", "error");
    }
  }

  async function handleReport(reason) {
    try {
      await reportMaterial(id, reason);
      setReportOpen(false);
      showToast("Thanks — our team will review this.", "success");
    } catch (err) {
      showToast(err.message || "Couldn't send your report. Please try again.", "error");
    }
  }

  async function handleGenerateQuiz() {
    setGenLoading(true);
    try {
      const quiz = await generateQuiz(id, numQuestions, difficulty);
      navigate(`/quiz/${quiz._id}`, { state: { quiz } });
    } catch (err) {
      showToast(err.message || "Couldn't generate quiz", "error");
    } finally {
      setGenLoading(false);
    }
  }

  async function handleGenerateTheory() {
    setTheoryLoading(true);
    try {
      const quiz = await generateTheoryQuiz(id, numQuestions, difficulty);
      setTheoryQuestions(quiz.questions);
      setRevealed({});
    } catch (err) {
      showToast(err.message || "Couldn't generate theory questions", "error");
    } finally {
      setTheoryLoading(false);
    }
  }

  if (loadFailed) {
    return (
      <AppShell>
        <p className={`text-sm ${muted}`}>We couldn't load this material. It may have been removed.</p>
        <Button className="mt-3 text-sm" onClick={() => navigate(-1)}>Go back</Button>
      </AppShell>
    );
  }
  if (!material) return <AppShell><InlineLoader /></AppShell>;

  const busy = genLoading || theoryLoading;
  const allRevealed = theoryQuestions && theoryQuestions.every((_, i) => revealed[i]);
  const needsOfficeFallback = !["image", "pdf"].includes(material.fileType);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <button onClick={() => navigate(-1)} className={`-ml-2 mb-2.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-xs ${muted} hover:bg-slate-100 dark:hover:bg-slate-800`}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        {/* MATERIAL */}
        <section className={`${card} p-3.5 sm:p-4`}>
          <div className="flex flex-wrap items-center gap-1.5">
            {material.courseId?.code && <span className="text-[11px] font-semibold text-primary">{material.courseId.code}</span>}
            {material.fileType && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase dark:bg-slate-800">{material.fileType}</span>}
            {material.visibility === "private" && <Badge tone="violet"><Lock className="h-3 w-3" /> Only you can see this</Badge>}
            {material.visibility !== "private" && material.status === "pending" && <Badge tone="amber">Awaiting review</Badge>}
            {material.visibility !== "private" && material.status === "rejected" && <Badge tone="red">Rejected</Badge>}
          </div>
          <h1 className="mt-1.5 text-base font-bold leading-snug sm:text-lg">{material.title}</h1>
          {material.description && <p className={`mt-1.5 max-w-2xl text-xs leading-relaxed ${muted}`}>{material.description}</p>}
          <p className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] ${muted}`}>
            <span>Uploaded by {material.uploadedBy?.name}</span>
            <span>{new Date(material.createdAt).toLocaleDateString()}</span>
            {material.size && <span>{material.size}</span>}
            <span>{material.downloads} downloads</span>
          </p>

          <div className="mt-3.5 flex gap-2">
            <Button className="flex-1 text-sm sm:flex-none" disabled={downloading} onClick={handleDownload}>
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {downloading ? "Preparing..." : "Download"}
            </Button>
            <Button className="flex-1 text-sm sm:flex-none" variant="outline" onClick={() => setPreviewOpen(true)}><Eye className="h-3.5 w-3.5" /> Preview</Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
            <Button className="text-sm" variant="outline" onClick={handleBookmark} aria-pressed={bookmarked}>
              {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> : <Bookmark className="h-3.5 w-3.5" />} {bookmarked ? "Bookmarked" : "Bookmark"}
            </Button>
            <Button className="text-sm" variant="outline" onClick={() => navigate(`/assistant?material=${id}`)}><Bot className="h-3.5 w-3.5" /> Ask AI about this</Button>
            <button onClick={() => setReportOpen(true)} className={`ml-auto inline-flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] ${muted} hover:bg-slate-100 dark:hover:bg-slate-800`}>
              <Flag className="h-3 w-3" /> Report an issue
            </button>
          </div>
        </section>

        {/* STUDY TOOLS */}
        <section className={`${card} mt-4 p-3.5 sm:p-4`}>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-secondary-purple" />
            <h2 className="text-sm font-semibold">Practise with this material</h2>
          </div>
          <p className={`mt-1 text-xs ${muted}`}>Questions are generated from the content of this file.</p>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
            <Segmented label="Number of questions" options={[3, 5, 8, 10,15,20]} value={numQuestions} onChange={setNumQuestions} />
            <Segmented label="Difficulty" options={["Easy", "Medium", "Hard"]} value={difficulty} onChange={setDifficulty} />
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="flex items-center gap-1.5 text-sm font-medium"><ClipboardCheck className="h-3.5 w-3.5 text-primary" /> Multiple-choice quiz</p>
              <p className={`mt-1 text-xs ${muted}`}>Answer, get scored, then review what you missed.</p>
              <Button className="mt-2.5 w-full text-sm" variant="secondary" disabled={busy} onClick={handleGenerateQuiz}>
                {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {genLoading ? "Generating..." : "Start quiz"}
              </Button>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="flex items-center gap-1.5 text-sm font-medium"><BookOpenText className="h-3.5 w-3.5 text-primary" /> Theory questions</p>
              <p className={`mt-1 text-xs ${muted}`}>Open-ended questions with model answers you can reveal.</p>
              <Button className="mt-2.5 w-full text-sm" variant="outline" disabled={busy} onClick={handleGenerateTheory}>
                {theoryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpenText className="h-3.5 w-3.5" />} {theoryLoading ? "Generating..." : "Generate questions"}
              </Button>
            </div>
          </div>

          {theoryQuestions && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Theory questions</h3>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setRevealed(allRevealed ? {} : Object.fromEntries(theoryQuestions.map((_, i) => [i, true])))}>
                    {allRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {allRevealed ? "Hide answers" : "Show all answers"}
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={async () => {
                    try { await navigator.clipboard.writeText(formatAllForCopy(theoryQuestions)); showToast("Copied all questions", "success"); }
                    catch { showToast("Couldn't copy — your browser blocked clipboard access.", "error"); }
                  }}>
                    <Copy className="h-3 w-3" /> Copy all
                  </Button>
                </div>
              </div>
              <p className={`mt-1 text-xs ${muted}`}>Try answering in your head first, then reveal the model answer.</p>

              <div className="mt-3 space-y-2.5">
                {theoryQuestions.map((q, idx) => {
                  const open = Boolean(revealed[idx]);
                  return (
                    <div key={idx} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      {/* Two columns: number | content. Question, answer and actions all live
                          in the content column with the same line height, so their left and
                          right edges match. No padded answer box, no side buttons. */}
                      <div className="grid grid-cols-[1.1rem_minmax(0,1fr)] gap-x-1.5 gap-y-2 text-xs leading-5">
                        <span className="font-semibold text-primary">{idx + 1}.</span>
                        <p className="break-words font-medium">{q.question}</p>

                        {open && (
                          <>
                            <span aria-hidden="true" />
                            <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
                              <p className={`text-[11px] font-semibold ${muted}`}>Answer</p>
                              <p className="break-words text-slate-600 dark:text-slate-300">{q.answer}</p>
                            </div>
                          </>
                        )}

                        <span aria-hidden="true" />
                        <div className="-ml-1.5 flex flex-wrap items-center gap-x-1">
                          <button
                            onClick={() => setRevealed((r) => ({ ...r, [idx]: !open }))}
                            aria-expanded={open}
                            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                          >
                            {open ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {open ? "Hide answer" : "Show answer"}
                          </button>
                          <CopyButton text={q.question} label="question" />
                          {open && <CopyButton text={q.answer} label="answer" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {previewOpen && (
        <Modal title={material.title} wide onClose={() => setPreviewOpen(false)}>
          <FilePreview material={material} />
          {needsOfficeFallback && (
            <p className={`mt-2.5 text-xs ${muted}`}>
              Preview not loading? <button onClick={handleDownload} className="font-medium text-primary hover:underline">Download the file instead</button>.
            </p>
          )}
        </Modal>
      )}

      {reportOpen && (
        <Modal title="Report an issue" onClose={() => setReportOpen(false)}>
          <ReportForm onSubmit={handleReport} onCancel={() => setReportOpen(false)} />
        </Modal>
      )}
    </AppShell>
  );
}