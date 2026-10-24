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
  const courseCode = material.courseId?.code || material.course?.code;
  const uploader = material.uploadedBy?.name || (typeof material.uploadedBy === "string" ? material.uploadedBy : "");
  const when = material.createdAt || material.date;

  return (
    <button onClick={onOpen} className="lv-card-interactive group flex w-full items-start gap-3 p-3 text-left">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${TILE[material.fileType] || TILE.docx}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-snug text-night group-hover:text-primary dark:text-slate-100 line-clamp-2 break-words">
          {material.title}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] lv-meta">
          <span className="font-medium">{fileTypeLabel(material.fileType)}</span>
          {courseCode && <span>· {courseCode}</span>}
          {uploader && <span className="max-w-[9rem] truncate">· {uploader}</span>}
          {when && <span>· {new Date(when).toLocaleDateString()}</span>}
          {material.size && <span>· {material.size}</span>}
          <span className="inline-flex items-center gap-0.5">
            · <Download className="h-3 w-3" /> {material.downloads}
          </span>
        </span>

        {(foreign || material.visibility === "private" || material.status === "pending" || material.status === "rejected" || hasQuiz) && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {foreign && <Badge tone="violet">Other department</Badge>}
            {material.visibility === "private" && <Badge tone="violet">Private</Badge>}
            {material.status === "pending" && <Badge tone="amber">Awaiting review</Badge>}
            {material.status === "rejected" && <Badge tone="red">Rejected</Badge>}
            {hasQuiz && (
              <Badge tone="accent">
                <Sparkles className="h-3 w-3" /> Quiz ready
              </Badge>
            )}
          </span>
        )}
      </span>

      <span className="shrink-0 pt-0.5">
        {isBookmarked ? (
          <BookmarkCheck className="h-[18px] w-[18px] text-accent" />
        ) : (
          <Bookmark className="h-[18px] w-[18px] text-slate-300 transition-colors group-hover:text-accent dark:text-slate-600" />
        )}
      </span>
    </button>
  );
}
