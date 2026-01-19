window.wsCartMoney = function (amount, currency) {
  try {
    const n = Number(amount || 0);
    const c = currency || "USD";
    return new Intl.NumberFormat(
      sap.ui.getCore().getConfiguration().getLanguage(),
      { style: "currency", currency: c }
    ).format(n);
  } catch {
    return (Number(amount || 0).toFixed(2) + " " + (currency || "USD"));
  }
};

window.wsCartLineTotalText = function (row) {
  try {
    const total = (Number(row?.price) || 0) * (Number(row?.qty) || 0);
    return window.wsCartMoney(total, row?.currency || "USD");
  } catch {
    return "";
  }
};

(function () {
  "use strict";

  const core = () => sap.ui.getCore();

  const fmt = (value, currency) => {
    try {
      if (window.formatPrice) return window.formatPrice(value, currency || "USD");
      if (window.wsCartMoney) return window.wsCartMoney(value, currency || "USD");
    } catch {}
    return Number(value || 0).toFixed(2) + " " + (currency || "USD");
  };

  const ensureModel = () => {
    try {
      const c = core();
      let model = c.getModel("CartModel");
      
      if (!model) {
        model = new sap.ui.model.json.JSONModel({ 
          items: [], 
          totals: { qty: 0, amount: 0, currency: "USD" } 
        });
        c.setModel(model, "CartModel");
      }
      
      const data = model.getData();
      if (!data || !Array.isArray(data.items)) {
        model.setData({ 
          items: [], 
          totals: { qty: 0, amount: 0, currency: "USD" } 
        });
      }
      
      if (!data.totals) {
        data.totals = { qty: 0, amount: 0, currency: "USD" };
        model.setData(data);
      }
      
      return model;
    } catch {
      return new sap.ui.model.json.JSONModel({ 
        items: [], 
        totals: { qty: 0, amount: 0, currency: "USD" } 
      });
    }
  };

  const getItems = () => {
    const model = ensureModel();
    const data = model.getData();
    return Array.isArray(data.items) ? data.items : [];
  };

  const setItems = (items, totals) => {
    const model = ensureModel();
    model.setData({ 
      items: Array.isArray(items) ? items : [],
      totals: totals || { qty: 0, amount: 0, currency: "USD" }
    });
    model.updateBindings(true);
    model.refresh(true);
  };

  const getSelectedProduct = () => {
    try {
      const model = core().getModel("SelectedProductModel");
      const data = model?.getData?.();
      return data?.item || null;
    } catch {
      return null;
    }
  };

  const getQtyFromUI = () => {
    try {
      if (typeof QtyInput !== "undefined" && QtyInput?.getValue) {
        const val = Number(QtyInput.getValue());
        return (!isNaN(val) && val > 0) ? val : 1;
      }
    } catch {}

    try {
      if (typeof ProductDetailPage !== "undefined" && ProductDetailPage?.findAggregatedObjects) {
        const controls = ProductDetailPage.findAggregatedObjects(true) || [];
        for (const control of controls) {
          if (control?.getMetadata?.().getName() === "sap.m.StepInput" && control.getValue) {
            const val = Number(control.getValue());
            return (!isNaN(val) && val > 0) ? val : 1;
          }
        }
      }
    } catch {}

    return 1;
  };

  const normalizeProduct = (p = {}) => ({
    id: p.id || "",
    name: p.name || "",
    subtitle: p.subtitle || "",
    price: Number(p.price) || 0,
    currency: p.currency || "USD",
    imageUrl: p.imageUrl || p.image || ""
  });

  const calculateTotals = items => {
    const qty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    const amount = items.reduce((sum, item) => {
      const q = Number(item.qty) || 0;
      const p = Number(item.price) || 0;
      return sum + (q * p);
    }, 0);
    const currency = (items[0]?.currency) || "USD";
    
    return { qty, amount, currency };
  };

  const enrichItems = items => {
    return items.map(item => {
      const qty = Number(item.qty) || 1;
      const price = Number(item.price) || 0;
      const lineTotal = qty * price;
      
      return {
        ...item,
        qty,
        price,
        lineTotal,
        lineTotalText: fmt(lineTotal, item.currency || "USD"),
        priceText: fmt(price, item.currency || "USD")
      };
    });
  };

  const updateBadge = () => {
    try {
      const totals = ensureModel().getData().totals || { qty: 0 };
      if (typeof CartCountText !== "undefined" && CartCountText?.setText) {
        CartCountText.setText(String(totals.qty));
      }
    } catch {}
  };

  const updateTotal = () => {
    try {
      const data = ensureModel().getData();
      const totals = data.totals || { amount: 0, currency: "USD" };
      
      if (typeof CartTotalText !== "undefined" && CartTotalText?.setText) {
        CartTotalText.setText(fmt(totals.amount, totals.currency));
      }
    } catch {}
  };

  const findRemoveButton = row => {
    try {
      const controls = row.findAggregatedObjects(true) || [];
      return controls.find(c => 
        c?.attachPress && c?.getId?.()?.includes("CartRemoveBtn")
      ) || null;
    } catch {
      return null;
    }
  };

  const renderCart = () => {
    try {
      const model = ensureModel();

      if (typeof CartList === "undefined" || !CartList?.removeAllItems || !CartList.addItem) {
        return;
      }
      
      if (typeof CustomListItem1 === "undefined" || !CustomListItem1?.clone) {
        return;
      }

      let items = getItems();
      items = enrichItems(items);
      const totals = calculateTotals(items);
      
      setItems(items, totals);

      try {
        CustomListItem1.setVisible(false);
      } catch {}
      
      CartList.removeAllItems();

      items.forEach((item, index) => {
        const row = CustomListItem1.clone();
        try {
          row.setVisible(true);
        } catch {}

        row.setModel(model, "CartModel");
        row.setBindingContext(model.createBindingContext("/items/" + index), "CartModel");

        const removeBtn = findRemoveButton(row);
        if (removeBtn) {
          if (removeBtn.__wsFn) {
            try {
              removeBtn.detachPress(removeBtn.__wsFn);
            } catch {}
          }
          
          removeBtn.__wsFn = (() => {
            const itemId = item.id;
            return () => {
              try {
                removeFromCart(itemId);
              } catch {}
            };
          })();

          removeBtn.attachPress(removeBtn.__wsFn);
        }

        CartList.addItem(row);
      });

      try {
        core().applyChanges();
      } catch {}

      updateTotal();
      updateBadge();
    } catch {}
  };

  const addToCart = (product, qty) => {
    try {
      ensureModel();

      const prod = normalizeProduct(product || getSelectedProduct());
      if (!prod.id) {
        try {
          sap.m.MessageToast.show("No product selected.");
        } catch {}
        return;
      }

      let quantity = Number(qty);
      if (isNaN(quantity) || quantity <= 0) quantity = getQtyFromUI();
      if (isNaN(quantity) || quantity <= 0) quantity = 1;

      const items = getItems();
      const existingIndex = items.findIndex(item => item.id === prod.id);

      if (existingIndex > -1) {
        items[existingIndex].qty = (Number(items[existingIndex].qty) || 0) + quantity;
      } else {
        items.push({
          id: prod.id,
          name: prod.name,
          subtitle: prod.subtitle,
          price: prod.price,
          currency: prod.currency,
          imageUrl: prod.imageUrl,
          qty: quantity
        });
      }

      const totals = calculateTotals(items);
      setItems(items, totals);
      renderCart();

      try {
        if (typeof CartDialog !== "undefined" && CartDialog?.open) {
          CartDialog.open();
        }
      } catch {}

      try {
        sap.m.MessageToast.show("Added to cart");
      } catch {}
    } catch {}
  };

  const removeFromCart = productId => {
    try {
      ensureModel();
      const items = getItems().filter(item => item.id !== productId);
      const totals = calculateTotals(items);
      setItems(items, totals);
      renderCart();
    } catch {}
  };

  const clearCart = () => {
    try {
      setItems([], { qty: 0, amount: 0, currency: "USD" });
      renderCart();
    } catch {}
  };

  const openCart = () => {
    try {
      renderCart();
      if (typeof CartDialog !== "undefined" && CartDialog?.open) {
        CartDialog.open();
      }
    } catch {}
  };

  const closeCart = () => {
    try {
      if (typeof CartDialog !== "undefined" && CartDialog?.close) {
        CartDialog.close();
      }
    } catch {}
  };

  window.onRemoveCartItem = function (event) {
    try {
      const source = event?.getSource?.();
      const context = source?.getBindingContext?.("CartModel");
      const obj = context?.getObject?.();
      if (obj?.id) removeFromCart(obj.id);
    } catch {}
  };

  const wireCartDialog = () => {
    try {
      if (typeof CartDialog === "undefined" || !CartDialog?.addEventDelegate) return;
      if (CartDialog.__wsCartWired) return;

      CartDialog.__wsCartWired = true;
      CartDialog.addEventDelegate({
        onAfterOpen: () => {
          try {
            renderCart();
          } catch {}
        }
      });
    } catch {}
  };

  window.wsAddToCart = addToCart;
  window.wsRemoveFromCart = removeFromCart;
  window.wsClearCart = clearCart;
  window.wsRenderCart = renderCart;
  window.wsOpenCart = openCart;
  window.wsCloseCart = closeCart;
  window.wsUpdateCartBadge = updateBadge;
  window.wsUpdateCartTotal = updateTotal;
  window.wsWireCartDialogAutoRender = wireCartDialog;

  core().attachInit(() => {
    try {
      ensureModel();
      wireCartDialog();
      renderCart();
    } catch {}
  });

})();