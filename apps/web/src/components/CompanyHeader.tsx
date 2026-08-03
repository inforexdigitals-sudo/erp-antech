export interface CompanyHeaderProps {
  companyName: string;
  logo: string;
  website: string;
  email: string;
  phone: string;
  description1: string;
  description2: string;
}

/** Strips a leading tel: prefix / spaces for the href, e.g. "+65 8725 6914" -> "+6587256914". */
function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function toWebsiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

/**
 * A letterhead-style banner: logo (25%) beside company info (75%), a
 * navy/grey divider underneath. Purely presentational — every value is
 * a prop, nothing hardcoded, so callers own where the data comes from
 * (see layouts/AppShell.tsx for the one wired to real Company Profile
 * data via useCompanyProfile()).
 */
export function CompanyHeader({ companyName, logo, website, email, phone, description1, description2 }: CompanyHeaderProps) {
  return (
    <header style={{ fontFamily: "'Inter', Arial, sans-serif" }} className="w-full bg-white">
      <div className="flex flex-col items-center gap-4 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6 md:px-8">
        {/* Left: logo, ~25% on desktop */}
        <div className="flex w-full shrink-0 items-center justify-center sm:w-1/4 sm:justify-start">
          <img
            src={logo}
            alt={`${companyName} logo`}
            className="h-[70px] w-auto object-contain md:h-[80px]"
            draggable={false}
          />
        </div>

        {/* Right: company info, ~75% on desktop */}
        <div className="flex w-full flex-col items-center gap-1 text-center sm:w-3/4 sm:items-start sm:text-left">
          <p className="text-[13.5px] leading-snug text-[#222222] sm:text-sm">{description1}</p>
          <p className="text-[13.5px] leading-snug text-[#222222] sm:text-sm">{description2}</p>
          <p className="text-[13.5px] leading-snug text-[#222222] sm:text-sm">
            <span>Web Page: </span>
            <a href={toWebsiteHref(website)} target="_blank" rel="noopener noreferrer" className="text-[#1A56DB] underline-offset-2 hover:underline">
              {website}
            </a>
            <span className="mx-1.5">·</span>
            <span>Email: </span>
            <a href={`mailto:${email}`} className="text-[#1A56DB] underline-offset-2 hover:underline">
              {email}
            </a>
          </p>
          <p className="text-[13.5px] leading-snug text-[#222222] sm:text-sm">
            <span>HP: </span>
            <a href={toTelHref(phone)} className="text-[#1A56DB] underline-offset-2 hover:underline">
              {phone}
            </a>
          </p>
        </div>
      </div>

      {/* Divider: primary navy bar with a short light-grey extension on the right */}
      <div className="flex h-[6px] w-full">
        <div className="flex-[6]" style={{ backgroundColor: '#0B2E5B' }} />
        <div className="flex-[3]" style={{ backgroundColor: '#244E86' }} />
        <div className="flex-1" style={{ backgroundColor: '#D9D9D9' }} />
      </div>
    </header>
  );
}
