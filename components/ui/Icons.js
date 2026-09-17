/**
 * Inline SVG icon set.
 *
 * Kept in-repo rather than pulling an icon package: the site uses ~30 glyphs and
 * this ships only the paths actually rendered. All icons inherit `currentColor`
 * and are `aria-hidden` — label the interactive element, not the glyph.
 */

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

function make(paths, overrides = {}) {
  const Icon = ({ size = 20, className = '', ...rest }) => (
    <svg {...base} {...overrides} width={size} height={size} className={className} {...rest}>
      {paths}
    </svg>
  );
  return Icon;
}

export const SearchIcon = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </>,
);

export const CartIcon = make(
  <>
    <path d="M3 4h2.2l1.6 10.3a2 2 0 0 0 2 1.7h7.8a2 2 0 0 0 2-1.6L20 7H6" />
    <circle cx="9.5" cy="19.5" r="1.4" />
    <circle cx="17" cy="19.5" r="1.4" />
  </>,
);

export const MenuIcon = make(
  <>
    <path d="M3.5 7h17" />
    <path d="M3.5 12h17" />
    <path d="M3.5 17h17" />
  </>,
);

export const CloseIcon = make(
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </>,
);

export const ChevronRightIcon = make(<path d="m9 5 7 7-7 7" />);
export const ChevronLeftIcon = make(<path d="m15 5-7 7 7 7" />);
export const ChevronDownIcon = make(<path d="m5 9 7 7 7-7" />);
export const ArrowRightIcon = make(
  <>
    <path d="M4 12h15" />
    <path d="m13 6 6 6-6 6" />
  </>,
);
export const ArrowLeftIcon = make(
  <>
    <path d="M20 12H5" />
    <path d="m11 6-6 6 6 6" />
  </>,
);

export const StarIcon = ({ size = 16, className = '', filled = false, half = false }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    {half && (
      <defs>
        <linearGradient id="star-half-fill">
          <stop offset="50%" stopColor="currentColor" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
    )}
    <path
      d="M12 3.2l2.6 5.3 5.9.86-4.25 4.14 1 5.86L12 16.6l-5.25 2.76 1-5.86L3.5 9.36l5.9-.86z"
      fill={half ? 'url(#star-half-fill)' : filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  </svg>
);

export const HeartIcon = ({ size = 20, className = '', filled = false, ...rest }) => (
  <svg
    {...base}
    width={size}
    height={size}
    className={className}
    fill={filled ? 'currentColor' : 'none'}
    {...rest}
  >
    <path d="M12 20s-7.2-4.4-7.2-9.2A4 4 0 0 1 12 8.2a4 4 0 0 1 7.2 2.6C19.2 15.6 12 20 12 20z" />
  </svg>
);

export const PlusIcon = make(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);
export const MinusIcon = make(<path d="M5 12h14" />);

export const TrashIcon = make(
  <>
    <path d="M4 7h16" />
    <path d="M10 4h4" />
    <path d="M6 7l1 12.2a1.8 1.8 0 0 0 1.8 1.8h6.4A1.8 1.8 0 0 0 17 19.2L18 7" />
    <path d="M10 11v6M14 11v6" />
  </>,
);

export const CheckIcon = make(<path d="m4.5 12.5 5 5 10-11" />);

export const CheckCircleIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.4 2.6 2.6L16 9.6" />
  </>,
);

export const AlertIcon = make(
  <>
    <path d="M12 4.5 2.8 20h18.4z" />
    <path d="M12 10v4" />
    <path d="M12 17.2h.01" />
  </>,
);

export const InfoIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </>,
);

export const TruckIcon = make(
  <>
    <path d="M2.5 6.5h11v9h-11z" />
    <path d="M13.5 10h4l3 3v2.5h-7z" />
    <circle cx="7" cy="17.5" r="1.6" />
    <circle cx="17" cy="17.5" r="1.6" />
  </>,
);

export const ShieldIcon = make(
  <>
    <path d="M12 3.2 5 6v5.5c0 4 3 7.4 7 9.3 4-1.9 7-5.3 7-9.3V6z" />
    <path d="m9.2 12 2 2 3.6-4" />
  </>,
);

