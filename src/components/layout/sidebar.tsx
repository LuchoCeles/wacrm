'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTotalUnread } from '@/hooks/use-total-unread';
import { useUnreadNotifications } from '@/hooks/use-unread-notifications';
import {
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
  Crown,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Radio,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import type { AccountRole } from '@/lib/auth/roles';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Per-role chip metadata used in the sidebar's account strip + the
// Members tab roster. Keeping this near both consumers in a single
// place avoids drift between the two surfaces — when a designer
// wants to recolour "agent" rows, this is the one diff.
const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; labelKey: string; className: string }
> = {
  owner: {
    icon: Crown,
    labelKey: 'roleOwner',
    // Amber: scarce, immutable, "the boss" — gets visual emphasis.
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  admin: {
    icon: Shield,
    labelKey: 'roleAdmin',
    // Primary-tinted: significant but not as scarce as owner.
    className: 'border-primary/40 bg-primary/10 text-primary',
  },
  agent: {
    icon: UserCog,
    labelKey: 'roleAgent',
    // Neutral slate: the operational default.
    className: 'border-border bg-muted text-foreground',
  },
  viewer: {
    icon: User,
    labelKey: 'roleViewer',
    // Muted slate: read-only role; visually quieter than agent.
    className: 'border-border bg-card text-muted-foreground',
  },
};
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  /**
   * When true, the nav row renders a small "Beta" chip after the label.
   * Purely informational — doesn't affect routing or access.
   */
  beta?: boolean;
}

const navItems: NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/inbox', labelKey: 'inbox', icon: MessageSquare },
  { href: '/notifications', labelKey: 'notifications', icon: Bell },
  { href: '/contacts', labelKey: 'contacts', icon: Users },
  { href: '/pipelines', labelKey: 'pipelines', icon: GitBranch },
  { href: '/broadcasts', labelKey: 'broadcasts', icon: Radio },
  { href: '/automations', labelKey: 'automations', icon: Zap },
  { href: '/flows', labelKey: 'flows', icon: Workflow, beta: true },
  { href: '/agents', labelKey: 'aiAgents', icon: Bot },
];

const bottomNavItems = [
  { href: '/settings', labelKey: 'settings', icon: Settings },
];

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
}

