// app/generate-pdf/route.ts
// Avery 95328 (3×2) — unchanged: exact geometry + optional bleed
// Self-cut (3×3) — restored: fits 9 cards on 8.5×11 with 0.2 mm spacing, no bleed effect

import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { Document, Page, View, Image, StyleSheet, Text, pdf } from "@react-pdf/renderer";

/* ---------- Types ---------- */
interface ParsedCard { quantity: number; name: string; setCode?: string; cardNumber?: string }
interface CardData { name: string; image_uris?: { normal: string }; card_faces?: Array<{ image_uris: { normal: string } }> }
interface ProcessedCard { name: string; imageUrl: string | null; setCode?: string; success: boolean }
type Layout = "self-cut" | "avery";
interface PostRequestBody { cards: ParsedCard[]; layout?: Layout; enableBleed?: boolean }

/* ---------- Constants (points) ---------- */
const IN = 72;

// Page sizes
const PAGE_L = { w: 11 * IN, h: 8.5 * IN }; // Letter landscape (Avery)
const PAGE_P = { w: 8.5 * IN, h: 11 * IN }; // Letter portrait (Self-cut)

// Avery 95328 geometry (unchanged)
const CARD_W = 2.5 * IN;               // 180 pt
const CARD_H = 3.5 * IN;               // 252 pt
const CARD_R = 0.375 * IN;             // 27 pt radius
const GAP_X  = 1.0 * IN;               // 72 pt (horizontal spacing)
const GAP_Y  = 0.5 * IN;               // 36 pt (vertical spacing)
const M_L    = 0.75 * IN;              // 54 pt (left margin)
const M_T    = 0.5 * IN;               // 36 pt (top margin)

// Bleed (Avery only)
const BLEED_IN   = 0.1 * IN;           // 0.1" = 7.2 pt per side
const BLEED_FILL = "#120c0c";

// Self-cut spacing: 0.2 mm between cards (≈ 0.007874 in)
const MM = 72 / 25.4;
const SC_GAP = 0.2 * MM;               // ≈ 0.56693 pt (gap between adjacent cards)
const SC_COLS = 3;
const SC_ROWS = 3;

// Optional: debug outlines
const DEBUG_OUTLINES = false;

/* ---------- Data loader ---------- */
async function fetchCardImage(cardName: string, setCode?: string): Promise<string | null> {
  try {
    let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;
    if (setCode) url += `&set=${encodeURIComponent(setCode.toLowerCase())}`;
    const response = await fetch(url, { headers: { "User-Agent": "ProxyPrint/1.0" } });
    if (!response.ok) return null;
    const cardData: CardData = await response.json();

    // Correct handling of double-faced cards
    if (cardData.card_faces && cardData.card_faces[0]?.image_uris?.normal) {
      return cardData.card_faces[0].image_uris.normal;
    }
    if (cardData.image_uris?.normal) return cardData.image_uris.normal;
    return null;
  } catch {
    return null;
  }
}

