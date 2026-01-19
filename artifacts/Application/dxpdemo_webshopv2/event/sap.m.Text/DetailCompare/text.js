if (typeof itemcomparedAt === "undefined" || itemcomparedAt === null || itemcomparedAt === "") { return ""; }

// read current price + currency from SelectedProductModel (because formatter only gets comparedAt)
var d = sap.ui.getCore().getModel("SelectedProductModel");
var item = (d && d.getData && d.getData().item) ? d.getData().item : {};

var priceN = Number(item.price || 0);
var compareN = Number(itemcomparedAt || 0);

// hide compare if invalid or not higher than price
if (!compareN || isNaN(compareN) || compareN <= priceN) { return ""; }

var c = (typeof item.currency === "undefined" || item.currency === null || item.currency === "") ? "USD" : item.currency;

const formattedText = new Intl.NumberFormat(
  sap.ui.getCore().getConfiguration().getLanguage(),
  { style: "currency", currency: c }
).format(compareN);

return formattedText;