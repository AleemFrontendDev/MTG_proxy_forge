import { type NextRequest, NextResponse } from "next/server"
import React from "react"
import { Document, Page, View, Image, StyleSheet, Text, pdf } from "@react-pdf/renderer"

/* ---------- Types ---------- */
interface ParsedCard {
  quantity: number
  name: string
  setCode?: string
  cardNumber?: string
}
interface CardData {
  name: string
  image_uris?: { normal: string }
  card_faces?: Array<{ image_uris: { normal: string } }>
}
interface ProcessedCard {
  name: string
  imageUrl: string | null
  setCode?: string
  success: boolean
}

type Layout = "self-cut" | "avery"

/* ---------- Constants (points) ---------- */
// 1 in = 72 pt
const IN = 72

// Page (Letter, landscape)
const PAGE_W = 11 * IN // 792
const PAGE_H = 8.5 * IN // 612

// Avery 95328 geometry from the annotated template (converted from mm)
/*
  Card: 63.5 × 88.9 mm => 180.0 × 252.0 pt
  Corner radius: 9.525 mm => 27.0 pt
  Left/Right margin: 19.05 mm => 54.0 pt
  Top/Bottom margin: 12.7 mm => 36.0 pt
  Horizontal spacing: 25.4 mm => 72.0 pt
  Vertical spacing: 12.7 mm => 36.0 pt
*/
const CARD_W = 2.5 * IN // 180
const CARD_H = 3.5 * IN // 252
const CARD_R = (9.525 * 72) / 25.4 // ~27.0
const M_L = (19.05 * 72) / 25.4 // 54.0
const M_T = (12.7 * 72) / 25.4 // 36.0
const GAP_X = (25.4 * 72) / 25.4 // 72.0
const GAP_Y = (12.7 * 72) / 25.4 // 36.0

// Bleed: 0.1" per side (so +0.2" overall)
const BLEED = 0.1 * IN // 7.2 pt per side
const BLEED_FILL = "#120c0c"

// Optional debug (set true to draw dotted cut lines)
const DEBUG = false

