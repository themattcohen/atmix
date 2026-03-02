"use client";

export function ManageCookiePreferences() {
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => {
          localStorage.removeItem("fbar_cookie_consent");
          window.location.reload();
        }}
        className="text-sm text-blue-600 underline hover:no-underline"
      >
        Manage Cookie Preferences
      </button>
    </div>
  );
}
