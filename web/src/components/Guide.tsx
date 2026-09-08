export function Guide({
  title,
  steps,
}: {
  title: string;
  steps: string[];
}) {
  return (
    <section className="rounded-2xl border border-[#2a3344] bg-[#181e29] p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-6 text-[#d5deec]">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#10141c] text-xs font-semibold text-[#3dd6c6]">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
