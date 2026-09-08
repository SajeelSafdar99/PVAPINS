export function ExtensionDownload({
  title,
  description,
  href,
  filename,
}: {
  title: string;
  description: string;
  href: string;
  filename: string;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-[#2a3344] bg-[#181e29] p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 flex-1 text-sm text-[#93a0b5]">{description}</p>
      <p className="mt-3 text-xs text-[#93a0b5]">
        Unzip the file, then in Chrome open chrome://extensions → Developer mode → Load unpacked
        → choose the unzipped folder (the one with manifest.json).
      </p>
      <a
        href={href}
        download={filename}
        className="mt-4 inline-flex justify-center rounded-lg bg-[#3dd6c6] px-4 py-2 text-center font-semibold text-[#06221f]"
      >
        Download zip
      </a>
    </article>
  );
}
