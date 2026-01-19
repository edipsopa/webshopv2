
(function () {
    "use strict";

    // Create a namespace to avoid polluting the global window object.
    window.ws = window.ws || {};

    /* --------------------------- Helpers --------------------------- */

    const getCore = () => sap.ui.getCore();
    const logError = (message, error) => console.error(message, error);
    const logWarn = (message) => console.warn(message);
    const safeArr = (value) => (Array.isArray(value) ? value : []);

    /**
     * Retrieves the selected product from the "SelectedProductModel".
     * @returns {object|null} The selected product item or null.
     */
    const getSelectedProduct = () => {
        try {
            const model = getCore().getModel("SelectedProductModel");
            return model?.getData()?.item || null;
        } catch (e) {
            logError("Error getting selected product:", e);
            return null;
        }
    };

    /**
     * Updates the "SelectedProductModel" with the given product item.
     * @param {object} item - The product item to set.
     */
    const setSelectedProduct = (item) => {
        try {
            const model = getCore().getModel("SelectedProductModel");
            if (model) {
                model.setData({ item: item || {} }, true); // Use merge option
            }
        } catch (e) {
            logError("Error setting selected product:", e);
        }
    };

    /**
     * Creates a deterministic pseudo-random number generator from a seed string.
     * @param {string} seed - The seed string.
     * @returns {function(): number} A function that returns a random number between 0 and 1.
     */
    const createSeededRandom = (seed = "x") => {
        let h = 0;
        for (let i = 0; i < seed.length; i++) {
            h = ((h << 5) - h) + seed.charCodeAt(i);
        }
        h = Math.abs(h);
        return () => {
            h = (h * 9301 + 49297) % 233280;
            return h / 233280;
        };
    };

    /**
     * Picks a random element from an array using a seeded random function.
     * @param {function(): number} randomFn - The random number generator.
     * @param {Array} arr - The array to pick from.
     * @returns {*} A random element from the array.
     */
    const pickRandom = (randomFn, arr) => {
        const safeArray = safeArr(arr);
        return safeArray.length ? safeArray[Math.floor(randomFn() * safeArray.length)] : null;
    };

    /**
     * Generates a mock list of reviews for a given product.
     * @param {object} product - The product to generate reviews for.
     * @returns {Array<object>} An array of review objects.
     */
    const mockReviewsFor = (product = {}) => {
        const id = product.id || product.name || "default_product";
        const random = createSeededRandom(id);

        const people = [
            { name: "Lars T.", location: "Trondheim" },
            { name: "Eva M.", location: "Oslo" },
            { name: "Jonas H.", location: "Bergen" },
            { name: "Sofia K.", location: "Stavanger" },
            { name: "Maja N.", location: "Kristiansand" },
        ];

        const texts = [
            "The minimalist look is exactly what I wanted.",
            "Feels premium and sturdy — better than expected.",
            "Looks great in my living room. Clean lines.",
            "Easy to match with other furniture, very happy.",
            "Solid quality. Shipping was fast.",
        ];

        const reviewCount = 2 + Math.floor(random() * 3); // 2 to 4 reviews
        const reviews = [];

        for (let i = 0; i < reviewCount; i++) {
            const person = pickRandom(random, people) || { name: "User", location: "" };
            const text = pickRandom(random, texts) || "";
            const rating = 4 + Math.floor(random() * 2); // 4 or 5 stars

            reviews.push({
                name: person.name,
                location: person.location,
                rating,
                text,
            });
        }

        return reviews;
    };

    /**
     * Finds a control within a set of aggregated objects by its style class.
     * @param {Array<sap.ui.core.Control>} controls - The controls to search through.
     * @param {string} styleClass - The style class to find.
     * @returns {sap.ui.core.Control|null} The found control or null.
     */
    const findByClass = (controls, styleClass) => {
        return safeArr(controls).find((c) => c?.hasStyleClass(styleClass)) || null;
    };

    /* --------------------------- Public API --------------------------- */

    /**
     * Ensures the selected product has a 'reviews' array, mocking it if necessary.
     * @param {object} [item=getSelectedProduct()] - The product item.
     */
    const ensureMockReviews = (item = getSelectedProduct()) => {
        if (!item) return;

        const hasReviews = Array.isArray(item.reviews) && item.reviews.length > 0;
        if (hasReviews) return;

        item.reviews = mockReviewsFor(item);
        setSelectedProduct(item); // Persist the new reviews back to the model
    };

    /**
     * Renders the reviews for the currently selected product.
     */
    const renderReviews = () => {
        try {
            if (typeof ReviewsWrap === "undefined" || typeof ReviewCardTemplate === "undefined") {
                logWarn("UI components 'ReviewsWrap' or 'ReviewCardTemplate' are not defined.");
                return;
            }

            const item = getSelectedProduct();
            if (!item) {
                ReviewsWrap.removeAllItems(); // Clear reviews if no product is selected
                return;
            }

            ensureMockReviews(item);
            const reviews = safeArr(item.reviews);

            // Prepare for rendering
            ReviewCardTemplate.setVisible(false);
            ReviewsWrap.removeAllItems();

            reviews.forEach((review) => {
                const card = ReviewCardTemplate.clone();
                const allControls = card.findAggregatedObjects(true);

                const { name, location, rating, text } = review;
                const initial = (name || "U").trim().charAt(0).toUpperCase();

                // Populate card controls
                findByClass(allControls, "wsReviewAvatar")?.setText(initial);
                findByClass(allControls, "wsReviewName")?.setText(name || "");
                findByClass(allControls, "wsReviewLoc")?.setText(location || "");
                findByClass(allControls, "wsReviewText")?.setText(text || "");

                const ratingControl = findByClass(allControls, "wsReviewRating");
                if (ratingControl) {
                    const ratingValue = Math.max(0, Math.min(5, Number(rating) || 0));
                    ratingControl.setValue(ratingValue);
                }

                card.setVisible(true);
                ReviewsWrap.addItem(card);
            });
        } catch (e) {
            logError("Failed to render reviews:", e);
        }
    };

    // Expose public functions under a namespace
    window.ws.reviews = {
        ensureMockReviews,
        renderReviews,
    };

    /* ------------------ Model Binding & Initialization ------------------ */

    /**
     * Attaches a listener to the "SelectedProductModel" to re-render reviews on change.
     */
    const wireSelectedProductListener = () => {
        try {
            const model = getCore().getModel("SelectedProductModel");
            if (!model || model.__wsReviewsWired) return;

            model.__wsReviewsWired = true; // Flag to prevent attaching multiple listeners

            // Wrap the model's setData method to automatically trigger a re-render
            const originalSetData = model.setData.bind(model);
            model.setData = function (...args) {
                originalSetData(...args);
                renderReviews(); // Render after any data change
            };
        } catch (e) {
            logError("Failed to wire 'SelectedProductModel' listener:", e);
        }
    };

    // Initialize when UI5 core is ready
    getCore().attachInit(() => {
        wireSelectedProductListener();
        renderReviews(); // Initial render in case a product is already selected
    });
})();
