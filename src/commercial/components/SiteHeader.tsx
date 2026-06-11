'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

type MenuKey = 'products' | 'resources' | 'solutions';
type MenuItemIcon =
  | 'box'
  | 'tool'
  | 'ruler'
  | 'clipboard'
  | 'upload'
  | 'search'
  | 'layers'
  | 'clock'
  | 'book'
  | 'file'
  | 'users'
  | 'mail'
  | 'shield'
  | 'cookie'
  | 'lock'
  | 'school'
  | 'team'
  | 'teacher'
  | 'grid'
  | 'refresh'
  | 'hardhat'
  | 'message'
  | 'repeat'
  | 'truck';

type MenuItem = {
  title: string;
  description?: string;
  href: string;
  icon: MenuItemIcon;
};

type MenuColumn = {
  heading: string;
  items: MenuItem[];
};

type MenuDirection = 'forward' | 'backward';
type MenuMotion = 'from-start' | 'from-end' | 'to-start' | 'to-end';

const desktopPanelId = 'site-desktop-mega-menu';
const mobileMenuId = 'site-mobile-menu';

const menuLabels: Record<MenuKey, string> = {
  products: 'Products',
  resources: 'Resources',
  solutions: 'Solutions'
};

const dropdownOrder: MenuKey[] = ['products', 'resources', 'solutions'];

const megaMenus: Record<MenuKey, MenuColumn[]> = {
  products: [
    {
      heading: 'Catalog',
      items: [
        {
          title: 'Teaching Materials',
          description: 'Consumables and classroom essentials',
          href: '/products',
          icon: 'box'
        },
        {
          title: 'Workshop Equipment',
          description: 'Tools, machines, and accessories',
          href: '/products#workshop',
          icon: 'tool'
        },
        {
          title: 'Measuring Tools',
          description: 'Precision instruments for lessons',
          href: '/products#measuring',
          icon: 'ruler'
        }
      ]
    },
    {
      heading: 'Operations',
      items: [
        {
          title: 'Order Portal',
          description: 'Prepare and submit school orders',
          href: '/order',
          icon: 'clipboard'
        },
        {
          title: 'Purchase Orders',
          description: 'Upload documentation in one flow',
          href: '/order/narocilnica',
          icon: 'upload'
        },
        {
          title: 'Catalog Search',
          description: 'Find products by category or keyword',
          href: '/products',
          icon: 'search'
        }
      ]
    },
    {
      heading: 'Platform',
      items: [
        {
          title: 'Technical Preview',
          description: 'Explore product details before ordering',
          href: '/products',
          icon: 'layers'
        },
        {
          title: 'Availability',
          description: 'Plan purchases around current supply',
          href: '/contact',
          icon: 'clock'
        },
        {
          title: 'Documentation',
          description: 'How ordering and delivery work',
          href: '/how-schools-order',
          icon: 'book'
        }
      ]
    }
  ],
  resources: [
    {
      heading: 'Learn',
      items: [
        {
          title: 'Ordering Guide',
          description: 'Steps for public school procurement',
          href: '/how-schools-order',
          icon: 'book'
        },
        {
          title: 'Product Notes',
          description: 'Practical details for classroom use',
          href: '/products',
          icon: 'file'
        },
        {
          title: 'Terms',
          description: 'Commercial and delivery conditions',
          href: '/terms',
          icon: 'clipboard'
        }
      ]
    },
    {
      heading: 'Company',
      items: [
        {
          title: 'About Atehna',
          description: 'Focused support for technical education',
          href: '/about',
          icon: 'users'
        },
        {
          title: 'Contact',
          description: 'Reach the team for a quote or question',
          href: '/contact',
          icon: 'mail'
        },
        {
          title: 'Privacy',
          description: 'How customer data is handled',
          href: '/privacy',
          icon: 'shield'
        }
      ]
    },
    {
      heading: 'Support',
      items: [
        {
          title: 'Order Help',
          description: 'Get assistance with an active request',
          href: '/contact',
          icon: 'message'
        },
        {
          title: 'Cookies',
          description: 'Manage website preferences',
          href: '/cookies',
          icon: 'cookie'
        },
        {
          title: 'Account Access',
          description: 'Administrative login for the team',
          href: '/admin',
          icon: 'lock'
        }
      ]
    }
  ],
  solutions: [
    {
      heading: 'By Team',
      items: [
        {
          title: 'Primary Schools',
          description: 'Reliable supply for yearly programs',
          href: '/products',
          icon: 'school'
        },
        {
          title: 'Procurement Teams',
          description: 'Clear ordering and documentation flows',
          href: '/how-schools-order',
          icon: 'team'
        },
        {
          title: 'Technical Teachers',
          description: 'Materials matched to classroom projects',
          href: '/products',
          icon: 'teacher'
        }
      ]
    },
    {
      heading: 'By Need',
      items: [
        {
          title: 'Classroom Kits',
          description: 'Bundled materials for repeat lessons',
          href: '/products#kits',
          icon: 'grid'
        },
        {
          title: 'Workshop Renewal',
          description: 'Refresh tools and storage in stages',
          href: '/contact',
          icon: 'refresh'
        },
        {
          title: 'Safety Supplies',
          description: 'Protective gear and workshop basics',
          href: '/products#safety',
          icon: 'hardhat'
        }
      ]
    },
    {
      heading: 'By Workflow',
      items: [
        {
          title: 'Quote Requests',
          description: 'Start a focused procurement conversation',
          href: '/contact',
          icon: 'message'
        },
        {
          title: 'Fast Reorders',
          description: 'Return to known categories quickly',
          href: '/products',
          icon: 'repeat'
        },
        {
          title: 'Delivery Planning',
          description: 'Coordinate timing across school terms',
          href: '/contact',
          icon: 'truck'
        }
      ]
    }
  ]
};

