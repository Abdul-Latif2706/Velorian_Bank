/*
   Velorian Bank — centralized browser state.
   Front-end prototype only.
   The PHP/MySQL backend is the source of truth when online mode is enabled.
   Do not use localStorage for real banking/security.
*/

const VB_STORAGE_KEY = "velorian_bank_state_v5";
const VB_SESSION_KEY = "velorian_bank_session_v2";

const ACCOUNT_PREFIX = "1092";
const CURRENCY = "USD";
const TRANSFER_DAILY_LIMIT = 25000;

const VB_CURRENCIES = {
  USD: {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    locale: "en-US"
  },

  GBP: {
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    locale: "en-GB"
  },

  EUR: {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    locale: "de-DE"
  }
};


/* ============================================================
   SEED STATE
============================================================ */

function vbSeedState() {
  return {
    version: 5,

    bank: {
      name: "Velorian Bank",
      currency: CURRENCY,
      accountPrefix: ACCOUNT_PREFIX,

      supportedCurrencies: [
        "USD",
        "GBP",
        "EUR"
      ],

      rates: {
        USD: {
          USD: 1,
          GBP: 0.78,
          EUR: 0.85
        },

        GBP: {
          USD: 1.28,
          GBP: 1,
          EUR: 1.09
        },

        EUR: {
          USD: 1.18,
          GBP: 0.92,
          EUR: 1
        }
      }
    },

    admin: {
      email: "admin@velorian.com",
      name: "Hamza"
    },

    clients: [],
    transactions: [],
    audit: [],
    notifications: []
  };
}


/* ============================================================
   GET STATE
============================================================ */

function vbGetState() {
  let state;

  try {
    state = JSON.parse(
      localStorage.getItem(VB_STORAGE_KEY) || "null"
    );
  } catch (error) {
    state = null;
  }

  if (!state || typeof state !== "object") {
    state = vbSeedState();

    localStorage.setItem(
      VB_STORAGE_KEY,
      JSON.stringify(state)
    );
  }

  state.bank ||= {
    name: "Velorian Bank",
    currency: CURRENCY,
    accountPrefix: ACCOUNT_PREFIX
  };

  state.clients ||= [];
  state.transactions ||= [];
  state.audit ||= [];
  state.notifications ||= [];

  state.bank.name ||= "Velorian Bank";
  state.bank.currency ||= CURRENCY;
  state.bank.accountPrefix ||= ACCOUNT_PREFIX;

  state.bank.supportedCurrencies ||= [
    "USD",
    "GBP",
    "EUR"
  ];

  state.bank.rates ||= {
    USD: {
      USD: 1,
      GBP: 0.78,
      EUR: 0.85
    },

    GBP: {
      USD: 1.28,
      GBP: 1,
      EUR: 1.09
    },

    EUR: {
      USD: 1.18,
      GBP: 0.92,
      EUR: 1
    }
  };


  /* ----------------------------------------------------------
     Normalize clients
  ---------------------------------------------------------- */

  state.clients.forEach(client => {

    client.currency ||= CURRENCY;

    client.forcePasswordChange =
      client.forcePasswordChange || false;

    client.status ||= "Active";

    client.accountType ||=
      "Savings Account";

    client.name ||= "Client";

    client.email ||= "";

    client.phone ||= "";

    client.country ||= "";

    client.dob ||= "";

    client.address ||= "";

    client.accountNumber ||= "";

    client.balance =
      Number(client.balance || 0);
  });


  /* ----------------------------------------------------------
     Normalize transactions
  ---------------------------------------------------------- */

  state.transactions.forEach(transaction => {

    const transactionClientId =
      String(
        transaction.clientId ||
        transaction.client_id ||
        ""
      ).trim();

    const transactionAccountNumber =
      String(
        transaction.clientAccountNumber ||
        transaction.client_account_number ||
        transaction.accountNumber ||
        transaction.account_number ||
        ""
      ).trim();

    const client =
      state.clients.find(client =>
        String(client.id || "").trim() ===
        transactionClientId
      )
      ||
      state.clients.find(client =>
        transactionAccountNumber &&
        String(client.accountNumber || "").trim() ===
        transactionAccountNumber
      );

    transaction.clientId =
      client?.id ||
      transaction.clientId ||
      transaction.client_id ||
      "";

    transaction.clientAccountNumber =
      transactionAccountNumber ||
      client?.accountNumber ||
      "";

    transaction.clientName =
      transaction.clientName ||
      transaction.client_name ||
      client?.name ||
      "";

    transaction.currency ||=
      client?.currency ||
      CURRENCY;

    transaction.amount =
      Number(transaction.amount || 0);

    transaction.status ||=
      "Success";

    transaction.description ||=
      "";

    transaction.timestamp ||=
      transaction.createdAt ||
      new Date().toISOString();
  });


  if (!VB_CURRENCIES[state.bank.currency]) {
    state.bank.currency = CURRENCY;
  }

  return state;
}


/* ============================================================
   SAVE STATE
============================================================ */

function vbSaveState(state) {

  localStorage.setItem(
    VB_STORAGE_KEY,
    JSON.stringify(state)
  );

  window.dispatchEvent(
    new CustomEvent("velorian:statechange")
  );

  return state;
}


/* ============================================================
   RESET LOCAL BANK DATA
============================================================ */

function vbResetBankData() {

  const state =
    vbSeedState();

  localStorage.setItem(
    VB_STORAGE_KEY,
    JSON.stringify(state)
  );

  window.dispatchEvent(
    new CustomEvent("velorian:statechange")
  );

  return state;
}


/* ============================================================
   SESSION
============================================================ */

function vbGetSession() {

  try {

    return JSON.parse(
      sessionStorage.getItem(
        VB_SESSION_KEY
      ) || "null"
    );

  } catch (error) {

    return null;
  }
}


