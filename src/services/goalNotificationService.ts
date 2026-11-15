import {
  GoalAlertItem,
  KickoffAlertItem,
  MatchItem,
  detectFavoredTeamGoalEvents,
  detectAllGoalEvents,
  detectUpcomingTwoMinuteKickoffs,
} from '../utils/footballLogic';

export type BrowserNotificationState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export type UnifiedMatchAlert =
  | ({ alertType: 'GOAL' } & GoalAlertItem)
  | ({ alertType: 'KICKOFF_2MIN' } & KickoffAlertItem);

type GoalAlertListener = (alert: GoalAlertItem, dispatchedViaBrowserApi: boolean) => void;
type UnifiedAlertListener = (alert: UnifiedMatchAlert, dispatchedViaOsApi: boolean) => void;

class GoalNotificationService {
  private listeners = new Set<GoalAlertListener>();
  private unifiedListeners = new Set<UnifiedAlertListener>();
  private dispatchedIds = new Map<string, number>();

  constructor() {
    this.cleanExpiredAlertIds();
  }

  /**
   * Cleans up alert IDs older than 2 hours from memory and sessionStorage
   */
  public cleanExpiredAlertIds(): void {
    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    try {
      const saved = sessionStorage.getItem('ks_dispatched_alert_ids_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [id, time] of Object.entries(parsed)) {
            const timeNum = Number(time);
            if (now - timeNum < TWO_HOURS_MS) {
              this.dispatchedIds.set(id, timeNum);
            }
          }
        }
      } else {
        // Migration from legacy array
        const oldSaved = sessionStorage.getItem('ks_dispatched_alert_ids_v1');
        if (oldSaved) {
          sessionStorage.removeItem('ks_dispatched_alert_ids_v1');
        }
      }
    } catch {
      // ignore storage errors
    }

    // Prune in-memory map
    for (const [id, time] of this.dispatchedIds.entries()) {
      if (now - time >= TWO_HOURS_MS) {
        this.dispatchedIds.delete(id);
      }
    }
  }

  private persistDispatchedIds(): void {
    try {
      this.cleanExpiredAlertIds();
      const obj: Record<string, number> = {};
      for (const [id, time] of this.dispatchedIds.entries()) {
        obj[id] = time;
      }
      sessionStorage.setItem('ks_dispatched_alert_ids_v2', JSON.stringify(obj));
    } catch {
      // ignore storage errors
    }
  }

  /**
   * Returns current browser Notification API permission status safely.
   */
  public getPermissionStatus(): BrowserNotificationState {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return window.Notification.permission as BrowserNotificationState;
  }

  /**
   * Requests browser/OS Notification API permission from the user.
   */
  public async requestPermission(): Promise<BrowserNotificationState> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      const result = await window.Notification.requestPermission();
      return result as BrowserNotificationState;
    } catch {
      return this.getPermissionStatus();
    }
  }

  /**
   * Subscribes legacy UI components to live goal alerts.
   */
  public subscribe(listener: GoalAlertListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribes UI components to unified alerts (both 2-min pre-match & every goal scored).
   */
  public subscribeAlerts(listener: UnifiedAlertListener): () => void {
    this.unifiedListeners.add(listener);
    return () => {
      this.unifiedListeners.delete(listener);
    };
  }

  /**
   * Dispatches an OS-level / Service Worker notification so it pops up at the top
   * of the phone/desktop screen even when outside the app.
   */
  private dispatchSystemNotification(payload: {
    id: string;
    matchId: string;
    title: string;
    body: string;
    icon: string;
  }): boolean {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }

    if (window.Notification.permission !== 'granted') {
      return false;
    }

    let dispatched = false;

    // 1. Prefer Service Worker showNotification (works in background / lockscreen / outside app)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          return registration.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon || '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: payload.id,
            renotify: true,
            requireInteraction: true,
            vibrate: [220, 100, 220, 100, 300],
            data: {
              matchId: payload.matchId,
              url: '/',
            },
          } as NotificationOptions);
        })
        .catch(() => {
          // Fallback if SW registration showNotification fails
          try {
            const notif = new window.Notification(payload.title, {
              body: payload.body,
              icon: payload.icon || '/pwa-192x192.png',
              tag: payload.id,
              silent: false,
            });
            notif.onclick = () => {
              window.focus();
              notif.close();
            };
          } catch {
            // ignore
          }
        });
      dispatched = true;
    } else {
      try {
        const browserNotif = new window.Notification(payload.title, {
          body: payload.body,
          icon: payload.icon || '/pwa-192x192.png',
          tag: payload.id,
          silent: false,
        });
        browserNotif.onclick = () => {
          window.focus();
          browserNotif.close();
        };
        dispatched = true;
      } catch {
        dispatched = false;
      }
    }

    return dispatched;
  }

  /**
   * Dispatches a goal alert through Service Worker / Browser Notification API
   * and notifies all registered UI subscribers (including top heads-up banner).
   */
  public notifyGoalScored(alert: GoalAlertItem): boolean {
    if (this.dispatchedIds.has(alert.id)) {
      return false;
    }
    this.dispatchedIds.set(alert.id, Date.now());
    this.persistDispatchedIds();

    const firedOsNotification = this.dispatchSystemNotification({
      id: alert.id,
      matchId: alert.matchId,
      title: alert.title,
      body: alert.body,
      icon: alert.icon,
    });

    this.listeners.forEach((listener) => {
      listener(alert, firedOsNotification);
    });

    const unified: UnifiedMatchAlert = { ...alert, alertType: 'GOAL' };
    this.unifiedListeners.forEach((listener) => {
      listener(unified, firedOsNotification);
    });

    return firedOsNotification;
  }

  /**
   * Dispatches a 2-minute pre-match kickoff notification through Service Worker / OS API
   * and triggers the in-app top heads-up banner.
   */
  public notifyUpcomingKickoff(alert: KickoffAlertItem): boolean {
    if (this.dispatchedIds.has(alert.id)) {
      return false;
    }
    this.dispatchedIds.set(alert.id, Date.now());
    this.persistDispatchedIds();

    const firedOsNotification = this.dispatchSystemNotification({
      id: alert.id,
      matchId: alert.matchId,
      title: alert.title,
      body: alert.body,
      icon: alert.icon,
    });

    const unified: UnifiedMatchAlert = { ...alert, alertType: 'KICKOFF_2MIN' };
    this.unifiedListeners.forEach((listener) => {
      listener(unified, firedOsNotification);
    });

    return firedOsNotification;
  }

  /**
   * Evaluates previous vs updated live matches and triggers alerts for ANY goal scored.
   */
  public checkMatchesForAllGoals(
    previousMatches: MatchItem[],
    updatedMatches: MatchItem[]
  ): GoalAlertItem[] {
    const newGoalAlerts = detectAllGoalEvents(previousMatches, updatedMatches);
    for (const alert of newGoalAlerts) {
      this.notifyGoalScored(alert);
    }
    return newGoalAlerts;
  }

  /**
   * Evaluates upcoming matches and triggers alerts for any match kicking off in <= 2 minutes.
   */
  public checkMatchesForTwoMinuteKickoff(
    matches: MatchItem[],
    nowDate: Date = new Date()
  ): KickoffAlertItem[] {
    const upcomingAlerts = detectUpcomingTwoMinuteKickoffs(
      matches,
      nowDate,
      this.dispatchedIds
    );
    for (const alert of upcomingAlerts) {
      this.notifyUpcomingKickoff(alert);
    }
    return upcomingAlerts;
  }

  /**
   * Evaluates previous vs updated live matches for favored teams (backwards-compatible helper).
   */
  public checkMatchesForFavoredGoals(
    previousMatches: MatchItem[],
    updatedMatches: MatchItem[],
    favoredTeamCodes: string[]
  ): GoalAlertItem[] {
    const newGoalAlerts = detectFavoredTeamGoalEvents(
      previousMatches,
      updatedMatches,
      favoredTeamCodes
    );

    for (const alert of newGoalAlerts) {
      this.notifyGoalScored(alert);
    }

    return newGoalAlerts;
  }

  /**
   * Syncs active & upcoming matches with the Service Worker so background notifications
   * continue to fire even when the app tab is minimized or in the background.
   */
  public syncMatchesWithServiceWorker(matches: MatchItem[]): void {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    try {
      const compactMatches = matches.slice(0, 40).map((m) => ({
        id: m.id,
        leagueName: m.leagueName,
        status: m.status,
        kickoffIso: m.dateIso,
        kickoffTime: m.kickoffTime,
        homeName: m.homeTeam.name,
        awayName: m.awayTeam.name,
        homeScore: m.homeScore ?? 0,
        awayScore: m.awayScore ?? 0,
        homeLogo: m.homeTeam.logoUrl,
        awayLogo: m.awayTeam.logoUrl,
      }));

      navigator.serviceWorker.ready
        .then((reg) => {
          if (reg.active) {
            reg.active.postMessage({
              type: 'SYNC_WATCHED_MATCHES',
              matches: compactMatches,
            });
          }
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  }
}

export const goalNotificationService = new GoalNotificationService();