/* ---------- Data loader ---------- */
async function fetchCardImage(cardName: string, setCode?: string): Promise<string | null> {
  try {
    let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`
    if (setCode) url += `&set=${encodeURIComponent(setCode.toLowerCase())}`

    const response = await fetch(url, { headers: { "User-Agent": "ProxyPrint/1.0" } })
    if (!response.ok) {
      console.error(`Failed to fetch card: ${cardName} (${response.status})`)
      return null
    }

    const cardData: CardData = await response.json()

    // Correct handling of double-faced cards
    if (cardData.card_faces && cardData.card_faces[0]?.image_uris?.normal) {
      return cardData.card_faces[0].image_uris.normal
    }
    if (cardData.image_uris?.normal) {
      return cardData.image_uris.normal
    }
    return null
  } catch (err) {
    console.error(`Error fetching card ${cardName}:`, err)
    return null
  }
}

/* ---------- Styles ---------- */
const createStyles = (layout: Layout) =>
  StyleSheet.create({
    page: {
      backgroundColor: "white",
      ...(layout === "avery"
        ? { position: "relative", width: PAGE_W, height: PAGE_H }
        : { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 0, paddingLeft: 42 }),
    },

    // Avery: rounded card mask (the real 2.5×3.5)
    cardMask: {
      position: "absolute",
      width: CARD_W,
      height: CARD_H,
      borderRadius: CARD_R,
      overflow: "hidden",
    },

    // Avery: rectangular bleed behind the card (no radius)
    bleedRect: {
      position: "absolute",
      width: CARD_W + 2 * BLEED,
      height: CARD_H + 2 * BLEED,
      backgroundColor: BLEED_FILL,
    },

    // Self-cut containers (retain contractor sizing)
    selfCutCard: {
      width: 165 + BLEED,
      height: 238 + BLEED,
      // borderRadius: 7.2,
      margin: 0,
      overflow: "hidden",
      border: "0.1pt solid #ccc",
    },
    selfCutCardWithBleed: {
      width: 165 + BLEED,
      height: 238 + BLEED,
      // borderRadius: 7.2,
      margin: 0,
      overflow: "hidden",
      backgroundColor: BLEED_FILL,
      border: "0.5pt solid " + BLEED_FILL,
    },

    // Common
    img: { width: "100%", height: "100%", objectFit: "cover" },

    placeholder: {
      width: "100%",
      height: "100%",
      backgroundColor: "#f5f5f5",
      justifyContent: "center",
      alignItems: "center",
      padding: 8,
    },
    placeholderBleed: {
      width: "100%",
      height: "100%",
      backgroundColor: BLEED_FILL,
      justifyContent: "center",
      alignItems: "center",
      padding: 8,
    },
    name: { fontSize: 8, color: "#3c3c3c", textAlign: "center", marginBottom: 4 },
    nameBleed: { fontSize: 8, color: "#ffffff", textAlign: "center", marginBottom: 4 },
    err: { fontSize: 6, color: "#999", textAlign: "center" },
    errBleed: { fontSize: 6, color: "#ccc", textAlign: "center" },
    code: { fontSize: 5, color: "#666", textAlign: "center", position: "absolute", bottom: 4, left: 0, right: 0 },
    codeBleed: { fontSize: 5, color: "#ccc", textAlign: "center", position: "absolute", bottom: 4, left: 0, right: 0 },

    // Dotted guide lines (optional)
    dottedLineHorizontal: {
      position: "absolute",
      width: PAGE_W - 1,
      height: 1,
      borderTop: "1pt dashed #666",
      left: 0.5,
    },
    dottedLineVertical: {
      position: "absolute",
      width: 1,
      height: PAGE_H - 1,
      borderLeft: "1pt dashed #666",
      top: 0.5,
    },
  })

/* ---------- Small helpers ---------- */
function averySlotLeft(col: number) {
  // col: 0..2
  return M_L + col * (CARD_W + GAP_X)
}
function averySlotTop(row: number) {
  // row: 0..1
  return M_T + row * (CARD_H + GAP_Y)
}

/* ---------- Card element (no JSX) ---------- */
function CardEl(params: {
  card: ProcessedCard
  layout: Layout
  enableBleed: boolean
  left?: number
  top?: number
}) {
  const { card, layout, enableBleed, left, top } = params
  const styles = createStyles(layout)

  // Avery: explicit absolute positions via left/top
  if (layout === "avery" && typeof left === "number" && typeof top === "number") {
    const maskStyle = { ...styles.cardMask, left, top }
    const bleedStyle = { ...styles.bleedRect, left: left - BLEED, top: top - BLEED }

    const content =
      card.imageUrl && card.success
        ? React.createElement(Image, { src: card.imageUrl, style: styles.img })
        : React.createElement(
            View,
            { style: styles.placeholder },
            React.createElement(Text, { style: styles.name }, card.name),
            React.createElement(Text, { style: styles.err }, card.success === false ? "(Error loading)" : "(Image not found)"),
            card.setCode ? React.createElement(Text, { style: styles.code }, `[${card.setCode.toUpperCase()}]`) : null,
          )

    return React.createElement(
      React.Fragment,
      null,
      enableBleed ? React.createElement(View, { style: bleedStyle }) : null,
      React.createElement(View, { style: maskStyle }, content),
    )
  }

  // Self-cut: keep contractor’s with/without bleed behavior
  const selfContent =
    card.imageUrl && card.success
      ? React.createElement(Image, { src: card.imageUrl, style: styles.img })
      : React.createElement(
          View,
          { style: enableBleed ? styles.placeholderBleed : styles.placeholder },
          React.createElement(Text, { style: enableBleed ? styles.nameBleed : styles.name }, card.name),
          React.createElement(Text, { style: enableBleed ? styles.errBleed : styles.err }, card.success === false ? "(Error loading)" : "(Image not found)"),
          card.setCode
            ? React.createElement(Text, { style: enableBleed ? styles.codeBleed : styles.code }, `[${card.setCode.toUpperCase()}]`)
            : null,
        )

  return React.createElement(View, { style: enableBleed ? styles.selfCutCardWithBleed : styles.selfCutCard }, selfContent)
}

/* ---------- Optional GridLines overlay (retained) ---------- */
const GridLines: React.FC<{ layout: Layout }> = ({ layout }) => {
  if (layout !== "avery" || !DEBUG) return null
  const styles = createStyles(layout)

  // Values derived from the template in points (rounded) — margins and spacings. :contentReference[oaicite:3]{index=3} :contentReference[oaicite:4]{index=4}
  const horizontal = [M_T, M_T + CARD_H, M_T + CARD_H + GAP_Y, PAGE_H - (PAGE_H - (M_T + CARD_H + GAP_Y) - CARD_H) - GAP_Y, PAGE_H - M_T]
  const vertical = [M_L, M_L + CARD_W, M_L + CARD_W + GAP_X, M_L + 2 * (CARD_W + GAP_X) - GAP_X, M_L + 2 * (CARD_W + GAP_X), PAGE_W - M_L]

  return React.createElement(
    React.Fragment,
    null,
    ...horizontal.map((y, i) => React.createElement(View, { key: `h-${i}`, style: { ...styles.dottedLineHorizontal, top: Math.round(y) } })),
    ...vertical.map((x, i) => React.createElement(View, { key: `v-${i}`, style: { ...styles.dottedLineVertical, left: Math.round(x) } })),
  )
}

/* ---------- Document ---------- */
function CardsPDFDocument(params: { cards: ProcessedCard[]; layout: Layout; enableBleed: boolean }) {
  const { cards, layout, enableBleed } = params
  const styles = createStyles(layout)

  const perPage = layout === "avery" ? 6 : 9

  // Fixed Avery positions
  const XS = [averySlotLeft(0), averySlotLeft(1), averySlotLeft(2)]
  const YS = [averySlotTop(0), averySlotTop(1)]

  // Chunk into pages
  const pages: ProcessedCard[][] = []
  for (let i = 0; i < cards.length; i += perPage) pages.push(cards.slice(i, i + perPage))

  return React.createElement(
    Document,
    null,
    pages.map((pageCards, pageIndex) =>
      React.createElement(
        Page,
        { key: String(pageIndex), size: "LETTER", orientation: layout === "avery" ? "landscape" : "portrait", style: styles.page },
        React.createElement(GridLines, { layout }),
        pageCards.map((card, idx) => {
          if (layout === "avery") {
            const row = Math.floor(idx / 3)
            const col = idx % 3
            const left = XS[col]
            const top = YS[row]
            return React.createElement(CardEl, { key: `${pageIndex}-${idx}`, card, layout, enableBleed, left, top })
          }
          return React.createElement(CardEl, { key: `${pageIndex}-${idx}`, card, layout, enableBleed })
        }),
      ),
    ),
  )
}

/* ---------- Route handler ---------- */
export async function POST(request: NextRequest) {
  try {
    const {
      cards,
      layout = "self-cut",
      enableBleed = true,
    }: { cards: ParsedCard[]; layout?: Layout; enableBleed?: boolean } = await request.json()

    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 })
    }

    console.log(`Processing ${cards.length} card entries for ${layout} layout`)

    // Deduplicate API fetches
    const uniq = new Map<string, { name: string; setCode?: string }>()
    for (const c of cards) {
      const key = (c.name + (c.setCode || "")).toLowerCase()
      if (!uniq.has(key)) uniq.set(key, { name: c.name, setCode: c.setCode })
    }

    console.log(`Fetching ${uniq.size} unique cards`)

    const uniqueCards = Array.from(uniq.values())
    const images = await Promise.all(
      uniqueCards.map(async (c) => {
        const imageUrl = await fetchCardImage(c.name, c.setCode)
        const key = (c.name + (c.setCode || "")).toLowerCase()
        return { key, imageUrl, success: !!imageUrl, name: c.name, setCode: c.setCode }
      }),
    )

    const imageMap = new Map<string, { imageUrl: string | null; success: boolean }>()
    images.forEach(({ key, imageUrl, success }) => imageMap.set(key, { imageUrl, success }))

    console.log(`Successfully loaded ${images.filter((i) => i.success).length}/${images.length} images`)

    // Expand by quantity
    const processed: ProcessedCard[] = []
    for (const c of cards) {
      const key = (c.name + (c.setCode || "")).toLowerCase()
      const img = imageMap.get(key)
      for (let i = 0; i < c.quantity; i++) {
        processed.push({ name: c.name, imageUrl: img?.imageUrl || null, setCode: c.setCode, success: img?.success || false })
      }
    }

    console.log(`Will generate ${processed.length} total card instances`)

    const element = React.createElement(CardsPDFDocument, { cards: processed, layout, enableBleed })
    const pdfBuffer = await pdf(element).toBuffer()

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
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate PDF", details: error instanceof Error ? error.stack : undefined },
      { status: 500 },
    )
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
  })
}
