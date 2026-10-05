document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector) => document.querySelector(selector);

    const session = typeof vbGetSession === "function" ? vbGetSession() : null;
    if (!session || session.role !== "client") return;
    if (typeof vbOnlineEnabled !== "function" || !vbOnlineEnabled()) return;

    const token = sessionStorage.getItem("vb_api_client_token");
    if (!token) return;

    let activeReference = "";
    let otpTimer = null;

    function showToast(message, type = "success") {
        const toast = $("#toast");
        if (!toast) return;
        clearTimeout(window.velorianToastTimer);
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        window.velorianToastTimer = setTimeout(() => {
            toast.className = "toast";
        }, 4000);
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add("open");
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove("open");
    }

    function showMessage(element, text, type = "error") {
        if (!element) return;
        element.textContent = text;
        element.className = `form-error full-field ${type} show`;
    }

    function clearMessage(element) {
        if (!element) return;
        element.textContent = "";
        element.className = "form-error full-field";
    }

    function getCurrentClient() {
        if (typeof vbGetState !== "function") return null;
        const state = vbGetState();
        if (!state || !Array.isArray(state.clients)) return null;
        return state.clients.find(c => c.id === session.clientId) ||
            state.clients.find(c => c.accountNumber === session.accountNumber) || null;
    }

    async function syncClient() {
    try {
        /*
         * First refresh the client account/balance.
         */
        const meResponse =
            await vbOnlineClientMe(token);

        if (
            meResponse &&
            meResponse.client &&
            typeof vbMergeRemoteClients === "function"
        ) {
            vbMergeRemoteClients([
                meResponse.client
            ]);
        }

        /*
         * Then explicitly request the transaction history.
         *
         * This is important because an administrator can create
         * a deposit or withdrawal while the client is already
         * logged in.
         */
        const transactionResponse =
            await vbOnlineClientTransactions(token);

        if (
            transactionResponse &&
            Array.isArray(
                transactionResponse.transactions
            ) &&
            typeof vbMergeRemoteTransactions === "function"
        ) {
            vbMergeRemoteTransactions(
                transactionResponse.transactions
            );
        }

        /*
         * Tell client.js to render the newly synchronized data.
         */
        window.dispatchEvent(
            new CustomEvent("velorian:statechange")
        );

        return {
            client:
                transactionResponse?.client ||
                meResponse?.client ||
                null,

            transactions:
                transactionResponse?.transactions || []
        };

    } catch (error) {

        console.error(
            "Velorian Bank client synchronization failed:",
            error
        );

        if (
            /authorization|unauthorized|session|token/i.test(
                error.message || ""
            )
        ) {
            sessionStorage.removeItem(
                "vb_api_client_token"
            );

            showToast(
                "Your session has expired. Please log in again.",
                "error"
            );
        }

        return null;
    }
}
    

    const transferButton = $("#openTransfer");

    if (transferButton) {
        transferButton.addEventListener("click", (event) => {
            event.preventDefault();

            const client = getCurrentClient();
            if (!client) {
                showToast("Unable to load your account information.", "error");
                return;
            }

            const form = $("#externalTransferForm");
            const currency = client.currency || "USD";

            if (form) form.reset();
            if ($("#transferCurrency")) $("#transferCurrency").value = currency;
            if ($("#transferBalanceHint")) {
                $("#transferBalanceHint").textContent =
                    `Available balance: ${vbFormatMoney(Number(client.balance || 0), currency)} • Daily limit: ${vbFormatMoney(25000, currency)}`;
            }

            clearMessage($("#transferMessage"));
            openModal("transferModal");
        });
    }

    const transferForm = $("#externalTransferForm");

    if (transferForm) {
        transferForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const client = getCurrentClient();
            const messageBox = $("#transferMessage");
            if (!client) return showMessage(messageBox, "Unable to load your account information.");

            clearMessage(messageBox);

            const recipientName = $("#transferRecipientName")?.value.trim() || "";
            const country = $("#transferCountry")?.value.trim() || "";
            const bankName = $("#transferBankName")?.value.trim() || "";
            const recipientAccount = $("#transferRecipientAccount")?.value.trim() || "";
            const iban = $("#transferIban")?.value.trim() || "";
            const swift = $("#transferSwift")?.value.trim() || "";
            const amount = Number($("#transferAmount")?.value || 0);
            const currency = $("#transferCurrency")?.value || "";
            const description = $("#transferDescription")?.value.trim() || "";

            if (!recipientName) return showMessage(messageBox, "Please enter the recipient's name.");
            if (!country) return showMessage(messageBox, "Please enter the destination country.");
            if (!bankName) return showMessage(messageBox, "Please enter the recipient bank name.");
            if (!recipientAccount) return showMessage(messageBox, "Please enter the recipient account number.");
            if (!Number.isFinite(amount) || amount <= 0) return showMessage(messageBox, "Please enter a valid transfer amount.");
            if (amount > 25000) return showMessage(messageBox, "The maximum transfer amount is 25,000 per transaction.");

            const clientCurrency = client.currency || "USD";
            if (currency !== clientCurrency) {
                return showMessage(messageBox, `For this demonstration, the transfer currency must match your account currency (${clientCurrency}).`);
            }

            const balance = Number(client.balance || 0);
            if (amount > balance) {
                return showMessage(messageBox, `Insufficient available balance. Your current balance is ${vbFormatMoney(balance, clientCurrency)}.`);
            }

            const submitButton = transferForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.dataset.originalText = submitButton.textContent;
                submitButton.textContent = "Securing transfer…";
            }

            try {
                const response = await vbOnlineTransferRequest(token, {
                    recipientName,
                    country,
                    bankName,
                    recipientAccount,
                    iban,
                    swift,
                    amount,
                    currency,
                    description
                });

                if (!response || !response.reference) {
                    throw new Error("The transfer request could not be created.");
                }

                activeReference = response.reference;
                closeModal("transferModal");

                if ($("#otpIntro")) {
                    $("#otpIntro").textContent = response.emailSent
                        ? "A 6-digit verification code has been sent to your registered email address."
                        : (response.emailNotice || "OTP delivery is not currently configured.");
                }

                if ($("#transferOtp")) {
                    $("#transferOtp").value = "";
                }
                clearMessage($("#otpMessage"));
                openModal("otpModal");
                startOtpTimer(response.expiresInSeconds || 300);
            } catch (error) {
                console.error("Transfer request failed:", error);
                showMessage(messageBox, error.message || "Unable to create the transfer request.");
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = submitButton.dataset.originalText || "Continue to OTP verification →";
                }
            }
        });
    }

    const otpForm = $("#otpForm");

    if (otpForm) {
        otpForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const messageBox = $("#otpMessage");
            clearMessage(messageBox);

            const otp = $("#transferOtp")?.value.trim() || "";
            if (!/^\d{6}$/.test(otp)) return showMessage(messageBox, "Please enter the 6-digit OTP.");
            if (!activeReference) return showMessage(messageBox, "The transfer verification session is missing. Please start the transfer again.");

            const verifyButton = otpForm.querySelector('button[type="submit"]');
            if (verifyButton) {
                verifyButton.disabled = true;
                verifyButton.dataset.originalText = verifyButton.textContent;
                verifyButton.textContent = "Verifying…";
            }

            try {
                const response = await vbOnlineTransferVerify(token, {
                    reference: activeReference,
                    otp
                });

                clearInterval(otpTimer);
                otpTimer = null;
                closeModal("otpModal");
                await syncClient();
                showToast(`Transfer ${response.reference || activeReference} verified successfully and is now processing.`, "success");
                activeReference = "";
            } catch (error) {
                console.error("OTP verification failed:", error);
                showMessage(messageBox, error.message || "OTP verification failed.");
            } finally {
                if (verifyButton) {
                    verifyButton.disabled = false;
                    verifyButton.textContent = verifyButton.dataset.originalText || "Verify & process transfer →";
                }
            }
        });
    }

    function startOtpTimer(seconds) {
        clearInterval(otpTimer);
        let remaining = Number(seconds) || 300;
        const timerElement = $("#otpTimer");
        const verifyButton = otpForm?.querySelector('button[type="submit"]');

        function updateTimer() {
            const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
            const secs = String(remaining % 60).padStart(2, "0");
            if (timerElement) timerElement.textContent = remaining > 0 ? `Expires in ${minutes}:${secs}` : "OTP expired";
            if (remaining <= 0) {
                clearInterval(otpTimer);
                otpTimer = null;
                if (verifyButton) verifyButton.disabled = true;
                return;
            }
            remaining--;
        }

        if (verifyButton) verifyButton.disabled = false;
        updateTimer();
        otpTimer = setInterval(updateTimer, 1000);
    }

    const otpInput = $("#transferOtp");
    if (otpInput) {
        otpInput.addEventListener("input", () => {
            otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);
        });
    }

    const amountInput = $("#transferAmount");
    if (amountInput) {
        amountInput.addEventListener("input", () => {
            const value = Number(amountInput.value);
            if (value > 25000) amountInput.value = "25000";
            if (value < 0) amountInput.value = "0";
        });
    }

    document.querySelectorAll("[data-close], [data-close-modal]").forEach(button => {
        button.addEventListener("click", () => {
            const id = button.getAttribute("data-close") || button.getAttribute("data-close-modal");
            if (id) closeModal(id);
        });
    });

    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("click", event => {
            if (event.target === modal) modal.classList.remove("open");
        });
    });

    syncClient();
    setInterval(syncClient, 15000);
});
