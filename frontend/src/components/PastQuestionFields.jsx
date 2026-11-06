import React from "react";
import { BookOpen, FileQuestion } from "lucide-react";
import { Input, Select } from "./FormFields.jsx";

export const EXAM_TYPES = [
  ["exam", "Exam"], ["test", "Test / mid-semester"], ["quiz", "Quiz"], ["assignment", "Assignment"], ["other", "Other"],
];
export const examTypeLabel = (v) => EXAM_TYPES.find(([k]) => k === v)?.[1] || "";

export const emptyKindForm = { kind: "material", examYear: "", examType: "exam" };

// Adds the "what is this?" choice to an upload form: study material, or a past
// question (an old exam / test paper). `value` is { kind, examYear, examType };
// `onChange(patch)` receives only what changed. Works the same for students and reps.
export default function PastQuestionFields({ value, onChange, disabled = false }) {
  const year = new Date().getFullYear();
  const options = [
    { kind: "material", icon: BookOpen, title: "Study material", text: "Notes, slides, textbooks." },
    { kind: "past_question", icon: FileQuestion, title: "Past question", text: "An old exam or test paper." },
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="What are you uploading?">
        {options.map(({ kind, icon: Icon, title, text }) => (
          <button
            type="button" key={kind} role="radio" aria-checked={value.kind === kind} disabled={disabled}
            onClick={() => onChange({ kind })}
            className={`rounded-xl border p-3 text-left transition-colors disabled:opacity-60 ${value.kind === kind ? "border-accent bg-accent/10" : "border-slate-200 hover:border-slate-300 dark:border-slate-700"}`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" /> {title}</span>
            <span className="mt-1 block text-xs lv-meta">{text}</span>
          </button>
        ))}
      </div>
      {value.kind === "past_question" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="number" inputMode="numeric" min={1950} max={year + 1} placeholder={`Year it was set, e.g. ${year - 1}`}
            value={value.examYear} onChange={(e) => onChange({ examYear: e.target.value })} aria-label="Exam year" disabled={disabled}
          />
          <Select value={value.examType} onChange={(e) => onChange({ examType: e.target.value })} aria-label="Paper type" disabled={disabled}>
            {EXAM_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </div>
      )}
    </div>
  );
}

// Appends the kind fields to an upload's FormData.
export function appendKindFields(fd, value) {
  fd.append("kind", value.kind);
  if (value.kind === "past_question") {
    if (value.examYear) fd.append("examYear", String(value.examYear));
    if (value.examType) fd.append("examType", value.examType);
  }
}
