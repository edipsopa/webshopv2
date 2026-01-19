(function () {
  "use strict";

  const core = () => sap.ui.getCore();

  const Utils = {
    num(v, fb = 0) {
      try {
        if (v == null) return fb;
        if (typeof v === "number") return isNaN(v) ? fb : v;
        const normalized = String(v).trim().replace(",", ".");
        const match = normalized.match(/-?\d+(\.\d+)?/);
        const n = match ? Number(match[0]) : NaN;
        return isNaN(n) ? fb : n;
      } catch {
        return fb;
      }
    },

    lang() {
      try {
        return core().getConfiguration().getLanguage();
      } catch {
        return "en";
      }
    },

    formatMoney(val, currency = "USD") {
      try {
        const n = this.num(val, NaN);
        if (isNaN(n)) return "";
        return new Intl.NumberFormat(this.lang(), {
          style: "currency",
          currency
        }).format(n);
      } catch {
        return String(val || "");
      }
    },

    toast(msg) {
      try {
        sap.m.MessageToast.show(msg);
      } catch {}
    },

    showBusy() {
      try {
        sap.ui.core.BusyIndicator.show(0);
      } catch {}
    },

    hideBusy() {
      try {
        sap.ui.core.BusyIndicator.hide();
      } catch {}
    },

    unitPriceFrom(item, fallback) {
      const prices = [item?.unitPrice, item?.price, fallback].map(p => this.num(p, NaN));
      return prices.find(p => !isNaN(p) && p > 0) || 0;
    }
  };

  const Product = {
    normalize(p = {}) {
      const price = Utils.num(p.price, 0);
      const compareAt = Utils.num(p.comparedAt || p.compareAt, 0);
      
      return {
        id: p.id || "",
        name: p.name || "",
        subtitle: p.subtitle || "",
        description: p.description || "",
        category: p.category || "",
        price,
        comparedAt: compareAt,
        compareAt: compareAt,
        currency: p.currency || "USD",
        rating: Utils.num(p.rating, 0),
        badge: p.badge || "",
        isFeatured: !!p.isFeatured,
        imageUrl: p.imageUrl || p.image || ""
      };
    },

    normalizeList(arr) {
      return (Array.isArray(arr) ? arr : []).map(this.normalize.bind(this));
    }
  };

  const Model = {
    get(name) {
      try {
        return core().getModel(name) || null;
      } catch {
        return null;
      }
    },

    getData(name, fallback = {}) {
      try {
        const model = this.get(name);
        const data = model?.getData?.();
        return data ?? fallback;
      } catch {
        return fallback;
      }
    },

    setData(name, data) {
      try {
        const model = this.get(name);
        if (!model?.setData) return;
        model.setData(data);
        model.updateBindings(true);
        model.refresh(true);
      } catch {}
    },

    init() {
      try {
        const c = core();
        const models = {
          ProductsModel: { items: [] },
          SelectedProductModel: { item: {} },
          CartModel: { items: [], totals: { qty: 0, amount: 0, currency: "USD" } }
        };

        Object.entries(models).forEach(([name, data]) => {
          if (!c.getModel(name)) {
            c.setModel(new sap.ui.model.json.JSONModel(data), name);
          }
        });

        this.normalizeCart();
      } catch {}
    },

    normalizeCart() {
      try {
        const cart = this.getData("CartModel", {});
        cart.items = Array.isArray(cart.items) ? cart.items : [];
        cart.totals = cart.totals || { qty: 0, amount: 0, currency: "USD" };

        cart.items.forEach(item => {
          item.qty = Math.max(1, Utils.num(item.qty, 1));
          item.unitPrice = Utils.unitPriceFrom(item, item.price);
          item.price = Utils.num(item.price, item.unitPrice);
          item.lineTotal = item.qty * item.unitPrice;

          const currency = item.currency || cart.totals.currency || "USD";
          item.unitPriceText = Utils.formatMoney(item.unitPrice, currency);
          item.lineTotalText = Utils.formatMoney(item.lineTotal, currency);
        });

        this.setData("CartModel", cart);
      } catch {}
    }
  };

  const Event = {
    removePress(button) {
      try {
        const registry = button?.mEventRegistry?.press;
        if (!Array.isArray(registry)) return;
        
        registry.slice().forEach(handler => {
          try {
            button.detachPress(handler.fFunction, handler.oListener);
          } catch {}
        });
        
        button.mEventRegistry.press = [];
      } catch {}
    },

    findControl(controls, idPart, method) {
      try {
        return (controls || []).find(c =>
          c?.getId &&
          String(c.getId()).includes(idPart) &&
          (!method || typeof c[method] === "function")
        ) || null;
      } catch {
        return null;
      }
    },

    findByMetadata(controls, metaName, method) {
      try {
        return (controls || []).find(c =>
          c?.getMetadata &&
          c.getMetadata().getName() === metaName &&
          (!method || typeof c[method] === "function")
        ) || null;
      } catch {
        return null;
      }
    }
  };

  const Cart = {
    get() {
      const cart = Model.getData("CartModel", {});
      cart.items = Array.isArray(cart.items) ? cart.items : [];
      cart.totals = cart.totals || { qty: 0, amount: 0, currency: "USD" };
      return cart;
    },

    save(cart) {
      try {
        const model = Model.get("CartModel");
        if (!model) return;
        model.setData(cart);
        model.updateBindings(true);
        model.refresh(true);
        this.updateCartCount();
      } catch {}
    },

    updateCartCount() {
      try {
        const cart = this.get();
        const model = Model.get("CartModel");
        if (model) {
          model.setProperty("/totals/qty", cart.totals.qty);
          model.updateBindings(true);
        }
      } catch {}
    },

    findItem(items, id) {
      return (items || []).find(i => i.id === id);
    },

    recalculate(cart) {
      try {
        let totalQty = 0;
        let totalAmount = 0;
        let currency = cart.totals?.currency || "USD";

        (cart.items || []).forEach(item => {
          item.qty = Math.max(1, Utils.num(item.qty, 1));
          item.unitPrice = Utils.unitPriceFrom(item, item.price);
          item.price = Utils.num(item.price, item.unitPrice);
          item.lineTotal = item.qty * item.unitPrice;

          const itemCurrency = item.currency || currency;
          item.unitPriceText = Utils.formatMoney(item.unitPrice, itemCurrency);
          item.lineTotalText = Utils.formatMoney(item.lineTotal, itemCurrency);

          totalQty += item.qty;
          totalAmount += item.lineTotal;
          if (item.currency) currency = item.currency;
        });

        cart.totals = { qty: totalQty, amount: totalAmount, currency };
        return cart;
      } catch {
        return cart;
      }
    },

    add(product, qty = 1) {
      try {
        if (!product?.id) return;
        Model.init();

        const quantity = Math.max(1, Utils.num(qty, 1));
        const cart = this.get();
        const existing = this.findItem(cart.items, product.id);

        const unitPrice = Utils.num(product.price, 0);
        const currency = product.currency || "USD";

        if (existing) {
          existing.qty = Math.max(1, Utils.num(existing.qty, 1) + quantity);
          existing.unitPrice = Utils.unitPriceFrom(existing, unitPrice);
          existing.price = Utils.num(existing.price, existing.unitPrice || unitPrice);
          existing.currency = existing.currency || currency;
        } else {
          cart.items.push({
            id: product.id,
            name: product.name || "",
            subtitle: product.subtitle || "",
            imageUrl: product.imageUrl || "",
            qty: quantity,
            unitPrice,
            price: unitPrice,
            currency
          });
        }

        this.recalculate(cart);
        this.save(cart);

        setTimeout(() => {
          this.open();
          Utils.toast("Added to cart");
        }, 100);
      } catch {}
    },

    updateQuantity(id, delta) {
      try {
        const cart = this.get();
        const item = this.findItem(cart.items, id);
        if (!item) return;

        item.qty = Math.max(1, Utils.num(item.qty, 1) + Utils.num(delta, 0));
        item.unitPrice = Utils.unitPriceFrom(item, item.price);
        item.price = Utils.num(item.price, item.unitPrice);

        this.recalculate(cart);
        this.save(cart);

        try {
          if (typeof CartList !== "undefined" && CartList?.getBinding) {
            const binding = CartList.getBinding("items");
            if (binding) binding.refresh(true);
          }
        } catch {}
      } catch {}
    },

    remove(id) {
      try {
        const cart = this.get();
        cart.items = (cart.items || []).filter(i => i.id !== id);
        this.recalculate(cart);
        this.save(cart);
        Utils.toast(cart.items.length === 0 ? "Cart is empty" : "Item removed");
      } catch {}
    },

    open() {
      try {
        if (!CartDialog?.open) return;

        if (typeof CartList !== "undefined" && CartList) {
          const model = Model.get("CartModel");
          if (model) CartList.setModel(model, "CartModel");

          const binding = CartList.getBinding("items");
          if (!binding && typeof CustomListItem1 !== "undefined" && CustomListItem1?.clone) {
            const template = CustomListItem1.clone();
            template.setVisible(true);
            CartList.bindAggregation("items", {
              path: "CartModel>/items",
              template,
              templateShareable: false
            });
          } else if (binding) {
            binding.refresh(true);
          }
        }

        CartDialog.open();
        setTimeout(() => this.wireRemoveButtons(), 150);
      } catch {}
    },

    wireRemoveButtons() {
      try {
        if (typeof CartList === "undefined" || !CartList) return;

        const cart = this.get();
        const listItems = CartList.getItems();

        listItems.forEach((listItem, index) => {
          try {
            const item = cart.items[index];
            if (!item) return;

            const controls = listItem.findAggregatedObjects(true) || [];
            const removeButton = controls.find(c =>
              c?.getId && (
                String(c.getId()).includes("CartRemoveBtn") ||
                (c.hasStyleClass && c.hasStyleClass("wsCartRemove"))
              )
            );
            
            if (!removeButton) return;

            Event.removePress(removeButton);
            const itemId = item.id;
            removeButton.attachPress(() => this.remove(itemId));
          } catch {}
        });
      } catch {}
    },

    close() {
      try {
        CartDialog?.close?.();
      } catch {}
    },

    reset() {
      try {
        const model = core().getModel("CartModel");
        if (!model) return;
        model.setData({ items: [], totals: { qty: 0, amount: 0, currency: "USD" } });
        model.updateBindings(true);
        model.refresh(true);
        this.updateCartCount();
      } catch {}
    }
  };

  const Navigation = {
    openDetail(event, product) {
      try {
        let prod = product;

        if (!prod && event?.getSource) {
          const source = event.getSource();
          const context = source.getBindingContext?.("ProductsModel");
          if (context) prod = context.getObject();
        }

        if (!prod?.id) return;

        const normalized = Product.normalize(prod);
        Model.setData("SelectedProductModel", { item: normalized });

        try {
          if (typeof App !== "undefined" && App?.to) {
            App.to(ProductDetailPage);
          }
        } catch {}

        setTimeout(() => {
          try {
            if (typeof window.wsRenderReviews === "function") {
              window.wsRenderReviews();
            }
          } catch {}
          this.wireImages();
        }, 100);
      } catch {}
    },

    wireImages() {
      try {
        if (typeof DetailImage !== "undefined" && DetailImage?.$) {
          DetailImage.$().off("click.wsZoom").on("click.wsZoom", () => {
            const src = DetailImage.getSrc();
            if (src) Gallery.zoom(src);
          });
        }

        if (typeof DetailThumbs !== "undefined" && DetailThumbs?.getItems) {
          DetailThumbs.getItems().forEach(thumb => {
            try {
              (thumb.findAggregatedObjects(true) || [])
                .filter(c => c?.getMetadata && c.getMetadata().getName() === "sap.m.Image")
                .forEach(img => {
                  if (!img?.$) return;
                  img.$().off("click.wsZoom").on("click.wsZoom", () => {
                    const src = img.getSrc();
                    if (src) Gallery.zoom(src);
                  });
                });
            } catch {}
          });
        }
      } catch {}
    }
  };

  const UI = {
    renderGrid() {
      try {
        const items = Model.getData("ProductsModel", { items: [] }).items || [];
        if (!ProductGrid?.removeAllItems || !ProductCard?.clone) return;

        ProductCard.setVisible(false);
        ProductGrid.removeAllItems();

        items.forEach(product => {
          try {
            ProductGrid.addItem(this.createCard(product));
          } catch {}
        });
      } catch {}
    },

    createCard(product) {
      const normalized = Product.normalize(product);
      const card = ProductCard.clone();
      card.setVisible(true);

      try {
        if (card.attachPress) {
          card.attachPress(() => Navigation.openDetail(null, normalized));
        }
      } catch {}

      try {
        const controls = card.findAggregatedObjects(true) || [];

        const image = Event.findControl(controls, "CardImage", "setSrc") || 
                     Event.findByMetadata(controls, "sap.m.Image", "setSrc");
        if (image) image.setSrc(normalized.imageUrl || "");

        const title = Event.findControl(controls, "CardTitle", "setText");
        if (title) title.setText(normalized.name || "");

        const price = Event.findControl(controls, "CardPrice", "setText");
        if (price) {
          price.setText(normalized.price ? Utils.formatMoney(normalized.price, normalized.currency) : "");
        }

        const compare = Event.findControl(controls, "CardCompare", "setText");
        if (compare) compare.setText("");

        const button = Event.findControl(controls, "AddToCartButton", "attachPress") || 
                      Event.findByMetadata(controls, "sap.m.Button", "attachPress");
        if (button) {
          Event.removePress(button);
          button.attachPress(e => {
            try {
              if (e?.cancelBubble !== undefined) e.cancelBubble = true;
              if (e?.preventDefault) e.preventDefault();
            } catch {}
            Cart.add(normalized, 1);
          });
        }
      } catch {}

      return card;
    }
  };

  const Loader = {
    async load() {
      Utils.showBusy();
      try {
        Model.init();

        let products = [];
        try {
          products = await apigetProducts();
        } catch {
          products = [];
        }

        const items = Array.isArray(products) ? products : [];
        Model.setData("ProductsModel", { items: Product.normalizeList(items) });

        UI.renderGrid();
        this.wireCart();

        try {
          if (typeof window.wsRenderGallery === "function") {
            window.wsRenderGallery();
          }
        } catch {}
      } catch {
      } finally {
        Utils.hideBusy();
      }
    },

    wireCart() {
      try {
        if (typeof ViewCartBtn !== "undefined" && ViewCartBtn?.attachPress) {
          Event.removePress(ViewCartBtn);
          ViewCartBtn.attachPress(() => Cart.open());
        }
      } catch {}
    }
  };

  const Gallery = {
    images: [
      "517b0c8fc4f7f9734e65e26860ddaf938c649bb96cef3c6269d25ea8fb218b57.png",
      "78b233b9b82101ad391bb62419b5c023806c86108cd5ba6e9796a3ec088b31c0.png",
      "3089572069c20bafd762942e5066fe30b60ccab0bfef1127ac478723aebe4173.png",
      "a4079e8edb6317fa5f38689b9074e3b0e722a7dea12916a32c80e2cd71feeac1.png",
      "b58a01a3b26c38ed92463424c53aff7e8f7aa4bcfd0e4de340e9c588bd91f342.png",
      "bccbb6a3076e96ea2f7ddacce61d2621d1f5cf412576237179c19ea165e6abed.png",
      "0b824badf2079e193ac631315574eccf9aee69c22229ff304b2d7603e811a771.png",
      "db814bab09d08df67e618e0402cc69fc45e03d909758bec1d40b5fefdbdd5917.png",
      "c859377852d994bda476fd3cd8b90fd2ff880bf63773e0fc637d556a30e758e4.png"
    ].map(name => `/media/root/demo-webshop/${name}`),

    dialog: null,
    dialogImage: null,

    ensureDialog() {
      try {
        if (this.dialog) return;

        this.dialogImage = new sap.m.Image({
          width: "100%",
          height: "100%",
          densityAware: false
        }).addStyleClass("wsGalleryDialogImg");

        this.dialog = new sap.m.Dialog({
          stretch: true,
          showHeader: false,
          verticalScrolling: false,
          horizontalScrolling: false,
          contentWidth: "100%",
          contentHeight: "100%",
          content: [this.dialogImage]
        }).addStyleClass("wsGalleryDialog");

        this.dialog.addEventDelegate({
          onAfterRendering: () => {
            try {
              const $dialog = this.dialog.$();
              const scrollStyles = { padding: "0", margin: "0", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#000" };
              const contStyles = { padding: "0", margin: "0", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" };
              const imgStyles = { maxWidth: "100%", maxHeight: "100vh", width: "auto", height: "auto", objectFit: "contain", display: "block" };
              
              $dialog.find(".sapMDialogScroll").css(scrollStyles);
              $dialog.find(".sapMDialogScrollCont").css(contStyles);
              $dialog.find(".wsGalleryDialogImg img").css(imgStyles);
              $dialog.off("click.wsGalleryClose").on("click.wsGalleryClose", () => this.dialog.close());
            } catch {}
          }
        });
      } catch {}
    },

    zoom(src) {
      try {
        this.ensureDialog();
        this.dialogImage.setSrc(src || "");
        this.dialog.open();
      } catch {}
    },

    render() {
      try {
        if (typeof GalleryRail === "undefined" || !GalleryRail?.removeAllItems) return;

        GalleryRail.removeAllItems();

        this.images.forEach(src => {
          try {
            const image = new sap.m.Image({ src, decorative: false }).addStyleClass("wsGalleryImg");
            const tile = new sap.m.VBox({ items: [image] }).addStyleClass("wsGalleryTile");
            
            tile.addEventDelegate({
              onAfterRendering: () => {
                try {
                  tile.$().off("click.wsGallery").on("click.wsGallery", () => this.zoom(src));
                } catch {}
              }
            });
            
            GalleryRail.addItem(tile);
          } catch {}
        });
      } catch {}
    }
  };

  const ThankYou = {
    dialog: null,
    image: null,
    imageSrc: "/media/root/demo-webshop/Neptune%20DXP%2024.14.0.png",

    ensure() {
      try {
        if (this.dialog) return;

        this.image = new sap.m.Image({
          src: this.imageSrc,
          width: "100%",
          height: "100%",
          densityAware: false
        }).addStyleClass("wsThanksImg");

        this.dialog = new sap.m.Dialog({
          stretch: true,
          showHeader: false,
          verticalScrolling: false,
          horizontalScrolling: false,
          contentWidth: "100%",
          contentHeight: "100%",
          content: [this.image]
        }).addStyleClass("wsThanksDialog");

        this.dialog.addEventDelegate({
          onAfterRendering: () => {
            try {
              this.dialog.$().off("click.wsThanks").on("click.wsThanks", () => this.dialog.close());
            } catch {}
          }
        });
      } catch {}
    },

    open() {
      try {
        this.ensure();
        this.image.setSrc(this.imageSrc);
        this.dialog.open();
      } catch {}
    }
  };

  const getProductScrollContainer = () => {
    try {
      if (typeof ProductGrid !== "undefined" && ProductGrid?.$) {
        const $list = ProductGrid.$().find("ul.sapMListUl");
        if ($list && $list.length) return $list[0];
      }
      return document.querySelector('[id$="ProductGrid"] ul.sapMListUl') ||
             document.querySelector('[id$="ProductGrid"]')?.querySelector("ul.sapMListUl") ||
             null;
    } catch {
      return null;
    }
  };

  window.formatPrice = (price, currency) => Utils.formatMoney(price, currency);

  window.formatSelectedPrice = value => {
    try {
      const data = core().getModel("SelectedProductModel")?.getData?.() || {};
      return Utils.formatMoney(value, data.item?.currency || "USD");
    } catch {
      return Utils.formatMoney(value, "USD");
    }
  };

  window.formatSelectedCompare = window.formatSelectedPrice;
  window.formatCartItemPrice = (price, currency) => Utils.formatMoney(price, currency || "USD");
  window.formatCartItemUnitPrice = (unitPrice, currency) => Utils.formatMoney(unitPrice, currency || "USD");
  window.formatCartItemLineTotal = (lineTotal, currency) => Utils.formatMoney(lineTotal, currency || "USD");

  window.onOpenProductDetail = (event, product) => Navigation.openDetail(event, product);
  window.wsRenderGallery = () => Gallery.render();
  window.wsOpenGalleryZoom = src => Gallery.zoom(src);
  window.wsGalleryImages = Gallery.images;
  window.wsAddToCartProduct = (product, qty) => Cart.add(product, qty);
  window.onOpenCart = () => Cart.open();
  window.onCloseCart = () => Cart.close();

  window.onCartQtyPlus = function (event) {
    try {
      const context = event?.getSource?.().getBindingContext("CartModel") || 
                     event?.getBindingContext?.("CartModel") || 
                     this?.getBindingContext?.("CartModel");
      const item = context?.getObject?.();
      if (item?.id) Cart.updateQuantity(item.id, 1);
    } catch {}
  };

  window.onCartQtyMinus = function (event) {
    try {
      const context = event?.getSource?.().getBindingContext("CartModel") || 
                     event?.getBindingContext?.("CartModel") || 
                     this?.getBindingContext?.("CartModel");
      const item = context?.getObject?.();
      if (item?.id) Cart.updateQuantity(item.id, -1);
    } catch {}
  };

  window.onCartRemoveItem = function (event) {
    try {
      const context = event?.getSource?.().getBindingContext("CartModel") || 
                     event?.getBindingContext?.("CartModel") || 
                     this?.getBindingContext?.("CartModel");
      const item = context?.getObject?.();
      if (item?.id) Cart.remove(item.id);
    } catch {}
  };

  window.onAddToCart = () => {
    try {
      const selected = Model.getData("SelectedProductModel", {}).item;
      if (!selected?.id) return Utils.toast("No product selected.");
      
      const quantity = (typeof QtyInput !== "undefined" && QtyInput?.getValue) 
        ? Math.max(1, Utils.num(QtyInput.getValue(), 1)) 
        : 1;
      
      Cart.add(selected, quantity);
    } catch {}
  };

  window.onHeroShopNow = () => {
    try {
      const element = (typeof CollectionSection !== "undefined" && CollectionSection?.getDomRef)
        ? CollectionSection.getDomRef()
        : document.querySelector(".CollectionSection");
      
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch {}
  };

  window.onCollectionPrevPress = () => {
    try {
      const container = getProductScrollContainer();
      if (!container) return;
      container.scrollBy({ left: -(container.clientWidth / 4), behavior: "smooth" });
    } catch {}
  };

  window.onCollectionNextPress = () => {
    try {
      const container = getProductScrollContainer();
      if (!container) return;
      container.scrollBy({ left: (container.clientWidth / 4), behavior: "smooth" });
    } catch {}
  };

  window.onCheckout = () => {
    try {
      if (typeof CartDialog !== "undefined" && CartDialog?.close) {
        CartDialog.close();
      }
    } catch {}
    Cart.reset();
    ThankYou.open();
    Utils.toast("Thank you for trying our demo.");
  };

  window.__wsListTemplate = null;

  window.wsEnsureProductsModel = () => {
    try {
      const model = core().getModel("ProductsModel");
      const data = model?.getData?.() || {};
      if (Array.isArray(data.items) && data.items.length) return true;
      Loader.load();
      return true;
    } catch {
      return true;
    }
  };

  window.wsBindProductList = force => {
    try {
      const list = sap.ui.getCore().byId("GridList") || 
                   (typeof GridList !== "undefined" ? GridList : null);
      if (!list?.bindAggregation) return;

      list.setModel(core().getModel("ProductsModel"), "ProductsModel");

      const binding = list.getBinding("items");
      if (binding && !force) {
        binding.refresh(true);
        return;
      }

      if (!window.__wsListTemplate) {
        if (typeof GridListItem === "undefined" || !GridListItem?.clone) return;
        window.__wsListTemplate = GridListItem.clone();
        window.__wsListTemplate.setVisible(true);
      }

      list.unbindAggregation("items");

      const template = window.__wsListTemplate.clone();
      template.setVisible(true);

      list.bindAggregation("items", {
        path: "ProductsModel>/items",
        template,
        templateShareable: false
      });

      const newBinding = list.getBinding("items");
      if (newBinding) newBinding.refresh(true);
    } catch {}
  };

  window.onShowAllProductsPress = () => {
    try {
      window.wsEnsureProductsModel();
      window.wsBindProductList(true);
      if (typeof App !== "undefined" && App?.to) {
        App.to(ProductListPage);
      }
    } catch {}
  };

  core().attachInit(() => {
    try {
      if (typeof ProductListPage !== "undefined" && ProductListPage?.addEventDelegate) {
        ProductListPage.addEventDelegate({
          onBeforeShow: () => {
            window.wsEnsureProductsModel();
            window.wsBindProductList(true);
          }
        });
      }
    } catch {}

    Model.init();
    Loader.load();
  });

})();