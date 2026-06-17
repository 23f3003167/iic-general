import { useEffect } from "react";

export const usePreventDevTools = () => {
  useEffect(() => {
    // Prevent keyboard shortcuts for developer tools only
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = String(e.key || '').toLowerCase();
      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      const meta = e.metaKey;

      // Block function keys commonly used for debugging
      const blockedFunctionKeys = ['f12', 'f11'];

      if (blockedFunctionKeys.includes(key)) {
        e.preventDefault();
        return false;
      }

      // Block developer tools shortcuts only (not copy/paste)
      if (ctrl && shift && ['i', 'j', 'k'].includes(key)) {
        e.preventDefault();
        return false;
      }

      if (ctrl && ['u'].includes(key)) {
        e.preventDefault();
        return false;
      }

      if (meta && alt && ['i', 'j', 'u'].includes(key)) {
        e.preventDefault();
        return false;
      }
    };

    // Detect if DevTools is open (basic detection)
    const detectDevTools = () => {
      const threshold = 160;
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        console.warn("Developer tools detected!");
        // You can add custom action here
      }
    };

    // Run detection periodically
    const devToolsInterval = setInterval(detectDevTools, 1000);

    // Add event listeners
    document.addEventListener("keydown", handleKeyDown, { capture: true });

    // Cleanup listeners on component unmount
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      clearInterval(devToolsInterval);
    };
  }, []);
};
