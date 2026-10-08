import React from "react";
import {
  FileText,
  Presentation,
  FileSpreadsheet,
  Image as ImageIcon,
  Bookmark,
  BookmarkCheck,
  Download,
  Sparkles,
} from "lucide-react";
import Badge from "./Badge.jsx";

const ICONS = {
  pdf: FileText,
  pptx: Presentation,
  docx: FileText,
  xlsx: FileSpreadsheet,
  image: ImageIcon,
};

export const fileTypeLabel = (type) =>
  ({ pdf: "PDF", pptx: "PowerPoint", docx: "Word", xlsx: "Excel", image: "Image" }[type] || type);

// Each file type gets its own tinted tile, all drawn from the navy family so
// the grid stays calm while still being scannable by format.
const TILE = {
  pdf: "bg-danger/10 text-danger",
  pptx: "bg-warning/10 text-warning",
  docx: "bg-primary/10 text-primary",
  xlsx: "bg-success/10 text-success",
  image: "bg-secondary-purple/10 text-secondary-purple",
};

export default function MaterialCard({ material, onOpen, isBookmarked, foreign }) {
  const Icon = ICONS[material.fileType] || FileText;
  const hasQuiz = material.quizzesGenerated > 15;

  return (
    <button
      onClick={onOpen}
      className="lv-card-interactive group w-full p-4 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`shrink-0 rounded-xl p-2.5 ${TILE[material.fileType] || TILE.docx}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display font-semibold leading-snug text-night group-hover:text-primary dark:text-slate-100">
              {material.title}
            </p>
            <p className="mt-1 line-clamp-2 text-sm lv-meta">{material.description}</p>
          </div>
        </div>
        <span className="shrink-0">
          {isBookmarked ? (
            <BookmarkCheck className="h-5 w-5 text-accent" />
          ) : (
            <Bookmark className="h-5 w-5 text-slate-400 transition-colors group-hover:text-accent" />
          )}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="slate">{fileTypeLabel(material.fileType)}</Badge>
        {foreign && <Badge tone="violet">Other department</Badge>}
        {material.visibility === "private" && <Badge tone="violet">Private</Badge>}
        {material.status === "pending" && <Badge tone="amber">Awaiting review</Badge>}
        {material.status === "rejected" && <Badge tone="red">Rejected</Badge>}
        {hasQuiz && (
          <Badge tone="accent">
            <Sparkles className="h-3 w-3" /> Quiz ready
          </Badge>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs lv-meta dark:border-slate-800">
        <span className="truncate">{material.uploadedBy?.name || material.uploadedBy}</span>
        <span>{new Date(material.createdAt || material.date).toLocaleDateString()}</span>
        {material.size && <span>{material.size}</span>}
        <span className="ml-auto inline-flex items-center gap-1">
          <Download className="h-3 w-3" />
          {material.downloads}
        </span>
      </div>
    </button>
  );
}
