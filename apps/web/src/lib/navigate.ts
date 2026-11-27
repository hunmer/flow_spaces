export function nativeNavigate(router: { push: (href: string) => void; replace: (href: string) => void }, href: string, replace = false) {
  if (replace) {
    router.replace(href);
  } else {
    router.push(href);
  }
}
