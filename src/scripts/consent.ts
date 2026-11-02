// Google Consent Mode v2 banner. The default (denied) state and the restore of
// a saved choice are set in Layout.astro's head script, before gtag("config").
const STORAGE_KEY = "consent-v1";

type Gtag = (...args: unknown[]) => void;

function applyBanner(): void {
  const banner = document.getElementById("consent-banner");
  if (!banner) return;
  // gaEnabled is set by the head script only on the production hosts.
  const enabled = (window as unknown as { gaEnabled?: boolean }).gaEnabled;
  banner.hidden = !enabled || localStorage.getItem(STORAGE_KEY) !== null;
}

function choose(granted: boolean): void {
  localStorage.setItem(STORAGE_KEY, granted ? "granted" : "denied");
  if (granted) {
    (window as unknown as { gtag?: Gtag }).gtag?.("consent", "update", {
      analytics_storage: "granted",
    });
  }
  applyBanner();
}

document.addEventListener("click", event => {
  const target = (event.target as Element).closest<HTMLElement>(
    "[data-consent]"
  );
  if (target) choose(target.dataset.consent === "granted");
});

document.addEventListener("astro:page-load", applyBanner);
