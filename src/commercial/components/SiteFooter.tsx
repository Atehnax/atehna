import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { Clock, Globe2, Mail, MapPin, Phone } from 'lucide-react';
import AtehnaLogo from '@/commercial/components/AtehnaLogo';
import { ResponsiveSiteLogo } from '@/commercial/components/SiteLogo';
import type {
  HomepageFooterColumn,
  HomepageFooterContact,
  HomepageFooterLink,
  HomepageFooterSettings,
  HomepageFooterSocialLink,
  HomepageFooterSpacing,
  HomepageSocialType
} from '@/shared/domain/landing/landingPage';

export type FooterPresentation = Pick<HomepageFooterSettings, 'logoMode' | 'layoutColumns' | 'spacing' | 'topBorder'>;

export type SiteFooterLinkPlacement = 'column' | 'legal';
export type SiteFooterContactField = keyof HomepageFooterContact;

export type SiteFooterControlTarget =
  | { scope: 'surface'; settings: HomepageFooterSettings; hidden: boolean }
  | { scope: 'logo'; settings: HomepageFooterSettings; logoMode: HomepageFooterSettings['logoMode'] }
  | { scope: 'description'; value: string }
  | { scope: 'columns'; columns: HomepageFooterColumn[] }
  | { scope: 'column'; column: HomepageFooterColumn; hidden: boolean }
  | { scope: 'columnTitle'; column: HomepageFooterColumn; value: string; hidden: boolean }
  | {
    scope: 'link';
    placement: SiteFooterLinkPlacement;
    link: HomepageFooterLink;
    column?: HomepageFooterColumn;
    hidden: boolean;
  }
  | { scope: 'contact'; contact: HomepageFooterContact }
  | { scope: 'contactField'; contact: HomepageFooterContact; field: SiteFooterContactField; value: string }
  | { scope: 'social'; links: HomepageFooterSocialLink[] }
  | { scope: 'socialLink'; link: HomepageFooterSocialLink; hidden: boolean }
  | { scope: 'copyright'; rawValue: string; resolvedValue: string }
  | { scope: 'legal'; links: HomepageFooterLink[] };

