import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MessageCircle, Globe, ExternalLink, Bug, Lightbulb, Monitor, Server, Database, Cloud, Sparkles, ShieldCheck } from "lucide-react";
import PublicLayout from "../../components/PublicLayout.jsx";
import { APP_CONFIG } from "../../config/appConfig.js";

const STACK = [
  { icon: Monitor, name: "Frontend", detail: "React 18, Vite, Tailwind CSS. Installable as a PWA." },
  { icon: Server, name: "Backend", detail: "Node.js and Express, with JWT sessions." },
  { icon: Database, name: "Database", detail: "MongoDB (Mongoose)." },
  { icon: Cloud, name: "File storage", detail: "Cloudinary." },
  { icon: Sparkles, name: "AI", detail: "Groq-hosted language models. The model is set by server configuration." },
];

const initials = (name) => name.split(" ").map((n) => n[0]).slice(0, 2).join("");
const handleUrl = (v, base) => (/^https?:\/\//.test(v) ? v : base + v.replace(/^@/, ""));

// Only the contact details a developer actually has are shown.
function contactsFor(d) {
  return [
    d.email && { icon: Mail, label: "Email", href: `mailto:${d.email}` },
    d.whatsapp && { icon: MessageCircle, label: "WhatsApp", href: `https://wa.me/${String(d.whatsapp).replace(/\D/g, "")}` },
    d.phone && { icon: Phone, label: "Call", href: `tel:${d.phone}` },
    d.github && { icon: ExternalLink, label: "GitHub", href: handleUrl(d.github, "https://github.com/") },
    d.linkedin && { icon: ExternalLink, label: "LinkedIn", href: handleUrl(d.linkedin, "https://linkedin.com/in/") },
    d.website && { icon: Globe, label: "Website", href: handleUrl(d.website, "https://") },
  ].filter(Boolean);
}

// Photo with an initials fallback if none is set or the image fails to load.
function Avatar({ dev }) {
  const [failed, setFailed] = useState(false);
  if (dev.photo && !failed) {
    return (
      <img
        src={dev.photo}
        alt={`Photo of ${dev.name}`}
        loading="lazy"
        onError={() => setFailed(true)}
        className="aspect-[4/3] w-full rounded-xl bg-slate-100 object-contain object-top dark:bg-slate-800"
      />
    );
  }
  return (
    <div className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-accent font-display text-4xl font-bold text-accent-fg" aria-hidden="true">
      {initials(dev.name)}
    </div>
  );
}

function ContactCard({ icon: Icon, title, text, href }) {
  return (
    <a href={href} className="lv-card group flex items-start gap-3 p-4 transition hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/20 text-primary"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm lv-meta">{text}</span>
      </span>
    </a>
  );
}

export default function DevelopersPage() {
  const email = APP_CONFIG.supportEmail;
  const whatsapp = APP_CONFIG.supportWhatsapp;
  const mail = (subject) => `mailto:${email}?subject=${encodeURIComponent(`${subject} — ${APP_CONFIG.name}`)}`;

  return (
    <PublicLayout>
      {/* Intro */}
      <section className="relative overflow-hidden bg-night text-white">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px)", backgroundSize: "100% 34px" }} />
        <div className="relative mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">The people behind {APP_CONFIG.name}</h1>
          <p className="mt-3 max-w-xl text-slate-300">
            {APP_CONFIG.name} is built by a small team who use it themselves. Say hello, report a bug, or tell us what to build next.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12">
        {/* Team */}
        <h2 className="font-display text-xl font-bold">Built by</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {APP_CONFIG.developers.map((d) => {
            const contacts = contactsFor(d);
            return (
              <article key={d.name} className="lv-card flex flex-col p-3">
                <Avatar dev={d} />
                <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
                  <h3 className="font-display text-lg font-semibold leading-tight">{d.name}</h3>
                  <p className="text-sm lv-meta">{d.role}</p>
                  {d.bio && <p className="mt-2 text-sm leading-relaxed">{d.bio}</p>}
                  {contacts.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2 pt-1">
                      {contacts.map(({ icon: Icon, label, href }) => (
                        <li key={label}>
                          <a
                            href={href}
                            target={href.startsWith("http") ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            aria-label={`${label} — ${d.name}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary dark:border-slate-700"
                          >
                            <Icon className="h-3.5 w-3.5" /> {label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* Contact */}
        <h2 className="mt-14 font-display text-xl font-bold">Get in touch</h2>
        {email || whatsapp ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {email && <ContactCard icon={Mail} title="Email us" text={email} href={mail("Hello")} />}
            {whatsapp && <ContactCard icon={MessageCircle} title="WhatsApp" text="Chat with the team" href={`https://wa.me/${String(whatsapp).replace(/\D/g, "")}`} />}
            {email && <ContactCard icon={Bug} title="Report a bug" text="Tell us what happened and on which page." href={mail("Bug report")} />}
            {email && <ContactCard icon={Lightbulb} title="Suggest an idea" text="A feature or fix you'd like to see." href={mail("Idea")} />}
          </div>
        ) : (
          <p className="lv-card mt-5 p-4 text-sm lv-meta">
            Found a bug or have an idea? Tell your Course Rep or school admin and they'll pass it on.
          </p>
        )}

        {/* Stack */}
        <h2 className="mt-14 font-display text-xl font-bold">Tech stack</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map(({ icon: Icon, name, detail }) => (
            <div key={name} className="lv-card flex items-start gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="mt-0.5 text-sm lv-meta">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-14 flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/privacy" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
            <ShieldCheck className="h-4 w-4" /> How we handle your data
          </Link>
          <a href="https://buyonuma.shop" target="_blank" rel="noopener noreferrer sponsored" className="lv-meta hover:text-primary">
            Sponsored by buyonuma.shop
          </a>
        </div>
      </div>
    </PublicLayout>
  );
}