const staticNavItems = [
  { label: 'Enterprise', href: '/about' },
  { label: 'Pricing', href: '/contact' }
];

const ctas = [
  { label: 'Ask AI', href: '/contact', variant: 'secondary' },
  { label: 'Log In', href: '/admin', variant: 'ghost' },
  { label: 'Sign Up', href: '/order', variant: 'primary' }
] as const;

function Brand() {
  return (
    <span className="inline-flex items-center gap-2 text-black">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] bg-black text-[15px] font-semibold leading-none text-white">
        A
      </span>
      <span className="text-[23px] font-semibold leading-none tracking-normal">Atehna</span>
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`h-[18px] w-[18px] transition duration-150 ${
        open ? 'rotate-180 opacity-100' : 'opacity-60'
      }`}
      fill="none"
    >
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative h-[21px] w-[21px]"
    >
      <span
        className={`absolute left-0 top-1 h-px w-[21px] bg-current transition duration-150 ${
          open ? 'translate-y-[7px] rotate-45' : ''
        }`}
      />
      <span
        className={`absolute left-0 top-[11px] h-px w-[21px] bg-current transition duration-150 ${
          open ? 'opacity-0' : ''
        }`}
      />
      <span
        className={`absolute left-0 top-[18px] h-px w-[21px] bg-current transition duration-150 ${
          open ? '-translate-y-[7px] -rotate-45' : ''
        }`}
      />
    </span>
  );
}

