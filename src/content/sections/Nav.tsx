import { useEffect, useState, type MouseEvent } from 'react';
import PillNav, { type PillNavItem } from '../bits/PillNav';
import { goToSection } from '../motion';
import { isDiveMode } from '../../core/input';
import { switchExperience } from '../../experience';

const SECTIONS: PillNavItem[] = [
  { label: 'About', href: '#about' },
  { label: 'Work', href: '#work' },
  { label: 'Websites', href: '#websites' },
  { label: 'Stack', href: '#stack' },
  { label: 'Contact', href: '#contact' },
];

/** No href makes it a button: it leaves the page rather than moving along it. */
const DESIGN_VIEW: PillNavItem = { label: 'Design view', ariaLabel: 'Switch to the Design experience' };

export function Nav() {
  const [active, setActive] = useState<string | undefined>(undefined);
  // The surface has no phone layout, so phones are not offered it.
  const items = isDiveMode() ? SECTIONS : [...SECTIONS, DESIGN_VIEW];

  // The section in the middle band of the screen is the one being read. The
  // hero is watched too, so going back to the top clears the mark.
  useEffect(() => {
    const els = ['#top', ...SECTIONS.map((s) => s.href!)]
      .map((sel) => document.querySelector(sel))
      .filter((el): el is Element => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id === 'top' ? undefined : `#${e.target.id}`);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const onItemClick = (item: PillNavItem, _i: number, e: MouseEvent<HTMLElement>) => {
    if (!item.href) return switchExperience('design');
    e.preventDefault();
    goToSection(item.href.slice(1));
  };

  return (
    <header
      className="ct-nav"
      onClickCapture={(e) => {
        // The logo is PillNav's own plain link; route it through the smoother like the items.
        if (!(e.target as Element).closest('a[href="#top"]')) return;
        e.preventDefault();
        goToSection('top');
      }}
    >
      <PillNav
        logo="/pfp.jpg"
        logoAlt="Back to top"
        logoHref="#top"
        items={items}
        activeHref={active ?? ''}
        onItemClick={onItemClick}
        theme="light"
        surface="glass"
        size="md"
        hoverEffect="glide"
        indicator="dot"
        textColor="#121212"
        ariaLabel="Sections"
      />
    </header>
  );
}
