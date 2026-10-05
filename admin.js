document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    /* =========================================================
       VELORIAN BANK — ADMIN DASHBOARD
       PHP / MySQL ONLINE VERSION
       ========================================================= */

    const session =
        typeof vbGetSession === "function"
            ? vbGetSession()
            : null;

    if (!session || session.role !== "admin") {
        window.location.href = "login.html";
        return;
    }

    /* =========================================================
       HELPERS
       ========================================================= */

    const $ = (selector) => document.querySelector(selector);

    const $$ = (selector) =>
        Array.from(document.querySelectorAll(selector));

    const esc = (value) =>
        String(value ?? "").replace(/[&<>'"]/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        }[char]));

    function getAdminToken() {
        return (
            sessionStorage.getItem("vb_api_admin_token") ||
            localStorage.getItem("vb_api_admin_token") ||
            sessionStorage.getItem("admin_token") ||
            localStorage.getItem("admin_token") ||
            sessionStorage.getItem("token") ||
            localStorage.getItem("token") ||
            ""
        );
    }

    function onlineMode() {
        return (
            typeof vbOnlineEnabled === "function" &&
            vbOnlineEnabled()
        );
    }

    function toast(message, type = "success") {
        const element = $("#toast");

        if (!element) {
            console.log(message);
            return;
        }

        element.textContent = message;
        element.className = `toast show ${type}`;

        clearTimeout(window.velorianToastTimer);

        window.velorianToastTimer = setTimeout(() => {
            element.className = "toast";
        }, 3500);
    }

    function modal(id, open = true) {
        const element = $(`#${id}`);

        if (!element) return;

        element.classList.toggle("open", open);
    }

    function closeModal(id) {
        modal(id, false);
    }

    function getState() {
        if (typeof vbGetState === "function") {
            return vbGetState();
        }

        return {
            clients: [],
            transactions: [],
            audit: [],
            bank: {}
        };
    }

    function findClient(id) {
        if (typeof vbFindClient === "function") {
            return vbFindClient(id);
        }

        return getState().clients.find(
            (client) => client.id === id
        );
    }

    function transactionClient(transaction) {
        return getState().clients.find(
            (client) => client.id === transaction.clientId
        );
    }

    function statusClass(status) {
        if (
            status === "Active" ||
            status === "Success"
        ) {
            return "badge-success";
        }

        if (
            status === "Frozen" ||
            status === "Closed" ||
            status === "Failed"
        ) {
            return "badge-danger";
        }

        return "badge-pending";
    }

    function transactionTypeLabel(type) {
        switch (type) {
            case "deposit":
                return "Deposit";

            case "withdrawal":
                return "Withdrawal";

            case "transfer_in":
                return "Transfer received";

            case "transfer_out":
                return "Transfer sent";

            default:
                return type || "Transaction";
        }
    }

    /* =========================================================
       PHONE HELPERS
       ========================================================= */

    const phoneCodes = [
        "+233",
        "+1",
        "+44",
        "+234",
        "+254",
        "+27",
        "+20",
        "+971",
        "+966",
        "+91",
        "+86",
        "+81",
        "+82",
        "+33",
        "+49",
        "+39",
        "+34",
        "+31",
        "+41",
        "+61",
        "+64",
        "+55",
        "+52",
        "+7",
        "+90",
        "+65"
    ];

    function normalizePhone(code, number) {
        let raw = String(number || "").trim();

        if (!raw) {
            return "";
        }

        let phone = raw.replace(/[\s().-]/g, "");

        if (phone.startsWith("00")) {
            phone = "+" + phone.slice(2);
        }

        if (phone.startsWith("+")) {
            if (!/^\+\d{6,15}$/.test(phone)) {
                throw new Error(
                    "Enter a valid international phone number."
                );
            }

            return phone;
        }

        if (phone.startsWith("0")) {
            phone = phone.slice(1);
        }

        const result = `${code}${phone}`;

        if (!/^\+\d{6,15}$/.test(result)) {
            throw new Error(
                "Enter a valid international phone number."
            );
        }

        return result;
    }

    function splitPhone(phone) {
        const value = String(phone || "")
            .trim()
            .replace(/[^\d+]/g, "");

        const code =
            phoneCodes.find((item) =>
                value.startsWith(item)
            ) || "+233";

        let local = value;

        if (value.startsWith(code)) {
            local = value.slice(code.length);
        }

        return {
            code,
            local
        };
    }

    /* =========================================================
       ONLINE SYNCHRONIZATION
       ========================================================= */

    async function syncOnlineClients() {
        if (!onlineMode()) {
            renderAll();
            return;
        }

        const token = getAdminToken();

        if (!token) {
            console.warn(
                "Velorian Bank: Admin API token not found."
            );

            renderAll();
            return;
        }

        try {
            if (
                typeof vbOnlineAdminClients ===
                "function"
            ) {
                const response =
                    await vbOnlineAdminClients(token);

                if (
                    response &&
                    Array.isArray(response.clients) &&
                    typeof vbMergeRemoteClients ===
                        "function"
                ) {
                    vbMergeRemoteClients(
                        response.clients
                    );
                }
            }

            if (
                typeof vbOnlineAdminTransfers ===
                "function"
            ) {
                const response =
                    await vbOnlineAdminTransfers(token);

                if (
                    response &&
                    Array.isArray(
                        response.transactions
                    ) &&
                    typeof vbMergeRemoteTransactions ===
                        "function"
                ) {
                    vbMergeRemoteTransactions(
                        response.transactions
                    );
                }
            }

            renderAll();
        } catch (error) {
            console.error(
                "Velorian Bank admin sync error:",
                error
            );

            const message =
                String(error?.message || "")
                    .toLowerCase();

            if (
                message.includes("authorization") ||
                message.includes("unauthorized") ||
                message.includes("401")
            ) {
                sessionStorage.removeItem(
                    "vb_api_admin_token"
                );

                localStorage.removeItem(
                    "vb_api_admin_token"
                );

                sessionStorage.removeItem(
                    "admin_token"
                );

                localStorage.removeItem(
                    "admin_token"
                );

                sessionStorage.removeItem(
                    "token"
                );

                localStorage.removeItem(
                    "token"
                );
            }

            renderAll();
        }
    }

    /* =========================================================
       NAVIGATION
       ========================================================= */

    function switchSection(name) {
        $$(".dashboard-section").forEach(
            (section) => {
                section.classList.remove("active");
            }
        );

        const section = $(`#${name}Section`);

        if (section) {
            section.classList.add("active");
        }

        $$(".nav-item").forEach((button) => {
            button.classList.toggle(
                "active",
                button.dataset.section === name
            );
        });

        const titles = {
            overview: "System Overview",
            clients: "Client Accounts",
            transactions: "System Transactions",
            audit: "Audit Trail",
            settings: "System Settings"
        };

        const title = $("#pageTitle");

        if (title) {
            title.textContent =
                titles[name] || "Velorian Bank";
        }

        $("#sidebar")?.classList.remove("open");
        $("#mobileOverlay")?.classList.remove("open");
    }

    $$("[data-section]").forEach((button) => {
        button.addEventListener("click", () => {
            switchSection(button.dataset.section);
        });
    });

    $$("[data-go]").forEach((button) => {
        button.addEventListener("click", () => {
            switchSection(button.dataset.go);
        });
    });

    /* =========================================================
       MOBILE MENU
       ========================================================= */

    $("#menuBtn")?.addEventListener("click", () => {
        $("#sidebar")?.classList.toggle("open");
        $("#mobileOverlay")?.classList.toggle("open");
    });

    $("#mobileOverlay")?.addEventListener(
        "click",
        () => {
            $("#sidebar")?.classList.remove("open");
            $("#mobileOverlay")?.classList.remove("open");
        }
    );

    /* =========================================================
       MODALS
       ========================================================= */

    $$("[data-close]").forEach((button) => {
        button.addEventListener("click", () => {
            closeModal(button.dataset.close);
        });
    });

    $$(".modal-backdrop").forEach((backdrop) => {
        backdrop.addEventListener(
            "click",
            (event) => {
                if (event.target === backdrop) {
                    backdrop.classList.remove("open");
                }
            }
        );
    });



    /* =========================================================
       CURRENCY TOTALS
       ========================================================= */

    function totalsByCurrency(items) {
        const totals = {
            USD: 0,
            GBP: 0,
            EUR: 0
        };

        items.forEach((item) => {
            const currency =
                item.currency ||
                findClient(item.clientId)?.currency ||
                "USD";

            totals[currency] =
                (totals[currency] || 0) +
                Number(item.amount || 0);
        });

        return (
            Object.entries(totals)
                .filter(([, value]) => value !== 0)
                .map(([currency, value]) =>
                    vbFormatMoney(
                        value,
                        currency
                    )
                )
                .join(" • ") || "$0.00"
        );
    }

    /* =========================================================
       STATISTICS
       ========================================================= */

    function renderStats() {
        const state = getState();

        const deposits =
            state.transactions.filter(
                (transaction) =>
                    transaction.type === "deposit"
            );

        const withdrawals =
            state.transactions.filter(
                (transaction) =>
                    transaction.type === "withdrawal"
            );

        const transfers =
            state.transactions.filter(
                (transaction) =>
                    transaction.type === "transfer_out"
            );

        const element = $("#adminStats");

        if (!element) return;

        const stats = [
            [
                "Active clients",
                state.clients.filter(
                    (client) =>
                        client.status === "Active"
                ).length,
                "Registered accounts",
                "blue"
            ],
            [
                "Total balances",
                totalsByCurrency(
                    state.clients.map((client) => ({
                        amount: client.balance,
                        currency: client.currency
                    }))
                ),
                "By account currency",
                "gold"
            ],
            [
                "Deposits",
                totalsByCurrency(deposits),
                "All-time deposits",
                "green"
            ],
            [
                "Withdrawals",
                totalsByCurrency(withdrawals),
                "All-time withdrawals",
                "red"
            ],
            [
                "Transfers",
                totalsByCurrency(transfers),
                "Sender-side volume",
                "blue"
            ],
            [
                "Transactions",
                state.transactions.length,
                "Ledger entries",
                "gold"
            ]
        ];

        element.innerHTML = stats
            .map(
                (item) => `
                    <article class="stat-card glass">
                        <div class="stat-top">
                            <span>${esc(item[0])}</span>
                            <span class="stat-icon ${item[3]}">◈</span>
                        </div>

                        <strong>${esc(item[1])}</strong>

                        <small>${esc(item[2])}</small>
                    </article>
                `
            )
            .join("");
    }

    /* =========================================================
       CHART
       ========================================================= */

    function renderChart() {
        const state = getState();
        const days = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();

            date.setHours(0, 0, 0, 0);
            date.setDate(
                date.getDate() - i
            );

            const key =
                date.toISOString().slice(0, 10);

            const count =
                state.transactions.filter(
                    (transaction) =>
                        String(
                            transaction.timestamp || ""
                        ).slice(0, 10) === key
                ).length;

            days.push({
                label:
                    date.toLocaleDateString(
                        "en-US",
                        {
                            weekday: "short"
                        }
                    ),
                count
            });
        }

        const chart = $("#volumeChart");

        if (!chart) return;

        const max = Math.max(
            ...days.map(
                (day) => day.count
            ),
            1
        );

        chart.innerHTML = days
            .map(
                (day) => `
                    <div class="bar-col">
                        <div class="bar-value">
                            ${day.count || ""}
                        </div>

                        <div class="bar-track">
                            <i
                                style="height:${Math.max(
                                    5,
                                    (day.count / max) *
                                        100
                                )}%"
                            ></i>
                        </div>

                        <span>${esc(day.label)}</span>
                    </div>
                `
            )
            .join("");
    }

    /* =========================================================
       ACCOUNT STATUS
       ========================================================= */

    function renderStatus() {
        const state = getState();

        const total = Math.max(
            state.clients.length,
            1
        );

        const statuses = [
            ["Active", "green"],
            ["Frozen", "red"],
            ["Suspended", "gold"],
            ["Closed", "blue"]
        ];

        const element =
            $("#statusBreakdown");

        if (!element) return;

        element.innerHTML = statuses
            .map(([status, color]) => {
                const count =
                    state.clients.filter(
                        (client) =>
                            client.status ===
                            status
                    ).length;

                return `
                    <div class="status-line">
                        <div>
                            <span>${esc(status)}</span>
                            <strong>${count}</strong>
                        </div>

                        <div class="status-bar">
                            <i
                                class="${color}"
                                style="width:${
                                    (count / total) *
                                    100
                                }%"
                            ></i>
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    /* =========================================================
       RECENT TRANSACTIONS
       ========================================================= */

    function renderRecent() {
        const state = getState();
        const element =
            $("#recentTransactions");

        if (!element) return;

        const rows = state.transactions
            .slice(0, 7)
            .map((transaction) => {
                const client =
                    transactionClient(
                        transaction
                    );

                const positive =
                    transaction.type ===
                        "deposit" ||
                    transaction.type ===
                        "transfer_in";

                return `
                    <tr>
                        <td>
                            <strong>
                                ${esc(
                                    client?.name ||
                                    "Unknown"
                                )}
                            </strong>
                        </td>

                        <td>
                            ${esc(
                                transactionTypeLabel(
                                    transaction.type
                                )
                            )}
                        </td>

                        <td class="${
                            positive
                                ? "amount-positive"
                                : "amount-negative"
                        }">
                            ${positive ? "+" : "-"}
                            ${vbFormatMoney(
                                transaction.amount,
                                client?.currency ||
                                    transaction.currency ||
                                    "USD"
                            )}
                        </td>

                        <td>
                            <span class="badge ${statusClass(
                                transaction.status
                            )}">
                                ${esc(
                                    transaction.status
                                )}
                            </span>
                        </td>

                        <td>
                            ${vbRelativeDate(
                                transaction.timestamp
                            )}
                        </td>
                    </tr>
                `;
            })
            .join("");

        element.innerHTML =
            rows ||
            `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            No transactions yet.
                        </div>
                    </td>
                </tr>
            `;
    }

    /* =========================================================
       TOP CLIENTS
       ========================================================= */

    function renderTopClients() {
        const state = getState();
        const element =
            $("#topClients");

        if (!element) return;

        const clients = [...state.clients]
            .sort(
                (a, b) =>
                    Number(b.balance || 0) -
                    Number(a.balance || 0)
            )
            .slice(0, 5);

        element.innerHTML =
            clients
                .map(
                    (client) => `
                        <div class="client-row">
                            <div class="avatar">
                                ${esc(
                                    vbInitials(
                                        client.name
                                    )
                                )}
                            </div>

                            <div>
                                <strong>
                                    ${esc(client.name)}
                                </strong>

                                <small>
                                    ${esc(
                                        client.accountNumber
                                    )}
                                    •
                                    ${esc(
                                        client.accountType
                                    )}
                                </small>
                            </div>

                            <span class="balance-mini">
                                ${vbFormatMoney(
                                    client.balance,
                                    client.currency
                                )}
                            </span>
                        </div>
                    `
                )
                .join("") ||
            `
                <div class="empty-state">
                    No client accounts yet.
                </div>
            `;
    }

    /* =========================================================
       CLIENT TABLE
       ========================================================= */

    function renderClients() {
        const state = getState();

        const search =
            ($("#clientSearch")?.value || "")
                .toLowerCase()
                .trim();

        const filter =
            $("#clientStatusFilter")?.value ||
            "all";

        const clients =
            state.clients.filter((client) => {
                const searchText =
                    `${client.name || ""} ${
                        client.email || ""
                    } ${
                        client.accountNumber || ""
                    }`.toLowerCase();

                const matchesSearch =
                    !search ||
                    searchText.includes(search);

                const matchesStatus =
                    filter === "all" ||
                    client.status === filter;

                return (
                    matchesSearch &&
                    matchesStatus
                );
            });

        const count = $("#clientCount");

        if (count) {
            count.textContent =
                `${clients.length} of ${state.clients.length} clients`;
        }

        const table = $("#clientsTable");

        if (!table) return;

        table.innerHTML =
            clients
                .map((client) => {
                    const activity =
                        state.transactions.filter(
                            (transaction) =>
                                transaction.clientId ===
                                client.id
                        ).length;

                    return `
                        <tr>
                            <td>
                                <div class="client-cell">
                                    <div class="avatar small">
                                        ${esc(
                                            vbInitials(
                                                client.name
                                            )
                                        )}
                                    </div>

                                    <div>
                                        <strong>
                                            ${esc(
                                                client.name
                                            )}
                                        </strong>

                                        <small>
                                            ${esc(
                                                client.email
                                            )}
                                        </small>
                                    </div>
                                </div>
                            </td>

                            <td>
                                <strong>
                                    ${esc(
                                        client.accountNumber
                                    )}
                                </strong>

                                <small>
                                    ${esc(
                                        client.accountType
                                    )}
                                </small>
                            </td>

                            <td>
                                <strong>
                                    ${vbFormatMoney(
                                        client.balance,
                                        client.currency
                                    )}
                                </strong>
                            </td>

                            <td>${activity}</td>

                            <td>
                                <span class="badge ${statusClass(
                                    client.status
                                )}">
                                    ${esc(
                                        client.status
                                    )}
                                </span>
                            </td>

                            <td>
                                <button
                                    type="button"
                                    class="action-btn"
                                    data-view-client="${esc(
                                        client.id
                                    )}"
                                >
                                    Manage
                                </button>

                                <button
                                    type="button"
                                    class="action-btn danger-action"
                                    data-delete-client="${esc(
                                        client.id
                                    )}"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    `;
                })
                .join("") ||
            `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            No clients match your search.
                        </div>
                    </td>
                </tr>
            `;
    }

    /* =========================================================
       TRANSACTION TABLE
       ========================================================= */

    function renderTransactions() {
        const state = getState();

        const search =
            ($("#transactionSearch")?.value || "")
                .toLowerCase()
                .trim();

        const typeFilter =
            $("#transactionFilter")?.value ||
            "all";

        const statusFilter =
            $("#transactionStatusFilter")?.value ||
            "all";

        const transactions =
            state.transactions.filter(
                (transaction) => {
                    const client =
                        transactionClient(
                            transaction
                        );

                    const searchText =
                        `${transaction.id || ""} ${
                            client?.name || ""
                        } ${
                            client?.accountNumber || ""
                        }`.toLowerCase();

                    const matchesSearch =
                        !search ||
                        searchText.includes(search);

                    const matchesType =
                        typeFilter === "all" ||
                        transaction.type ===
                            typeFilter;

                    const matchesStatus =
                        statusFilter === "all" ||
                        transaction.status ===
                            statusFilter;

                    return (
                        matchesSearch &&
                        matchesType &&
                        matchesStatus
                    );
                }
            );

        const table =
            $("#transactionsTable");

        if (!table) return;

        table.innerHTML =
            transactions
                .map((transaction) => {
                    const client =
                        transactionClient(
                            transaction
                        );

                    const positive =
                        transaction.type ===
                            "deposit" ||
                        transaction.type ===
                            "transfer_in";

                    return `
                        <tr>
                            <td>
                                <strong>
                                    ${esc(
                                        transaction.id
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${esc(
                                    client?.name ||
                                    "Unknown"
                                )}
                            </td>

                            <td>
                                ${esc(
                                    client?.accountNumber ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${esc(
                                    transactionTypeLabel(
                                        transaction.type
                                    )
                                )}
                            </td>

                            <td class="${
                                positive
                                    ? "amount-positive"
                                    : "amount-negative"
                            }">
                                ${positive ? "+" : "-"}
                                ${vbFormatMoney(
                                    transaction.amount,
                                    client?.currency ||
                                        transaction.currency ||
                                        "USD"
                                )}
                            </td>

                            <td>
                                <span class="badge ${statusClass(
                                    transaction.status
                                )}">
                                    ${esc(
                                        transaction.status
                                    )}
                                </span>
                            </td>

                            <td>
                                ${vbFormatDate(
                                    transaction.timestamp
                                )}
                            </td>
                        </tr>
                    `;
                })
                .join("") ||
            `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            No transactions match your filters.
                        </div>
                    </td>
                </tr>
            `;
    }

    /* =========================================================
       AUDIT
       ========================================================= */

    function renderAudit() {
        const state = getState();

        const search =
            ($("#auditSearch")?.value || "")
                .toLowerCase()
                .trim();

        const items =
            state.audit.filter((item) => {
                const text =
                    `${item.action || ""} ${
                        item.details || ""
                    } ${
                        item.actor || ""
                    }`.toLowerCase();

                return (
                    !search ||
                    text.includes(search)
                );
            });

        const element =
            $("#auditListFull");

        if (!element) return;

        element.innerHTML =
            items
                .map(
                    (item) => `
                        <div class="audit-item">
                            <div class="audit-icon">
                                ✓
                            </div>

                            <div>
                                <strong>
                                    ${esc(item.action)}
                                </strong>

                                <p>
                                    ${esc(
                                        item.details
                                    )}
                                </p>

                                <small>
                                    ${esc(item.actor)}
                                    •
                                    ${vbFormatDate(
                                        item.timestamp
                                    )}
                                </small>
                            </div>
                        </div>
                    `
                )
                .join("") ||
            `
                <div class="empty-state">
                    No audit events yet.
                </div>
            `;
    }

    /* =========================================================
       CURRENCY SETTINGS
       ========================================================= */

    function renderCurrencySettings() {
        const state = getState();

        const currency =
            state.bank?.currency || "USD";

        const currencySelect =
            $("#currencySelect");

        if (currencySelect) {
            currencySelect.value = currency;
        }

        const current =
            $("#currentCurrencyCode");

        if (current) {
            const info =
                typeof vbGetCurrency ===
                "function"
                    ? vbGetCurrency(currency)
                    : {
                          symbol: currency
                      };

            current.textContent =
                `${currency} — ${
                    info.symbol || currency
                }`;
        }

        const dailyLimit =
            $("#dailyLimitDisplay");

        if (
            dailyLimit &&
            typeof TRANSFER_DAILY_LIMIT !==
                "undefined" &&
            typeof vbFormatMoney ===
                "function"
        ) {
            dailyLimit.textContent =
                vbFormatMoney(
                    TRANSFER_DAILY_LIMIT,
                    currency
                );
        }

        const rates =
            state.bank?.rates || {};

        const fields = [
            ["rateUSDGBP", "USD", "GBP"],
            ["rateUSDEUR", "USD", "EUR"],
            ["rateGBPUSD", "GBP", "USD"],
            ["rateGBPEUR", "GBP", "EUR"],
            ["rateEURUSD", "EUR", "USD"],
            ["rateEURGBP", "EUR", "GBP"]
        ];

        fields.forEach(
            ([id, from, to]) => {
                const input = $(`#${id}`);

                if (input) {
                    input.value =
                        rates[from]?.[to] ?? "";
                }
            }
        );

        if (
            typeof vbRenderCurrencyUI ===
            "function"
        ) {
            vbRenderCurrencyUI();
        }
    }

    /* =========================================================
       CLIENT DETAILS
       ========================================================= */

    function populateEdit(client) {
        if (!client) return;

        const phone =
            splitPhone(client.phone);

        $("#editClientId").value =
            client.id || "";

        $("#editName").value =
            client.name || "";

        $("#editEmail").value =
            client.email || "";

        $("#editPhoneCode").value =
            phone.code;

        $("#editPhone").value =
            phone.local;

        $("#editDob").value =
            client.dob || "";

        $("#editAddress").value =
            client.address || "";

        $("#editAccountType").value =
            client.accountType ||
            "Savings Account";

        $("#editCurrency").value =
            client.currency || "USD";

        $("#editStatus").value =
            client.status || "Active";

        $("#editAccountNumber").textContent =
            client.accountNumber || "—";
    }

    function showClientDetails(id) {
        const client = findClient(id);

        if (!client) {
            toast(
                "Client account could not be found.",
                "error"
            );
            return;
        }

        const state = getState();

        const transactions =
            state.transactions.filter(
                (transaction) =>
                    transaction.clientId === id
            );

        const element =
            $("#clientDetails");

        if (!element) return;

        element.innerHTML = `
            <div class="detail-head">
                <div class="detail-avatar">
                    ${esc(
                        vbInitials(client.name)
                    )}
                </div>

                <div>
                    <span class="eyebrow">
                        CLIENT ACCOUNT
                    </span>

                    <h2>
                        ${esc(client.name)}
                    </h2>

                    <p>
                        ${esc(
                            client.accountType
                        )}
                        •
                        ${esc(
                            client.currency ||
                            "USD"
                        )}
                        •
                        <span class="badge ${statusClass(
                            client.status
                        )}">
                            ${esc(
                                client.status
                            )}
                        </span>
                    </p>
                </div>
            </div>

            <div class="detail-grid">
                <div class="detail-box">
                    <span>Account number</span>
                    <strong>
                        ${esc(
                            client.accountNumber
                        )}
                    </strong>
                </div>

                <div class="detail-box">
                    <span>Current balance</span>
                    <strong>
                        ${vbFormatMoney(
                            client.balance,
                            client.currency
                        )}
                    </strong>
                </div>

                <div class="detail-box">
                    <span>Email</span>
                    <strong>
                        ${esc(client.email)}
                    </strong>
                </div>

                <div class="detail-box">
                    <span>Phone</span>
                    <strong>
                        ${esc(
                            client.phone ||
                            "Not provided"
                        )}
                    </strong>
                </div>

                <div class="detail-box">
                    <span>Date joined</span>
                    <strong>
                        ${vbShortDate(
                            client.createdAt
                        )}
                    </strong>
                </div>

                <div class="detail-box">
                    <span>Address</span>
                    <strong>
                        ${esc(
                            client.address ||
                            "Not provided"
                        )}
                    </strong>
                </div>
            </div>

            <div class="detail-actions">
                <button
                    type="button"
                    class="primary-btn compact"
                    data-edit-from-details="${esc(
                        client.id
                    )}"
                >
                    Edit profile
                </button>

                <button
                    type="button"
                    class="secondary-btn compact"
                    data-status-from-details="${esc(
                        client.id
                    )}"
                >
                    ${
                        client.status === "Active"
                            ? "Freeze account"
                            : "Activate account"
                    }
                </button>

                <button
                    type="button"
                    class="secondary-btn compact"
                    data-password-from-details="${esc(
                        client.id
                    )}"
                >
                    Change password
                </button>

                <button
                    type="button"
                    class="secondary-btn compact danger-action"
                    data-delete-from-details="${esc(
                        client.id
                    )}"
                >
                    Delete client
                </button>

                <button
                    type="button"
                    class="secondary-btn compact"
                    data-statement-from-details="${esc(
                        client.id
                    )}"
                >
                    Statement
                </button>
            </div>

            <div class="panel inner-panel">
                <div class="panel-head">
                    <div>
                        <span class="card-kicker">
                            RECENT ACTIVITY
                        </span>

                        <h3>
                            Account history
                        </h3>
                    </div>
                </div>

                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Reference</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Date</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${
                                transactions
                                    .slice(
                                        0,
                                        10
                                    )
                                    .map(
                                        (
                                            transaction
                                        ) => {
                                            const positive =
                                                transaction.type ===
                                                    "deposit" ||
                                                transaction.type ===
                                                    "transfer_in";

                                            return `
                                                <tr>
                                                    <td>
                                                        ${esc(
                                                            transaction.id
                                                        )}
                                                    </td>

                                                    <td>
                                                        ${esc(
                                                            transactionTypeLabel(
                                                                transaction.type
                                                            )
                                                        )}
                                                    </td>

                                                    <td class="${
                                                        positive
                                                            ? "amount-positive"
                                                            : "amount-negative"
                                                    }">
                                                        ${
                                                            positive
                                                                ? "+"
                                                                : "-"
                                                        }

                                                        ${vbFormatMoney(
                                                            transaction.amount,
                                                            client.currency ||
                                                                transaction.currency ||
                                                                "USD"
                                                        )}
                                                    </td>

                                                    <td>
                                                        ${vbFormatDate(
                                                            transaction.timestamp
                                                        )}
                                                    </td>
                                                </tr>
                                            `;
                                        }
                                    )
                                    .join("") ||
                                `
                                    <tr>
                                        <td colspan="4">
                                            <div class="empty-state">
                                                No activity.
                                            </div>
                                        </td>
                                    </tr>
                                `
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        modal(
            "clientDetailsModal",
            true
        );
    }

    /* =========================================================
       CREATE CLIENT
       ========================================================= */

    $("#quickAddClient")?.addEventListener(
        "click",
        () => {
            modal("clientModal", true);
        }
    );

    $("#addClientBtn")?.addEventListener(
        "click",
        () => {
            modal("clientModal", true);
        }
    );

    const createClientForm =
        $("#createClientForm");

    if (createClientForm) {
        createClientForm.addEventListener(
            "submit",
            async (event) => {
                event.preventDefault();

                try {
                    const payload = {
                        name:
                            $("#newClientName")
                                .value
                                .trim(),

                        email:
                            $("#newClientEmail")
                                .value
                                .trim(),

                        password:
                            $("#newClientPassword")
                                .value,

                        phone:
                            normalizePhone(
                                $(
                                    "#newClientPhoneCode"
                                ).value,
                                $(
                                    "#newClientPhone"
                                ).value
                            ),

                        dob:
                            $("#newClientDob")
                                .value,

                        address:
                            $(
                                "#newClientAddress"
                            )
                                .value
                                .trim(),

                        accountType:
                            $(
                                "#newClientAccountType"
                            ).value,

                        currency:
                            $(
                                "#newClientCurrency"
                            ).value,

                        initialBalance:
                            Number(
                                $(
                                    "#newClientBalance"
                                ).value || 0
                            )
                    };

                    let client;

                    if (onlineMode()) {
                        if (
                            typeof vbOnlineAdminCreateClient !==
                            "function"
                        ) {
                            throw new Error(
                                "Admin client creation API is unavailable."
                            );
                        }

                        const response =
                            await vbOnlineAdminCreateClient(
                                getAdminToken(),
                                payload
                            );

                        client =
                            response?.client;

                        if (
                            client &&
                            typeof vbMergeRemoteClients ===
                                "function"
                        ) {
                            vbMergeRemoteClients([
                                client
                            ]);
                        }
                    } else {
                        client =
                            vbCreateClient(
                                payload
                            );
                    }

                    if (!client) {
                        throw new Error(
                            "The client account was not created."
                        );
                    }

                    createClientForm.reset();

                    $(
                        "#newClientBalance"
                    ).value = "0";

                    closeModal(
                        "clientModal"
                    );

                    renderAll();

                    toast(
                        `Account ${client.accountNumber} created successfully.`
                    );

                    setTimeout(() => {
                        showClientDetails(
                            client.id
                        );
                    }, 150);
                } catch (error) {
                    console.error(error);

                    toast(
                        error.message ||
                            "Could not create client.",
                        "error"
                    );
                }
            }
        );
    }

    /* =========================================================
       POST TRANSACTION
       ========================================================= */

    function populatePostClients() {
        const select =
            $("#postClientId");

        if (!select) return;

        const state = getState();

        select.innerHTML =
            state.clients
                .map(
                    (client) => `
                        <option value="${esc(
                            client.id
                        )}">
                            ${esc(
                                client.name
                            )}
                            —
                            ${esc(
                                client.accountNumber
                            )}
                            (${esc(
                                client.currency ||
                                "USD"
                            )})
                        </option>
                    `
                )
                .join("") ||
            `
                <option value="">
                    No client accounts yet
                </option>
            `;

        updatePostBalance();
    }

    function updatePostBalance() {
        const client =
            findClient(
                $("#postClientId")?.value
            );

        const balanceElement =
            $("#postTransactionBalance");

        if (balanceElement) {
            if (client) {
                balanceElement.textContent =
                    `Current balance: ${vbFormatMoney(
                        client.balance,
                        client.currency
                    )} • Account currency: ${
                        typeof vbGetCurrency ===
                        "function"
                            ? vbGetCurrency(
                                  client.currency
                              ).name
                            : client.currency
                    }`;
            } else {
                balanceElement.textContent =
                    "Select a client to view their current balance.";
            }
        }

        const amount =
            $("#postTransactionAmount");

        if (amount && client) {
            amount.placeholder =
                `Amount in ${client.currency}`;

            amount.dataset.currency =
                client.currency;
        }

        const type =
            $("#postTransactionType");

        const recipient =
            $("#postRecipientField");

        if (recipient && type) {
            recipient.classList.toggle(
                "hidden",
                type.value !== "transfer"
            );
        }
    }

    $("#openPostTransaction")?.addEventListener(
        "click",
        () => {
            populatePostClients();
            modal(
                "postTransactionModal",
                true
            );
        }
    );

    $("#postClientId")?.addEventListener(
        "change",
        updatePostBalance
    );

    $("#postTransactionType")?.addEventListener(
        "change",
        updatePostBalance
    );

    const postTransactionForm =
        $("#postTransactionForm");

    if (postTransactionForm) {
        postTransactionForm.addEventListener(
            "submit",
            async (event) => {
                event.preventDefault();

                try {
                    const client =
                        findClient(
                            $(
                                "#postClientId"
                            ).value
                        );

                    if (!client) {
                        throw new Error(
                            "Select a client account."
                        );
                    }

                    const type =
                        $(
                            "#postTransactionType"
                        ).value;

                    const status =
                        $(
                            "#postTransactionStatus"
                        ).value;

                    const amount =
                        Number(
                            $(
                                "#postTransactionAmount"
                            ).value
                        );

                    if (
                        !Number.isFinite(
                            amount
                        ) ||
                        amount <= 0
                    ) {
                        throw new Error(
                            "Enter a valid transaction amount."
                        );
                    }

                    const description =
                        $(
                            "#postTransactionDescription"
                        )
                            .value
                            .trim() ||
                        `Administrator ${type}`;

                    let response = null;

                    if (onlineMode()) {
                        const token =
                            getAdminToken();

                        if (!token) {
                            throw new Error(
                                "Administrator session expired. Please sign in again."
                            );
                        }

                        if (
                            type ===
                            "transfer"
                        ) {
                            const recipientAccount =
                                $(
                                    "#postRecipientAccount"
                                )
                                    .value
                                    .trim();

                            if (
                                !recipientAccount
                            ) {
                                throw new Error(
                                    "Enter the recipient account number."
                                );
                            }

                            if (
                                typeof vbOnlineAdminTransfer !==
                                "function"
                            ) {
                                throw new Error(
                                    "Internal transfer API is unavailable."
                                );
                            }

                            response =
                                await vbOnlineAdminTransfer(
                                    token,
                                    {
                                        senderId:
                                            client.id,

                                        recipientAccount,

                                        amount,

                                        description
                                    }
                                );
                        } else {
                            if (
                                typeof vbOnlineAdminTransaction !==
                                "function"
                            ) {
                                throw new Error(
                                    "Transaction API is unavailable."
                                );
                            }

                            response =
                                await vbOnlineAdminTransaction(
                                    token,
                                    {
                                        clientId:
                                            client.id,

                                        type,

                                        amount,

                                        status,

                                        description
                                    }
                                );
                        }

                        await syncOnlineClients();
                    } else {
                        if (
                            type ===
                            "transfer"
                        ) {
                            const recipientAccount =
                                $(
                                    "#postRecipientAccount"
                                )
                                    .value
                                    .trim();

                            if (
                                !recipientAccount
                            ) {
                                throw new Error(
                                    "Enter the recipient account number."
                                );
                            }

                            response =
                                vbTransferFunds(
                                    client.id,
                                    recipientAccount,
                                    amount,
                                    description
                                );
                        } else {
                            response =
                                vbAdminPostTransaction(
                                    client.id,
                                    type,
                                    amount,
                                    status,
                                    description
                                );
                        }
                    }

                    postTransactionForm.reset();

                    closeModal(
                        "postTransactionModal"
                    );

                    renderAll();

                    if (
                        type === "deposit"
                    ) {
                        toast(
                            `Deposit posted for ${client.name}.`
                        );
                    } else if (
                        type ===
                        "withdrawal"
                    ) {
                        toast(
                            `Withdrawal posted for ${client.name}.`
                        );
                    } else {
                        toast(
                            `Transfer posted successfully${
                                response?.reference
                                    ? ` • ${response.reference}`
                                    : ""
                            }.`
                        );
                    }
                } catch (error) {
                    console.error(error);

                    toast(
                        error.message ||
                            "Transaction could not be completed.",
                        "error"
                    );
                }
            }
        );
    }

    /* =========================================================
       DELETE CLIENT
       ========================================================= */

    async function deleteClientAccount(
        client
    ) {
        if (!client) return;

        const confirmed =
            window.confirm(
                `Delete ${client.name}'s client account (${client.accountNumber})? This will permanently remove the client profile, balance and transaction history.`
            );

        if (!confirmed) return;

        try {
            if (onlineMode()) {
                if (
                    typeof vbOnlineAdminDeleteClient !==
                    "function"
                ) {
                    throw new Error(
                        "Delete client API is unavailable."
                    );
                }

                await vbOnlineAdminDeleteClient(
                    getAdminToken(),
                    client.id
                );

                await syncOnlineClients();
            } else {
                vbDeleteClient(client.id);
            }

            renderAll();

            toast(
                `Client ${client.name} deleted successfully.`
            );
        } catch (error) {
            console.error(error);

            toast(
                error.message ||
                    "Client could not be deleted.",
                "error"
            );
        }
    }

    /* =========================================================
       CLIENT TABLE ACTIONS
       ========================================================= */

    $("#clientsTable")?.addEventListener(
        "click",
        async (event) => {
            const viewButton =
                event.target.closest(
                    "[data-view-client]"
                );

            const deleteButton =
                event.target.closest(
                    "[data-delete-client]"
                );

            if (viewButton) {
                showClientDetails(
                    viewButton.dataset
                        .viewClient
                );
                return;
            }

            if (deleteButton) {
                const client =
                    findClient(
                        deleteButton.dataset
                            .deleteClient
                    );

                await deleteClientAccount(
                    client
                );
            }
        }
    );

    /* =========================================================
       CLIENT DETAILS ACTIONS
       ========================================================= */

    $("#clientDetails")?.addEventListener(
        "click",
        async (event) => {
            const editButton =
                event.target.closest(
                    "[data-edit-from-details]"
                );

            const statusButton =
                event.target.closest(
                    "[data-status-from-details]"
                );

            const passwordButton =
                event.target.closest(
                    "[data-password-from-details]"
                );

            const deleteButton =
                event.target.closest(
                    "[data-delete-from-details]"
                );

            const statementButton =
                event.target.closest(
                    "[data-statement-from-details]"
                );

            if (editButton) {
                const client =
                    findClient(
                        editButton.dataset
                            .editFromDetails
                    );

                if (!client) return;

                populateEdit(client);

                closeModal(
                    "clientDetailsModal"
                );

                modal(
                    "editClientModal",
                    true
                );

                return;
            }

            if (statusButton) {
                const client =
                    findClient(
                        statusButton.dataset
                            .statusFromDetails
                    );

                if (!client) return;

                const nextStatus =
                    client.status ===
                    "Active"
                        ? "Frozen"
                        : "Active";

                const confirmed =
                    window.confirm(
                        `Set ${client.name}'s account to ${nextStatus}?`
                    );

                if (!confirmed) return;

                try {
                    if (onlineMode()) {
                        if (
                            typeof vbOnlineAdminUpdateClient !==
                            "function"
                        ) {
                            throw new Error(
                                "Client update API is unavailable."
                            );
                        }

                        const response =
                            await vbOnlineAdminUpdateClient(
                                getAdminToken(),
                                {
                                    id: client.id,
                                    status:
                                        nextStatus
                                }
                            );

                        if (
                            response?.client &&
                            typeof vbMergeRemoteClients ===
                                "function"
                        ) {
                            vbMergeRemoteClients([
                                response.client
                            ]);
                        }
                    } else {
                        vbSetClientStatus(
                            client.id,
                            nextStatus
                        );
                    }

                    renderAll();

                    showClientDetails(
                        client.id
                    );

                    toast(
                        `Account ${nextStatus.toLowerCase()}.`
                    );
                } catch (error) {
                    console.error(error);

                    toast(
                        error.message ||
                            "Account status could not be updated.",
                        "error"
                    );
                }

                return;
            }

            if (passwordButton) {
                const client =
                    findClient(
                        passwordButton.dataset
                            .passwordFromDetails
                    );

                if (!client) return;

                $(
                    "#passwordClientId"
                ).value = client.id;

                $(
                    "#passwordClientName"
                ).textContent =
                    client.name;

                $(
                    "#clientNewPassword"
                ).value = "";

                closeModal(
                    "clientDetailsModal"
                );

                modal(
                    "passwordModal",
                    true
                );

                return;
            }

            if (deleteButton) {
                const client =
                    findClient(
                        deleteButton.dataset
                            .deleteFromDetails
                    );

                if (!client) return;

                await deleteClientAccount(
                    client
                );

                closeModal(
                    "clientDetailsModal"
                );

                return;
            }

            if (statementButton) {
                if (
                    typeof vbExportStatement ===
                    "function"
                ) {
                    vbExportStatement(
                        statementButton
                            .dataset
                            .statementFromDetails,
                        "",
                        ""
                    );
                } else {
                    toast(
                        "Statement export is unavailable.",
                        "error"
                    );
                }
            }
        }
    );

    /* =========================================================
       EDIT CLIENT
       ========================================================= */

    $("#editClientForm")?.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            try {
                const id =
                    $("#editClientId").value;

                const payload = {
                    id,

                    name:
                        $("#editName")
                            .value
                            .trim(),

                    email:
                        $("#editEmail")
                            .value
                            .trim(),

                    phone:
                        normalizePhone(
                            $(
                                "#editPhoneCode"
                            ).value,
                            $(
                                "#editPhone"
                            ).value
                        ),

                    dob:
                        $("#editDob")
                            .value,

                    address:
                        $("#editAddress")
                            .value
                            .trim(),

                    accountType:
                        $(
                            "#editAccountType"
                        ).value,

                    currency:
                        $(
                            "#editCurrency"
                        ).value,

                    status:
                        $("#editStatus")
                            .value
                };

                if (onlineMode()) {
                    if (
                        typeof vbOnlineAdminUpdateClient !==
                        "function"
                    ) {
                        throw new Error(
                            "Client update API is unavailable."
                        );
                    }

                    const response =
                        await vbOnlineAdminUpdateClient(
                            getAdminToken(),
                            payload
                        );

                    if (
                        response?.client &&
                        typeof vbMergeRemoteClients ===
                            "function"
                    ) {
                        vbMergeRemoteClients([
                            response.client
                        ]);
                    }
                } else {
                    vbUpdateClient(
                        id,
                        payload
                    );
                }

                closeModal(
                    "editClientModal"
                );

                renderAll();

                showClientDetails(id);

                toast(
                    "Client profile updated successfully."
                );
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                        "Client profile could not be updated.",
                    "error"
                );
            }
        }
    );

    /* =========================================================
       CHANGE CLIENT PASSWORD
       ========================================================= */

    $("#passwordForm")?.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            try {
                const clientId =
                    $("#passwordClientId")
                        .value;

                const password =
                    $("#clientNewPassword")
                        .value;

                if (password.length < 8) {
                    throw new Error(
                        "Password must contain at least 8 characters."
                    );
                }

                if (onlineMode()) {
                    if (
                        typeof vbOnlineAdminPassword !==
                        "function"
                    ) {
                        throw new Error(
                            "Password API is unavailable."
                        );
                    }

                    await vbOnlineAdminPassword(
                        getAdminToken(),
                        {
                            clientId,
                            password
                        }
                    );
                } else {
                    vbChangeClientPassword(
                        clientId,
                        password
                    );
                }

                $("#passwordForm").reset();

                closeModal(
                    "passwordModal"
                );

                toast(
                    "Client password changed successfully."
                );
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                        "Password could not be changed.",
                    "error"
                );
            }
        }
    );

    /* =========================================================
   MASTER RENDER
   ========================================================= */

