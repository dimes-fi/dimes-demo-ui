import '@testing-library/jest-dom/vitest'

// jsdom does not implement ResizeObserver, which the SVG rails observe to size themselves against
// their container. A no-op observer leaves them on their initial fallback width, which is enough
// for the marks and labels under test.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// jsdom does not implement matchMedia, which useMediaQuery — and therefore any component
// calling useIsMobile — reads on first render. Report "does not match" so components render
// their desktop layout under test.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
