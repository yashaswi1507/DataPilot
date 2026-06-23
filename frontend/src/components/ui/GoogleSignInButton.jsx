import { useEffect, useRef } from "react";

const GOOGLE_CLIENT_ID = "544303241286-stc79gugvrb30kv9v8to3ga0rop6e6vl.apps.googleusercontent.com";

/**
 * Renders Google's official "Sign in with Google" button using the
 * Google Identity Services script (loaded in index.html). When the user
 * picks an account, Google calls back with a signed credential (JWT) —
 * we hand that straight to the backend's /api/auth/google endpoint,
 * which verifies it and logs the user in or creates their account.
 *
 * Usage: <GoogleSignInButton onCredential={(credential) => ...} />
 */
export default function GoogleSignInButton({ onCredential, disabled }) {
  const buttonRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    function tryInit() {
      if (initialized.current) return;
      if (!window.google || !window.google.accounts || !buttonRef.current) {
        // Script loads async — retry shortly until it's ready.
        setTimeout(tryInit, 150);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response.credential) onCredential(response.credential);
        },
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 360,
        text: "continue_with",
      });

      initialized.current = true;
    }
    tryInit();
  }, [onCredential]);

  return (
    <div style={{ display: "flex", justifyContent: "center", opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <div ref={buttonRef} />
    </div>
  );
}
