document.addEventListener("DOMContentLoaded",()=>{
 const session=vbGetSession(); if(!session||session.role!=="client"){location.href="../client-login.html";return;}
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
 // Resolve the logged-in account by ID first, then by account number for compatibility with older sessions.
 function resolveClient(){
   const state=vbGetState();
   return state.clients.find(c=>c.id===session.clientId) || (session.accountNumber ? state.clients.find(c=>String(c.accountNumber)===String(session.accountNumber)) : null);
 }
 const forced=resolveClient(); if(!forced){vbClearSession();location.href="../client-login.html";return;} if(forced.forcePasswordChange){location.href="first-login.html";return;}
 const toast=(m,t="success")=>{const e=$("#toast");e.textContent=m;e.className=`toast show ${t}`;clearTimeout(window._toast);window._toast=setTimeout(()=>e.className="toast",3500)};
 let balanceVisible=true;
 const getClient=()=>resolveClient();
 function open(id){$("#"+id).classList.add("open")} function close(id){$("#"+id).classList.remove("open")}
 function meta(t){if(t.type==="deposit")return["Deposit","+","amount-positive"];if(t.type==="withdrawal")return["Withdrawal","-","amount-negative"];if(t.type==="transfer_in")return["Transfer received","+","amount-positive"];return["Transfer sent","-","amount-negative"]}


 async function refreshOnlineClientData(){

    if(
        typeof vbOnlineEnabled !== "function" ||
        !vbOnlineEnabled()
    ){
        return;
    }

    const token =
        sessionStorage.getItem(
            "vb_api_client_token"
        );

    if(!token){
        return;
    }

    try{

        /*
         * Refresh client account information.
         */
        if(
            typeof vbOnlineClientMe === "function"
        ){

            const me =
                await vbOnlineClientMe(token);

            if(
                me &&
                me.client &&
                typeof vbMergeRemoteClients === "function"
            ){

                vbMergeRemoteClients([
                    me.client
                ]);
            }
        }

        /*
         * Refresh transaction history directly
         * from the PHP/MySQL backend.
         */
        if(
            typeof vbOnlineClientTransactions === "function"
        ){

            const result =
                await vbOnlineClientTransactions(
                    token
                );

            if(
                result &&
                Array.isArray(
                    result.transactions
                ) &&
                typeof vbMergeRemoteTransactions === "function"
            ){

                vbMergeRemoteTransactions(
                    result.transactions
                );
            }
        }

        /*
         * Re-render the dashboard after
         * the server data has been merged.
         */
        render();

    }catch(error){

        console.error(
            "Velorian Bank online refresh failed:",
            error
        );

    }
}


 function render(){

    vbRenderCurrencyUI();

    const c = getClient();

    if(!c){
        vbClearSession();
        location.href="../client-login.html";
        return;
    }

    /*
     * Get transactions from the local synchronized state.
     * vbMergeRemoteTransactions() will place server transactions
     * into this state when the online refresh runs.
     */
    const all = vbClientTransactions(
        c.id,
        c.accountNumber
    );

    const q = (
        ($("#historySearch")?.value) || ""
    ).toLowerCase();

    const f =
        $("#historyFilter")?.value ||
        "all";

    const txs = all.filter(t =>
        (f === "all" || t.type === f) &&
        (
            !q ||
            `${t.id} ${t.description || ""} ${t.relatedAccountNumber || ""}`
                .toLowerCase()
                .includes(q)
        )
    );

    const deposits =
        all
            .filter(t => t.type === "deposit")
            .reduce(
                (a,t) => a + Number(t.amount || 0),
                0
            );

    const withdrawals =
        all
            .filter(t => t.type === "withdrawal")
            .reduce(
                (a,t) => a + Number(t.amount || 0),
                0
            );

    if($("#clientNameTop"))
        $("#clientNameTop").textContent =
            c.name.split(" ")[0];

    if($("#heroFirstName"))
        $("#heroFirstName").textContent =
            c.name.split(" ")[0];

    if($("#accountNumberHero"))
        $("#accountNumberHero").textContent =
            c.accountNumber;

    if($("#summaryAccountNumber"))
        $("#summaryAccountNumber").textContent =
            c.accountNumber;

    if($("#profileAccountNumber"))
        $("#profileAccountNumber").textContent =
            c.accountNumber;

    if($("#profileAvatar"))
        $("#profileAvatar").textContent =
            vbInitials(c.name);

    if($("#profileName"))
        $("#profileName").textContent =
            c.name;

    if($("#profileEmail"))
        $("#profileEmail").textContent =
            c.email;

    if($("#profileType"))
        $("#profileType").textContent =
            c.accountType;

    if($("#profileTypeSide"))
        $("#profileTypeSide").textContent =
            c.accountType;

    if($("#profileJoined"))
        $("#profileJoined").textContent =
            c.createdAt
                ? vbShortDate(c.createdAt)
                : "—";

    if($("#profileCurrency"))
        $("#profileCurrency").textContent =
            c.currency;

    if($("#summaryCurrency"))
        $("#summaryCurrency").textContent =
            c.currency;

    const st =
        $("#profileStatus");

    if(st){

        st.textContent =
            c.status;

        st.className =
            `${st.id === "profileStatus" &&
              st.tagName === "STRONG"
                ? ""
                : "badge "
            }${
                c.status === "Active"
                    ? "badge-success"
                    : c.status === "Frozen"
                        ? "badge-danger"
                        : "badge-pending"
            }`;
    }

    if($("#snapshotStatus"))
        $("#snapshotStatus").textContent =
            c.status;

    if($("#balanceValue"))
        $("#balanceValue").textContent =
            balanceVisible
                ? vbFormatMoney(
                    c.balance,
                    c.currency
                )
                : "••••••";

    if($("#totalDeposits"))
        $("#totalDeposits").textContent =
            vbFormatMoney(
                deposits,
                c.currency
            );

    if($("#totalWithdrawals"))
        $("#totalWithdrawals").textContent =
            vbFormatMoney(
                withdrawals,
                c.currency
            );

    if($("#transactionCount"))
        $("#transactionCount").textContent =
            all.length;

    const alert =
        $("#accountAlert");

    if(c.status !== "Active"){

        alert.className =
            "account-alert";

        alert.innerHTML =
            `<strong>
                Account ${esc(c.status.toLowerCase())}
            </strong>
            <span>
                Banking transactions and transfers are currently unavailable.
            </span>`;

    }else{

        alert.className =
            "account-alert hidden";
    }

    const transactionContainer =
        $("#clientTransactions");

    if(transactionContainer){

        transactionContainer.innerHTML =
            txs.map(t => {

                const [
                    label,
                    sign,
                    cls
                ] = meta(t);

                const rel =
                    t.relatedAccountNumber
                        ? `
                            <small>
                                ${
                                    t.type === "transfer_out"
                                        ? "To"
                                        : "From"
                                }
                                ${esc(
                                    t.relatedAccountNumber
                                )}
                            </small>
                          `
                        : `
                            <small>
                                ${esc(
                                    t.description ||
                                    "Bank transaction"
                                )}
                            </small>
                          `;

                return `
                    <tr data-receipt="${esc(t.id)}">

                        <td>
                            <strong>
                                ${esc(t.id)}
                            </strong>
                            ${rel}
                        </td>

                        <td>
                            ${label}
                        </td>

                        <td class="${cls}">
                            ${sign}${vbFormatMoney(
                                t.amount,
                                t.currency || c.currency
                            )}
                        </td>

                        <td>
                            <span class="badge ${
                                t.status === "Success"
                                    ? "badge-success"
                                    : "badge-pending"
                            }">
                                ${esc(t.status)}
                            </span>
                        </td>

                        <td>
                            ${vbFormatDate(t.timestamp)}
                        </td>

                    </tr>
                `;

            }).join("")

            ||

            `
                <tr>
                    <td colspan="5">
                        <div class="empty-state">
                            No transactions found.
                        </div>
                    </td>
                </tr>
            `;
    }

    const notes =
        vbGetState()
            .notifications
            .filter(n =>
                n.clientId === c.id
            );

    const unread =
        notes.filter(n => !n.read).length;

    if($("#notificationCount"))
        $("#notificationCount").textContent =
            unread || "";
}
 function renderNotifications(){const ns=vbGetState().notifications.filter(n=>n.clientId===getClient()?.id);$("#notificationsList").innerHTML=ns.map(n=>`<div class="notification-item ${n.read?"read":"unread"}"><div><span class="notification-dot ${esc(n.type)}"></span></div><div><strong>${esc(n.title)}</strong><p>${esc(n.message)}</p><small>${vbFormatDate(n.timestamp)}</small></div></div>`).join("")||`<div class="empty-state">No notifications yet.</div>`}
 function showReceipt(id){const t=vbGetState().transactions.find(x=>x.id===id);const c=getClient();if(!t||!c)return;const [label,sign,cls]=meta(t);$("#receiptContent").innerHTML=`<button class="modal-close" data-close="receiptModal">×</button><div class="receipt-brand"><img src="assets/logo.jfif" alt="Velorian Bank"></div><span class="eyebrow">TRANSACTION RECEIPT</span><h2>${label}</h2><div class="receipt-status"><span class="badge badge-success">${esc(t.status)}</span></div><div class="receipt-amount ${cls}">${sign}${vbFormatMoney(t.amount,t.currency||c.currency)}</div><div class="receipt-grid"><div><span>Reference</span><strong>${esc(t.id)}</strong></div><div><span>Date</span><strong>${vbFormatDate(t.timestamp)}</strong></div><div><span>Account</span><strong>${c.accountNumber}</strong></div><div><span>Description</span><strong>${esc(t.description||"Bank transaction")}</strong></div>${t.relatedAccountNumber?`<div><span>Related account</span><strong>${esc(t.relatedAccountNumber)}</strong></div>`:""}${t.exchangeRate&&t.receivedCurrency&&t.receivedCurrency!==t.currency?`<div><span>Exchange rate</span><strong>1 ${esc(t.currency)} = ${esc(String(t.exchangeRate))} ${esc(t.receivedCurrency)}</strong></div><div><span>Converted amount</span><strong>${vbFormatMoney(t.receivedAmount||t.amount,t.receivedCurrency)}</strong></div>`:""}</div><button class="primary-btn" id="printReceipt">Print / Save PDF</button>`;open("receiptModal");$("#printReceipt").onclick=()=>window.print()}
 const recipientAccount=$("#recipientAccount"), recipientPreview=$("#recipientPreview");
 if(recipientAccount && recipientPreview){recipientAccount.oninput=()=>{const n=recipientAccount.value.trim(),target=vbGetState().clients.find(x=>x.accountNumber===n),sender=getClient();if(target&&sender&&target.id!==session.clientId){const rate=vbGetRate(sender.currency,target.currency);const rateText=sender.currency===target.currency?"1:1 exchange rate":(rate?`1 ${sender.currency} = ${rate} ${target.currency}`:"Exchange rate not configured");recipientPreview.className="recipient-preview";recipientPreview.innerHTML=`<span class="profile-avatar small">${esc(vbInitials(target.name))}</span><div><strong>${esc(target.name)}</strong><small>${esc(target.accountType)} • ${esc(target.accountNumber)} • ${esc(vbGetCurrency(target.currency).name)}</small><small>${esc(rateText)}</small></div>`}else recipientPreview.className="recipient-preview hidden"};}
 const openStatement=$("#openStatement"), statementForm=$("#statementForm");
 if(openStatement) openStatement.onclick=()=>{const now=new Date();if($("#statementTo")) $("#statementTo").value=now.toISOString().slice(0,10);open("statementModal")};
 if(statementForm) statementForm.onsubmit=e=>{e.preventDefault();try{vbExportStatement(getClient().id,$("#statementFrom")?.value||"",$("#statementTo")?.value||"");close("statementModal")}catch(err){toast(err.message,"error")}};
 const notificationHandler=()=>{renderNotifications();open("notificationsModal");vbMarkNotificationsRead(getClient().id);setTimeout(render,0)};
 const notificationsBtn=$("#notificationsBtn"), notificationsBtnTop=$("#notificationsBtnTop"); if(notificationsBtn) notificationsBtn.onclick=notificationHandler; if(notificationsBtnTop) notificationsBtnTop.onclick=notificationHandler;
 const openPassword=$("#openPassword"), ownPasswordForm=$("#ownPasswordForm");
 if(openPassword) openPassword.onclick=()=>open("passwordModal");
 const openPasswordSecondary=$("#openPasswordSecondary"); if(openPasswordSecondary) openPasswordSecondary.onclick=()=>open("passwordModal");
 const openSupport=$("#openSupport"), openSupportSecondary=$("#openSupportSecondary");
 function support(){toast("Support is available through the bank contact channels.");}
 if(openSupport) openSupport.onclick=support; if(openSupportSecondary) openSupportSecondary.onclick=support;
 if(ownPasswordForm) ownPasswordForm.onsubmit=async e=>{e.preventDefault();if($("#newPassword").value!==$("#confirmPassword").value)return toast("New passwords do not match.","error");try{if(vbOnlineEnabled())await vbOnlineClientPassword(sessionStorage.getItem("vb_api_client_token"),{password:$("#newPassword").value});else vbChangeOwnPassword(getClient().id,$("#currentPassword").value,$("#newPassword").value);e.target.reset();close("passwordModal");toast("Password updated successfully.")}catch(err){toast(err.message,"error")}};
 const toggleBalance=$("#toggleBalance"), copyAccount=$("#copyAccount");
 if(toggleBalance) toggleBalance.onclick=()=>{balanceVisible=!balanceVisible;toggleBalance.textContent=balanceVisible?"Hide balance":"Show balance";render()};
 if(copyAccount) copyAccount.onclick=async()=>{try{await navigator.clipboard.writeText(getClient().accountNumber);toast("Account number copied.")}catch{toast("Copy is unavailable in this browser.","error")}};
 const historySearch=$("#historySearch"), historyFilter=$("#historyFilter"), clientLogout=$("#clientLogout");
 if(historySearch) historySearch.oninput=render; if(historyFilter) historyFilter.onchange=render;
 if(clientLogout) clientLogout.onclick=()=>{vbClearSession();location.replace("../client-login.html")};
 $("#clientTransactions").onclick=e=>{const tr=e.target.closest("tr[data-receipt]");if(tr)showReceipt(tr.dataset.receipt)};
 $$('[data-scroll]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.scroll).scrollIntoView({behavior:"smooth",block:"center"}));$$('[data-close]').forEach(b=>b.onclick=()=>close(b.dataset.close));$$('.modal-backdrop').forEach(m=>m.onclick=e=>{if(e.target===m)m.classList.remove("open")});
 window.addEventListener(
    "velorian:statechange",
    render
);

window.addEventListener(
    "storage",
    render
);

render();

/*
 * Immediately retrieve the latest
 * transactions from the PHP/MySQL backend.
 */
refreshOnlineClientData();

/*
 * Continue refreshing periodically so that
 * an admin withdrawal/deposit appears
 * without requiring the client to log out.
 */
setInterval(
    refreshOnlineClientData,
    10000
);;
});
