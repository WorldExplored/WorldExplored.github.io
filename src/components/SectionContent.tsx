import { additionalContributions, featured, profile, type SectionId } from '@/content/profile';
import { Arrow } from './HabitatIcon';

function MainSectionContent({ id }: { id: SectionId }) {
  if (id === 'work') return <>
    <div className="featured-list">{featured.map((item, index) => <article className="contribution" key={item.number}>
      <div className="contribution-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
      <div className="contribution-main">
        <div className="contribution-meta"><span className={`status status-${item.status === 'Merged' ? 'merged' : item.status === 'Open' ? 'open' : 'closed'}`}>{item.status}</span><span className="pr-id">{profile.ui.projectLabel} #{item.number}</span>{item.attribution && <span className="attribution">{item.attribution}</span>}</div>
        <h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.heading}<Arrow /></a></h3>
        <p className="problem">{item.problem}</p><p>{item.contribution}</p>
        <ul className="tags" aria-label={profile.ui.topics}>{item.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>
      </div>
    </article>)}</div>
    <details className="contribution-log"><summary>{profile.ui.contributions}<span>{additionalContributions.length} {profile.ui.prUnit}</span><span className="disclosure" aria-hidden="true">+</span></summary>
      <p className="log-note">{profile.ui.logNote}</p>
      <ul>{additionalContributions.map(item => <li key={item.number}><a href={item.url} target="_blank" rel="noopener noreferrer"><span className="pr-id">#{item.number}</span><span>{item.title}</span><Arrow /></a><span className={`status status-${item.status === 'Merged' ? 'merged' : item.status === 'Open' ? 'open' : 'closed'}`}>{item.status}</span></li>)}</ul>
    </details><p className="verification">{profile.ui.verified} <time dateTime={profile.lastVerified}>{profile.lastVerified}</time> · <a href={profile.links.contributions} target="_blank" rel="noopener noreferrer">{profile.ui.source}<Arrow /></a></p>
  </>;

  if (id === 'research') return <article className="research-paper">
    <div className="paper-cover" aria-hidden="true"><span>{profile.research.coverVenue}</span><strong>{profile.research.year}</strong><div className="paper-water"><i /><i /><i /></div><span>{profile.research.coverSeries}</span></div>
    <div className="paper-copy"><p className="eyebrow">{profile.research.venue}</p><h3>{profile.research.title}</h3><p className="byline">{profile.research.attribution}</p><p>{profile.research.description}</p><p>{profile.research.role}</p><ul className="tags">{profile.research.tags.map(tag => <li key={tag}>{tag}</li>)}</ul><a className="text-link" href={profile.links.paper} target="_blank" rel="noopener noreferrer">{profile.ui.paper}<Arrow /></a></div>
  </article>;

  if (id === 'purdue') return <div className="education"><div className="education-year" aria-hidden="true">{profile.graduationYear}</div><div><p className="eyebrow">{profile.graduation}</p><h3>{profile.university}</h3><p className="degree">{profile.degree}</p><p>{profile.educationContext}</p></div></div>;

  if (id === 'about') return <div className="about-copy"><p className="lead-copy">{profile.about}</p><a href={profile.links.profile} className="text-link" target="_blank" rel="noopener noreferrer">{profile.ui.source}<Arrow /></a></div>;

  if (id === 'contact') return <div className="contact-copy"><p className="lead-copy">{profile.ui.contact}</p>{profile.showAvailability && <p className="availability"><span className="status-light" aria-hidden="true" />{profile.availability}</p>}<div className="contact-links"><a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer">{profile.ui.linkedin}<Arrow /></a><a href={profile.links.github} target="_blank" rel="noopener noreferrer">{profile.ui.github}<Arrow /></a><a href={profile.links.paper} target="_blank" rel="noopener noreferrer">{profile.ui.paper}<Arrow /></a></div></div>;

  return <p className="building-copy">{profile.building}</p>;
}

export function SectionContent({ id }: { id: SectionId }) {
  return <><MainSectionContent id={id} />{profile.additions.filter(item => item.section === id).map(item => <article className="additional-entry" key={item.title}><h3>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}<Arrow /></a> : item.title}</h3><p>{item.description}</p>{item.tags && <ul className="tags">{item.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}</article>)}</>;
}
