export function Icon({
  name,
  className = "",
}: {
  name:
    | "check"
    | "x"
    | "help"
    | "copy"
    | "pages"
    | "ticket"
    | "bulb"
    | "external"
    | "loading"
    | "chevron";
  className?: string;
}) {
  const paths = {
    chevron: <path d="m6 9 6 6 6-6" />,
    loading: <path className="busy-ring" d="M12 3a9 9 0 1 1-9 9" />,
    ticket: (
      <>
        <path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" />
        <path d="M14 6v3m0 3v1m0 3v2" />
      </>
    ),
    bulb: (
      <>
        <path d="M9 18h6m-5 3h4M8 15c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7l-1 3H9z" />
        <path d="m10 9 2 2 2-2M12 11v4" />
      </>
    ),
    external: (
      <>
        <path d="M13 4h7v7m0-7-10 10" />
        <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    x: <path d="m7 7 10 10M17 7 7 17" />,
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.4 1.6c-1 .8-1.9 1.1-1.9 2.4M12 16h.01" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    pages: (
      <>
        <path d="M4 4h7v16H4zM14 4h6v16h-6M11 8h3M11 16h3" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