function vbSetSession(
  role,
  clientId = null,
  accountNumber = null
) {

  sessionStorage.setItem(
    VB_SESSION_KEY,
    JSON.stringify({
      role,
      clientId,
      accountNumber,
      createdAt: Date.now()
    })
  );
}


function vbClearSession() {

  sessionStorage.removeItem(
    VB_SESSION_KEY
  );
}


/* ============================================================
   CLIENT LOOKUP
============================================================ */

function vbFindClient(
  id,
  accountNumber = null
) {

  const state =
    vbGetState();

  const normalizedId =
    String(id || "").trim();

  const normalizedAccount =
    String(accountNumber || "").trim();

  return (
    state.clients.find(
      client =>
        String(client.id || "").trim() ===
        normalizedId
    )
    ||
    (
      normalizedAccount
        ? state.clients.find(
            client =>
              String(
                client.accountNumber || ""
              ).trim() ===
              normalizedAccount
          )
        : null
    )
  );
}


/* ============================================================
   ID GENERATOR
============================================================ */

function vbMakeId(prefix) {

  return (
    `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`
  ).toUpperCase();
}


/* ============================================================
   ACCOUNT NUMBER
============================================================ */

function vbGenerateAccountNumber() {

  const state =
    vbGetState();

  let number;

  do {

    number =
      ACCOUNT_PREFIX +
      Math.floor(
        100000 +
        Math.random() * 900000
      );

  } while (
    state.clients.some(
      client =>
        String(client.accountNumber || "") ===
        String(number)
    )
  );

  return number;
}


/* ============================================================
   CURRENCY HELPERS
============================================================ */

function vbGetCurrency(code = CURRENCY) {

  return (
    VB_CURRENCIES[code] ||
    VB_CURRENCIES[CURRENCY]
  );
}


function vbGetClientCurrency(clientOrId) {

  const client =
    typeof clientOrId === "string"
      ? vbFindClient(clientOrId)
      : clientOrId;

  return vbGetCurrency(
    client?.currency || CURRENCY
  );
}


function vbCurrencySymbol(
  code = CURRENCY
) {

  return vbGetCurrency(code).symbol;
}


function vbFormatMoney(
  value,
  code = CURRENCY
) {

  const currency =
    vbGetCurrency(code);

  return new Intl.NumberFormat(
    currency.locale,
    {
      style: "currency",
      currency: currency.code
    }
  ).format(
    Number(value || 0)
  );
}


/* ============================================================
   BANK CURRENCY
============================================================ */

function vbSetCurrency(code) {

  if (!VB_CURRENCIES[code]) {
    throw new Error(
      "Unsupported currency."
    );
  }

  const state =
    vbGetState();

  state.bank.currency =
    code;

  vbSaveState(state);

  return state;
}


/* ============================================================
   EXCHANGE RATE
============================================================ */

function vbSetExchangeRate(
  from,
  to,
  rate
) {

  if (
    !VB_CURRENCIES[from] ||
    !VB_CURRENCIES[to]
  ) {
    throw new Error(
      "Unsupported currency."
    );
  }

  const value =
    Number(rate);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      "Exchange rate must be greater than zero."
    );
  }

  const state =
    vbGetState();

  state.bank.rates[from] ||= {};

  state.bank.rates[from][to] =
    from === to
      ? 1
      : value;

  state.audit.unshift({
    id: vbMakeId("AUD"),
    action: "Exchange rate updated",
    details:
      `${from} → ${to} = ${state.bank.rates[from][to]}`,
    actor:
      state.admin?.name ||
      "Administrator",
    timestamp:
      new Date().toISOString()
  });

  vbSaveState(state);

  return state;
}


function vbGetRate(
  from,
  to
) {

  if (from === to) {
    return 1;
  }

  return Number(
    vbGetState()
      .bank
      .rates?.[from]?.[to] || 0
  );
}


/* ============================================================
   CURRENCY UI
============================================================ */

function vbRenderCurrencyUI(
  root = document
) {

  const currency =
    vbGetCurrency();

  root
    .querySelectorAll(
      "[data-currency-symbol]"
    )
    .forEach(
      element =>
        element.textContent =
          currency.symbol
    );

  root
    .querySelectorAll(
      "[data-currency-code]"
    )
    .forEach(
      element =>
        element.textContent =
          currency.code
    );

  root
    .querySelectorAll(
      "[data-currency-name]"
    )
    .forEach(
      element =>
        element.textContent =
          currency.name
    );
}


/* ============================================================
   DATE HELPERS
============================================================ */

function vbFormatDate(iso) {

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  ).format(
    new Date(iso)
  );
}


function vbShortDate(iso) {

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  ).format(
    new Date(iso)
  );
}


