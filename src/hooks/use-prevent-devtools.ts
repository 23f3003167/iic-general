import { useEffect } from "react";

export const usePreventDevTools = () => {
  useEffect(() => {
    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Prevent keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 - Developer Tools
      if (e.key === "F12") {
        e.preventDefault();
        return false;
      }

      // Ctrl+Shift+I - Developer Tools (Chrome, Edge, Firefox)
      if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i")) {
        e.preventDefault();
        return false;
      }

      // Ctrl+U - View Source
      if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        return false;
      }

      // Ctrl+Shift+C - Inspect Element
      if (e.ctrlKey && e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault();
        return false;
      }

      // Ctrl+Shift+J - Developer Tools Console (Chrome, Edge)
      if (e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j")) {
        e.preventDefault();
        return false;
      }

      // Ctrl+Shift+K - Developer Tools Console (Firefox)
      if (e.ctrlKey && e.shiftKey && (e.key === "K" || e.key === "k")) {
        e.preventDefault();
        return false;
      }

      // Cmd+Option+I - Developer Tools (Safari on Mac)
      if (e.metaKey && e.altKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        return false;
      }

      // Cmd+Option+J - Developer Tools Console (Safari on Mac)
      if (e.metaKey && e.altKey && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        return false;
      }

      // Cmd+Option+U - View Source (Safari on Mac)
      if (e.metaKey && e.altKey && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        return false;
      }

      // Cmd+Option+C - Inspect Element (Safari on Mac)
      if (e.metaKey && e.altKey && (e.key === "c" || e.key === "C")) {
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

    // Prevent copying sensitive data (optional - uncomment if needed)
    // const handleCopy = (e: ClipboardEvent) => {
    //   e.preventDefault();
    //   console.warn("Copy is disabled");
    // };

    // Add event listeners
    document.addEventListener("contextmenu", handleContextMenu, { capture: true });
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    // document.addEventListener("copy", handleCopy, { capture: true });

    // Disable drag and drop (optional)
    document.addEventListener("dragstart", (e) => {
      if ((e.target as HTMLElement).tagName !== "INPUT" && 
          (e.target as HTMLElement).tagName !== "TEXTAREA") {
        e.preventDefault();
      }
    });

    // Cleanup listeners on component unmount
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      // document.removeEventListener("copy", handleCopy, { capture: true });
      clearInterval(devToolsInterval);
    };
  }, []);
};
