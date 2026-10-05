(function () {
    "use strict";

    /*
     * ============================================================
     * VELORIAN BANK — PHP / MYSQL ONLINE API CLIENT
     * ============================================================
     *
     * All requests use:
     *
     * /api/index.php?route=...
     *
     * No Apache URL rewriting is required.
     * ============================================================
     */

    /* ============================================================
       API BASE URL
    ============================================================ */

    function getBaseUrl() {

        if (window.VB_API_BASE) {
            return String(window.VB_API_BASE).replace(/\/+$/, "");
        }

        if (
            location.protocol !== "http:" &&
            location.protocol !== "https:"
        ) {
            return "";
        }

        /*
         * Velorian Bank is running at:
         *
         * http://localhost/velorianbank/
         *
         * We automatically detect /velorianbank.
         */

        const pathname = location.pathname;
        const segments = pathname.split("/").filter(Boolean);

        if (
            segments.length > 0 &&
            !pathname.endsWith(".php") &&
            !pathname.includes("/api/")
        ) {
            return location.origin + "/" + segments[0];
        }

        if (pathname.includes("/velorianbank")) {
            return location.origin + "/velorianbank";
        }

        return location.origin;
    }

    const base = getBaseUrl();


    /* ============================================================
       ONLINE STATUS
    ============================================================ */

    window.vbOnlineEnabled = function () {
        return !!base;
    };


    /* ============================================================
       API ROUTE BUILDER
    ============================================================ */

    function apiRoute(route) {
        return (
            "/api/index.php?route=" +
            encodeURIComponent(route).replace(/%2F/g, "/")
        );
    }


    /* ============================================================
       ADMIN TOKEN RESOLVER
       ============================================================ */

    function getAdminToken() {

        const possibleKeys = [
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
         * First check localStorage.
         */

        for (const key of possibleKeys) {

            const value = localStorage.getItem(key);

            if (
                value &&
                value !== "null" &&
                value !== "undefined" &&
                value.trim() !== ""
            ) {
                return value.trim();
            }
        }


        /*
         * Then check sessionStorage.
         */

        for (const key of possibleKeys) {

            const value = sessionStorage.getItem(key);

            if (
                value &&
                value !== "null" &&
                value !== "undefined" &&
                value.trim() !== ""
            ) {
                return value.trim();
            }
        }


        /*
         * Some versions of access-control.js store the
         * authentication state as JSON.
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

                const possibleToken =
                    parsed.token ||
                    parsed.adminToken ||
                    parsed.admin_token ||
                    parsed.accessToken ||
                    parsed.access_token;

                if (
                    possibleToken &&
                    String(possibleToken).trim() !== ""
                ) {
                    return String(possibleToken).trim();
                }

            } catch (error) {
                // Ignore invalid JSON and continue.
            }
        }

        return "";
    }


    /*
     * Expose this for admin.js.
     */

    window.vbGetAdminToken = getAdminToken;


    /* ============================================================
       AUTH HEADERS
    ============================================================ */

    function adminHeaders(extraHeaders = {}) {

        const token = getAdminToken();

        return {
            ...extraHeaders,
            Authorization: token
                ? "Bearer " + token
                : ""
        };
    }


    /* ============================================================
       GENERIC API REQUEST
    ============================================================ */

    window.vbOnlineRequest = async function (path, options = {}) {

        if (!base) {

            throw new Error(
                "The online banking service is not available when the site is opened directly from a file. Open the site through XAMPP or PHP hosting."
            );
        }


        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };


        const response = await fetch(
            base + path,
            {
                ...options,
                headers,
                credentials: "same-origin",
                cache: "no-store"
            }
        );


        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }


        if (!response.ok) {

            /*
             * Give the frontend a useful authentication error.
             */

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                throw new Error(
                    data.error ||
                    data.message ||
                    "Admin authorization required."
                );
            }


            throw new Error(
                data.error ||
                data.message ||
                "The online banking service could not complete the request."
            );
        }


        return data;
    };


    /* ============================================================
       CLIENT REGISTRATION
    ============================================================ */

    window.vbOnlineRegister = async function (payload) {

        return vbOnlineRequest(
            apiRoute("register"),
            {
                method: "POST",
                body: JSON.stringify(payload)
            }
        );
    };


    /* ============================================================
       CLIENT LOGIN
    ============================================================ */

    window.vbOnlineClientLogin = async function (payload) {

        return vbOnlineRequest(
            apiRoute("client/login"),
            {
                method: "POST",
                body: JSON.stringify(payload)
            }
        );
    };


    /* ============================================================
       ADMIN LOGIN
    ============================================================ */

    window.vbOnlineAdminLogin = async function (payload) {

        return vbOnlineRequest(
            apiRoute("admin/login"),
            {
                method: "POST",
                body: JSON.stringify(payload)
            }
        );
    };


    /* ============================================================
       ADMIN — CLIENT LIST
    ============================================================ */

    window.vbOnlineAdminClients = async function (token) {

        const actualToken =
            token ||
            getAdminToken();

        return vbOnlineRequest(
            apiRoute("admin/clients"),
            {
                headers: {
                    Authorization:
                        "Bearer " + actualToken
                }
            }
        );
    };


    /* ============================================================
       CLIENT — ACCOUNT INFORMATION
    ============================================================ */

    window.vbOnlineClientMe = async function (token) {

        return vbOnlineRequest(
            apiRoute("client/me"),
            {
                headers: {
                    Authorization:
                        "Bearer " + token
                }
            }
        );
    };


    /* ============================================================
       CLIENT — TRANSACTIONS
    ============================================================ */

    window.vbOnlineClientTransactions = async function (token) {

        return vbOnlineRequest(
            apiRoute("client/transactions"),
            {
                headers: {
                    Authorization:
                        "Bearer " + token
                }
            }
        );
    };


    /* ============================================================
       CLIENT — EXTERNAL TRANSFER REQUEST
    ============================================================ */

    window.vbOnlineTransferRequest = async function (
        token,
        payload
    ) {

        return vbOnlineRequest(
            apiRoute("client/transfer/request"),
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + token
                },
                body: JSON.stringify(payload)
            }
        );
    };


    /* ============================================================
       CLIENT — EXTERNAL TRANSFER OTP VERIFICATION
    ============================================================ */

    window.vbOnlineTransferVerify = async function (
        token,
        payload
    ) {

        return vbOnlineRequest(
            apiRoute("client/transfer/verify"),
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + token
                },
                body: JSON.stringify(payload)
            }
        );
    };


    /* ============================================================
       ADMIN — TRANSFERS
    ============================================================ */

    window.vbOnlineAdminTransfers = async function (token) {

        const actualToken =
            token ||
            getAdminToken();

        return vbOnlineRequest(
            apiRoute("admin/transfers"),
            {
                headers: {
                    Authorization:
                        "Bearer " + actualToken
                }
            }
        );
    };


    /* ============================================================
       ADMIN — CREATE CLIENT
    ============================================================ */

    window.vbOnlineAdminCreateClient = async function (
        token,
        payload
    ) {

        /*
         * Support both:
         *
         * vbOnlineAdminCreateClient(token, payload)
         *
         * and:
         *
         * vbOnlineAdminCreateClient(payload)
         */

        let actualToken = token;
        let actualPayload = payload;

        if (
            typeof token === "object" &&
            payload === undefined
        ) {
            actualPayload = token;
            actualToken = getAdminToken();
        }

        actualToken =
            actualToken ||
            getAdminToken();

        return vbOnlineRequest(
            apiRoute("admin/client/create"),
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + actualToken
                },
                body: JSON.stringify(actualPayload)
            }
        );
    };


    /* ============================================================
       ADMIN — UPDATE CLIENT
    ============================================================ */

    window.vbOnlineAdminUpdateClient = async function (
        token,
        payload
    ) {

        let actualToken = token;
        let actualPayload = payload;

        if (
            typeof token === "object" &&
            payload === undefined
        ) {
            actualPayload = token;
            actualToken = getAdminToken();
        }

        actualToken =
            actualToken ||
            getAdminToken();

        return vbOnlineRequest(
            apiRoute("admin/client/update"),
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + actualToken
                },
                body: JSON.stringify(actualPayload)
            }
        );
    };


    /* ============================================================
       ADMIN — DELETE CLIENT
    ============================================================ */

    window.vbOnlineAdminDeleteClient = async function (
        token,
        id
    ) {

        let actualToken = token;
        let clientId = id;

        /*
         * Support:
         *
         * vbOnlineAdminDeleteClient(token, id)
         *
         * and:
         *
         * vbOnlineAdminDeleteClient(id)
         */

        if (
            id === undefined &&
            typeof token === "string"
        ) {
            clientId = token;
            actualToken = getAdminToken();
        }

        actualToken =
            actualToken ||
            getAdminToken();

        if (!actualToken) {
            throw new Error(
                "Admin authorization required. Please sign in again."
            );
        }

        return vbOnlineRequest(
            apiRoute("admin/client/delete"),
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + actualToken
                },
                body: JSON.stringify({
                    id: clientId
                })
            }
        );
    };


    /* ============================================================
       ADMIN — DEPOSIT / WITHDRAWAL
    ============================================================ */

    window.vbOnlineAdminTransaction = async function (
        token,
        payload
    ) {

        let actualToken = token;
        let actualPayload = payload;


        /*
         * Support:
         *
         * vbOnlineAdminTransaction(token, payload)
         *
         * OR:
         *
         * vbOnlineAdminTransaction(payload)
         */

        if (
            typeof token === "object" &&
            payload === undefined
        ) {

            actualPayload = token;
            actualToken = getAdminToken();
        }


        actualToken =
            actualToken ||
            getAdminToken();


        if (!actualToken) {
            throw new Error(
                "Admin authorization required. Please sign in again."
            );
        }


        return vbOnlineRequest(
            apiRoute("admin/transaction"),
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + actualToken
                },
                body: JSON.stringify(actualPayload)
            }
        );
    };


    /* ============================================================
       ADMIN — INTERNAL TRANSFER
    ============================================================ */

    window.vbOnlineAdminTransfer = async function (
        token,
        payload
    ) {

        let actualToken = token;
        let actualPayload = payload;

        if (
            typeof token === "object" &&
            payload === undefined
        ) {
            actualPayload = token;
            actualToken = getAdminToken();
        }

        actualToken =
            actualToken ||
            getAdminToken();

        return vbOnlineRequest(
            apiRoute("admin/internal-transfer"),
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + actualToken
                },
                body: JSON.stringify(actualPayload)
            }
        );
    };


    /* ============================================================
       ADMIN — CHANGE CLIENT PASSWORD
    ============================================================ */

    window.vbOnlineAdminPassword = async function (
        token,
        payload
    ) {

        let actualToken = token;
        let actualPayload = payload;

        if (
            typeof token === "object" &&
            payload === undefined
        ) {
            actualPayload = token;
            actualToken = getAdminToken();
        }

        actualToken =
            actualToken ||
            getAdminToken();

        return vbOnlineRequest(
            apiRoute("admin/client/password"),
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + actualToken
                },
                body: JSON.stringify(actualPayload)
            }
        );
    };


    /* ============================================================
       CLIENT — CHANGE PASSWORD
    ============================================================ */

    window.vbOnlineClientPassword = async function (
        token,
        payload
    ) {

        return vbOnlineRequest(
            apiRoute("client/password"),
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + token
                },
                body: JSON.stringify(payload)
            }
        );
    };


    /* ============================================================
       ADMIN — SETTINGS
    ============================================================ */

    window.vbOnlineAdminSettings = async function (
        token,
        payload
    ) {

        let actualToken = token;
        let actualPayload = payload;

        if (
            typeof token === "object" &&
            payload === undefined
        ) {
            actualPayload = token;
            actualToken = getAdminToken();
        }

        actualToken =
            actualToken ||
            getAdminToken();

        return vbOnlineRequest(
            apiRoute("admin/settings"),
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + actualToken
                },
                body: JSON.stringify(actualPayload)
            }
        );
    };


    /* ============================================================
       ADMIN — RESET BANK DATA
    ============================================================ */

    window.vbOnlineAdminReset = async function (token) {

        const actualToken =
            token ||
            getAdminToken();


        if (!actualToken) {
            throw new Error(
                "Admin authorization required. Please sign in again."
            );
        }


        return vbOnlineRequest(
            apiRoute("admin/reset"),
            {
                method: "POST",
                headers: {
                    Authorization:
                        "Bearer " + actualToken
                }
            }
        );
    };


    /* ============================================================
       DEBUG INFORMATION
    ============================================================ */

    console.log(
        "Velorian Bank Online API loaded successfully."
    );

    console.log(
        "API base:",
        base || "(not available)"
    );

    console.log(
        "Admin token available:",
        !!getAdminToken()
    );

})();