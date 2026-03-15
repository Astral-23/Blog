import Link from "next/link";
import { getSiteSettings } from "@/lib/site-config";

export function SiteHeader() {
  const settings = getSiteSettings();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-title" href="/">
          {settings.titleSegments.map((segment, index) => (
            <span
              key={`${segment.text}-${index}`}
              style={{ fontSize: `${segment.size}em` }}
            >
              {segment.text}
            </span>
          ))}
        </Link>
        <nav aria-label="Global">
          <ul className="nav-list">
            {settings.navigation.map((item) => (
              <li key={item.href}>
                <Link className="nav-link" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
