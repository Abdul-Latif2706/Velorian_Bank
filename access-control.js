/*
 * ============================================================
 * VELORIAN BANK — ACCESS CONTROL
 * ============================================================
 *
 * Protects:
 *
 * /control-center/*
 * /client/*
 *
 * Admin and client sessions are kept separate.
 *
 * This file does NOT bypass PHP authentication.
 * It only determines whether the browser is allowed to
 * enter the protected pages.
 * ============================================================
 */

(function () {

    "use strict";


    /* ============================================================
       CURRENT SESSION
    ============================================================ */

    function getCurrentSession() {

        try {

            if (typeof window.vbGetSession === "function") {

                const session = window.vbGetSession();

                if (session && typeof session === "object") {
                    return session;
                }
            }

        } catch (error) {

            console.warn(
                "Velorian Bank: unable to read browser session.",
                error
            );
        }

        return null;
    }


    /* ============================================================
       GET AUTH TOKEN
    ============================================================ */

    function getAuthToken() {

        const keys = [
            "admin_token",
            "adminToken",
            "vb_admin_token",
            "vbAdminToken",
            "velorian_admin_token",
            "token",
            "auth_token",
            "authToken"
        ];


        /*
         * localStorage
         */

        for (const key of keys) {

            const value = localStorage.getItem(key);

            if (
                value &&
                value !== "null" &&
                value !== "undefined" &&
                String(value).trim() !== ""
            ) {
                return String(value).trim();
            }
        }


        /*
         * sessionStorage
         */

        for (const key of keys) {

            const value = sessionStorage.getItem(key);

            if (
                value &&
                value !== "null" &&
                value !== "undefined" &&
                String(value).trim() !== ""
            ) {
                return String(value).trim();
            }
        }


        /*
         * Check common JSON authentication objects.
         */

        const stateKeys = [
            "velorian_auth",
            "vb_auth",
            "auth_state",
            "velorianBankAuth"
        ];


        for (const key of stateKeys) {

            try {

                const raw =
                    localStorage.getItem(key) ||
                    sessionStorage.getItem(key);

                if (!raw) {
                    continue;
                }

                const parsed = JSON.parse(raw);

                if (!parsed || typeof parsed !== "object") {
                    continue;
                }

                const token =
                    parsed.token ||
                    parsed.adminToken ||
                    parsed.admin_token ||
                    parsed.accessToken ||
                    parsed.access_token;

                if (
                    token &&
                    String(token).trim() !== ""
                ) {
                    return String(token).trim();
                }

            } catch (error) {

                /*
                 * Ignore invalid JSON and continue checking.
                 */

            }
        }


        return "";
    }


    /* ============================================================
       EXPOSE AUTH HELPERS
    ============================================================ */

    window.vbGetAdminAuthToken = getAuthToken;

    window.vbIsAdminAuthenticated = function () {

        const session = getCurrentSession();

        return !!(
            session &&
            session.role === "admin"
        );
    };


    window.vbIsClientAuthenticated = function () {

        const session = getCurrentSession();

        return !!(
            session &&
            session.role === "client"
        );
    };


    /* ============================================================
       DETERMINE CURRENT PAGE
    ============================================================ */

    const pathname =
        window.location.pathname || "";

    const path =
        pathname.toLowerCase();

    const parts =
        path
            .split("/")
            .filter(Boolean);

    const page =
        parts[parts.length - 1] || "";


    const inAdmin =
        parts.includes("control-center");


    const inClient =
        parts.includes("client");


    /* ============================================================
       READ SESSION
    ============================================================ */

    const session =
        getCurrentSession();


    /* ============================================================
       ADMIN PROTECTION
    ============================================================ */

    if (
        inAdmin &&
        (
            page === "index.html" ||
            page === "portal.html"
        )
    ) {

        if (
            !session ||
            session.role !== "admin"
        ) {

            window.location.replace(
                "login.html"
            );

            return;
        }
    }


    /* ============================================================
       CLIENT PROTECTION
    ============================================================ */

    if (
        inClient &&
        (
            page === "index.html" ||
            page === "first-login.html"
        )
    ) {

        if (
            !session ||
            session.role !== "client"
        ) {

            window.location.replace(
                "../client-login.html"
            );

            return;
        }
    }


    /* ============================================================
       DEBUG INFORMATION
    ============================================================ */

    console.log(
        "Velorian Bank access control loaded."
    );

    console.log(
        "Current role:",
        session && session.role
            ? session.role
            : "none"
    );

    console.log(
        "Admin API token available:",
        !!getAuthToken()
    );

})();