type SiteFooterSurfaceRenderProps = {
  settings: HomepageFooterSettings;
  hidden: boolean;
  children: ReactNode;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterLogoRenderProps = {
  settings: HomepageFooterSettings;
  logoMode: HomepageFooterSettings['logoMode'];
  logo: ReactNode;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterDescriptionRenderProps = {
  value: string;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterColumnsRenderProps = {
  columns: HomepageFooterColumn[];
  children: ReactNode;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterColumnRenderProps = {
  column: HomepageFooterColumn;
  links: HomepageFooterLink[];
  hidden: boolean;
  children: ReactNode;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterColumnTitleRenderProps = {
  column: HomepageFooterColumn;
  value: string;
  hidden: boolean;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterLinkRenderProps = {
  placement: SiteFooterLinkPlacement;
  link: HomepageFooterLink;
  column?: HomepageFooterColumn;
  hidden: boolean;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterContactRenderProps = {
  contact: HomepageFooterContact;
  children: ReactNode;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterContactFieldRenderProps = {
  contact: HomepageFooterContact;
  field: SiteFooterContactField;
  value: string;
  icon: ReactNode;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterSocialRenderProps = {
  links: HomepageFooterSocialLink[];
  headingNode: ReactNode;
  linkNodes: ReactNode;
  children: ReactNode;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterSocialLinkRenderProps = {
  link: HomepageFooterSocialLink;
  hidden: boolean;
  icon: ReactNode;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterCopyrightRenderProps = {
  rawValue: string;
  resolvedValue: string;
  defaultNode: ReactNode;
  controls: ReactNode;
};

type SiteFooterLegalRenderProps = {
  links: HomepageFooterLink[];
  children: ReactNode;
  defaultNode: ReactNode;
  controls: ReactNode;
};

export type SiteFooterEditorAdapter = {
  /** Marks the adapter as an editing surface. Set false for render-only element wrappers. */
  editorMode?: boolean;
  /** Render the footer even when it is disabled in the public configuration. */
  forceVisible?: boolean;
  /** Keep hidden columns and links in their configured order for editor display. */
  showHidden?: boolean;
  /** Keep empty editable regions mounted. Defaults to true whenever an adapter is supplied. */
  showEmpty?: boolean;
  /** Produce contextual controls. Matching slots receive them; without a slot they follow the default node. */
  renderControls?: (target: SiteFooterControlTarget) => ReactNode;
  renderSurface?: (props: SiteFooterSurfaceRenderProps) => ReactNode;
  renderLogo?: (props: SiteFooterLogoRenderProps) => ReactNode;
  renderDescription?: (props: SiteFooterDescriptionRenderProps) => ReactNode;
  renderColumns?: (props: SiteFooterColumnsRenderProps) => ReactNode;
  renderColumn?: (props: SiteFooterColumnRenderProps) => ReactNode;
  renderColumnTitle?: (props: SiteFooterColumnTitleRenderProps) => ReactNode;
  renderLink?: (props: SiteFooterLinkRenderProps) => ReactNode;
  renderContact?: (props: SiteFooterContactRenderProps) => ReactNode;
  renderContactField?: (props: SiteFooterContactFieldRenderProps) => ReactNode;
  renderSocial?: (props: SiteFooterSocialRenderProps) => ReactNode;
  renderSocialLink?: (props: SiteFooterSocialLinkRenderProps) => ReactNode;
  renderCopyright?: (props: SiteFooterCopyrightRenderProps) => ReactNode;
  renderLegal?: (props: SiteFooterLegalRenderProps) => ReactNode;
};

export type SiteFooterProps = {
  settings: HomepageFooterSettings;
  presentation?: Partial<FooterPresentation>;
  containerClassName?: string;
  responsivePresentation?: boolean;
  editorAdapter?: SiteFooterEditorAdapter;
};

type OptionalVisibilityAndOrder = {
  visible?: boolean;
  position?: number;
};

const mobileColumnClassNames: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6'
};

const tabletColumnClassNames: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6'
};

const desktopColumnClassNames: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6'
};

const mobileSpacingClassNames: Record<HomepageFooterSpacing, string> = {
  compact: 'py-6',
  medium: 'py-8',
  large: 'py-12'
};

const tabletSpacingClassNames: Record<HomepageFooterSpacing, string> = {
  compact: 'sm:py-6',
  medium: 'sm:py-8',
  large: 'sm:py-12'
};

const desktopSpacingClassNames: Record<HomepageFooterSpacing, string> = {
  compact: 'lg:py-6',
  medium: 'lg:py-8',
  large: 'lg:py-12'
};

const socialLabels: Record<HomepageSocialType, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X',
  custom: 'Povezava'
};

const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

function boundedColumnCount(value: number | undefined) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(6, Math.max(1, Math.round(value ?? 1)));
}

function orderedFooterItems<T>(items: readonly T[], includeHidden = false) {
  return items
    .map((item, index) => ({ item, index, meta: item as T & OptionalVisibilityAndOrder }))
    .filter(({ meta }) => includeHidden || meta.visible !== false)
    .sort((first, second) => {
      const firstPosition = Number.isFinite(first.meta.position) ? first.meta.position as number : first.index;
      const secondPosition = Number.isFinite(second.meta.position) ? second.meta.position as number : second.index;
      return firstPosition - secondPosition || first.index - second.index;
    })
    .map(({ item }) => item);
}

function renderDefaultSiteFooterLogo(
  settings: HomepageFooterSettings,
  logoMode: HomepageFooterSettings['logoMode'],
  fluid = false
) {
  if (logoMode === 'hidden') return null;

  const logoText = settings.logoText.trim();
  if (logoText && logoText.toUpperCase() !== 'ATEHNA') {
    return (
      <span className={`inline-flex items-center gap-3 text-[color:var(--site-color-primary)] ${fluid ? 'h-full min-h-0 w-full' : ''}`}>
        <span className={`grid place-items-center rounded-[var(--site-radius-md,0.5rem)] bg-[color:var(--site-color-primary)] font-bold text-[color:var(--site-color-primary-foreground)] ${fluid ? 'aspect-square h-full text-[0.45em]' : 'h-9 w-9 text-base'}`}>
          {logoText.slice(0, 1).toUpperCase()}
        </span>
        {logoMode === 'full' ? (
          <span className={`${fluid ? 'text-[0.62em]' : 'text-xl'} font-bold tracking-[0.02em] text-[color:var(--site-color-text)]`}>{logoText}</span>
        ) : null}
      </span>
    );
  }

  return (
    <AtehnaLogo
      markOnly={logoMode === 'mark'}
      fluid={fluid}
      className={!fluid && logoMode === 'mark' ? '[&>svg]:h-10 [&>svg]:w-10' : ''}
    />
  );
}

const footerLogoPurposes = {
  desktop: 'footer-desktop',
  tablet: 'footer-tablet',
  mobile: 'footer-mobile'
} as const;

export function renderSiteFooterLogo(
  settings: HomepageFooterSettings,
  logoMode: HomepageFooterSettings['logoMode'],
  fluid = false
) {
  if (logoMode === 'hidden') return null;
  const fallback = renderDefaultSiteFooterLogo(settings, logoMode, fluid);
  const className = fluid ? 'h-full w-full' : 'h-10 w-[126px]';
  const purposeClassNames = fluid
    ? undefined
    : {
        desktop: 'h-10 w-[126px]',
        tablet: 'h-10 w-[123px]',
        mobile: 'h-10 w-[120px]'
      };

  return (
    <ResponsiveSiteLogo
      purposes={footerLogoPurposes}
      fallback={fallback}
      className={className}
      purposeClassNames={purposeClassNames}
      alt="Atehna"
    />
  );
}

export function SiteFooterSocialIcon({ type }: { type: HomepageSocialType }) {
  const commonProps = {
    'aria-hidden': true,
    className: 'h-4 w-4 shrink-0',
    'data-social-brand-icon': true,
    'data-social-type': type,
    focusable: false
  } as const;

  if (type === 'facebook') {
    return (
      <svg {...commonProps} viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.75 21v-8h2.68l.4-3.1h-3.08V7.92c0-.9.25-1.51 1.54-1.51h1.65V3.64c-.29-.04-1.27-.12-2.42-.12-2.39 0-4.03 1.46-4.03 4.14V9.9H7.79V13h2.7v8h3.26Z" />
      </svg>
    );
  }

  if (type === 'instagram') {
    return (
      <svg {...commonProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.4" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (type === 'youtube') {
    return (
      <svg {...commonProps} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M21.58 7.19a2.76 2.76 0 0 0-1.94-1.95C17.93 4.78 12 4.78 12 4.78s-5.93 0-7.64.46a2.76 2.76 0 0 0-1.94 1.95A28.7 28.7 0 0 0 1.96 12c0 1.62.15 3.23.46 4.81a2.76 2.76 0 0 0 1.94 1.95c1.71.46 7.64.46 7.64.46s5.93 0 7.64-.46a2.76 2.76 0 0 0 1.94-1.95c.31-1.58.46-3.19.46-4.81 0-1.62-.15-3.23-.46-4.81ZM10 15.5v-7l6 3.5-6 3.5Z" clipRule="evenodd" />
      </svg>
    );
  }

  if (type === 'linkedin') {
    return (
      <svg {...commonProps} viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.51 8.25H3.28V20h3.23V8.25ZM4.9 3a1.88 1.88 0 1 0 0 3.75A1.88 1.88 0 0 0 4.9 3ZM9.04 8.25h3.1v1.61h.04c.43-.82 1.49-2 3.6-2 3.84 0 4.55 2.53 4.55 5.82V20H17.1v-5.61c0-1.34-.02-3.06-1.86-3.06-1.87 0-2.15 1.46-2.15 2.96V20H9.04V8.25Z" />
      </svg>
    );
  }

  if (type === 'x') {
    return (
      <svg {...commonProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M5 4 19 20M19 4 5 20" />
      </svg>
    );
  }

  return <Globe2 {...commonProps} strokeWidth={1.8} />;
}

function resolvedPresentation(
  settings: HomepageFooterSettings,
  presentation: Partial<FooterPresentation>,
  responsive: boolean
) {
  const base = {
    layoutColumns: presentation.layoutColumns ?? settings.layoutColumns,
    spacing: presentation.spacing ?? settings.spacing,
    topBorder: presentation.topBorder ?? settings.topBorder
  };

  if (!responsive) {
    return { mobile: base, tablet: base, desktop: base };
  }

  return {
    mobile: settings.responsive.mobile,
    tablet: settings.responsive.tablet,
    desktop: settings.responsive.desktop
  };
}

function slotNode<T extends { defaultNode: ReactNode; controls: ReactNode }>(
  renderer: ((props: T) => ReactNode) | undefined,
  props: T
) {
  if (renderer) return renderer(props);
  return (
    <>
      {props.defaultNode}
      {props.controls}
    </>
  );
}

export default function SiteFooter({
  settings,
  presentation = {},
  containerClassName = 'site-container',
  responsivePresentation = true,
  editorAdapter
}: SiteFooterProps) {
  if (!settings.visible && !editorAdapter?.forceVisible) return null;

  const year = new Date().getFullYear();
  const copyright = settings.copyright.replaceAll('{year}', String(year));
  const logoMode = presentation.logoMode ?? settings.logoMode;
  const editorMode = editorAdapter?.editorMode ?? Boolean(editorAdapter);
  const showHidden = editorAdapter?.showHidden ?? false;
  const showEmpty = editorAdapter?.showEmpty ?? editorMode;
  const columns = orderedFooterItems(settings.columns, showHidden);
  const socialLinks = orderedFooterItems(settings.socialLinks, showHidden);
  const legalLinks = orderedFooterItems(settings.legalLinks, showHidden);
  const contact = settings.contact;
  const hasContact = Boolean(contact.email || contact.phone || contact.address || contact.workingHours);
  const views = resolvedPresentation(settings, presentation, responsivePresentation);
  const mobileColumns = boundedColumnCount(views.mobile.layoutColumns);
  const tabletColumns = boundedColumnCount(views.tablet.layoutColumns);
  const desktopColumns = boundedColumnCount(views.desktop.layoutColumns);
  const controlsFor = (target: SiteFooterControlTarget) => editorAdapter?.renderControls?.(target) ?? null;

  const logo = renderSiteFooterLogo(settings, logoMode);
  const logoDefaultNode = (
    <Link href="/" prefetch={false} aria-label="Atehna domov" className="inline-flex">
      {logo}
    </Link>
  );
  const renderedLogo = slotNode(editorAdapter?.renderLogo, {
    settings,
    logoMode,
    logo,
    defaultNode: logoDefaultNode,
    controls: controlsFor({ scope: 'logo', settings, logoMode })
  });

  const renderedDescription = (settings.description || showEmpty || editorAdapter?.renderDescription)
    ? slotNode(editorAdapter?.renderDescription, {
      value: settings.description,
      defaultNode: settings.description
        ? <p className="site-paragraph mt-4 max-w-xs text-[13px] leading-6">{settings.description}</p>
        : null,
      controls: controlsFor({ scope: 'description', value: settings.description })
    })
    : null;

  const renderedColumns = columns.map((column) => {
    const links = orderedFooterItems(column.links, showHidden);
    const columnHidden = column.visible === false;
    const renderedTitle = slotNode(editorAdapter?.renderColumnTitle, {
      column,
      value: column.title,
      hidden: columnHidden,
      defaultNode: <h2 className="text-[13px] font-semibold text-[color:var(--site-color-text)]">{column.title}</h2>,
      controls: controlsFor({ scope: 'columnTitle', column, value: column.title, hidden: columnHidden })
    });
    const renderedLinks = links.map((link) => {
      const hidden = columnHidden || link.visible === false;
      const renderedLink = slotNode(editorAdapter?.renderLink, {
        placement: 'column' as const,
        link,
        column,
        hidden,
        defaultNode: (
          <Link href={link.href || '#'} prefetch={false} className="site-link text-[13px] leading-5 transition">
            {link.label}
          </Link>
        ),
        controls: controlsFor({ scope: 'link', placement: 'column', link, column, hidden })
      });

      return <li key={link.id}>{renderedLink}</li>;
    });
    const columnChildren = (
      <>
        {renderedTitle}
        {(links.length > 0 || showEmpty) ? <ul className="mt-3 grid gap-2">{renderedLinks}</ul> : null}
      </>
    );
    const columnDefaultNode = <div className="min-w-0">{columnChildren}</div>;

    return (
      <Fragment key={column.id}>
        {slotNode(editorAdapter?.renderColumn, {
          column,
          links,
          hidden: columnHidden,
          children: columnChildren,
          defaultNode: columnDefaultNode,
          controls: controlsFor({ scope: 'column', column, hidden: columnHidden })
        })}
      </Fragment>
    );
  });

  const columnsDefaultNode = (
    <nav
      aria-label="Povezave v nogi"
      className={classNames(
        'grid gap-6',
        mobileColumnClassNames[mobileColumns],
        tabletColumnClassNames[tabletColumns],
        desktopColumnClassNames[desktopColumns]
      )}
    >
      {renderedColumns}
    </nav>
  );
  const shouldRenderColumns = columns.length > 0 || showEmpty || Boolean(editorAdapter?.renderColumns);
  const columnsRegion = shouldRenderColumns
    ? slotNode(editorAdapter?.renderColumns, {
      columns,
      children: renderedColumns,
      defaultNode: columnsDefaultNode,
      controls: controlsFor({ scope: 'columns', columns })
    })
    : <div />;

  const contactFields: Array<{
    field: SiteFooterContactField;
    icon: ReactNode;
    itemClassName: string;
    defaultNode: ReactNode;
  }> = [
    {
      field: 'email',
      icon: <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />,
      itemClassName: 'flex items-center gap-2',
      defaultNode: contact.email
        ? <a href={`mailto:${contact.email}`} className="site-link transition">{contact.email}</a>
        : null
    },
    {
      field: 'phone',
      icon: <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />,
      itemClassName: 'flex items-center gap-2',
      defaultNode: contact.phone
        ? <span>{contact.phone}</span>
        : null
    },
    {
      field: 'address',
      icon: <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />,
      itemClassName: 'flex items-start gap-2',
      defaultNode: contact.address ? <span>{contact.address}</span> : null
    },
    {
      field: 'workingHours',
      icon: <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />,
      itemClassName: 'flex items-start gap-2',
      defaultNode: contact.workingHours ? <span>{contact.workingHours}</span> : null
    }
  ];
  const renderedContactFields = contactFields
    .filter(({ field }) => Boolean(contact[field]) || showEmpty || Boolean(editorAdapter?.renderContactField))
    .map(({ field, icon, itemClassName, defaultNode }) => (
      <li key={field} className={itemClassName}>
        {icon}
        {slotNode(editorAdapter?.renderContactField, {
          contact,
          field,
          value: contact[field],
          icon,
          defaultNode,
          controls: controlsFor({ scope: 'contactField', contact, field, value: contact[field] })
        })}
      </li>
    ));
  const contactChildren = (
    <>
      <h2 id="site-footer-contact-heading" className="text-[13px] font-semibold text-[color:var(--site-color-text)]">
        Kontakt
      </h2>
      <ul className="mt-3 grid gap-2 text-[13px] leading-5 text-[color:var(--site-color-text-muted)]">
        {renderedContactFields}
      </ul>
    </>
  );
  const contactDefaultNode = <section aria-labelledby="site-footer-contact-heading">{contactChildren}</section>;
  const shouldRenderContact = hasContact || showEmpty || Boolean(editorAdapter?.renderContact);
  const contactRegion = shouldRenderContact
    ? slotNode(editorAdapter?.renderContact, {
      contact,
      children: contactChildren,
      defaultNode: contactDefaultNode,
      controls: controlsFor({ scope: 'contact', contact })
    })
    : null;

  const renderedSocialLinks = socialLinks.map((link) => {
    const hidden = link.visible === false;
    const icon = <SiteFooterSocialIcon type={link.type} />;
    const defaultNode = (
      <Link
        href={link.href || '#'}
        prefetch={false}
        aria-label={link.label || socialLabels[link.type]}
        title={link.label || socialLabels[link.type]}
        className="site-link grid h-8 w-8 place-items-center rounded-[var(--site-radius-md,0.5rem)] border border-[color:var(--site-divider-color)] no-underline transition hover:border-[color:var(--site-link-hover)]"
      >
        {icon}
      </Link>
    );

    return (
      <Fragment key={link.id}>
        {slotNode(editorAdapter?.renderSocialLink, {
          link,
          hidden,
          icon,
          defaultNode,
          controls: controlsFor({ scope: 'socialLink', link, hidden })
        })}
      </Fragment>
    );
  });
  const socialHeadingNode = (
    <h2 id="site-footer-social-heading" className="text-[13px] font-semibold text-[color:var(--site-color-text)]">
      Spremljajte nas
    </h2>
  );
  const socialLinkNodes = <div className="mt-3 flex flex-wrap gap-2">{renderedSocialLinks}</div>;
  const socialChildren = (
    <>
      {socialHeadingNode}
      {socialLinkNodes}
    </>
  );
  const socialDefaultNode = (
    <section className={shouldRenderContact ? 'mt-5' : ''} aria-labelledby="site-footer-social-heading">
      {socialChildren}
    </section>
  );
  const shouldRenderSocial = socialLinks.length > 0 || showEmpty || Boolean(editorAdapter?.renderSocial);
  const socialRegion = shouldRenderSocial
    ? slotNode(editorAdapter?.renderSocial, {
      links: socialLinks,
      headingNode: socialHeadingNode,
      linkNodes: renderedSocialLinks,
      children: socialChildren,
      defaultNode: socialDefaultNode,
      controls: controlsFor({ scope: 'social', links: socialLinks })
    })
    : null;

  const renderedCopyright = slotNode(editorAdapter?.renderCopyright, {
    rawValue: settings.copyright,
    resolvedValue: copyright,
    defaultNode: copyright ? <p>{copyright}</p> : <span />,
    controls: controlsFor({ scope: 'copyright', rawValue: settings.copyright, resolvedValue: copyright })
  });
  const renderedLegalLinks = legalLinks.map((link) => {
    const hidden = link.visible === false;
    const renderedLink = slotNode(editorAdapter?.renderLink, {
      placement: 'legal' as const,
      link,
      hidden,
      defaultNode: (
        <Link key={link.id} href={link.href || '#'} prefetch={false} className="site-link transition">
          {link.label}
        </Link>
      ),
      controls: controlsFor({ scope: 'link', placement: 'legal', link, hidden })
    });
    return <Fragment key={link.id}>{renderedLink}</Fragment>;
  });
  const legalDefaultNode = (
    <nav aria-label="Pravne povezave" className="flex flex-wrap gap-x-5 gap-y-2">
      {renderedLegalLinks}
    </nav>
  );
  const shouldRenderLegal = legalLinks.length > 0 || showEmpty || Boolean(editorAdapter?.renderLegal);
  const legalRegion = shouldRenderLegal
    ? slotNode(editorAdapter?.renderLegal, {
      links: legalLinks,
      children: renderedLegalLinks,
      defaultNode: legalDefaultNode,
      controls: controlsFor({ scope: 'legal', links: legalLinks })
    })
    : null;
  const shouldRenderBottom = Boolean(copyright) || legalLinks.length > 0 || showEmpty
    || Boolean(editorAdapter?.renderCopyright) || Boolean(editorAdapter?.renderLegal);

  const surfaceChildren = (
    <div
      className={classNames(
        containerClassName,
        mobileSpacingClassNames[views.mobile.spacing],
        tabletSpacingClassNames[views.tablet.spacing],
        desktopSpacingClassNames[views.desktop.spacing]
      )}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(180px,1fr)_minmax(0,2.2fr)_minmax(220px,0.9fr)]">
        <div className="min-w-0">
          {renderedLogo}
          {renderedDescription}
        </div>

        {columnsRegion}

        <div className="min-w-0">
          {contactRegion}
          {socialRegion}
        </div>
      </div>

      {shouldRenderBottom ? (
        <div className={classNames(
          'site-divider mt-7 flex flex-wrap items-center justify-between gap-3 border-t text-[12px] text-[color:var(--site-color-text-muted)]',
          editorMode ? 'py-2' : 'pt-4'
        )}>
          {renderedCopyright}
          {legalRegion}
        </div>
      ) : null}
    </div>
  );
  const surfaceControls = controlsFor({ scope: 'surface', settings, hidden: !settings.visible });
  const surfaceClassName = classNames(
    'site-footer-surface border-[color:var(--site-divider-color)] bg-[color:var(--site-color-surface)] text-[color:var(--site-color-text)]',
    views.mobile.topBorder ? 'border-t' : 'border-t-0',
    views.tablet.topBorder ? 'sm:border-t' : 'sm:border-t-0',
    views.desktop.topBorder ? 'lg:border-t' : 'lg:border-t-0'
  );
  const surfaceDefaultNode = (
    <footer className={surfaceClassName}>
      {surfaceChildren}
    </footer>
  );

  if (editorAdapter?.renderSurface) {
    return editorAdapter.renderSurface({
      settings,
      hidden: !settings.visible,
      children: surfaceChildren,
      defaultNode: surfaceDefaultNode,
      controls: surfaceControls
    });
  }

  if (!surfaceControls) return surfaceDefaultNode;

  return (
    <footer className={surfaceClassName}>
      {surfaceChildren}
      {surfaceControls}
    </footer>
  );
}