/* ---------- Styles ---------- */
const createStyles = (layout: Layout) =>
  StyleSheet.create({
    page: {
      backgroundColor: "white",
      ...(layout === "avery"
        ? { position: "relative", width: PAGE_L.w, height: PAGE_L.h }
        : { position: "relative", width: PAGE_P.w, height: PAGE_P.h } // [SELF-CUT FIX] absolute positioning on portrait
      ),
    },

    // Avery mask (unchanged)
    cardMask: {
      position: "absolute", width: CARD_W, height: CARD_H,
      borderRadius: CARD_R, overflow: "hidden",
      border: DEBUG_OUTLINES ? "1pt dashed #000" : "0pt solid transparent",
    },

    // Avery bleed (unchanged)
    bleedRect: { position: "absolute", width: CARD_W + 2 * BLEED_IN, height: CARD_H + 2 * BLEED_IN, backgroundColor: BLEED_FILL },

    // [SELF-CUT FIX] self-cut card mask (same 2.5×3.5, rounded, no bleed)
    selfCutMask: {
      position: "absolute", width: CARD_W, height: CARD_H,
      borderRadius: CARD_R, overflow: "hidden",
      border: DEBUG_OUTLINES ? "0.5pt dashed #000" : "0.25pt solid #bbb",
      backgroundColor: "#ffffff",
    },

    // Images
    cardImage: { width: "100%", height: "100%", objectFit: "cover" },

    // Placeholders
    placeholder: {
      width: "100%", height: "100%", backgroundColor: "#f5f5f5",
      justifyContent: "center", alignItems: "center", padding: 8,
    },
    placeholderText: { fontSize: 8, color: "#3c3c3c", textAlign: "center", marginBottom: 4 },
    errorText: { fontSize: 6, color: "#999", textAlign: "center" },
    setCodeText: { fontSize: 5, color: "#666", textAlign: "center", position: "absolute", bottom: 4, left: 0, right: 0 },
  });

/* ---------- Position helpers ---------- */
// Avery fixed slots (unchanged)
function averyLeft(col: number) { return M_L + col * (CARD_W + GAP_X); }
function averyTop(row: number)  { return M_T + row * (CARD_H + GAP_Y); }

// [SELF-CUT FIX] compute centered grid with 0.2 mm gaps on portrait page
function selfCutGrid() {
  const totalW = SC_COLS * CARD_W + (SC_COLS - 1) * SC_GAP;
  const totalH = SC_ROWS * CARD_H + (SC_ROWS - 1) * SC_GAP;

  // center the grid; this yields small margins (~0.49" left/right, ~0.24" top/bottom)
  const startX = (PAGE_P.w - totalW) / 2;
  const startY = (PAGE_P.h - totalH) / 2;

  const XS = Array.from({ length: SC_COLS }, (_, c) => startX + c * (CARD_W + SC_GAP));
  const YS = Array.from({ length: SC_ROWS }, (_, r) => startY + r * (CARD_H + SC_GAP));
  return { XS, YS };
}

/* ---------- Card element (no JSX) ---------- */
function CardEl(params: {
  card: ProcessedCard; layout: Layout; enableBleed: boolean; left: number; top: number; isSelfCut?: boolean;
}) {
  const { card, layout, enableBleed, left, top, isSelfCut } = params;
  const styles = createStyles(layout);

  if (layout === "avery") {
    const bleedStyle = { ...styles.bleedRect, left: left - BLEED_IN, top: top - BLEED_IN };
    const maskStyle  = { ...styles.cardMask,  left, top };

    const content = (card.imageUrl && card.success)
      ? React.createElement(Image, { src: card.imageUrl, style: styles.cardImage })
      : React.createElement(
          View, { style: styles.placeholder },
          React.createElement(Text, { style: styles.placeholderText }, card.name),
          React.createElement(Text, { style: styles.errorText }, card.success === false ? "(Error loading)" : "(Image not found)"),
          card.setCode ? React.createElement(Text, { style: styles.setCodeText }, `[${card.setCode.toUpperCase()}]`) : null,
        );

    return React.createElement(
      React.Fragment, null,
      enableBleed ? React.createElement(View, { style: bleedStyle }) : null,
      React.createElement(View, { style: maskStyle }, content),
    );
  }

  // [SELF-CUT FIX] absolute-positioned 3×3, no bleed effect
  const maskStyle = { ...styles.selfCutMask, left, top };
  const content = (card.imageUrl && card.success)
    ? React.createElement(Image, { src: card.imageUrl, style: styles.cardImage })
    : React.createElement(
        View, { style: styles.placeholder },
        React.createElement(Text, { style: styles.placeholderText }, card.name),
        React.createElement(Text, { style: styles.errorText }, card.success === false ? "(Error loading)" : "(Image not found)"),
        card.setCode ? React.createElement(Text, { style: styles.setCodeText }, `[${card.setCode.toUpperCase()}]`) : null,
      );

  return React.createElement(View, { style: maskStyle }, content);
}

