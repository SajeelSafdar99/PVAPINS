export function ExtensionDownload({
  title,
  description,
  href,
  filename,
  version,
}: {
  title: string;
  description: string;
  href: string;
  filename: string;
  version?: string;
}) {
  return (
    <article className="card flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {version ? <span className="badge-muted shrink-0">v{version}</span> : null}
      </div>
      <p className="mt-2 flex-1 text-sm leading-6 text-muted">{description}</p>
      <p className="mt-4 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs leading-5 text-muted">
        Chrome cannot install a zip. Unzip it, open chrome://extensions, turn on Developer mode,
        click Load unpacked, and choose the folder that contains manifest.json. After this version is
        installed, the popup will offer the next zip when we ship one.
      </p>
      <a href={href} download={filename} className="btn-primary mt-4 w-full">
        Download zip
      </a>
    </article>
  );
}
