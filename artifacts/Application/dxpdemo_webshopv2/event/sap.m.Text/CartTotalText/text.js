if (typeof totalsamount === "undefined" || totalsamount === null || totalsamount === "") { return; }

// If it's already formatted (string like "$129.00"), keep it.
if (typeof totalsamount === "string") {
  const formattedText = totalsamount;
  return formattedText;
}

// If it's numeric, format it using CartModel currency
var cur = "USD";
try { cur = sap.ui.getCore().getModel("CartModel").getProperty("/totals/currency") || "USD"; } catch (e) {}

const formattedText = window.formatPrice(Number(totalsamount || 0), cur);
return formattedText;