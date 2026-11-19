/* Разработка проекта NutsCafe. Миндулин Евгений Александрович */

"use strict";

(() => {
    // 1. Общие функции. Данные блюд читаются только из HTML.
    const page = document.body.dataset.page;
    const query = (selector, parent = document) => parent.querySelector(selector);
    const queryAll = (selector, parent = document) => [...parent.querySelectorAll(selector)];
    const money = (amount) => new Intl.NumberFormat("ru-RU").format(amount) + " ₽";
    const dishSource = query("#dish-library")
        || query("#cart-templates")?.content
        || query("#catalog")
        || query("#main");
    const knownIds = new Set(queryAll("[data-dish]", dishSource).map((dish) => dish.dataset.dish));
    let cart = new Map();
    let toastTimeout;

    function getDish(id) {
        if (!knownIds.has(id)) return null;
        return query('[data-dish="' + id + '"]', dishSource);
    }

    function notify(message) {
        const toast = query("#toast");
        clearTimeout(toastTimeout);
        toast.textContent = message;
        toast.setAttribute("data-visible", "");
        toastTimeout = setTimeout(() => toast.removeAttribute("data-visible"), 4200);
    }

    function readCart() {
        const result = new Map();
        const raw = new URLSearchParams(location.search).get("cart") || "";
        if (raw.length > 3000) return result;

        raw.split(",").slice(0, 64).forEach((entry) => {
            const match = /^([a-z0-9-]{1,50}):([1-9][0-9]?)$/.exec(entry);
            if (!match || !knownIds.has(match[1])) return;
            const previous = result.get(match[1]) || 0;
            result.set(match[1], Math.min(99, previous + Number(match[2])));
        });
        return result;
    }

    function cartValue() {
        return [...cart].map(([id, quantity]) => id + ":" + quantity).join(",");
    }

    function subtotal() {
        let total = 0;
        cart.forEach((quantity, id) => {
            total += Number(getDish(id).dataset.price) * quantity;
        });
        return total;
    }

    // В адресе страницы остаются только id блюда и состав корзины.
    function updateAddress() {
        const url = new URL(location.href);
        const id = url.searchParams.get("id");
        url.search = "";
        if (page === "product" && id && /^[a-z0-9-]{1,50}$/.test(id)) {
            url.searchParams.set("id", id);
        }
        if (cart.size) url.searchParams.set("cart", cartValue());
        try {
            history.replaceState(null, "", url.href);
        } catch {
            // Некоторые локальные просмотрщики запрещают History API.
            // Переходы через обычные ссылки всё равно переносят корзину.
        }
    }

    function updateLinks() {
        queryAll("a[href]").forEach((link) => {
            const original = link.getAttribute("href");
            if (original.startsWith("#")) return;
            const url = new URL(original, location.href);
            const isInternal = url.protocol === location.protocol
                && url.host === location.host
                && /\/(index|menu|product|cart|auth|account)\.html$/.test(url.pathname);
            if (!isInternal) return;
            url.searchParams.delete("cart");
            if (cart.size) url.searchParams.set("cart", cartValue());
            link.href = url.href;
        });
    }

    function updateCartState() {
        const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
        queryAll("[data-cart-count]").forEach((badge) => {
            badge.textContent = count;
            badge.closest("a").setAttribute("aria-label", "Корзина, товаров: " + count);
        });
        updateAddress();
        updateLinks();
    }

    cart = readCart();
    updateCartState();

    window.addEventListener("popstate", () => {
        cart = readCart();
        updateCartState();
        if (page === "cart") renderCart();
        if (page === "product") showProduct();
    });

    // 2. Навигация.
    const menuToggle = query("#menu-toggle");
    const mainNav = query("#main-nav");

    function closeMenu() {
        mainNav.removeAttribute("data-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Открыть меню");
    }

    menuToggle.addEventListener("click", () => {
        const opened = menuToggle.getAttribute("aria-expanded") !== "true";
        menuToggle.setAttribute("aria-expanded", String(opened));
        menuToggle.setAttribute("aria-label", opened ? "Закрыть меню" : "Открыть меню");
        mainNav.toggleAttribute("data-open", opened);
    });

    mainNav.addEventListener("click", (event) => {
        if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && mainNav.hasAttribute("data-open")) {
            closeMenu();
            menuToggle.focus();
        }
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest("header")) closeMenu();
    });

    // 3. Переключение изображений и интерактивные блоки.
    const heroSwitch = query("#hero-switch");
    if (heroSwitch) {
        let coffeeShown = false;
        heroSwitch.addEventListener("click", () => {
            coffeeShown = !coffeeShown;
            const image = query("#hero-photo");
            image.src = coffeeShown ? "img/drinks/cappuccino.jpg" : "img/hero.jpg";
            image.alt = coffeeShown
                ? "Капучино с узором на молочной пене в чёрной чашке"
                : "Шакшука с томатами, яйцами и зеленью в чёрной сковороде";
            heroSwitch.textContent = coffeeShown ? "02 / 02 →" : "01 / 02 →";
            query("#hero-caption").textContent = coffeeShown
                ? "Капучино — время сделать паузу"
                : "Шакшука — маленький повод проснуться";
        });
    }

    // 4. Каталог и поиск.
    const catalog = query("#catalog");
    let activeCategory = "all";

    function applyFilters() {
        const term = query("#search").value.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
        const sort = query("#sort").value;
        const cards = queryAll("[data-dish]", catalog);
        let visible = 0;

        cards.forEach((card) => {
            const title = query("h3", card).textContent.toLocaleLowerCase("ru").replaceAll("ё", "е");
            const match = title.includes(term)
                && (activeCategory === "all" || card.dataset.category === activeCategory);
            card.hidden = !match;
            if (match) visible++;
        });

        if (sort === "default") {
            cards.sort((a, b) => Number(a.dataset.originalOrder) - Number(b.dataset.originalOrder));
        } else {
            cards.sort((a, b) => (Number(a.dataset.price) - Number(b.dataset.price)) * (sort === "asc" ? 1 : -1));
        }
        cards.forEach((card) => catalog.append(card));
        query("#results-count").textContent = "Найдено позиций: " + visible;
        query("#no-results").hidden = visible > 0;
    }

    function resetFilters() {
        activeCategory = "all";
        query("#search").value = "";
        query("#sort").value = "default";
        queryAll("[data-category-filter]").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.categoryFilter === "all"));
        });
        applyFilters();
    }

    if (catalog) {
        queryAll("[data-dish]", catalog).forEach((card, index) => {
            card.dataset.originalOrder = index;
        });
        query("#search").addEventListener("input", applyFilters);
        query("#sort").addEventListener("change", applyFilters);
        query("#reset-filters").addEventListener("click", resetFilters);
        query("[data-reset]").addEventListener("click", resetFilters);
        query("#categories").addEventListener("click", (event) => {
            const button = event.target.closest("[data-category-filter]");
            if (!button) return;
            activeCategory = button.dataset.categoryFilter;
            queryAll("[data-category-filter]").forEach((item) => {
                item.setAttribute("aria-pressed", String(item === button));
            });
            applyFilters();
        });
    }

    // 5. Страница товара.
    function showProduct() {
        const id = new URLSearchParams(location.search).get("id");
        queryAll("[data-product]").forEach((product) => {
            product.hidden = product.dataset.dish !== id;
        });
        const selected = getDish(id);
        query("#product-not-found").hidden = Boolean(selected);
        query("#related-section").hidden = !selected;

        if (!selected) {
            document.title = "Блюдо не найдено — NutsCafe";
            query("#product-breadcrumb").textContent = "Блюдо не найдено";
            return;
        }

        const title = query("h1", selected).textContent;
        document.title = title + " — NutsCafe";
        query("#product-breadcrumb").textContent = title;
        const related = query("#related-dishes");
        related.replaceChildren();
        const candidates = queryAll("[data-product]").filter((product) => product.dataset.dish !== id);
        candidates.sort((a, b) => {
            return Number(b.dataset.category === selected.dataset.category)
                - Number(a.dataset.category === selected.dataset.category);
        });
        candidates.slice(0, 3).forEach((product) => related.append(createRecommendation(product)));
        updateLinks();
    }

    // Карточки рекомендаций используют сведения уже существующих блюд.
    function createRecommendation(product) {
        const card = document.createElement("div");
        card.className = "card";
        ["dish", "category", "price"].forEach((key) => card.dataset[key] = product.dataset[key]);
        const href = "product.html?id=" + product.dataset.dish;
        const name = query("h1", product).textContent;

        function element(tag, text) {
            const node = document.createElement(tag);
            node.textContent = text;
            return node;
        }

        function link(text) {
            const node = element("a", text);
            node.href = href;
            return node;
        }

        const photoLink = link("");
        photoLink.setAttribute("aria-label", "Подробнее: " + name);
        photoLink.append(query("img", product).cloneNode(true));
        if (product.dataset.promo) photoLink.append(element("p", product.dataset.promo));
        const title = document.createElement("h3");
        title.append(link(name));
        const actions = document.createElement("div");
        actions.className = "actions";
        const add = element("button", "В корзину");
        add.type = "button";
        add.dataset.add = product.dataset.dish;
        add.setAttribute("aria-label", "В корзину: " + name);
        actions.append(element("p", money(Number(product.dataset.price))), link("Подробнее"), add);
        card.append(photoLink, element("p", query("p", product.lastElementChild).textContent),
            title, element("p", query("[data-description]", product).textContent), actions);
        return card;
    }

    if (page === "product") showProduct();

    document.addEventListener("click", (event) => {
        const orderButton = event.target.closest("[data-order-toggle]");
        if (orderButton) {
            const details = document.getElementById(orderButton.getAttribute("aria-controls"));
            details.hidden = !details.hidden;
            orderButton.setAttribute("aria-expanded", String(!details.hidden));
        }

        const step = event.target.closest("[data-product-step]");
        if (step) {
            const input = query('input[type="number"]', step.closest("[data-product]"));
            const current = Math.min(99, Math.max(1, Math.trunc(Number(input.value)) || 1));
            input.value = Math.min(99, Math.max(1, current + Number(step.dataset.productStep)));
        }

        const add = event.target.closest("[data-add]");
        if (!add || !knownIds.has(add.dataset.add)) return;
        const product = add.closest("[data-product]");
        const input = product ? query('input[type="number"]', product) : null;
        if (input && (!input.checkValidity() || !input.value)) {
            input.reportValidity();
            return;
        }
        const quantity = input ? Number(input.value) : 1;
        const previous = cart.get(add.dataset.add) || 0;
        cart.set(add.dataset.add, Math.min(99, previous + quantity));
        updateCartState();
        notify(previous + quantity > 99
            ? "Можно добавить не более 99 порций одного блюда."
            : "Добавлено в корзину. Вкусный план становится лучше!");
    });

    // 6. Корзина.
    function renderCart(focusTarget) {
        const items = query("#cart-items");
        const empty = cart.size === 0;
        query("#cart-empty").hidden = !empty;
        query("#checkout-layout").hidden = empty;
        items.replaceChildren();

        cart.forEach((quantity, id) => {
            const item = getDish(id).cloneNode(true);
            query("[data-quantity]", item).textContent = quantity;
            query("[data-item-total]", item).textContent = money(Number(item.dataset.price) * quantity);
            query('[data-cart-step="-1"]', item).disabled = quantity === 1;
            query('[data-cart-step="1"]', item).disabled = quantity === 99;
            items.append(item);
        });

        updateLinks();
        calculateDelivery();
        if (focusTarget) {
            const row = query('[data-dish="' + focusTarget.id + '"]', items);
            const control = row ? query(focusTarget.selector, row) : null;
            if (control && !control.disabled) control.focus({ preventScroll: true });
        }
    }

    if (page === "cart") {
        renderCart();

        query("#cart-items").addEventListener("click", (event) => {
            const step = event.target.closest("[data-cart-step]");
            const remove = event.target.closest("[data-remove]");
            if (!step && !remove) return;
            const item = event.target.closest("[data-dish]");
            const id = item.dataset.dish;
            if (remove) {
                cart.delete(id);
                notify("Позиция удалена из корзины.");
            } else {
                const next = cart.get(id) + Number(step.dataset.cartStep);
                cart.set(id, Math.min(99, Math.max(1, next)));
            }
            updateCartState();
            renderCart(step ? { id, selector: '[data-cart-step="' + step.dataset.cartStep + '"]' } : null);
            if (!cart.size) query("#cart-empty a").focus({ preventScroll: true });
        });

        query("#clear-cart").addEventListener("click", () => {
            cart.clear();
            updateCartState();
            renderCart();
            query("#cart-empty a").focus({ preventScroll: true });
            notify("Корзина очищена.");
        });
    }

    // 7. Расчёт доставки. Тарифы и минимумы находятся в option.
    function calculateDelivery() {
        const total = subtotal();
        queryAll("[data-subtotal]").forEach((label) => label.textContent = money(total));
        const option = query("#zone").selectedOptions[0];
        const selected = Boolean(option.value);
        const cost = selected ? Number(option.dataset.cost) : 0;
        const minimum = selected ? Number(option.dataset.min) : 0;

        query("#delivery-cost").textContent = selected ? money(cost) : "Выберите зону";
        query("#grand-total").textContent = money(total + cost);
        const warning = query("#minimum-warning");
        warning.toggleAttribute("data-warning", selected && total < minimum);
        if (!selected) {
            warning.textContent = "Выберите зону для расчёта доставки.";
        } else if (total < minimum) {
            warning.textContent = "Минимум для зоны " + option.value + " — " + money(minimum)
                + " без доставки. Добавьте блюда ещё на " + money(minimum - total) + ".";
        } else {
            warning.textContent = "Минимальная сумма " + money(minimum) + " достигнута. Можно оформить демозаказ.";
        }
    }

    function clearErrors(form) {
        queryAll("[data-error-for]", form).forEach((error) => error.textContent = "");
        queryAll('[aria-invalid="true"]', form).forEach((field) => field.removeAttribute("aria-invalid"));
    }

    function setError(field, message) {
        field.setAttribute("aria-invalid", "true");
        const error = document.getElementById(field.id + "-error");
        if (error) error.textContent = message;
    }

    function validPhone(value) {
        if (!/^[+\d\s()-]+$/.test(value.trim())) return false;
        const digits = value.replace(/\D/g, "");
        return /^[78]\d{10}$/.test(digits);
    }

    function validEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    }

    function validateForm(form) {
        clearErrors(form);
        queryAll("input, select, textarea", form).forEach((field) => {
            if (field.disabled || field.type === "checkbox") return;
            const value = field.value.trim();
            let error = "";

            if (field.required && !value) {
                error = "Заполните это поле.";
            } else if (!value) {
                return;
            } else if (field.type === "tel" && !validPhone(value)) {
                error = "Введите российский номер: +7 или 8 и ещё 10 цифр.";
            } else if (field.type === "email" && !validEmail(value)) {
                error = "Введите почту в формате name@example.com.";
            } else if (field.type === "password" && field.value.length < 8) {
                error = "Пароль должен содержать не менее 8 символов.";
            } else if (field.id === "login-identity" && !validEmail(value) && !validPhone(value)) {
                error = "Введите корректный email или российский телефон.";
            } else if (/^(recipient|register-name|profile-name)$/.test(field.id)
                && (value.length < 5 || value.split(/\s+/).length < 2)) {
                error = "Укажите фамилию и имя, не менее 5 символов.";
            } else if (field.id === "register-confirm" && field.value !== query("#register-password").value) {
                error = "Пароли не совпадают.";
            } else if (field.minLength > 0 && value.length < field.minLength) {
                error = "Введите не менее " + field.minLength + " символов.";
            } else if (!field.checkValidity()) {
                error = "Проверьте формат и длину значения.";
            }

            if (error) setError(field, error);
        });
        const firstInvalid = query('[aria-invalid="true"]', form);
        if (firstInvalid) firstInvalid.focus();
        return !firstInvalid;
    }

    // Исправленные поля очищают старое сообщение; повторная проверка — при отправке.
    document.addEventListener("input", (event) => {
        const field = event.target;
        if (!field.id || field.getAttribute("aria-invalid") !== "true") return;
        field.removeAttribute("aria-invalid");
        const error = document.getElementById(field.id + "-error");
        if (error) error.textContent = "";
    });

    if (page === "cart") {
        query("#zone").addEventListener("change", () => {
            query("#zone").removeAttribute("aria-invalid");
            query("#zone-error").textContent = "";
            query("#checkout-error").hidden = true;
            calculateDelivery();
        });

        query("#delivery-time").addEventListener("change", () => {
            const custom = query("#delivery-time").value === "custom";
            query("#custom-time-field").hidden = !custom;
            query("#custom-time").disabled = !custom;
            query("#custom-time").required = custom;
            query("#custom-time-error").textContent = "";
            query("#custom-time").removeAttribute("aria-invalid");
        });

        query("#checkout-form").addEventListener("submit", (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            let valid = validateForm(form);
            const option = query("#zone").selectedOptions[0];
            const total = subtotal();
            const cost = Number(option.dataset.cost || 0);
            const minimum = Number(option.dataset.min || 0);
            const message = query("#checkout-error");
            message.hidden = true;

            if (!cart.size) {
                message.textContent = "Сначала добавьте блюда в корзину.";
                message.hidden = false;
                return;
            }
            if (!option.value || !Number.isFinite(cost) || !Number.isFinite(minimum)) {
                setError(query("#zone"), "Выберите зону доставки.");
                valid = false;
            }
            if (option.value && total < minimum) {
                message.textContent = "Для выбранной зоны не хватает " + money(minimum - total)
                    + " стоимости блюд. Доставка не входит в минимальную сумму.";
                message.hidden = false;
                valid = false;
            }

            if (query("#delivery-time").value === "custom" && query("#custom-time").value) {
                const [hours, minutes] = query("#custom-time").value.split(":").map(Number);
                const now = new Date();
                const target = new Date();
                target.setHours(hours, minutes, 0, 0);
                if (target.getTime() - now.getTime() < 30 * 60 * 1000) {
                    setError(query("#custom-time"), "Выберите время сегодня, минимум через 30 минут. Или выберите относительное время доставки.");
                    valid = false;
                }
            }

            if (!valid) {
                const first = query('[aria-invalid="true"]', form);
                if (first) first.focus();
                else query("#minimum-warning").scrollIntoView({ block: "center", behavior: "smooth" });
                return;
            }

            const summary = query("#order-summary");
            summary.replaceChildren();
            function addSummary(text) {
                const line = document.createElement("p");
                line.textContent = text;
                summary.append(line);
            }

            addSummary("Демонстрационный заказ · " + new Date().toLocaleDateString("ru-RU"));
            cart.forEach((quantity, id) => {
                addSummary(query("h3", getDish(id)).textContent.trim() + " × " + quantity
                    + " — " + money(Number(getDish(id).dataset.price) * quantity));
            });
            addSummary("Получатель: " + query("#recipient").value.trim() + " · " + query("#phone").value.trim());
            let address = query("#city").value + ", " + query("#district").value.trim()
                + ", ул. " + query("#street").value.trim() + ", д. " + query("#house").value.trim();
            [["apartment", ", кв./офис "], ["entrance", ", подъезд "], ["floor", ", этаж "]].forEach(([id, prefix]) => {
                if (query("#" + id).value.trim()) address += prefix + query("#" + id).value.trim();
            });
            addSummary("Адрес: " + address);
            const timing = query("#delivery-time");
            addSummary("Время: " + (timing.value === "custom"
                ? "сегодня в " + query("#custom-time").value
                : timing.selectedOptions[0].textContent));
            addSummary("Оплата: " + query("#payment").selectedOptions[0].textContent + ". Реальная оплата не производится.");
            if (query("#comment").value.trim()) addSummary("Комментарий: " + query("#comment").value.trim());
            addSummary("Блюда: " + money(total) + " · Доставка, зона " + option.value + ": " + money(cost));
            addSummary("Итого: " + money(total + cost));
            cart.clear();
            updateCartState();
            form.reset();
            query("#custom-time-field").hidden = true;
            query("#custom-time").disabled = true;
            query("#custom-time").required = false;
            query("#checkout-layout").hidden = true;
            query("#cart-empty").hidden = true;
            query("#order-success").hidden = false;
            query("#order-success").focus();
        });
    }

    // 8. Регистрация и авторизация: только проверка, без учётных записей.
    const authTabs = query("#auth-tabs");
    if (authTabs) {
        function switchAuth(tab) {
            queryAll('[role="tab"]', authTabs).forEach((button) => {
                const selected = button === tab;
                button.setAttribute("aria-selected", String(selected));
                button.tabIndex = selected ? 0 : -1;
                const panel = document.getElementById(button.getAttribute("aria-controls"));
                panel.hidden = !selected;
                query("form", panel).hidden = false;
            });
            query("#auth-success").hidden = true;
            tab.focus();
        }

        authTabs.addEventListener("click", (event) => {
            const tab = event.target.closest('[role="tab"]');
            if (tab) switchAuth(tab);
        });

        authTabs.addEventListener("keydown", (event) => {
            if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const tabs = queryAll('[role="tab"]', authTabs);
            const selected = query('[aria-selected="true"]', authTabs);
            const next = event.key === "Home" ? tabs[0]
                : event.key === "End" ? tabs[1] : tabs.find((tab) => tab !== selected);
            switchAuth(next);
        });

        queryAll("[data-toggle-password]").forEach((button) => {
            button.addEventListener("click", () => {
                const shown = button.getAttribute("aria-pressed") !== "true";
                button.setAttribute("aria-pressed", String(shown));
                button.textContent = shown ? "Скрыть пароль" : "Показать пароль";
                button.dataset.togglePassword.split(",").forEach((id) => {
                    document.getElementById(id).type = shown ? "text" : "password";
                });
            });
        });

        queryAll("form[data-auth]").forEach((form) => {
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                const valid = validateForm(form);
                const message = query("[data-form-message]", form);
                message.hidden = valid;
                message.textContent = valid ? "" : "Проверьте выделенные поля.";
                if (!valid) return;

                // Содержимое форм сразу очищается и не переносится в кабинет.
                queryAll("form[data-auth]").forEach((item) => item.reset());
                queryAll('input[id*="password"], #register-confirm').forEach((input) => input.type = "password");
                queryAll("[data-toggle-password]").forEach((button) => {
                    button.setAttribute("aria-pressed", "false");
                    button.textContent = "Показать пароль";
                });
                queryAll('[role="tabpanel"]').forEach((panel) => panel.hidden = true);
                query("#auth-success").hidden = false;
                query("#auth-success").focus();
            });
        });
    }

    // 9. Личный кабинет. Редактирование действует только в текущем DOM.
    queryAll("form[data-editable]").forEach((form) => {
        let originalValues = [];

        function finishEditing() {
            queryAll("input", form).forEach((input) => input.readOnly = true);
            query("[data-edit]", form).hidden = false;
            query('[type="submit"]', form).hidden = true;
            query("[data-cancel]", form).hidden = true;
        }

        query("[data-edit]", form).addEventListener("click", () => {
            originalValues = queryAll("input", form).map((input) => input.value);
            queryAll("input", form).forEach((input) => input.readOnly = false);
            query("[data-edit]", form).hidden = true;
            query('[type="submit"]', form).hidden = false;
            query("[data-cancel]", form).hidden = false;
            query("[data-edit-message]", form).textContent = "Изменения применятся только на этой странице.";
            query("[data-edit-message]", form).removeAttribute("data-error");
            query("input", form).focus();
        });

        query("[data-cancel]", form).addEventListener("click", () => {
            queryAll("input", form).forEach((input, index) => input.value = originalValues[index]);
            clearErrors(form);
            finishEditing();
            query("[data-edit-message]", form).textContent = "Изменения отменены.";
            query("[data-edit-message]", form).removeAttribute("data-error");
            query("[data-edit]", form).focus();
        });

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const valid = validateForm(form);
            const message = query("[data-edit-message]", form);
            message.toggleAttribute("data-error", !valid);
            message.textContent = valid
                ? "Изменения применены. После обновления появятся исходные демоданные."
                : "Проверьте выделенные поля.";
            if (!valid) return;
            if (form.id === "profile-form") {
                const name = query("#profile-name").value.trim().split(/\s+/)[1];
                query("#main h1").textContent = "Здравствуйте, " + name + ".";
            }
            finishEditing();
            query("[data-edit]", form).focus();
        });
    });

    // Очистка вымышленных изменений при возврате из кеша истории браузера.
    window.addEventListener("pageshow", (event) => {
        if (!event.persisted) return;
        queryAll("form").forEach((form) => form.reset());
        if (page === "account") location.reload();
        if (page === "cart") {
            query("#order-success").hidden = true;
            renderCart();
        }
    });

    // Пароли и сведения получателя убираются перед уходом со страницы.
    window.addEventListener("pagehide", () => {
        queryAll("form").forEach((form) => form.reset());
        const summary = query("#order-summary");
        if (summary) summary.replaceChildren();
    });
})();

