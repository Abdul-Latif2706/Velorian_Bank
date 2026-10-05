document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector) => document.querySelector(selector);

    const form =
        $("#adminLoginForm") ||
        $("#clientLoginForm");

    if (!form) return;

    const isAdmin = form.id === "adminLoginForm";

    const errorElement = $(
        isAdmin
            ? "#adminLoginError"
            : "#clientLoginError"
    );

    function showError(message) {
        if (!errorElement) return;

        errorElement.textContent = message;
        errorElement.classList.add("show");

        clearTimeout(window.velorianLoginErrorTimer);

        window.velorianLoginErrorTimer = setTimeout(() => {
            errorElement.classList.remove("show");
        }, 5000);
    }

    function clearError() {
        if (!errorElement) return;

        errorElement.textContent = "";
        errorElement.classList.remove("show");
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        clearError();

        const identifierElement = $(
            isAdmin
                ? "#adminEmail"
                : "#clientAccount"
        );

        const passwordElement = $(
            isAdmin
                ? "#adminPassword"
                : "#clientPassword"
        );

        if (!identifierElement || !passwordElement) {
            showError(
                "The login form could not be loaded correctly."
            );
            return;
        }

        const identifier =
            identifierElement.value.trim();

        const password =
            passwordElement.value;

        if (!identifier) {
            showError(
                isAdmin
                    ? "Please enter your administrator email."
                    : "Please enter your account number or email."
            );
            return;
        }

        if (!password) {
            showError(
                "Please enter your password."
            );
            return;
        }

        const button =
            form.querySelector(
                'button[type="submit"]'
            );

        if (button) {
            button.disabled = true;
            button.dataset.oldText =
                button.innerHTML;
            button.innerHTML =
                "Verifying securely…";
        }

        try {

            /* =====================================================
               ONLINE PHP / MYSQL LOGIN
               ===================================================== */

            if (
                typeof vbOnlineEnabled === "function" &&
                vbOnlineEnabled()
            ) {

                /* ================= ADMIN LOGIN ================= */

                if (isAdmin) {

                    if (
                        typeof vbOnlineAdminLogin !==
                        "function"
                    ) {
                        throw new Error(
                            "Administrator login service is unavailable."
                        );
                    }

                    const response =
                        await vbOnlineAdminLogin({
                            email: identifier,
                            password: password
                        });

                    if (
                        !response ||
                        !response.token
                    ) {
                        throw new Error(
                            "Administrator authentication failed."
                        );
                    }

                    /*
                     * Store the API session token.
                     */
                    sessionStorage.setItem(
                        "vb_api_admin_token",
                        response.token
                    );

                    /*
                     * Create the local admin session.
                     */
                    if (
                        typeof vbSetSession ===
                        "function"
                    ) {
                        vbSetSession("admin");
                    }

                    window.location.href =
                        "../control-center/index.html";

                    return;
                }


                /* ================= CLIENT LOGIN ================= */

                if (
                    typeof vbOnlineClientLogin !==
                    "function"
                ) {
                    throw new Error(
                        "Client login service is unavailable."
                    );
                }

                const response =
                    await vbOnlineClientLogin({
                        identifier,
                        password
                    });


                /*
                 * Make sure the API actually returned
                 * a client object.
                 */
                if (
                    !response ||
                    !response.token
                ) {
                    throw new Error(
                        "Client authentication failed."
                    );
                }


                const client =
                    response.client;


                /*
                 * THIS IS THE IMPORTANT FIX.
                 *
                 * Never execute:
                 *
                 * response.client.id
                 *
                 * until we know that client exists.
                 */
                if (
                    !client ||
                    typeof client !== "object"
                ) {
                    console.error(
                        "Velorian Bank: client login response did not contain a client object.",
                        response
                    );

                    throw new Error(
                        "The server authenticated the account but did not return the client account information. Please try again."
                    );
                }


                /*
                 * The client ID and account number are
                 * required for the dashboard session.
                 */
                const clientId =
                    String(
                        client.id ||
                        client.clientId ||
                        client.client_id ||
                        ""
                    ).trim();

                const accountNumber =
                    String(
                        client.accountNumber ||
                        client.account_number ||
                        ""
                    ).trim();


                if (!clientId) {

                    console.error(
                        "Velorian Bank: client ID missing from login response.",
                        client
                    );

                    throw new Error(
                        "The client account ID was not returned by the server."
                    );
                }


                if (!accountNumber) {

                    console.error(
                        "Velorian Bank: account number missing from login response.",
                        client
                    );

                    throw new Error(
                        "The client account number was not returned by the server."
                    );
                }


                /*
                 * Save the API token BEFORE redirecting.
                 */
                sessionStorage.setItem(
                    "vb_api_client_token",
                    response.token
                );


                /*
                 * Synchronize the server client into
                 * local Velorian state.
                 */
                if (
                    typeof vbMergeRemoteClients ===
                    "function"
                ) {

                    try {

                        vbMergeRemoteClients([
                            client
                        ]);

                    } catch (mergeError) {

                        console.error(
                            "Velorian Bank: client synchronization failed:",
                            mergeError
                        );

                        /*
                         * Do not prevent login just because
                         * local synchronization failed.
                         *
                         * The PHP/MySQL session is still valid.
                         */
                    }
                }


                /*
                 * Create the client session using the
                 * verified values.
                 */
                if (
                    typeof vbSetSession !==
                    "function"
                ) {
                    throw new Error(
                        "Client session service is unavailable."
                    );
                }

                vbSetSession(
                    "client",
                    clientId,
                    accountNumber
                );


                /*
                 * Notify other scripts that the client
                 * session/state has changed.
                 */
                window.dispatchEvent(
                    new CustomEvent(
                        "velorian:statechange"
                    )
                );


                /*
                 * First-login password change.
                 */
                if (
                    client.forcePasswordChange ===
                    true
                ) {

                    window.location.href =
                        "client/first-login.html";

                    return;
                }


                /*
                 * Normal client dashboard.
                 */
                window.location.href =
                    "client/index.html";

                return;
            }


            /* =====================================================
               OFFLINE / LOCAL STORAGE LOGIN
               ===================================================== */

            if (
                typeof vbGetState !==
                "function"
            ) {
                throw new Error(
                    "Local banking system is unavailable."
                );
            }

            const state =
                vbGetState();


            /* ================= ADMIN ================= */

            if (isAdmin) {

                const admin =
                    state?.admin;

                if (
                    !admin ||
                    !admin.email
                ) {
                    throw new Error(
                        "Administrator account information is unavailable."
                    );
                }

                const emailMatches =
                    identifier.toLowerCase() ===
                    String(
                        admin.email
                    ).toLowerCase();

                const passwordMatches =
                    password ===
                    admin.password;

                if (
                    emailMatches &&
                    passwordMatches
                ) {

                    if (
                        typeof vbSetSession ===
                        "function"
                    ) {
                        vbSetSession("admin");
                    }

                    window.location.href =
                        "../control-center/index.html";

                    return;
                }

                showError(
                    "The administrator login details could not be verified."
                );

                return;
            }


            /* ================= CLIENT ================= */

            const clients =
                Array.isArray(state?.clients)
                    ? state.clients
                    : [];


            const normalizedIdentifier =
                identifier.toLowerCase();


            const client =
                clients.find((item) => {

                    if (!item) return false;

                    const accountNumber =
                        String(
                            item.accountNumber ||
                            ""
                        ).trim();

                    const email =
                        String(
                            item.email ||
                            ""
                        ).trim()
                        .toLowerCase();

                    return (
                        accountNumber ===
                        identifier
                    ) ||
                    (
                        email ===
                        normalizedIdentifier
                    );
                });


            if (!client) {

                showError(
                    "The login details could not be verified. Please try again."
                );

                return;
            }


            if (
                client.password !==
                password
            ) {

                showError(
                    "The login details could not be verified. Please try again."
                );

                return;
            }


            if (
                client.status &&
                client.status !== "Active"
            ) {

                showError(
                    `This account is ${String(
                        client.status
                    ).toLowerCase()}. Please contact Velorian Bank support.`
                );

                return;
            }


            const localClientId =
                String(
                    client.id ||
                    ""
                ).trim();

            const localAccountNumber =
                String(
                    client.accountNumber ||
                    ""
                ).trim();


            if (!localClientId) {

                showError(
                    "This client account is missing its account ID."
                );

                return;
            }


            if (!localAccountNumber) {

                showError(
                    "This client account is missing its account number."
                );

                return;
            }


            if (
                typeof vbSetSession ===
                "function"
            ) {

                vbSetSession(
                    "client",
                    localClientId,
                    localAccountNumber
                );

            } else {

                throw new Error(
                    "Client session service is unavailable."
                );
            }


            window.location.href =
                client.forcePasswordChange
                    ? "client/first-login.html"
                    : "client/index.html";
        }

        catch (error) {

            console.error(
                "Velorian Bank login error:",
                error
            );

            showError(
                error?.message ||
                "The login details could not be verified. Please try again."
            );
        }

        finally {

            if (button) {

                button.disabled = false;

                button.innerHTML =
                    button.dataset.oldText ||
                    button.innerHTML;
            }
        }
    });
});