export type GuideStep = {
  title: string;
  detail?: string;
};

export type GuideSection = {
  title: string;
  steps: GuideStep[];
};

export function Guide({ title, sections }: { title: string; sections: GuideSection[] }) {
  return (
    <section className="space-y-8">
      <h2 className="sr-only">{title}</h2>
      {sections.map((section) => (
        <div key={section.title} className="card">
          <h3 className="mb-4 text-base font-semibold text-accent">{section.title}</h3>
          <ol className="space-y-3">
            {section.steps.map((step, index) => (
              <li key={`${section.title}-${step.title}`} className="flex gap-3 text-sm leading-6 text-text/90">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-xs font-semibold text-accent">
                  {index + 1}
                </span>
                <span>
                  <strong className="font-semibold text-text">{step.title}</strong>
                  {step.detail ? <span className="block text-muted">{step.detail}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

export const installZipSteps: GuideStep[] = [
  {
    title: "Download the zip from this page.",
    detail: "Chrome cannot install a .zip file directly.",
  },
  {
    title: "Unzip it on your computer.",
    detail:
      "Mac: double-click the zip. Windows: right-click → Extract All. You should get a folder that contains manifest.json.",
  },
  {
    title: "Open chrome://extensions in Chrome.",
    detail: "Paste that address into the address bar and press Enter.",
  },
  {
    title: "Turn on Developer mode.",
    detail: "The switch is in the top-right corner of the extensions page.",
  },
  {
    title: "Click Load unpacked.",
    detail:
      "Select the unzipped folder itself — the one that contains manifest.json. Do not pick the .zip, and do not pick a parent Downloads folder.",
  },
  {
    title: "Pin the extension.",
    detail: "Click the puzzle-piece icon in Chrome’s toolbar, then pin PVAPINS so the popup is easy to open.",
  },
];
