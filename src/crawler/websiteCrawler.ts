import axios from "axios";
import * as cheerio from "cheerio";
import { BRANDING, STATIC_PAGES } from "../content/staticContent.js";
import { upsertPageDocument } from "../services/vectorService.js";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { normalizeWhitespace } from "../utils/validators.js";

const MAX_PAGES = 10;

function extractMeaningfulText($: cheerio.CheerioAPI): string {
  const root = $("main").first().length ? $("main").first() : $("body").first();
  root.find(
    "script, style, noscript, iframe, form, input, textarea, button, label, svg, header, footer, nav",
  ).remove();
  root
    .find(
      [
        "[class*='cookie']",
        "[id*='cookie']",
        "[class*='consent']",
        "[id*='consent']",
        "[class*='popup']",
        "[id*='popup']",
        "[class*='form']",
        "[id*='form']",
        "[class*='footer']",
        "[id*='footer']",
      ].join(","),
    )
    .remove();

  const chunks = root
    .find("h1, h2, h3, p, li")
    .map((_, element) => normalizeWhitespace($(element).text()))
    .get()
    .filter((value, index, array) => value.length > 30 && array.indexOf(value) === index);

  if (chunks.length === 0) {
    return normalizeWhitespace(root.text());
  }

  return normalizeWhitespace(chunks.join("\n"));
}

function sanitizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString();
}

function isAllowedLink(url: string, rootHost: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.host !== rootHost) {
      return false;
    }

    if (/\.(png|jpe?g|svg|webp|pdf|zip)$/i.test(parsed.pathname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function crawl(): Promise<void> {
  const seedUrl = sanitizeUrl(config.WEBSITE_SOURCE_URL);
  const rootHost = new URL(seedUrl).host;
  const queue = [seedUrl];
  const visited = new Set<string>();

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const url = queue.shift();
    if (!url || visited.has(url)) {
      continue;
    }

    visited.add(url);

    try {
      const response = await axios.get<string>(url, {
        timeout: 20_000,
      });
      const $ = cheerio.load(response.data);

      const title = normalizeWhitespace($("title").first().text()) || normalizeWhitespace($("h1").first().text());
      const content = extractMeaningfulText($);

      if (content.length > 250) {
        await upsertPageDocument({
          source: "website",
          url,
          title,
          content,
          metadata: {
            crawledAt: new Date().toISOString(),
          },
        });
      }

      $("a[href]").each((_, element) => {
        const href = $(element).attr("href");
        if (!href) {
          return;
        }

        try {
          const resolved = sanitizeUrl(new URL(href, url).toString());
          if (isAllowedLink(resolved, rootHost) && !visited.has(resolved) && !queue.includes(resolved)) {
            queue.push(resolved);
          }
        } catch {
          return;
        }
      });

      logger.info({ url }, "Pagina crawl-uita.");
    } catch (error) {
      logger.warn({ err: error, url }, "Pagina nu a putut fi crawl-uita.");
    }
  }

  for (const [pageKey, pageValue] of Object.entries(STATIC_PAGES)) {
    await upsertPageDocument({
      source: "curated_content",
      url: `${BRANDING.websiteUrl}#${pageKey}`,
      title: pageValue.title,
      content: pageValue.body,
      metadata: {
        curated: true,
      },
    });
  }

  logger.info({ pages: visited.size }, "Crawl finalizat.");
}

crawl().catch((error) => {
  logger.error({ err: error }, "Crawl esuat.");
  process.exit(1);
});
