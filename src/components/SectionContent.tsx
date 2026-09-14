import { publicContributions, profile, type SectionId } from '@/content/profile';
import { ContactLinks } from './ContactLinks';

export function SectionContent({ id }: { id: SectionId }) {
  if (id === 'work') return <>
    <div className="contribution-collection">{publicContributions.map(item => <a className="contribution-card" key={item.number} href={item.url} target="_blank" rel="noopener noreferrer" aria-labelledby={`pr-${item.number}`}>
      <div className="contribution-meta"><span className={`status status-${item.status.toLowerCase()}`}>{item.status}</span><span className="pr-id">vLLM #{item.number}</span><span className="attribution">{item.attribution || 'authored'}</span></div>
      <h3 id={`pr-${item.number}`}>{item.heading}</h3><p className="problem">{item.problem}</p><p>{item.contribution}</p>
      <ul className="tags" aria-label={profile.ui.topics}>{item.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>
    </a>)}</div><p className="verification">{profile.ui.verified} <time dateTime={profile.lastVerified}>{profile.lastVerified}</time></p>
  </>;
  if (id === 'research') return <article className="research-paper"><p className="venue">{profile.research.venue}</p><h3>{profile.research.title}</h3><p className="byline">{profile.research.attribution}</p><p>{profile.research.description}</p><p>{profile.research.role}</p><a className="primary-link" href={profile.links.paper} target="_blank" rel="noopener noreferrer">{profile.ui.paper}</a></article>;
  if (id === 'purdue') return <div className="education"><h3>{profile.university}</h3><p>{profile.degree}</p><p className="graduation">{profile.graduation}</p></div>;
  if (id === 'about') return <div className="about-copy"><p className="lead-copy">{profile.about}</p><a className="primary-link" href={profile.links.profile} target="_blank" rel="noopener noreferrer">{profile.ui.source}</a></div>;
  if (id === 'contact') return <div className="contact-copy"><ContactLinks />{profile.showAvailability && <p className="availability"><span aria-hidden="true" className="status-light" />{profile.availability}</p>}</div>;
  return null;
}
