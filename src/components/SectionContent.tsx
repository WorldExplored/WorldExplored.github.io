import { publicContributions, profile, type SectionId } from '@/content/profile';
import { ContactLinks } from './ContactLinks';

export function SectionContent({ id }: { id: SectionId }) {
  if (id === 'work') return <>
    <div className="contribution-collection">{publicContributions.map(item => <a className="contribution-card" key={item.number} href={item.url} target="_blank" rel="noopener noreferrer" aria-labelledby={`pr-${item.number}`}>
      <div className="contribution-meta"><span className={`status status-${item.status.toLowerCase()}`}>{item.status}</span><span className="pr-id">vLLM #{item.number}</span><span className="attribution">{item.attribution || 'authored'}</span></div>
      <h3 id={`pr-${item.number}`}>{item.heading}</h3><p className="problem">{item.problem}</p><p>{item.contribution}</p>
      <ul className="tags" aria-label={profile.ui.topics}>{item.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>
    </a>)}</div>
  </>;
  if (id === 'experience') return <div className="timeline">{profile.experience.map(item => <article className="timeline-entry" key={item.company}>
    <div className="timeline-marker" aria-hidden="true" /><div><p className="venue">{item.dates} · {item.location}</p><h3>{item.company}</h3><p className="byline">{item.role}</p><ul>{item.details.map(detail => <li key={detail}>{detail}</li>)}</ul></div>
  </article>)}</div>;
  if (id === 'research') return <div className="research-collection">{profile.research.map(item => <article className="research-paper" key={item.title}><p className="venue">{item.venue}</p><h3><a className="paper-title-link" href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></h3><p className="byline">{item.attribution}</p><p>{item.description}</p><p>{item.role}</p><ul className="tags" aria-label={profile.ui.topics}>{item.tags.map(tag => <li key={tag}>{tag}</li>)}</ul></article>)}</div>;
  if (id === 'purdue') return <div className="education"><h3>{profile.university}</h3><p>{profile.degree}</p><p className="graduation">{profile.graduation}</p></div>;
  if (id === 'history') return <div className="timeline history-timeline">
    {profile.historyMilestones.map(item => <article className="timeline-entry" key={`${item.date}-${item.title}`}>
      <div className="timeline-marker" aria-hidden="true" /><div><p className="venue">{item.date}</p><h3><a className="timeline-link" href={item.href} {...(item.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{item.title}</a></h3><p>{item.description}</p></div>
    </article>)}
    {profile.history.map(item => <article className="timeline-entry" key={item.organization}>
      <div className="timeline-marker" aria-hidden="true" /><div>{item.dates && <p className="venue">{item.dates}</p>}<h3>{item.organization}</h3><p className="byline">{item.role} · {item.school}</p>{item.description && <p>{item.description}</p>}</div>
    </article>)}
  </div>;
  if (id === 'about') return <div className="about-copy"><p className="lead-copy">{profile.about}</p></div>;
  if (id === 'contact') return <div className="contact-copy"><ContactLinks />{profile.showAvailability && <p className="availability"><span aria-hidden="true" className="status-light" />{profile.availability}</p>}</div>;
  return null;
}