function vbRelativeDate(iso) {

  const difference =
    Date.now() -
    new Date(iso).getTime();

  const minutes =
    Math.floor(
      difference / 60000
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  return `${days}d ago`;
}


function vbInitials(name) {

  return (
    String(name || "VB")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(value => value[0])
      .join("")
      .toUpperCase() ||
    "VB"
  );
}


/* ============================================================
   CLIENT TRANSACTIONS
============================================================ */

function vbClientTransactions(
  clientId,
  accountNumber = null
) {

  const state =
    vbGetState();

  const normalizedClientId =
    String(clientId || "").trim();

  const normalizedAccountNumber =
    String(accountNumber || "").trim();


  /*
     Resolve the actual local client.

     We first use the browser client ID.
     If the IDs differ between PHP/MySQL and browser
     storage, the account number is used instead.
  */

  const client =
    state.clients.find(
      item =>
        String(item.id || "").trim() ===
        normalizedClientId
    )
    ||
    (
      normalizedAccountNumber
        ? state.clients.find(
            item =>
              String(
                item.accountNumber || ""
              ).trim() ===
              normalizedAccountNumber
          )
        : null
    );


  if (!client) {
    return [];
  }


  const resolvedClientId =
    String(client.id || "").trim();

  const resolvedAccountNumber =
    String(
      client.accountNumber || ""
    ).trim();


  return state.transactions
    .filter(transaction => {

      const transactionClientId =
        String(
          transaction.clientId ||
          transaction.client_id ||
          ""
        ).trim();


      const transactionAccountNumber =
        String(
          transaction.clientAccountNumber ||
          transaction.client_account_number ||
          transaction.accountNumber ||
          transaction.account_number ||
          ""
        ).trim();


      return (
        transactionClientId ===
          resolvedClientId
        ||
        (
          resolvedAccountNumber &&
          transactionAccountNumber ===
            resolvedAccountNumber
        )
      );
    })
    .sort(
      (a, b) =>
        new Date(
          b.timestamp || 0
        ) -
        new Date(
          a.timestamp || 0
        )
    );
}


/* ============================================================
   AUDIT
============================================================ */

function vbAddAudit(
  action,
  details = "",
  actor = "Administrator"
) {

  const state =
    vbGetState();

  const timestamp =
    new Date().toISOString();

  state.audit.unshift({
    id: vbMakeId("AUD"),
    action,
    details,
    actor,
    timestamp
  });

  state.audit =
    state.audit.slice(0, 1000);

  vbSaveState(state);
}


/* ============================================================
   NOTIFICATIONS
============================================================ */

function vbAddNotification(
  clientId,
  title,
  message,
  type = "info",
  state = null
) {

  const currentState =
    state || vbGetState();

  currentState.notifications.unshift({
    id: vbMakeId("NTF"),
    clientId,
    title,
    message,
    type,
    read: false,
    timestamp:
      new Date().toISOString()
  });

  currentState.notifications =
    currentState.notifications.slice(
      0,
      1000
    );
}


/* ============================================================
   DAILY TRANSFER TOTAL
============================================================ */

function vbDailyTransferTotal(
  clientId
) {

  const start =
    new Date();

  start.setHours(
    0,
    0,
    0,
    0
  );

  const normalizedClientId =
    String(clientId || "").trim();

  return vbGetState()
    .transactions
    .filter(
      transaction =>
        String(
          transaction.clientId ||
          transaction.client_id ||
          ""
        ).trim() ===
          normalizedClientId
        &&
        transaction.type ===
          "transfer_out"
        &&
        new Date(
          transaction.timestamp
        ) >= start
    )
    .reduce(
      (total, transaction) =>
        total +
        Number(transaction.amount || 0),
      0
    );
}


/* ============================================================
   CREATE TRANSACTION
============================================================ */

function vbCreateTransaction(
  clientId,
  type,
  amount,
  status = "Success",
  description = "",
  meta = {}
) {

  const session =
    vbGetSession();

  if (
    !session ||
    session.role !== "admin"
  ) {
    throw new Error(
      "Only an authorized administrator can post deposits or withdrawals."
    );
  }

  const state =
    vbGetState();

  const client =
    state.clients.find(
      item =>
        String(item.id || "") ===
        String(clientId || "")
    );

  if (!client) {
    throw new Error(
      "Client account not found."
    );
  }

  if (
    client.status !== "Active"
  ) {
    throw new Error(
      `This account is ${client.status.toLowerCase()}. Transactions are unavailable.`
    );
  }

  const value =
    Number(amount);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      "Enter a valid amount."
    );
  }

  if (
    !["deposit", "withdrawal"]
      .includes(type)
  ) {
    throw new Error(
      "Unsupported transaction type."
    );
  }

  if (
    type === "withdrawal" &&
    value > client.balance
  ) {
    throw new Error(
      "Insufficient funds. Withdrawal cannot exceed available balance."
    );
  }

  if (status === "Success") {

    client.balance =
      Number(
        (
          client.balance +
          (
            type === "deposit"
              ? value
              : -value
          )
        ).toFixed(2)
      );
  }

  const timestamp =
    new Date().toISOString();

  const transaction = {

    id:
      vbMakeId("TX"),

    clientId:
      client.id,

    clientAccountNumber:
      client.accountNumber,

    clientName:
      client.name,

    type,

    amount:
      Number(value.toFixed(2)),

    currency:
      client.currency,

    status,

    description:
      String(description || "")
        .trim()
        .slice(0, 120),

    timestamp,

    ...meta
  };


  state.transactions.unshift(
    transaction
  );


  const label =
    type === "deposit"
      ? "Deposit"
      : "Withdrawal";

  const sign =
    type === "deposit"
      ? "received"
      : "completed";


  state.audit.unshift({

    id:
      vbMakeId("AUD"),

    action:
      `${label} ${sign}`,

    details:
      `${client.name} • ${vbFormatMoney(
        transaction.amount,
        client.currency
      )}`,

    actor:
      "Administrator",

    timestamp
  });


  vbAddNotification(

    client.id,

    `${label} ${status.toLowerCase()}`,

    `${vbFormatMoney(
      transaction.amount,
      client.currency
    )} ${
      type === "deposit"
        ? "was added to"
        : "was withdrawn from"
    } your account.`,

    type === "deposit"
      ? "success"
      : "warning",

    state
  );


  vbSaveState(
    state
  );

  return transaction;
}


/* ============================================================
   INTERNAL TRANSFER
============================================================ */