// Refresh all dashboard sections after any data change.
function renderAll() {
    renderStats();
    renderChart();
    renderStatus();
    renderRecent();
    renderTopClients();
    renderClients();
    renderTransactions();
    renderAudit();
    renderCurrencySettings();
}

    /* =========================================================
       CURRENCY
       ========================================================= */

    $("#saveCurrency")?.addEventListener(
        "click",
        () => {
            try {
                const code =
                    $("#currencySelect")
                        .value;

                vbSetCurrency(code);

                renderAll();

                const currencyInfo =
                    typeof vbGetCurrency ===
                    "function"
                        ? vbGetCurrency(code)
                        : {
                              name: code
                          };

                toast(
                    `Default currency set to ${currencyInfo.name}. Existing client currencies were not changed.`
                );
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                        "Currency could not be saved.",
                    "error"
                );
            }
        }
    );

    $("#saveRates")?.addEventListener(
        "click",
        () => {
            try {
                const rates = [
                    [
                        "USD",
                        "GBP",
                        "rateUSDGBP"
                    ],
                    [
                        "USD",
                        "EUR",
                        "rateUSDEUR"
                    ],
                    [
                        "GBP",
                        "USD",
                        "rateGBPUSD"
                    ],
                    [
                        "GBP",
                        "EUR",
                        "rateGBPEUR"
                    ],
                    [
                        "EUR",
                        "USD",
                        "rateEURUSD"
                    ],
                    [
                        "EUR",
                        "GBP",
                        "rateEURGBP"
                    ]
                ];

                rates.forEach(
                    ([from, to, field]) => {
                        const input =
                            $(`#${field}`);

                        if (!input) return;

                        vbSetExchangeRate(
                            from,
                            to,
                            input.value
                        );
                    }
                );

                renderCurrencySettings();

                toast(
                    "Exchange rates saved successfully."
                );
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                        "Exchange rates could not be saved.",
                    "error"
                );
            }
        }
    );

    /* =========================================================
       SEARCH / FILTERS
       ========================================================= */

    $("#clientSearch")?.addEventListener(
        "input",
        renderClients
    );

    $("#clientStatusFilter")?.addEventListener(
        "change",
        renderClients
    );

    $("#transactionSearch")?.addEventListener(
        "input",
        renderTransactions
    );

    $("#transactionFilter")?.addEventListener(
        "change",
        renderTransactions
    );

    $("#transactionStatusFilter")?.addEventListener(
        "change",
        renderTransactions
    );

    $("#auditSearch")?.addEventListener(
        "input",
        renderAudit
    );

    /* =========================================================
       RESET BANK DATA
       ========================================================= */

    $("#resetBankData")?.addEventListener(
        "click",
        async () => {
            const confirmed =
                window.confirm(
                    "Reset all Velorian Bank client accounts, transactions and audit activity? This cannot be undone."
                );

            if (!confirmed) return;

            try {
                if (onlineMode()) {
                    if (
                        typeof vbOnlineAdminReset !==
                        "function"
                    ) {
                        throw new Error(
                            "Reset API is unavailable."
                        );
                    }

                    await vbOnlineAdminReset(
                        getAdminToken()
                    );

                    await syncOnlineClients();
                } else {
                    vbResetBankData();
                }

                renderAll();

                toast(
                    "Bank data reset successfully."
                );
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                        "Bank data could not be reset.",
                    "error"
                );
            }
        }
    );

    /* =========================================================
       LOGOUT
       ========================================================= */

    $("#adminLogout")?.addEventListener(
        "click",
        () => {
            if (
                typeof vbClearSession ===
                "function"
            ) {
                vbClearSession();
            }

            sessionStorage.removeItem(
                "vb_api_admin_token"
            );

            localStorage.removeItem(
                "vb_api_admin_token"
            );

            sessionStorage.removeItem(
                "admin_token"
            );

            localStorage.removeItem(
                "admin_token"
            );

            sessionStorage.removeItem(
                "token"
            );

            localStorage.removeItem(
                "token"
            );

            window.location.href =
                "login.html";
        }
    );

    /* =========================================================
       STATE EVENTS
       ========================================================= */

    window.addEventListener(
        "velorian:statechange",
        renderAll
    );

    window.addEventListener(
        "storage",
        renderAll
    );

    /* =========================================================
       INITIAL LOAD
       ========================================================= */

    renderAll();

    syncOnlineClients();

    setInterval(
        syncOnlineClients,
        15000
    );

    console.log(
        "Velorian Bank Admin Dashboard loaded successfully."
    );
});