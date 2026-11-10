/**
 * URL query-param helpers so the current view (tab, date, language, chart
 * toggles) lives in the URL and can be copied/shared. We use replaceState so
 * the URL always reflects the view without piling up history entries.
 */
export function getUrlParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

export function setUrlParam(key: string, value: string | null): void {
  const params = new URLSearchParams(window.location.search);
  if (value == null || value === "") {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  const qs = params.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : "");
  window.history.replaceState(null, "", url);
}