function vbTransferFunds(
  senderId,
  recipientAccount,
  amount,
  description = "Internal transfer"
) {

  const session =
    vbGetSession();

  if (
    !session ||
    session.role !== "admin"
  ) {
    throw new Error(
      "Only an authorized administrator can perform transfers."
    );
  }

  const state =
    vbGetState();

  const sender =
    state.clients.find(
      client =>
        client.id === senderId
    );

  const recipient =
    state.clients.find(
      client =>
        String(
          client.accountNumber || ""
        ).trim() ===
        String(
          recipientAccount || ""
        ).trim()
    );

  if (!sender) {
    throw new Error(
      "Sender account not found."
    );
  }

  if (
    sender.status !== "Active"
  ) {
    throw new Error(
      "Your account is restricted and cannot send transfers."
    );
  }

  if (!recipient) {
    throw new Error(
      "Recipient account could not be found."
    );
  }

  if (
    recipient.id === sender.id
  ) {
    throw new Error(
      "You cannot transfer money to your own account."
    );
  }

  if (
    recipient.status !== "Active"
  ) {
    throw new Error(
      "The recipient account is not active."
    );
  }

  const value =
    Number(amount);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      "Enter a valid transfer amount."
    );
  }

  if (
    value > sender.balance
  ) {
    throw new Error(
      "Insufficient funds. Transfer cannot exceed available balance."
    );
  }

  if (
    vbDailyTransferTotal(sender.id) +
      value >
    TRANSFER_DAILY_LIMIT
  ) {
    throw new Error(
      `Daily transfer limit is ${vbFormatMoney(
        TRANSFER_DAILY_LIMIT,
        sender.currency
      )}.`
    );
  }

  const rate =
    vbGetRate(
      sender.currency,
      recipient.currency
    );

  if (!rate) {
    throw new Error(
      `No exchange rate is configured for ${sender.currency} to ${recipient.currency}.`
    );
  }

  const received =
    Number(
      (value * rate).toFixed(2)
    );

  const outgoing =
    Number(
      value.toFixed(2)
    );

  const timestamp =
    new Date().toISOString();

  const reference =
    vbMakeId("TRF");

  const descriptionText =
    String(
      description || "Internal transfer"
    )
      .trim()
      .slice(0, 120) ||
    "Internal transfer";


  sender.balance =
    Number(
      (
        sender.balance -
        outgoing
      ).toFixed(2)
    );

  recipient.balance =
    Number(
      (
        recipient.balance +
        received
      ).toFixed(2)
    );


  state.transactions.unshift({

    id:
      reference,

    clientId:
      sender.id,

    clientAccountNumber:
      sender.accountNumber,

    clientName:
      sender.name,

    type:
      "transfer_out",

    amount:
      outgoing,

    currency:
      sender.currency,

    receivedAmount:
      received,

    receivedCurrency:
      recipient.currency,

    exchangeRate:
      rate,

    status:
      "Success",

    description:
      descriptionText,

    timestamp,

    relatedClientId:
      recipient.id,

    relatedAccountNumber:
      recipient.accountNumber,

    direction:
      "out"
  });


  state.transactions.unshift({

    id:
      `${reference}-IN`,

    clientId:
      recipient.id,

    clientAccountNumber:
      recipient.accountNumber,

    clientName:
      recipient.name,

    type:
      "transfer_in",

    amount:
      received,

    currency:
      recipient.currency,

    sentAmount:
      outgoing,

    sentCurrency:
      sender.currency,

    exchangeRate:
      rate,

    status:
      "Success",

    description:
      descriptionText,

    timestamp,

    relatedClientId:
      sender.id,

    relatedAccountNumber:
      sender.accountNumber,

    direction:
      "in",

    relatedReference:
      reference
  });


  state.audit.unshift({

    id:
      vbMakeId("AUD"),

    action:
      "Internal transfer completed",

    details:
      `${sender.name} (${sender.accountNumber}) → ${recipient.name} (${recipient.accountNumber}) • ${vbFormatMoney(outgoing, sender.currency)} → ${vbFormatMoney(received, recipient.currency)} • rate ${rate}`,

    actor:
      "Client / System",

    timestamp
  });


  vbAddNotification(
    sender.id,
    "Transfer sent",
    `${vbFormatMoney(outgoing, sender.currency)} was sent to ${recipient.name}. They received ${vbFormatMoney(received, recipient.currency)}. Ref ${reference}.`,
    "success",
    state
  );


  vbAddNotification(
    recipient.id,
    "Transfer received",
    `${vbFormatMoney(received, recipient.currency)} was received from ${sender.name}. Original amount: ${vbFormatMoney(outgoing, sender.currency)}. Ref ${reference}.`,
    "success",
    state
  );


  vbSaveState(
    state
  );


  return {
    reference,
    sender,
    recipient,
    amount: outgoing,
    receivedAmount: received,
    rate,
    timestamp
  };
}


/* ============================================================
   ADMIN POST TRANSACTION
============================================================ */

function vbAdminPostTransaction(
  clientId,
  type,
  amount,
  status = "Success",
  description = "Administrator transaction"
) {

  return vbCreateTransaction(
    clientId,
    type,
    amount,
    status,
    description,
    {
      source: "Administrator"
    }
  );
}

/* ============================================================
   REMOTE CLIENT SYNCHRONIZATION
============================================================ */