import { useTranslations } from 'next-intl';

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const t = useTranslations('Sidebar');
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { profile, profileLoading, account, accountRole, signOut } = useAuth();
  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();
  // Only surface the account-name strip when it actually carries
  // information. A solo user's personal account is named after them
  // (the 017 signup trigger seeds it from `full_name`), so showing it
  // here would just duplicate the user name in the footer below. Once
  // the account is renamed or the user joins a shared account, the
  // name diverges and the strip becomes meaningful — that's the signal
  // we gate on. Wait for the profile fetch to settle first, otherwise
  // the strip flashes in once the row resolves (a layout jump).
  const showAccountStrip =
    !profileLoading && !!account?.name && account.name !== profile?.full_name;

  // Close the drawer when route changes — users opened it to navigate,
  // so once they pick a destination the drawer should get out of the way.
  useEffect(() => {
    onClose?.();
    // Only pathname drives this — onClose identity doesn't need to re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll and allow Escape to close while the drawer is open on
  // mobile. No-ops on desktop because the sidebar isn't positioned there.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Desktop navigation is a personal presentation preference, so retain it
  // across visits without involving the server-rendered dashboard shell.
  useEffect(() => {
    setIsCollapsed(window.localStorage.getItem('sidebar-collapsed') === 'true');
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  return (
    <>
      {/* Backdrop — only exists on mobile and only when open. Clicking
          it closes the drawer. Hidden from lg+ since the sidebar is
          part of the main flex row there. */}
      <button
        type="button"
        aria-label={t('closeMenu')}
        onClick={onClose}
        className={cn(
          'bg-background/70 fixed inset-0 z-30 backdrop-blur-sm transition-opacity lg:hidden',
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
      />

      <TooltipProvider>
        <aside
          className={cn(
            // Mobile: fixed drawer that slides in from the left.
            'border-border bg-card fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r',
            'transition-transform duration-200 ease-out will-change-transform',
            open ? 'translate-x-0' : '-translate-x-full',
            // Desktop: static and always visible, with a compact icon rail.
            'lg:static lg:z-0 lg:translate-x-0 lg:transition-[width] lg:duration-200',
            isCollapsed ? 'lg:w-16' : 'lg:w-60'
          )}
          aria-label="Primary"
        >
          {/* Logo row. On mobile we put a close button here; on desktop the
            close button is hidden since the sidebar is always-visible. */}
          <div
            className={cn(
              'group/sidebar-logo border-border relative flex h-14 shrink-0 items-center gap-2 border-b px-4',
              isCollapsed ? 'lg:justify-center lg:px-3' : 'justify-between'
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href="/dashboard"
                aria-label={t('title')}
                className="flex min-w-0 items-center gap-2"
              >
                <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    'text-foreground truncate text-sm font-semibold',
                    isCollapsed && 'lg:hidden'
                  )}
                >
                  {t('title')}
                </span>
              </Link>
              {/* In its expanded form this sits directly after the title:
                icon + title + collapse control. */}
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={t('collapseSidebar')}
                aria-expanded={true}
                className={cn(
                  'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring hidden h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none lg:flex',
                  isCollapsed && 'pointer-events-none absolute opacity-0'
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            {isCollapsed ? (
              /* Keep the compact state to the logo alone. The expand action is
                revealed over that logo on hover or keyboard focus. */
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={t('expandSidebar')}
                aria-expanded={false}
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring absolute top-1/2 hidden size-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg shadow-sm transition-opacity focus-visible:ring-2 focus-visible:outline-none lg:pointer-events-none lg:left-1/2 lg:flex lg:opacity-0 lg:group-hover/sidebar-logo:pointer-events-auto lg:group-hover/sidebar-logo:opacity-100 lg:focus-visible:pointer-events-auto lg:focus-visible:opacity-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('closeMenu')}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 items-center justify-center rounded-md lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Main navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' &&
                    pathname.startsWith(item.href));

                const showUnreadDot =
                  item.href === '/inbox' && totalUnread > 0 && !isActive;

                // Unlike the inbox dot, the notifications count stays visible
                // even while the page is active — it reflects unread state
                // (cleared by marking notifications read), not "currently
                // viewing this section".
                const showNotificationBadge =
                  item.href === '/notifications' && unreadNotifications > 0;

                return (
                  <li key={item.href}>
                    <Tooltip disabled={!isCollapsed}>
                      <TooltipTrigger
                        render={
                          <Link
                            href={item.href}
                            aria-label={t(item.labelKey as string)}
                            className={cn(
                              // Taller on mobile so fingers can hit the row reliably (≥44px).
                              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2',
                              isCollapsed && 'lg:justify-center lg:px-0',
                              isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span
                              className={cn(
                                'flex-1',
                                isCollapsed && 'lg:hidden'
                              )}
                            >
                              {t(item.labelKey as string)}
                            </span>
                            {item.beta && (
                              <span
                                aria-label={t('beta')}
                                className={cn(
                                  'rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-amber-300 uppercase',
                                  isCollapsed && 'lg:hidden'
                                )}
                              >
                                {t('beta')}
                              </span>
                            )}
                            {showUnreadDot && (
                              <span
                                aria-label={t('unreadConversations', {
                                  count: totalUnread,
                                })}
                                className={cn(
                                  'relative flex h-2 w-2',
                                  isCollapsed && 'lg:hidden'
                                )}
                              >
                                <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                                <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
                              </span>
                            )}
                            {showNotificationBadge && (
                              <span
                                aria-label={t('unreadNotifications', {
                                  count: unreadNotifications,
                                })}
                                className={cn(
                                  'bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                                  isCollapsed && 'lg:hidden'
                                )}
                              >
                                {unreadNotifications > 9
                                  ? '9+'
                                  : unreadNotifications}
                              </span>
                            )}
                          </Link>
                        }
                      />
                      <TooltipContent side="right">
                        {t(item.labelKey as string)}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>

            <div className="border-border my-4 border-t" />

            <ul className="flex flex-col gap-1">
              {bottomNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Tooltip disabled={!isCollapsed}>
                      <TooltipTrigger
                        render={
                          <Link
                            href={item.href}
                            aria-label={t(item.labelKey as string)}
                            className={cn(
                              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2',
                              isCollapsed && 'lg:justify-center lg:px-0',
                              isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className={cn(isCollapsed && 'lg:hidden')}>
                              {t(item.labelKey as string)}
                            </span>
                          </Link>
                        }
                      />
                      <TooltipContent side="right">
                        {t(item.labelKey as string)}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User section */}
          <div className="border-border shrink-0 border-t p-3">
            {/* Account name display — surfaced only when the account
              name differs from the user's own name (see
              `showAccountStrip`). For a default solo account the two
              match, so we hide it to avoid duplicating the user name
              below; for renamed or shared accounts it tells the user
              which account they're acting in. */}
            {showAccountStrip && account?.name ? (
              <div
                className={cn(
                  'text-muted-foreground mb-2 flex items-center gap-2 px-3 text-xs',
                  isCollapsed && 'lg:hidden'
                )}
              >
                <UsersRound className="size-3.5 shrink-0" />
                {/* `title=` exposes the full name on hover when it
                  gets truncated (long account names + narrow
                  sidebars). Cheap a11y win. */}
                <span className="truncate" title={account.name}>
                  {account.name}
                </span>
                {accountRole
                  ? // Always render the chip — owners used to be
                    // invisible here, which made them indistinguishable
                    // from admins at a glance. Now everyone sees their
                    // role (with a colour cue) regardless of tier.
                    (() => {
                      const meta = ROLE_CHIP[accountRole];
                      const Icon = meta.icon;
                      return (
                        <span
                          className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase ${meta.className}`}
                        >
                          <Icon className="size-3" />
                          {t(meta.labelKey as string)}
                        </span>
                      );
                    })()
                  : null}
              </div>
            ) : null}
            <DropdownMenu>
              <Tooltip disabled={!isCollapsed}>
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      aria-label={profile?.full_name ?? t('defaultUser')}
                      className={cn(
                        'hover:bg-muted/60 focus:bg-muted/60 data-popup-open:bg-muted/60 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus:outline-none',
                        isCollapsed && 'lg:justify-center lg:px-0'
                      )}
                    />
                  }
                >
                  <Avatar className="size-8 shrink-0">
                    {profile?.avatar_url ? (
                      <AvatarImage
                        src={profile.avatar_url}
                        alt={profile.full_name ?? t('defaultAvatar')}
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {profile?.full_name?.charAt(0)?.toUpperCase() ??
                        profile?.email?.charAt(0)?.toUpperCase() ??
                        'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn('min-w-0 flex-1', isCollapsed && 'lg:hidden')}
                  >
                    <p className="text-foreground truncate text-sm font-medium">
                      {profile?.full_name ?? t('defaultUser')}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {profile?.email ?? ''}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {profile?.full_name ?? t('defaultUser')}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                side="top"
                sideOffset={6}
                className="bg-popover text-popover-foreground ring-border min-w-56"
              >
                <DropdownMenuItem
                  render={
                    <Link
                      href="/settings?tab=profile"
                      onClick={onClose}
                      className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                    />
                  }
                >
                  <User className="size-4" />
                  {t('menuProfile')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <Link
                      href="/settings?tab=whatsapp"
                      onClick={onClose}
                      className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                    />
                  }
                >
                  <Settings className="size-4" />
                  {t('menuSettings')}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={signOut}
                  className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <LogOut className="size-4" />
                  {t('menuSignOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      </TooltipProvider>
    </>
  );
}
