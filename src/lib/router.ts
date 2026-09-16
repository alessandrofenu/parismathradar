import { useEffect, useState } from "react";

export interface Route {
  parts: string[];
  params: URLSearchParams;
}

function read(): Route {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, query] = raw.split("?");
  return { parts: path ? path.split("/").filter(Boolean) : [], params: new URLSearchParams(query ?? "") };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function navigate(path: string, params?: Record<string, string>, replace = false) {
  const q = params && Object.keys(params).length ? "?" + new URLSearchParams(params).toString() : "";
  const hash = `#/${path.replace(/^\//, "")}${q}`;
  if (replace) window.history.replaceState(null, "", hash);
  else window.location.hash = hash;
  if (replace) window.dispatchEvent(new HashChangeEvent("hashchange"));
}
