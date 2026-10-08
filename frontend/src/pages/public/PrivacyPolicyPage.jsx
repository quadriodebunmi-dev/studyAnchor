import React from "react";
import PublicLayout from "../../components/PublicLayout.jsx";
import { APP_CONFIG } from "../../config/appConfig.js";

const UPDATED = "21 September 2026";

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed lv-meta">{children}</div>
    </section>
  );
}
const List = ({ items }) => <ul className="list-disc space-y-1.5 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul>;

export default function PrivacyPolicyPage() {
  const name = APP_CONFIG.name;
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold">Privacy policy</h1>
        <p className="mt-2 text-sm lv-meta">Last updated {UPDATED}</p>
        <p className="mt-4 text-sm leading-relaxed lv-meta">
          {name} helps students share and study course materials. This page explains what we collect, who can see it, and the choices you have.
        </p>

        <Section title="What we collect">
          <List items={[
            "Account details: your name, email, matric number, school, department, level, semester and session. Passwords are stored hashed, never in plain text. If you use Google sign-in we receive your name and email from Google.",
            "Reps also give a short note with their application, which admins review.",
            "Files you upload, plus the text we extract from them so the AI features can work (for images, this is a transcription of readable text).",
            "Study activity on your account: your bookmarks and your quiz attempts and scores, which power Study Analytics.",
            "Study activity kept only on your device: which materials you've opened, your streak, and your AI assistant conversations. We don't store these on our servers.",
          ]} />
        </Section>

        <Section title="Who can see your uploads">
          <List items={[
            "Shared with your class, before approval: only you, the Course Reps at your school who review uploads, and platform admins. Other students cannot see it.",
            "Shared with your class, after approval: everyone signed in to the platform. That includes students at other schools who use the \"All schools\" view of the Explore Feed.",
            "Rejected uploads: you, your school's Course Reps and admins. The Rep's reason, if given, is shown to you.",
            "Saved just for you (private): only you. It appears on your own dashboard and is excluded from every other student's feed, search and downloads. Platform admins can access any upload if needed for moderation, for example to remove abusive content.",
          ]} />
          <p>You can delete any of your uploads from My Uploads at any time.</p>
        </Section>

        <Section title="AI features">
          <p>
            Quizzes, theory questions, study tips and the AI assistant are powered by a third-party AI provider. To answer, we send the provider the text of the material you choose (when you generate questions, or ask the assistant about a material) and the messages you type into the assistant. We don't use your content to advertise to you.
          </p>
          <p>AI output can be wrong. Check anything important against your lecture notes.</p>
        </Section>

        <Section title="Services we rely on">
          <List items={[
            "Cloudinary stores uploaded files.",
            "An AI provider (Groq) processes AI requests, as described above.",
            "Google, if you choose Google sign-in.",
            "An email provider sends password-reset links and Rep application decisions.",
          ]} />
        </Section>

        <Section title="Cookies, storage and offline use">
          <p>
            We keep you signed in with a session cookie and a token in your browser's storage. If you install the app, your device may keep offline copies of pages and recently viewed data. Signing out removes your session; clear your browser data to remove local copies.
          </p>
        </Section>

        <Section title="Your choices">
          <List items={[
            "Edit your name, school, department, level, semester and session on your Profile page.",
            "Delete your uploads, remove bookmarks and clear your assistant conversations (\"New chat\") whenever you like.",
            "Ask us to correct or delete your account and data using the contact below.",
          ]} />
        </Section>

        <Section title="Contact">
          <p>
            {APP_CONFIG.supportEmail
              ? <>Questions about this policy? Email <a className="font-medium text-primary hover:underline" href={`mailto:${APP_CONFIG.supportEmail}`}>{APP_CONFIG.supportEmail}</a>.</>
              : "Questions about this policy? Contact your school's admin or Course Rep."}
          </p>
          <p>We may update this policy as {name} changes; the date at the top shows the latest version.</p>
        </Section>
      </article>
    </PublicLayout>
  );
}