function vbMergeRemoteClients(remoteClients) {

  const state = vbGetState();

  if (!Array.isArray(remoteClients)) {
    return false;
  }

  let changed = false;

  remoteClients.forEach(remoteClient => {

    if (
      !remoteClient ||
      !remoteClient.id
    ) {
      return;
    }

    const remoteClientId =
      String(
        remoteClient.id ||
        remoteClient.clientId ||
        remoteClient.client_id ||
        ""
      ).trim();

    const remoteAccountNumber =
      String(
        remoteClient.accountNumber ||
        remoteClient.account_number ||
        ""
      ).trim();

    const remoteEmail =
      String(
        remoteClient.email ||
        ""
      ).trim()
      .toLowerCase();


    /*
       Find the existing browser client.

       Priority:
       1. Server/client ID
       2. Account number
       3. Email
    */

    const localClient =
      state.clients.find(client =>
        String(
          client.id || ""
        ).trim() ===
        remoteClientId
      )
      ||
      state.clients.find(client =>
        remoteAccountNumber &&
        String(
          client.accountNumber || ""
        ).trim() ===
        remoteAccountNumber
      )
      ||
      state.clients.find(client =>
        remoteEmail &&
        String(
          client.email || ""
        ).trim().toLowerCase() ===
        remoteEmail
      );


    /*
       Normalize the client returned by PHP.
    */

    const normalizedClient = {

      ...remoteClient,

      id:
        localClient?.id ||
        remoteClientId,

      serverClientId:
        remoteClientId,

      name:
        remoteClient.name ||
        localClient?.name ||
        "Client",

      email:
        remoteClient.email ||
        localClient?.email ||
        "",

      phone:
        remoteClient.phone ||
        localClient?.phone ||
        "",

      country:
        remoteClient.country ||
        localClient?.country ||
        "",

      dob:
        remoteClient.dob ||
        localClient?.dob ||
        "",

      address:
        remoteClient.address ||
        localClient?.address ||
        "",

      accountType:
        remoteClient.accountType ||
        remoteClient.account_type ||
        localClient?.accountType ||
        "Savings Account",

      currency:
        remoteClient.currency ||
        localClient?.currency ||
        CURRENCY,

      accountNumber:
        remoteAccountNumber ||
        localClient?.accountNumber ||
        "",

      balance:
        Number(
          remoteClient.balance ??
          localClient?.balance ??
          0
        ),

      status:
        remoteClient.status ||
        localClient?.status ||
        "Active",

      forcePasswordChange:
        Boolean(
          remoteClient.forcePasswordChange ??
          remoteClient.force_password_change ??
          localClient?.forcePasswordChange ??
          false
        ),

      createdAt:
        remoteClient.createdAt ||
        remoteClient.created_at ||
        localClient?.createdAt ||
        new Date().toISOString(),

      updatedAt:
        remoteClient.updatedAt ||
        remoteClient.updated_at ||
        new Date().toISOString()
    };


    /*
       Update an existing local client.
    */

    if (localClient) {

      const before =
        JSON.stringify({
          name:
            localClient.name,

          email:
            localClient.email,

          phone:
            localClient.phone,

          country:
            localClient.country,

          dob:
            localClient.dob,

          address:
            localClient.address,

          accountType:
            localClient.accountType,

          currency:
            localClient.currency,

          accountNumber:
            localClient.accountNumber,

          balance:
            localClient.balance,

          status:
            localClient.status,

          forcePasswordChange:
            localClient.forcePasswordChange,

          updatedAt:
            localClient.updatedAt
        });


      /*
         Preserve the browser ID.

         The PHP server ID is stored separately.
      */

      Object.assign(
        localClient,
        normalizedClient,
        {
          id:
            localClient.id
        }
      );


      const after =
        JSON.stringify({
          name:
            localClient.name,

          email:
            localClient.email,

          phone:
            localClient.phone,

          country:
            localClient.country,

          dob:
            localClient.dob,

          address:
            localClient.address,

          accountType:
            localClient.accountType,

          currency:
            localClient.currency,

          accountNumber:
            localClient.accountNumber,

          balance:
            localClient.balance,

          status:
            localClient.status,

          forcePasswordChange:
            localClient.forcePasswordChange,

          updatedAt:
            localClient.updatedAt
        });


      if (
        before !== after
      ) {
        changed = true;
      }

      return;
    }


    /*
       No local client exists.

       Add the remote client.
    */

    state.clients.push(
      normalizedClient
    );

    changed = true;
  });


  if (changed) {

    vbSaveState(
      state
    );
  }


  return changed;
}

/* ============================================================
   REMOTE TRANSACTION SYNCHRONIZATION
   IMPORTANT:
   There is ONLY ONE vbMergeRemoteTransactions function.
============================================================ */

