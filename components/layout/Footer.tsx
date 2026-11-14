import Link from "next/link";
import { t } from "@/lib/i18n/zh-TW";
import { Container } from "./Container";

const links = [
  { href: "/about", label: t.footer.about },
  { href: "/privacy", label: t.footer.privacy },
  { href: "/terms", label: t.footer.terms },
  { href: "/contact", label: t.footer.contact },
];

export function Footer() {
  return (
    <footer className="on-dark mt-24 bg-sign-deep text-white">
      <Container className="flex flex-col gap-6 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <p className="text-lg font-extrabold tracking-wide">{t.brand}</p>
          <p className="mt-1 text-white/85">{t.tagline}</p>
          <p className="mt-4 text-sm text-white/75">{t.footer.deviceNote}</p>
        </div>
        <nav aria-label={t.footer.label}>
          <ul className="flex flex-wrap gap-x-2 gap-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex min-h-11 items-center rounded-full px-3 font-semibold underline-offset-4 hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
