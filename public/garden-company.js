"use strict";
(function () {
  var DEFAULT_ENDPOINT = "https://garden-os.net/api/public/company/";
  var script = document.currentScript || document.querySelector("script[data-company]");
  var slug = script && script.getAttribute("data-company");
  var endpoint = (script && script.getAttribute("data-endpoint")) || DEFAULT_ENDPOINT;
  var dataPromise = null;

  function warn(message) {
    if (window.console && console.warn) console.warn("[GardenCompany] " + message);
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function dateParts(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    return match ? { y: match[1], m: String(Number(match[2])), d: String(Number(match[3])) } : null;
  }

  function formatDateJa(value) {
    var parts = dateParts(value);
    return parts ? parts.y + "年" + parts.m + "月" + parts.d + "日" : value;
  }

  function formatDateDot(value) {
    return String(value || "").replace(/-/g, ".");
  }

  function telHref(value) {
    return "tel:" + String(value || "").replace(/[^\d+]/g, "");
  }

  function fetchData() {
    if (dataPromise) return dataPromise;
    if (!slug) {
      dataPromise = Promise.reject(new Error("missing data-company"));
      return dataPromise;
    }
    dataPromise = fetch(endpoint + encodeURIComponent(slug), { mode: "cors", credentials: "omit" })
      .then(function (response) {
        var type = response.headers && response.headers.get("content-type");
        if (!response.ok || !type || type.indexOf("application/json") === -1) {
          throw new Error("invalid response");
        }
        return response.json();
      });
    return dataPromise;
  }

  function updateFields(data) {
    var allowed = { company_name: true, representative: true, address: true, phone: true, established_on: true };
    document.querySelectorAll("[data-garden]").forEach(function (element) {
      var key = element.getAttribute("data-garden");
      if (!allowed[key] || typeof data[key] !== "string") return;
      var value = data[key];
      if (key === "established_on" && element.getAttribute("data-garden-format") === "ja") {
        value = formatDateJa(value);
      }
      if (element.textContent !== value) element.textContent = value;
      if (key === "phone" && element.tagName.toLowerCase() === "a") {
        element.setAttribute("href", telHref(value));
      }
    });
  }

  function appendTextWithBreaks(parent, value) {
    String(value || "").split("\n").forEach(function (line, index) {
      if (index > 0) parent.appendChild(document.createElement("br"));
      parent.appendChild(document.createTextNode(line));
    });
  }

  function formatDateYm(value) {
    var parts = dateParts(value);
    return parts ? parts.y + "." + ("0" + parts.m).slice(-2) : value;
  }

  function tokenValue(item, token) {
    if (token === "published_on") return item.published_on || "";
    if (token === "published_on_ja") return formatDateJa(item.published_on || "");
    if (token === "published_on_ym") return formatDateYm(item.published_on || "");
    if (token === "published_on_dot") return formatDateDot(item.published_on || "");
    return item[token] || "";
  }

  function fragmentFromTemplate(html, item) {
    var template = document.createElement("template");
    template.innerHTML = html;
    var walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(function (textNode) {
      var value = textNode.nodeValue || "";
      if (value.indexOf("{{") === -1) return;
      var fragment = document.createDocumentFragment();
      value.split(/(\{\{published_on\}\}|\{\{published_on_ja\}\}|\{\{published_on_ym\}\}|\{\{published_on_dot\}\}|\{\{title\}\}|\{\{body\}\})/g).forEach(function (part) {
        var token = /^\{\{(.+)\}\}$/.exec(part);
        if (!token) {
          fragment.appendChild(document.createTextNode(part));
        } else if (token[1] === "body") {
          appendTextWithBreaks(fragment, tokenValue(item, "body"));
        } else {
          fragment.appendChild(document.createTextNode(tokenValue(item, token[1])));
        }
      });
      textNode.parentNode.replaceChild(fragment, textNode);
    });
    return Array.prototype.slice.call(template.content.childNodes);
  }

  function renderDefault(item) {
    var article = document.createElement("article");
    var time = document.createElement("time");
    var heading = document.createElement("h3");
    var body = document.createElement("p");
    article.className = "garden-news-item";
    time.textContent = formatDateDot(item.published_on);
    heading.textContent = item.title || "";
    appendTextWithBreaks(body, item.body);
    article.appendChild(time);
    article.appendChild(heading);
    article.appendChild(body);
    return [article];
  }

  function updateNews(data) {
    if (!Array.isArray(data.news) || data.news.length === 0) return;
    document.querySelectorAll("[data-garden-news]").forEach(function (element) {
      var limit = Number(element.getAttribute("data-garden-news-limit") || 5);
      var items = data.news.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 5);
      if (items.length === 0) return;
      var template = element.querySelector("template");
      var mode = element.getAttribute("data-garden-news-mode") === "prepend" ? "prepend" : "replace";
      if (element.getAttribute("data-garden-news-done") === "1") return;
      if (mode === "replace") {
        Array.prototype.slice.call(element.children).forEach(function (child) {
          if (child.tagName.toLowerCase() !== "template") child.remove();
        });
      }
      var anchor = mode === "prepend" ? firstNonTemplateChild(element) : null;
      items.forEach(function (item) {
        var nodes = template ? fragmentFromTemplate(template.innerHTML, item) : renderDefault(item);
        nodes.forEach(function (node) {
          if (anchor) element.insertBefore(node, anchor);
          else element.appendChild(node);
        });
      });
      element.setAttribute("data-garden-news-done", "1");
      dispatchUpdated(element, items.length);
    });
  }

  function firstNonTemplateChild(element) {
    var children = element.children;
    for (var i = 0; i < children.length; i++) {
      if (children[i].tagName.toLowerCase() !== "template") return children[i];
    }
    return null;
  }

  function dispatchUpdated(element, count) {
    try {
      var event = new CustomEvent("garden:news-updated", { bubbles: true, detail: { count: count } });
      element.dispatchEvent(event);
    } catch (error) {
      /* 古いブラウザでは何もしない */
    }
  }

  function refresh() {
    return fetchData().then(function (data) {
      updateFields(data);
      updateNews(data);
      return data;
    }).catch(function (error) {
      if (error && !error._gardenWarned) {
        error._gardenWarned = true;
        warn(error.message ? error.message : "load failed");
      }
    });
  }

  window.GardenCompany = { refresh: refresh };
  ready(refresh);
})();