function vbMergeRemoteTransactions(
  remoteTransactions
) {

  const state =
    vbGetState();

  if (
    !Array.isArray(
      remoteTransactions
    )
  ) {
    return false;
  }

  let changed = false;


  remoteTransactions.forEach(
    remoteTransaction => {

      if (
        !remoteTransaction ||
        !remoteTransaction.id
      ) {
        return;
      }


      /* ------------------------------------------------------
         Get identifiers returned by PHP/MySQL
      ------------------------------------------------------ */

      const remoteClientId =
        String(
          remoteTransaction.clientId ||
          remoteTransaction.client_id ||
          ""
        ).trim();


      const remoteAccountNumber =
        String(
          remoteTransaction.clientAccountNumber ||
          remoteTransaction.client_account_number ||
          remoteTransaction.accountNumber ||
          remoteTransaction.account_number ||
          ""
        ).trim();


      /* ------------------------------------------------------
         Find matching browser client.

         IMPORTANT:
         Account number is the fallback identifier.
      ------------------------------------------------------ */

      const localClient =
        state.clients.find(
          client =>
            String(
              client.id || ""
            ).trim() ===
            remoteClientId
        )
        ||
        state.clients.find(
          client =>
            remoteAccountNumber &&
            String(
              client.accountNumber || ""
            ).trim() ===
            remoteAccountNumber
        );


      /* ------------------------------------------------------
         Normalize remote transaction
      ------------------------------------------------------ */

      const normalizedTransaction = {

        ...remoteTransaction,

        id:
          String(
            remoteTransaction.id
          ),

        clientId:
          localClient
            ? localClient.id
            : remoteClientId,

        serverClientId:
          remoteClientId,

        clientAccountNumber:
          remoteAccountNumber ||
          localClient?.accountNumber ||
          "",

        clientName:
          remoteTransaction.clientName ||
          remoteTransaction.client_name ||
          localClient?.name ||
          "",

        amount:
          Number(
            remoteTransaction.amount || 0
          ),

        currency:
          remoteTransaction.currency ||
          localClient?.currency ||
          CURRENCY,

        status:
          remoteTransaction.status ||
          "Success",

        description:
          remoteTransaction.description ||
          "",

        timestamp:
          remoteTransaction.timestamp ||
          remoteTransaction.createdAt ||
          remoteTransaction.created_at ||
          new Date().toISOString(),

        remoteOnly:
          true
      };


      /* ------------------------------------------------------
         Find existing transaction
      ------------------------------------------------------ */

      const existing =
        state.transactions.find(
          transaction =>
            String(
              transaction.id || ""
            ) ===
            String(
              normalizedTransaction.id
            )
        );


      /* ------------------------------------------------------
         New remote transaction
      ------------------------------------------------------ */

      if (!existing) {

        state.transactions.push(
          normalizedTransaction
        );

        changed = true;

        return;
      }


      /* ------------------------------------------------------
         Existing transaction

         Preserve important local mapping values.
      ------------------------------------------------------ */

      const before =
        JSON.stringify({

          clientId:
            existing.clientId,

          clientAccountNumber:
            existing.clientAccountNumber,

          clientName:
            existing.clientName,

          amount:
            existing.amount,

          currency:
            existing.currency,

          status:
            existing.status,

          description:
            existing.description,

          timestamp:
            existing.timestamp
        });


      Object.assign(
        existing,
        normalizedTransaction
      );


      /*
         Never lose the local client mapping if
         the remote response does not contain it.
      */

      if (
        localClient
      ) {

        existing.clientId =
          localClient.id;

        existing.clientAccountNumber =
          localClient.accountNumber;

        existing.clientName =
          existing.clientName ||
          localClient.name;

        existing.currency =
          existing.currency ||
          localClient.currency ||
          CURRENCY;
      }


      const after =
        JSON.stringify({

          clientId:
            existing.clientId,

          clientAccountNumber:
            existing.clientAccountNumber,

          clientName:
            existing.clientName,

          amount:
            existing.amount,

          currency:
            existing.currency,

          status:
            existing.status,

          description:
            existing.description,

          timestamp:
            existing.timestamp
        });


      if (
        before !== after
      ) {

        changed = true;
      }

    }
  );


  /* ----------------------------------------------------------
     Always sort newest transactions first
  ---------------------------------------------------------- */

  state.transactions.sort(
    (a, b) =>
      new Date(
        b.timestamp || 0
      ) -
      new Date(
        a.timestamp || 0
      )
  );


  if (changed) {

    vbSaveState(
      state
    );
  }


  return changed;
}


/* ============================================================
   CREATE LOCAL CLIENT
============================================================ */

function vbCreateClient(
  data
) {

  const state =
    vbGetState();

  const name =
    String(data.name || "").trim();

  const email =
    String(data.email || "").trim();

  const password =
    String(data.password || "");

  const balance =
    Number(
      data.initialBalance || 0
    );


  if (
    !name ||
    !email ||
    !password
  ) {
    throw new Error(
      "Complete name, email and password."
    );
  }


  if (
    password.length < 8
  ) {
    throw new Error(
      "Client password must contain at least 8 characters."
    );
  }


  if (
    !Number.isFinite(balance) ||
    balance < 0
  ) {
    throw new Error(
      "Opening balance cannot be negative."
    );
  }


  if (
    state.clients.some(
      client =>
        String(
          client.email || ""
        )
          .toLowerCase() ===
        email.toLowerCase()
    )
  ) {
    throw new Error(
      "A client with this email already exists."
    );
  }


  const now =
    new Date().toISOString();


  const client = {

    id:
      vbMakeId("CLIENT"),

    name,

    email,

    password,

    phone:
      String(
        data.phone || ""
      ).trim(),

    dob:
      data.dob || "",

    address:
      String(
        data.address || ""
      ).trim(),

    photo:
      data.photo || "",

    accountType:
      data.accountType ||
      "Savings Account",

    currency:
      VB_CURRENCIES[data.currency]
        ? data.currency
        : CURRENCY,

    accountNumber:
      vbGenerateAccountNumber(),

    balance:
      Number(
        balance.toFixed(2)
      ),

    status:
      "Active",

    createdAt:
      now,

    updatedAt:
      now,

    forcePasswordChange:
      false
  };


  state.clients.push(
    client
  );


  if (balance > 0) {

    state.transactions.unshift({

      id:
        vbMakeId("TX"),

      clientId:
        client.id,

      clientAccountNumber:
        client.accountNumber,

      clientName:
        client.name,

      type:
        "deposit",

      amount:
        client.balance,

      currency:
        client.currency,

      status:
        "Success",

      description:
        "Opening balance",

      timestamp:
        now
    });
  }


  state.audit.unshift({

    id:
      vbMakeId("AUD"),

    action:
      "Client account created",

    details:
      `${client.name} • ${client.accountNumber}`,

    actor:
      "Administrator",

    timestamp:
      now
  });


  vbAddNotification(
    client.id,

    "Welcome to Velorian Bank",

    `Your ${client.accountType} account ${client.accountNumber} (${vbGetCurrency(client.currency).code}) is ready.`,

    "success",

    state
  );


  vbSaveState(
    state
  );

  return client;
}


/* ============================================================
   UPDATE CLIENT
============================================================ */

