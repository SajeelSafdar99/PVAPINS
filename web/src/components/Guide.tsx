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
        <div key={section.title} className="rounded-2xl border border-[#2a3344] bg-[#181e29] p-6">
          <h3 className="mb-4 text-base font-semibold text-[#3dd6c6]">{section.title}</h3>
          <ol className="space-y-3">
            {section.steps.map((step, index) => (
              <li key={`${section.title}-${step.title}`} className="flex gap-3 text-sm leading-6 text-[#d5deec]">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#10141c] text-xs font-semibold text-[#3dd6c6]">
                  {index + 1}
                </span>
                <span>
                  <strong className="font-semibold text-[#e8eef8]">{step.title}</strong>
                  {step.detail ? <span className="block text-[#93a0b5]">{step.detail}</span> : null}
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
