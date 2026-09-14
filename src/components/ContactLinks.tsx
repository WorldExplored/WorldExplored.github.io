import { profile } from '@/content/profile';

export function ContactIcon({ kind }: { kind: 'github' | 'linkedin' | 'email' }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    {kind === 'github' && <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.32-3.79-1.32-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.72.4-1.22.72-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.65 0c2.15-1.46 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.33-2.64 5.27-5.15 5.55.4.35.76 1.03.76 2.08v3.1c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z" />}
    {kind === 'linkedin' && <><rect x="1" y="1" width="22" height="22" rx="3" /><path d="M6 10v8m0-12v.1m5 11.9v-8m0 3c0-4 7-4 7 0v5" fill="none" stroke="white" strokeWidth="2.4" /><circle cx="6" cy="6.5" r="1.3" fill="white" /></>}
    {kind === 'email' && <><rect x="2" y="4" width="20" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m3 6 9 7 9-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></>}
  </svg>;
}

export function ContactLinks({ compact = false }: { compact?: boolean }) {
  const kinds = compact ? ['github', 'linkedin'] as const : ['email', 'github', 'linkedin'] as const;
  return <div className={`contact-links ${compact ? 'contact-compact' : ''}`}>{kinds.map(kind => <a className={`contact-link contact-${kind}`} key={kind} href={profile.links[kind]} {...(kind === 'email' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}><span className="contact-icon"><ContactIcon kind={kind} /></span><span>{profile.ui[kind]}{kind === 'email' && <small>{profile.links.email.slice('mailto:'.length)}</small>}</span></a>)}</div>;
}