export const SparkleIcon = make(
  <>
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z" />
    <path d="M18.5 4v3M20 5.5h-3" />
  </>,
);

export const PaletteIcon = make(
  <>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.4-1-1.8-1-2.9 0-.8.7-1.4 1.6-1.4h1.6a4.5 4.5 0 0 0 4.5-4.5c0-3.6-3.8-6.5-8.5-6.5z" />
    <circle cx="8" cy="11" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="11" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="8.6" r="1.1" fill="currentColor" stroke="none" />
  </>,
);

export const UploadIcon = make(
  <>
    <path d="M12 15.5V4.5" />
    <path d="m8 8.4 4-4 4 4" />
    <path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
  </>,
);

export const RotateIcon = make(
  <>
    <path d="M20 11a8 8 0 1 0-1.6 5.4" />
    <path d="M20 5.5V11h-5.5" />
  </>,
);

export const ZoomIcon = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
    <path d="M8.5 11h5M11 8.5v5" />
  </>,
);

export const MoveIcon = make(
  <>
    <path d="M12 4v16M4 12h16" />
    <path d="m9 7 3-3 3 3M9 17l3 3 3-3M7 9l-3 3 3 3M17 9l3 3-3 3" />
  </>,
);

export const HeadsetIcon = make(
  <>
    <path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" />
    <path d="M4.5 13.5h2V18h-2a1.5 1.5 0 0 1-1.5-1.5V15a1.5 1.5 0 0 1 1.5-1.5z" />
    <path d="M19.5 13.5h-2V18h2a1.5 1.5 0 0 0 1.5-1.5V15a1.5 1.5 0 0 0-1.5-1.5z" />
    <path d="M19 18v.6a2.4 2.4 0 0 1-2.4 2.4H13" />
  </>,
);

export const RefreshIcon = make(
  <>
    <path d="M4 11a8 8 0 0 1 13.7-5.6L20 8" />
    <path d="M20 4v4h-4" />
    <path d="M20 13a8 8 0 0 1-13.7 5.6L4 16" />
    <path d="M4 20v-4h4" />
  </>,
);

export const MailIcon = make(
  <>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="m3.6 7 8.4 6 8.4-6" />
  </>,
);

export const PhoneIcon = make(
  <path d="M6.2 3.5h3l1.4 3.6-2 1.4a11.5 11.5 0 0 0 5.4 5.4l1.4-2 3.6 1.4v3a2 2 0 0 1-2.2 2A15.8 15.8 0 0 1 4.2 5.7a2 2 0 0 1 2-2.2z" />,
);

export const ClockIcon = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.2V12l3.2 2" />
  </>,
);

export const MapPinIcon = make(
  <>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.6" />
  </>,
);

export const CreditCardIcon = make(
  <>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2.2" />
    <path d="M2.5 10h19" />
    <path d="M6.5 14.5h3" />
  </>,
);

export const CashIcon = make(
  <>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 9.5v.01M18 14.5v.01" />
  </>,
);

export const PackageIcon = make(
  <>
    <path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" />
    <path d="m4 8 8 4.5L20 8" />
    <path d="M12 12.5V21" />
  </>,
);

export const FilterIcon = make(
  <>
    <path d="M4 6.5h16" />
    <path d="M7 12h10" />
    <path d="M10 17.5h4" />
  </>,
);

export const EyeIcon = make(
  <>
    <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
    <circle cx="12" cy="12" r="2.8" />
  </>,
);

export const RulerIcon = make(
  <>
    <rect x="2.5" y="8" width="19" height="8" rx="1.6" />
    <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
  </>,
);

export const LeafIcon = make(
  <>
    <path d="M20 4c0 9-5.5 13-11 13a5 5 0 0 1-5-5C4 6.5 12.5 4 20 4z" />
    <path d="M4 20c2.5-5 6.5-8 11-9.5" />
  </>,
);

/* ---- Social ---- */

const brandBase = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': 'true',
  focusable: 'false',
};