function vbUpdateClient(
  id,
  updates
) {

  const state =
    vbGetState();

  const client =
    state.clients.find(
      item =>
        item.id === id
    );


  if (!client) {
    throw new Error(
      "Client account not found."
    );
  }


  if (
    updates.email &&
    state.clients.some(
      item =>
        item.id !== id &&
        String(item.email || "")
          .toLowerCase() ===
        updates.email
          .trim()
          .toLowerCase()
    )
  ) {
    throw new Error(
      "Another client already uses this email."
    );
  }


  if (
    updates.currency &&
    updates.currency !==
      client.currency
  ) {

    const hasActivity =
      state.transactions.some(
        transaction =>
          String(
            transaction.clientId ||
            ""
          ) ===
          String(id)
      );


    if (
      hasActivity ||
      Number(client.balance) !== 0
    ) {
      throw new Error(
        "Account currency cannot be changed after the account has a balance or transaction history. Create a new account instead."
      );
    }


    if (
      !VB_CURRENCIES[
        updates.currency
      ]
    ) {
      throw new Error(
        "Unsupported account currency."
      );
    }
  }


  Object.assign(
    client,
    updates,
    {
      updatedAt:
        new Date().toISOString()
    }
  );


  if (
    updates.name !== undefined
  ) {
    client.name =
      String(
        updates.name
      ).trim();
  }


  if (
    updates.email !== undefined
  ) {
    client.email =
      String(
        updates.email
      ).trim();
  }


  if (
    updates.phone !== undefined
  ) {
    client.phone =
      String(
        updates.phone
      ).trim();
  }


  if (
    updates.address !== undefined
  ) {
    client.address =
      String(
        updates.address
      ).trim();
  }


  if (
    updates.password !== undefined &&
    updates.password.length < 8
  ) {
    throw new Error(
      "Password must contain at least 8 characters."
    );
  }


  client.currency =
    VB_CURRENCIES[
      client.currency
    ]
      ? client.currency
      : CURRENCY;


  state.audit.unshift({

    id:
      vbMakeId("AUD"),

    action:
      "Client profile updated",

    details:
      `${client.name} • ${client.accountNumber} • ${client.currency}`,

    actor:
      "Administrator",

    timestamp:
      new Date().toISOString()
  });


  vbSaveState(
    state
  );

  return client;
}


/* ============================================================
   DELETE CLIENT
============================================================ */

function vbDeleteClient(
  id
) {

  const state =
    vbGetState();

  const index =
    state.clients.findIndex(
      client =>
        client.id === id
    );


  if (
    index === -1
  ) {
    throw new Error(
      "Client account not found."
    );
  }


  const client =
    state.clients[index];

  const now =
    new Date().toISOString();


  state.clients.splice(
    index,
    1
  );


  state.transactions =
    state.transactions.filter(
      transaction =>
        String(
          transaction.clientId ||
          ""
        ) !==
          String(id)
        &&
        String(
          transaction.clientAccountNumber ||
          transaction.client_account_number ||
          ""
        ).trim() !==
          String(
            client.accountNumber ||
            ""
          ).trim()
    );


  state.notifications =
    state.notifications.filter(
      notification =>
        String(
          notification.clientId ||
          ""
        ) !==
        String(id)
    );


  state.audit.unshift({

    id:
      vbMakeId("AUD"),

    action:
      "Client account deleted",

    details:
      `${client.name} • ${client.accountNumber}`,

    actor:
      state.admin?.name ||
      "Administrator",

    timestamp:
      now
  });


  state.audit =
    state.audit.slice(
      0,
      1000
    );


  vbSaveState(
    state
  );

  return client;
}


/* ============================================================
   CLIENT STATUS
============================================================ */

function vbSetClientStatus(
  id,
  status
) {

  if (
    ![
      "Active",
      "Suspended",
      "Frozen",
      "Closed"
    ].includes(status)
  ) {
    throw new Error(
      "Invalid account status."
    );
  }


  const state =
    vbGetState();

  const client =
    state.clients.find(
      item =>
        item.id === id
    );


  if (!client) {
    throw new Error(
      "Client account not found."
    );
  }


  client.status =
    status;

  const timestamp =
    new Date().toISOString();


  state.audit.unshift({

    id:
      vbMakeId("AUD"),

    action:
      `Account ${status.toLowerCase()}`,

    details:
      `${client.name} • ${client.accountNumber}`,

    actor:
      "Administrator",

    timestamp
  });


  vbAddNotification(

    client.id,

    `Account ${status.toLowerCase()}`,

    status === "Active"
      ? "Your account is active again."
      : `Your account has been marked ${status.toLowerCase()}. Contact support if you need assistance.`,

    status === "Active"
      ? "success"
      : "warning",

    state
  );


  vbSaveState(
    state
  );

  return client;
}


/* ============================================================
   ADMIN CHANGE CLIENT PASSWORD
============================================================ */

function vbChangeClientPassword(
  id,
  password
) {

  if (
    !password ||
    password.length < 8
  ) {
    throw new Error(
      "Password must contain at least 8 characters."
    );
  }


  const state =
    vbGetState();

  const client =
    state.clients.find(
      item =>
        item.id === id
    );


  if (!client) {
    throw new Error(
      "Client account not found."
    );
  }


  client.password =
    password;

  client.forcePasswordChange =
    true;


  state.audit.unshift({

    id:
      vbMakeId("AUD"),

    action:
      "Client password reset",

    details:
      client.accountNumber,

    actor:
      state.admin?.name ||
      "Administrator",

    timestamp:
      new Date().toISOString()
  });


  vbAddNotification(

    client.id,

    "Password reset",

    "Your sign-in password was reset. Please create a new password when you next sign in.",

    "info",

    state
  );


  vbSaveState(
    state
  );
}


/* ============================================================
   CLIENT CHANGE OWN PASSWORD
============================================================ */

function vbChangeOwnPassword(
  clientId,
  current,
  next
) {

  const state =
    vbGetState();

  const client =
    state.clients.find(
      item =>
        item.id === clientId
    );


  if (
    !client ||
    client.password !== current
  ) {
    throw new Error(
      "Current password is incorrect."
    );
  }


  if (
    !next ||
    next.length < 8
  ) {
    throw new Error(
      "New password must contain at least 8 characters."
    );
  }


  client.password =
    next;

  client.forcePasswordChange =
    false;


  state.audit.unshift({

    id:
      vbMakeId("AUD"),

    action:
      "Client changed own password",

    details:
      client.accountNumber,

    actor:
      client.accountNumber,

    timestamp:
      new Date().toISOString()
  });


  vbSaveState(
    state
  );
}


