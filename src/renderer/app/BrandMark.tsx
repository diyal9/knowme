export function BrandMark() {
  return (
    <div className="app-chrome-brand" aria-label="KnowMe">
      <span className="app-chrome-brand-mark" aria-hidden="true">
        <svg viewBox="0 0 1024 1024" focusable="false">
          <rect x="24" y="24" width="976" height="976" rx="196" ry="196" fill="#172535" />
          <g fill="none" stroke="#F4EFE7" strokeWidth="68" strokeLinecap="round" strokeLinejoin="round">
            <path d="M173 190 L173 805 L559 508" />
            <path d="M559 508 L850 181" />
            <path d="M559 508 L850 813" />
          </g>
          <g fill="#F4EFE7">
            <circle cx="173" cy="805" r="94" />
            <circle cx="559" cy="508" r="108" />
            <circle cx="850" cy="181" r="94" />
            <circle cx="850" cy="813" r="94" />
          </g>
          <circle cx="173" cy="190" r="75" fill="#F05D4E" />
        </svg>
      </span>
      <span className="app-chrome-brand-title">KnowMe</span>
    </div>
  )
}