function brand(paths) {
  const Icon = ({ size = 18, className = '', ...rest }) => (
    <svg {...brandBase} width={size} height={size} className={className} {...rest}>
      {paths}
    </svg>
  );
  return Icon;
}

export const InstagramIcon = brand(
  <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.05 1.8.25 2.2.42.6.22 1 .5 1.4.9.4.4.7.8.9 1.4.17.4.37 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.05 1.2-.25 1.8-.42 2.2-.22.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.17-1 .37-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.05-1.8-.25-2.2-.42-.6-.22-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.17-.4-.37-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.05-1.2.25-1.8.42-2.2.22-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.17 1-.37 2.2-.42C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.07-1.1.05-1.7.24-2.1.4-.5.2-.9.44-1.3.83-.4.4-.63.8-.83 1.3-.16.4-.35 1-.4 2.1C2.6 9.9 2.6 10.3 2.6 12s0 2.1.07 3.3c.05 1.1.24 1.7.4 2.1.2.5.44.9.83 1.3.4.4.8.63 1.3.83.4.16 1 .35 2.1.4 1.2.07 1.6.07 4.7.07s3.5 0 4.7-.07c1.1-.05 1.7-.24 2.1-.4.5-.2.9-.44 1.3-.83.4-.4.63-.8.83-1.3.16-.4.35-1 .4-2.1.07-1.2.07-1.6.07-3.3s0-2.1-.07-3.3c-.05-1.1-.24-1.7-.4-2.1a3.4 3.4 0 0 0-.83-1.3 3.4 3.4 0 0 0-1.3-.83c-.4-.16-1-.35-2.1-.4C15.5 4 15.1 4 12 4zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2zm5.1-2.1a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3z" />,
);

export const FacebookIcon = brand(
  <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6c-.3-.04-1.3-.13-2.45-.13-2.43 0-4.1 1.48-4.1 4.2v2.24H7.4V13h2.75v8z" />,
);

export const XIcon = brand(
  <path d="M17.2 3h3.3l-7.2 8.2L21.7 21h-6.5l-4.6-6-5.3 6H2l7.7-8.8L2.3 3h6.7l4.2 5.5zm-1.15 16h1.83L8.03 4.9H6.06z" />,
);

export const TikTokIcon = brand(
  <path d="M16.4 3h-3v12.1a2.6 2.6 0 1 1-2-2.53V9.5a5.6 5.6 0 1 0 5 5.57V9.2a6.7 6.7 0 0 0 3.9 1.24V7.4a3.8 3.8 0 0 1-3.9-3.6z" />,
);

export const LinkedInIcon = brand(
  <path d="M6.94 8.5v11.6H3.3V8.5zM5.12 3a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM9.2 8.5h3.48v1.6h.05c.49-.9 1.68-1.87 3.46-1.87 3.7 0 4.38 2.32 4.38 5.34v6.53h-3.63v-5.8c0-1.38-.03-3.16-1.98-3.16-1.98 0-2.28 1.5-2.28 3.06v5.9H9.2z" />,
);

export const SOCIAL_ICONS = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  x: XIcon,
  tiktok: TikTokIcon,
  linkedin: LinkedInIcon,
};

/* ---- Portal additions ---- */

export const LogoutIcon = make(
  <>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
    <path d="M14 8l4 4-4 4" />
    <path d="M18 12H9" />
  </>,
);

export const UserIcon = make(
  <>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </>,
);

export const GridIcon = make(
  <>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
  </>,
);

export const ListIcon = make(
  <>
    <path d="M8 6.5h12M8 12h12M8 17.5h12" />
    <path d="M4 6.5h.01M4 12h.01M4 17.5h.01" />
  </>,
);

export const CopyIcon = make(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </>,
);

export const LockIcon = make(
  <>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <path d="M12 14.5v2.5" />
  </>,
);

export const ReceiptIcon = make(
  <>
    <path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6-2.4-1.6z" />
    <path d="M9 8h6M9 11.5h6M9 15h4" />
  </>,
);

export const ExternalLinkIcon = make(
  <>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </>,
);