/* ============================================================
   NOTIFICATION READ
============================================================ */

function vbMarkNotificationsRead(
  clientId
) {

  const state =
    vbGetState();

  state.notifications
    .filter(
      notification =>
        String(
          notification.clientId ||
          ""
        ) ===
        String(clientId || "")
    )
    .forEach(
      notification =>
        notification.read = true
    );


  vbSaveState(
    state
  );
}


/* ============================================================
   STATEMENT EXPORT
============================================================ */

function vbExportStatement(
  clientId,
  from,
  to
) {

  const client =
    vbFindClient(clientId);

  if (!client) {
    throw new Error(
      "Client not found."
    );
  }


  const transactions =
    vbClientTransactions(
      clientId,
      client.accountNumber
    ).filter(
      transaction => {

        const date =
          new Date(
            transaction.timestamp
          );

        return (
          (!from ||
            date >=
              new Date(
                from +
                "T00:00:00"
              )) &&

          (!to ||
            date <=
              new Date(
                to +
                "T23:59:59"
              ))
        );
      }
    );


  const rows =
    transactions.map(
      transaction => ({

        date:
          vbFormatDate(
            transaction.timestamp
          ),

        reference:
          transaction.id,

        type:
          transaction.type,

        description:
          transaction.description,

        amount:
          transaction.type ===
              "withdrawal" ||
          transaction.type ===
              "transfer_out"
            ? -transaction.amount
            : transaction.amount,

        status:
          transaction.status
      })
    );


  const opening =
    transactions.reduce(
      (
        balance,
        transaction
      ) =>
        balance -
        (
          transaction.type ===
              "withdrawal" ||
          transaction.type ===
              "transfer_out"
            ? -transaction.amount
            : transaction.amount
        ),
      client.balance
    );


  const html = `
<!doctype html>

<html>

<head>

<meta charset="utf-8">

<title>
Velorian Bank Statement
</title>

<style>

body {
  font: 13px Arial;
  color: #142235;
  margin: 40px;
}

header {
  display: flex;
  justify-content: space-between;
  border-bottom: 3px solid #b58a3a;
  padding-bottom: 18px;
}

img {
  width: 170px;
  height: 65px;
  object-fit: contain;
}

.meta {
  display: grid;
  grid-template-columns:
    repeat(3, 1fr);
  gap: 12px;
  margin: 24px 0;
}

.box {
  padding: 14px;
  background: #f5f7fa;
  border-radius: 10px;
}

.box span {
  display: block;
  color: #6d7d8f;
  font-size: 10px;
  text-transform: uppercase;
}

.box strong {
  display: block;
  margin-top: 6px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 25px;
}

th,
td {
  text-align: left;
  padding: 11px;
  border-bottom: 1px solid #e3e7ec;
}

th {
  font-size: 10px;
  text-transform: uppercase;
  color: #68788a;
}

.pos {
  color: #087b56;
}

.neg {
  color: #b53d4c;
}

.foot {
  margin-top: 30px;
  color: #738296;
  font-size: 10px;
}

@media print {

  button {
    display: none;
  }

}

</style>

</head>

<body>

<header>

<img
  src="assets/logo.jfif"
>

<div style="text-align:right">

<b>
ACCOUNT STATEMENT
</b>

<div>
Generated ${new Date().toLocaleString()}
</div>

</div>

</header>


<div class="meta">

<div class="box">

<span>
Account holder
</span>

<strong>
${client.name}
</strong>

</div>


<div class="box">

<span>
Account number
</span>

<strong>
${client.accountNumber}
</strong>

</div>


<div class="box">

<span>
Account type
</span>

<strong>
${client.accountType}
</strong>

</div>


<div class="box">

<span>
Period
</span>

<strong>
${from || "All time"} —
${to || "Present"}
</strong>

</div>


<div class="box">

<span>
Opening balance
</span>

<strong>
${vbFormatMoney(
  opening,
  client.currency
)}
</strong>

</div>


<div class="box">

<span>
Closing balance
</span>

<strong>
${vbFormatMoney(
  client.balance,
  client.currency
)}
</strong>

</div>

</div>


<table>

<thead>

<tr>

<th>Date</th>

<th>Reference</th>

<th>Type</th>

<th>Description</th>

<th>Amount</th>

<th>Status</th>

</tr>

</thead>


<tbody>

${
  rows
    .map(
      row => `

<tr>

<td>
${row.date}
</td>

<td>
${row.reference}
</td>

<td>
${row.type.replaceAll(
  "_",
  " "
)}
</td>

<td>
${row.description || "—"}
</td>

<td
  class="${
    row.amount >= 0
      ? "pos"
      : "neg"
  }"
>

${
  row.amount >= 0
    ? "+"
    : "-"
}

${vbFormatMoney(
  Math.abs(row.amount),
  client.currency
)}

</td>

<td>
${row.status}
</td>

</tr>

`
    )
    .join("") ||

  `
<tr>

<td colspan="6">
No transactions for this period.
</td>

</tr>
`
}

</tbody>

</table>


<div class="foot">

Velorian Bank digital banking prototype.
This statement is generated for demonstration
purposes and is not a real financial document.

</div>


<button
  onclick="window.print()"
  style="
    margin-top:20px;
    padding:10px 16px;
  "
>

Print / Save as PDF

</button>


</body>

</html>
`;


  const windowRef =
    window.open(
      "",
      "_blank",
      "noopener,noreferrer"
    );


  if (!windowRef) {

    throw new Error(
      "Please allow pop-ups to generate the statement."
    );
  }


  windowRef.document.write(
    html
  );

  windowRef.document.close();
}