/* ---------- Document (no JSX) ---------- */
function CardsPDFDocument(params: { cards: ProcessedCard[]; layout: Layout; enableBleed: boolean }) {
  const { cards, layout, enableBleed } = params;
  const styles = createStyles(layout);

  if (layout === "avery") {
    const perPage = 6;
    const XS = [averyLeft(0), averyLeft(1), averyLeft(2)];
    const YS = [averyTop(0),  averyTop(1)];

    const pages: ProcessedCard[][] = [];
    for (let i = 0; i < cards.length; i += perPage) pages.push(cards.slice(i, i + perPage));

    return React.createElement(
      Document, null,
      pages.map((pageCards, pageIndex) =>
        React.createElement(
          Page,
          { key: String(pageIndex), size: "LETTER", orientation: "landscape", style: styles.page },
          pageCards.map((card, idx) => {
            const row = Math.floor(idx / 3);
            const col = idx % 3;
            return React.createElement(CardEl, {
              key: `${pageIndex}-${idx}`, card, layout, enableBleed,
              left: XS[col], top: YS[row],
            });
          }),
        ),
      ),
    );
  }

  // [SELF-CUT FIX] 3×3 on portrait page with 0.2 mm spacing, no bleed effect
  const perPage = 9;
  const { XS, YS } = selfCutGrid();

  const pages: ProcessedCard[][] = [];
  for (let i = 0; i < cards.length; i += perPage) pages.push(cards.slice(i, i + perPage));

  return React.createElement(
    Document, null,
    pages.map((pageCards, pageIndex) =>
      React.createElement(
        Page,
        { key: String(pageIndex), size: "LETTER", orientation: "portrait", style: styles.page },
        pageCards.map((card, idx) => {
          const row = Math.floor(idx / 3);
          const col = idx % 3;
          return React.createElement(CardEl, {
            key: `${pageIndex}-${idx}`, card, layout, enableBleed: false, // bleed ignored for self-cut
            left: XS[col], top: YS[row], isSelfCut: true,
          });
        }),
      ),
    ),
  );
}

/* ---------- Route handler ---------- */
export async function POST(request: NextRequest) {
  try {
    const { cards, layout = "self-cut", enableBleed = true } = (await request.json()) as PostRequestBody;
    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 });
    }

    // Deduplicate fetches
    const uniq = new Map<string, { name: string; setCode?: string }>();
    for (const c of cards) {
      const key = (c.name + (c.setCode || "")).toLowerCase();
      if (!uniq.has(key)) uniq.set(key, { name: c.name, setCode: c.setCode });
    }

    const uniqueCards = Array.from(uniq.values());
    const images = await Promise.all(
      uniqueCards.map(async (c) => {
        const imageUrl = await fetchCardImage(c.name, c.setCode);
        const key = (c.name + (c.setCode || "")).toLowerCase();
        return { key, imageUrl, success: !!imageUrl, name: c.name, setCode: c.setCode };
      }),
    );

    const imageMap = new Map<string, { imageUrl: string | null; success: boolean }>();
    images.forEach(({ key, imageUrl, success }) => imageMap.set(key, { imageUrl, success }));

    // Expand by quantity
    const processed: ProcessedCard[] = [];
    for (const c of cards) {
      const key = (c.name + (c.setCode || "")).toLowerCase();
      const img = imageMap.get(key);
      for (let i = 0; i < c.quantity; i++) {
        processed.push({ name: c.name, imageUrl: img?.imageUrl || null, setCode: c.setCode, success: img?.success || false });
      }
    }

    const element = React.createElement(CardsPDFDocument, { cards: processed, layout, enableBleed });
    const pdfBuffer = await pdf(element).toBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="proxyprint-cards.pdf"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate PDF" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
