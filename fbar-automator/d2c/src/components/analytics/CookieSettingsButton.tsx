"use client";

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => {
        localStorage.removeItem("fbar_cookie_consent");
        window.location.reload();
      }}
      className="text-gray-300 hover:text-white hover:underline min-h-[44px] inline-flex items-center text-sm"
    >
      Cookie Settings
    </button>
  );
}
