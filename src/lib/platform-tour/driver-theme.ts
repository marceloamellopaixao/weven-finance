export function ensurePlatformTourTheme() {
  if (typeof document === "undefined") return;

  const linkId = "driver-js-css";
  if (!document.getElementById(linkId)) {
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/driver.js@1.0.1/dist/driver.css";
    document.head.appendChild(link);
  }

  const styleId = "driver-js-theme-weven";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      .driver-popover.driverjs-theme {
        background-color: #ffffff;
        color: #18181b;
        border-radius: 18px;
        border: 1px solid #e4e4e7;
        box-shadow: 0 24px 40px -16px rgb(15 23 42 / 0.24);
        padding: 18px;
        font-family: var(--font-sans), system-ui, sans-serif;
      }

      .driver-popover.driverjs-theme .driver-popover-title {
        font-size: 18px;
        font-weight: 700;
        color: #7c3aed;
        margin-bottom: 8px;
      }

      .driver-popover.driverjs-theme .driver-popover-description {
        font-size: 14px;
        line-height: 1.6;
        color: #52525b;
        margin-bottom: 16px;
      }

      .driver-popover.driverjs-theme button {
        border-radius: 10px;
        padding: 9px 16px;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s;
        border: none;
        cursor: pointer;
      }

      .driver-popover.driverjs-theme .driver-popover-next-btn {
        background-color: #7c3aed !important;
        color: #ffffff !important;
        text-shadow: none;
      }

      .driver-popover.driverjs-theme .driver-popover-next-btn:hover {
        background-color: #6d28d9 !important;
      }

      .driver-popover.driverjs-theme .driver-popover-prev-btn {
        background-color: #f4f4f5 !important;
        color: #52525b !important;
        text-shadow: none;
      }

      .driver-popover.driverjs-theme .driver-popover-close-btn {
        color: #a1a1aa;
      }

      .driver-popover.driverjs-theme .driver-popover-progress-text {
        color: #71717a;
        font-size: 12px;
      }

      .dark .driver-popover.driverjs-theme {
        background-color: #18181b;
        border-color: #27272a;
        color: #f4f4f5;
      }

      .dark .driver-popover.driverjs-theme .driver-popover-description,
      .dark .driver-popover.driverjs-theme .driver-popover-progress-text {
        color: #a1a1aa;
      }
    `;
    document.head.appendChild(style);
  }
}
