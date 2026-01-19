if (typeof itemprice === "undefined" || itemprice === null || itemprice === "") { return; }

const formattedText =
  new Intl.NumberFormat(
    sap.ui.getCore().getConfiguration().getLanguage(),
    { style: "currency", currency: "USD" }
  ).format(Number(itemprice));

return formattedText;