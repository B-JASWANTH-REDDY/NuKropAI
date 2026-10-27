/**
 * NuKropAI Sovereign Privacy-Preserving Analytics
 * Aligned with DPDP Act 2023:
 * - ZERO third-party tracking cookies
 * - Consent-gated: only records events if user accepted analytics in CookieConsent
 * - Never collects IP addresses, exact GPS coordinates, or foliar images
 * - Collects purely operational product telemetry (e.g. feature usage, APK downloads)
 */

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, string | number | boolean>;
}

class PrivacyAnalytics {
  private hasConsent(): boolean {
    try {
      const consentRaw = localStorage.getItem('nk_consent');
      if (!consentRaw) return false;
      const parsed = JSON.parse(consentRaw);
      return parsed.level === 'all';
    } catch {
      return false;
    }
  }

  public track(event: string, properties: Record<string, string | number | boolean> = {}): void {
    if (!this.hasConsent()) {
      // Consent not granted; silently skip tracking
      return;
    }

    const payload: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        locale: navigator.language || 'en-IN'
      }
    };

    // Safe operational telemetry logging
    if (import.meta.env.DEV) {
      console.log('📊 [NuKropAI Analytics]', payload);
    }

    // In production, dispatch to backend telemetry proxy if endpoint configured
    const apiBase = import.meta.env.VITE_API_BASE_URL;
    if (apiBase && !import.meta.env.DEV) {
      try {
        navigator.sendBeacon?.(
          `${apiBase}/telemetry/event`,
          JSON.stringify(payload)
        );
      } catch {
        // Beacon failure should never degrade user experience
      }
    }
  }
}

export const analytics = new PrivacyAnalytics();
