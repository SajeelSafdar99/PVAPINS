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
    <article className="card flex flex-col">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-muted">{description}</p>
      <p className="mt-4 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs leading-5 text-muted">
        Chrome cannot install a zip. Unzip it, open chrome://extensions, turn on Developer mode,
        click Load unpacked, and choose the folder that contains manifest.json.
      </p>
      <a href={href} download={filename} className="btn-primary mt-4 w-full">
        Download zip
      </a>
    </article>
  );
}