function MenuItemGlyph({ icon }: { icon: MenuItemIcon }) {
  let path: ReactNode;

  switch (icon) {
    case 'box':
      path = (
        <>
          <path d="m4.5 8 7.5-4 7.5 4-7.5 4-7.5-4Z" />
          <path d="M4.5 8v8l7.5 4 7.5-4V8" />
          <path d="M12 12v8" />
        </>
      );
      break;
    case 'tool':
      path = (
        <>
          <path d="m14.5 5.5 4 4" />
          <path d="M4.5 19.5 15.8 8.2" />
          <path d="M16 4.5 19.5 8l-2.2 2.2-3.5-3.5L16 4.5Z" />
        </>
      );
      break;
    case 'ruler':
      path = (
        <>
          <path d="M4.5 16.5 16.5 4.5l3 3-12 12-3-3Z" />
          <path d="m8 13 1.4 1.4" />
          <path d="m10.5 10.5 1.4 1.4" />
          <path d="m13 8 1.4 1.4" />
        </>
      );
      break;
    case 'clipboard':
      path = (
        <>
          <path d="M8.5 5.5h7l.8 2h1.2v12h-11v-12h1.2l.8-2Z" />
          <path d="M9 11h6" />
          <path d="M9 15h5" />
        </>
      );
      break;
    case 'upload':
      path = (
        <>
          <path d="M12 15V5" />
          <path d="m8.5 8.5 3.5-3.5 3.5 3.5" />
          <path d="M5.5 15.5v3h13v-3" />
        </>
      );
      break;
    case 'search':
      path = (
        <>
          <path d="M10.8 16.1a5.3 5.3 0 1 0 0-10.6 5.3 5.3 0 0 0 0 10.6Z" />
          <path d="m15 15 4 4" />
        </>
      );
      break;
    case 'layers':
      path = (
        <>
          <path d="m4.5 8 7.5-4 7.5 4-7.5 4-7.5-4Z" />
          <path d="m4.5 12 7.5 4 7.5-4" />
          <path d="m4.5 16 7.5 4 7.5-4" />
        </>
      );
      break;
    case 'clock':
      path = (
        <>
          <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
          <path d="M12 8v4.5l3 1.8" />
        </>
      );
      break;
    case 'book':
      path = (
        <>
          <path d="M5.5 5.5h5A2.5 2.5 0 0 1 13 8v11a2.5 2.5 0 0 0-2.5-2.5h-5v-11Z" />
          <path d="M18.5 5.5h-3A2.5 2.5 0 0 0 13 8v11a2.5 2.5 0 0 1 2.5-2.5h3v-11Z" />
        </>
      );
      break;
    case 'file':
      path = (
        <>
          <path d="M7 4.5h7l3 3v12h-10v-15Z" />
          <path d="M14 4.5v3h3" />
          <path d="M9 12h6" />
          <path d="M9 15h5" />
        </>
      );
      break;
    case 'users':
      path = (
        <>
          <path d="M9.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M4.5 19c.6-3 2.4-4.5 5-4.5s4.4 1.5 5 4.5" />
          <path d="M15 11.5a2.5 2.5 0 1 0 0-5" />
          <path d="M15.5 14.5c2.1.3 3.5 1.8 4 4.5" />
        </>
      );
      break;
    case 'mail':
      path = (
        <>
          <path d="M5 7h14v10h-14V7Z" />
          <path d="m5 8 7 5 7-5" />
        </>
      );
      break;
    case 'shield':
      path = (
        <>
          <path d="M12 4.5 18 7v4.5c0 4-2.2 6.6-6 8-3.8-1.4-6-4-6-8V7l6-2.5Z" />
          <path d="m9.5 12 1.7 1.7 3.5-4" />
        </>
      );
      break;
    case 'cookie':
      path = (
        <>
          <path d="M18.5 12.5A6.5 6.5 0 1 1 11.5 5c.1 2.3 1.7 3.7 4 3.6.1 1.8 1.1 3 3 3.9Z" />
          <path d="M9 10h.1" />
          <path d="M12 15h.1" />
          <path d="M8 15h.1" />
        </>
      );
      break;
    case 'lock':
      path = (
        <>
          <path d="M7 10h10v9h-10v-9Z" />
          <path d="M9 10V8a3 3 0 0 1 6 0v2" />
          <path d="M12 14v2" />
        </>
      );
      break;
    case 'school':
      path = (
        <>
          <path d="m4 10 8-4 8 4-8 4-8-4Z" />
          <path d="M7 12.2v3.3c1.6 1.2 3.2 1.8 5 1.8s3.4-.6 5-1.8v-3.3" />
          <path d="M20 10v5" />
        </>
      );
      break;
    case 'team':
      path = (
        <>
          <path d="M8 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          <path d="M16 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          <path d="M4.5 18.5c.5-2.7 1.8-4 3.5-4s3 1.3 3.5 4" />
          <path d="M12.5 18.5c.5-2.7 1.8-4 3.5-4s3 1.3 3.5 4" />
        </>
      );
      break;
    case 'teacher':
      path = (
        <>
          <path d="M8.5 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M4 19c.5-3 2.1-4.5 4.5-4.5S12.5 16 13 19" />
          <path d="M14 6.5h6v8h-5" />
          <path d="M16 10.5h2" />
        </>
      );
      break;
    case 'grid':
      path = (
        <>
          <path d="M5.5 5.5h5v5h-5v-5Z" />
          <path d="M13.5 5.5h5v5h-5v-5Z" />
          <path d="M5.5 13.5h5v5h-5v-5Z" />
          <path d="M13.5 13.5h5v5h-5v-5Z" />
        </>
      );
      break;
    case 'refresh':
      path = (
        <>
          <path d="M18 8a6 6 0 0 0-10.2-2.2L6 7.5" />
          <path d="M6 4.5v3h3" />
          <path d="M6 16a6 6 0 0 0 10.2 2.2L18 16.5" />
          <path d="M18 19.5v-3h-3" />
        </>
      );
      break;
    case 'hardhat':
      path = (
        <>
          <path d="M5 15.5h14" />
          <path d="M7 15.5v-2a5 5 0 0 1 10 0v2" />
          <path d="M10 15.5v-7" />
          <path d="M14 15.5v-7" />
          <path d="M6.5 18.5h11" />
        </>
      );
      break;
    case 'message':
      path = (
        <>
          <path d="M5 6.5h14v9.5h-8l-4.5 3v-3H5V6.5Z" />
          <path d="M8 10h8" />
          <path d="M8 13h5" />
        </>
      );
      break;
    case 'repeat':
      path = (
        <>
          <path d="M7 7h9.5l2 2" />
          <path d="m16.5 5 2 2-2 2" />
          <path d="M17 17H7.5l-2-2" />
          <path d="m7.5 19-2-2 2-2" />
        </>
      );
      break;
    case 'truck':
      path = (
        <>
          <path d="M4.5 7h9.5v8h-9.5V7Z" />
          <path d="M14 10h3l2.5 3v2H14v-5Z" />
          <path d="M8 18a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 8 18Z" />
          <path d="M16.5 18a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" />
        </>
      );
      break;
  }

  return (
    <span className="inline-flex h-[43px] w-[43px] shrink-0 items-center justify-center rounded-lg border border-[#e8e8e8] bg-[#fafafa] text-[#5f6368] transition group-hover:border-[#dedede] group-hover:bg-white group-hover:text-black">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-[21px] w-[21px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {path}
      </svg>
    </span>
  );
}

function DesktopMenuContent({
  menu,
  onNavigate,
  motion,
  isExiting = false
}: {
  menu: MenuKey;
  onNavigate: () => void;
  motion?: MenuMotion;
  isExiting?: boolean;
}) {
  const motionClass = motion ? `site-menu-content-${motion}` : '';

  return (
    <div
      key={menu}
      aria-hidden={isExiting}
      className={`site-menu-content grid grid-cols-3 gap-[11px] p-4 ${motionClass} ${
        isExiting ? 'pointer-events-none absolute inset-0' : 'relative'
      }`}
    >
      {megaMenus[menu].map((column) => (
        <section key={column.heading} aria-labelledby={`${menu}-${column.heading}`}>
          <h2
            id={`${menu}-${column.heading}`}
            className="px-4 pb-[11px] pt-[5px] text-[17px] font-medium leading-[27px] text-[#666666]"
          >
            {column.heading}
          </h2>
          <ul className="space-y-[5px]">
            {column.items.map((item) => (
              <li key={item.title}>
                <Link
                  href={item.href}
                  prefetch={false}
                  onClick={onNavigate}
                  className="group grid h-[92px] grid-cols-[43px_1fr] items-center gap-[13px] overflow-hidden rounded-lg px-3 transition hover:bg-[#f5f5f5] focus-visible:bg-[#f5f5f5]"
                >
                  <MenuItemGlyph icon={item.icon} />
                  <span className="block min-w-0">
                    <span className="block truncate text-[19px] font-medium leading-[24px] text-[#111111]">
                      {item.title}
                    </span>
                    {item.description ? (
                      <span className="site-menu-description-clamp mt-[3px] block text-[17px] font-normal leading-[23px] text-[#6b7280]">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MobileAccordion({
  menu,
  open,
  onToggle,
  onNavigate
}: {
  menu: MenuKey;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const panelId = `site-mobile-${menu}-panel`;

  return (
    <div className="border-b border-[#eeeeee]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between px-[27px] py-[21px] text-left text-xl font-medium text-[#111111] transition hover:bg-[#f7f7f7]"
      >
        <span>{menuLabels[menu]}</span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <div id={panelId} className="pb-4">
          {megaMenus[menu].map((column) => (
            <section
              key={column.heading}
              className="px-[27px] pb-4"
            >
              <h2 className="pb-[5px] text-base font-medium uppercase tracking-normal text-[#737373]">
                {column.heading}
              </h2>
              <ul className="space-y-[5px]">
                {column.items.map((item) => (
                  <li key={item.title}>
                    <Link
                      href={item.href}
                      prefetch={false}
                      onClick={onNavigate}
                      className="group grid min-h-[82px] grid-cols-[43px_1fr] items-center gap-[13px] rounded-lg px-3 py-[9px] transition hover:bg-[#f5f5f5] focus-visible:bg-[#f5f5f5]"
                    >
                      <MenuItemGlyph icon={item.icon} />
                      <span className="block min-w-0">
                        <span className="block text-[19px] font-medium leading-[24px] text-[#111111]">
                          {item.title}
                        </span>
                        {item.description ? (
                          <span className="mt-[3px] block text-[17px] leading-[23px] text-[#6b7280]">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DesktopCta({
  label,
  href,
  variant,
  onNavigate
}: {
  label: string;
  href: string;
  variant: 'secondary' | 'ghost' | 'primary';
  onNavigate: () => void;
}) {
  const className =
    variant === 'primary'
      ? 'bg-black text-white hover:bg-[#1f1f1f]'
      : variant === 'secondary'
        ? 'border border-[#dedede] bg-white text-[#111111] hover:bg-[#f5f5f5]'
        : 'text-[#555555] hover:bg-[#f5f5f5] hover:text-black';

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onNavigate}
      className={`inline-flex h-[43px] items-center justify-center rounded-lg px-4 text-[19px] font-medium leading-none transition ${className}`}
    >
      {label}
    </Link>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const switchTimerRef = useRef<number | null>(null);
  const activeMenuRef = useRef<MenuKey | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const [previousMenu, setPreviousMenu] = useState<MenuKey | null>(null);
  const [menuDirection, setMenuDirection] = useState<MenuDirection | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileMenus, setOpenMobileMenus] = useState<MenuKey[]>([]);
  const isAdminPath = pathname.startsWith('/admin');

  const clearSwitchTimer = () => {
    if (switchTimerRef.current !== null) {
      window.clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }
  };

  const closeMenus = () => {
    clearSwitchTimer();
    activeMenuRef.current = null;
    setActiveMenu(null);
    setPreviousMenu(null);
    setMenuDirection(null);
    setMobileOpen(false);
  };

  const openDesktopMenu = (nextMenu: MenuKey) => {
    const currentMenu = activeMenuRef.current;

    if (currentMenu === nextMenu) {
      return;
    }

    clearSwitchTimer();

    if (currentMenu) {
      const currentIndex = dropdownOrder.indexOf(currentMenu);
      const nextIndex = dropdownOrder.indexOf(nextMenu);

      setPreviousMenu(currentMenu);
      setMenuDirection(nextIndex > currentIndex ? 'forward' : 'backward');
      switchTimerRef.current = window.setTimeout(() => {
        setPreviousMenu(null);
        setMenuDirection(null);
        switchTimerRef.current = null;
      }, 220);
    } else {
      setPreviousMenu(null);
      setMenuDirection(null);
    }

    activeMenuRef.current = nextMenu;
    setActiveMenu(nextMenu);
  };

  useEffect(() => {
    closeMenus();
    // closeMenus intentionally stays local to keep the route-change reset immediate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!headerRef.current?.contains(target)) {
        setActiveMenu(null);
        setMobileOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenu(null);
        setMobileOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearSwitchTimer();
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (isAdminPath) {
    return (
      <header className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center px-5 sm:px-8">
          <Link
            href="/"
            prefetch={false}
            aria-label="Atehna home"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-black/20"
          >
            <Brand />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header
      ref={headerRef}
      className="relative z-50 border-b border-[#e5e5e5] bg-white text-black [font-family:Inter,Geist,system-ui,sans-serif]"
    >
      <div className="flex h-[85px] w-full items-center justify-between gap-[21px] px-8">
        <Link
          href="/"
          prefetch={false}
          aria-label="Atehna home"
          onClick={closeMenus}
          className="inline-flex shrink-0 rounded-lg px-[5px] py-[5px] transition hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-black/20"
        >
          <Brand />
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden flex-1 items-center justify-center gap-[5px] lg:flex"
        >
          {dropdownOrder.map((key) => {
            const open = activeMenu === key;

            return (
              <button
                key={key}
                type="button"
                aria-expanded={open}
                aria-controls={desktopPanelId}
                aria-haspopup="true"
                onClick={() => openDesktopMenu(key)}
                onFocus={() => openDesktopMenu(key)}
                onMouseEnter={() => openDesktopMenu(key)}
                className={`inline-flex h-[43px] items-center gap-2 rounded-lg px-4 text-[19px] font-medium leading-none transition hover:bg-[#f5f5f5] hover:text-black focus-visible:ring-2 focus-visible:ring-black/20 ${
                  open ? 'text-black' : 'text-[#666666]'
                }`}
              >
                <span>{menuLabels[key]}</span>
                <ChevronIcon open={open} />
              </button>
            );
          })}

          {staticNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={closeMenus}
              className="inline-flex h-[43px] items-center rounded-lg px-4 text-[19px] font-medium leading-none text-[#666666] transition hover:bg-[#f5f5f5] hover:text-black focus-visible:ring-2 focus-visible:ring-black/20"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-[11px] lg:flex">
          {ctas.map((cta) => (
            <DesktopCta
              key={cta.label}
              label={cta.label}
              href={cta.href}
              variant={cta.variant}
              onNavigate={closeMenus}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          aria-controls={mobileMenuId}
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex h-12 w-12 items-center justify-center rounded-lg text-black transition hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-black/20 lg:hidden"
        >
          <MenuIcon open={mobileOpen} />
        </button>
      </div>

      {activeMenu ? (
        <div
          id={desktopPanelId}
          className="site-menu-perspective absolute left-1/2 top-full hidden w-[1013px] max-w-[calc(100vw-48px)] -translate-x-1/2 pt-[11px] lg:block"
        >
          <div className="site-menu-viewport-open overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="relative overflow-hidden">
              {previousMenu && menuDirection ? (
                <DesktopMenuContent
                  menu={previousMenu}
                  onNavigate={closeMenus}
                  motion={menuDirection === 'forward' ? 'to-start' : 'to-end'}
                  isExiting
                />
              ) : null}
              <DesktopMenuContent
                menu={activeMenu}
                onNavigate={closeMenus}
                motion={
                  previousMenu && menuDirection
                    ? menuDirection === 'forward'
                      ? 'from-end'
                      : 'from-start'
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      {mobileOpen ? (
        <div
          id={mobileMenuId}
          className="max-h-[calc(100vh-64px)] overflow-y-auto border-t border-[#eeeeee] bg-white lg:hidden"
        >
          <nav
            aria-label="Mobile navigation"
            className="pb-[27px]"
          >
            {dropdownOrder.map((key) => (
              <MobileAccordion
                key={key}
                menu={key}
                open={openMobileMenus.includes(key)}
                onToggle={() =>
                  setOpenMobileMenus((openMenus) =>
                    openMenus.includes(key)
                      ? openMenus.filter((openMenu) => openMenu !== key)
                      : [...openMenus, key]
                  )
                }
                onNavigate={closeMenus}
              />
            ))}

            <div className="border-b border-[#eeeeee] py-2">
              {staticNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={closeMenus}
                className="block px-[27px] py-4 text-xl font-medium text-[#111111] transition hover:bg-[#f5f5f5] focus-visible:bg-[#f5f5f5]"
              >
                {item.label}
              </Link>
            ))}
          </div>

            <div className="grid gap-[11px] px-[27px] pt-[21px]">
              {ctas.map((cta) => (
                <Link
                  key={cta.label}
                  href={cta.href}
                  prefetch={false}
                  onClick={closeMenus}
                  className={`inline-flex h-[53px] items-center justify-center rounded-lg px-[21px] text-[19px] font-medium transition ${
                    cta.variant === 'primary'
                      ? 'bg-black text-white hover:bg-[#1f1f1f]'
                      : cta.variant === 'secondary'
                        ? 'border border-[#dedede] bg-white text-[#111111] hover:bg-[#f5f5f5]'
                        : 'text-[#555555] hover:bg-[#f5f5f5] hover:text-black'
                  }`}
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
