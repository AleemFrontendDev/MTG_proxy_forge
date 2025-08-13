import { type NextRequest, NextResponse } from "next/server"
import jsPDF from "jspdf"
import { Buffer } from "buffer"

interface ParsedCard {
  quantity: number
  name: string
  setCode?: string
  cardNumber?: string
}

interface CardData {
  name: string
  image_uris?: {
    normal: string
  }
  card_faces?: Array<{
    image_uris: {
      normal: string
    }
  }>
}

async function fetchCardImage(cardName: string, setCode?: string): Promise<string | null> {
  try {
    let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`
    if (setCode) {
      url += `&set=${setCode.toLowerCase()}`
    }

    const response = await fetch(url)

    if (!response.ok) {
      console.error(`Failed to fetch card: ${cardName}`)
      return null
    }

    const cardData: CardData = await response.json()
    if (cardData.card_faces && cardData.card_faces[0]?.image_uris?.normal) {
      return cardData.card_faces[0].image_uris.normal
    }
    if (cardData.image_uris?.normal) {
      return cardData.image_uris.normal
    }

    return null
  } catch (error) {
    console.error(`Error fetching card ${cardName}:`, error)
    return null
  }
}

async function imageToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    return `data:image/jpeg;base64,${base64}`
  } catch (error) {
    console.error("Error converting image to base64:", error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { cards, layout = "self-cut" }: { cards: ParsedCard[]; layout?: "self-cut" | "avery" } = await request.json()

    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 })
    }

    const uniqueCardsMap = new Map<string, { name: string; setCode?: string }>()
    for (const card of cards) {
      const key = (card.name + (card.setCode || "")).toLowerCase()
      if (!uniqueCardsMap.has(key)) {
        uniqueCardsMap.set(key, { name: card.name, setCode: card.setCode })
      }
    }
    const uniqueCardsArray = Array.from(uniqueCardsMap.values())
    const imagePromises = uniqueCardsArray.map(async (card) => {
      const imageUrl = await fetchCardImage(card.name, card.setCode)
      const imageData = imageUrl ? await imageToBase64(imageUrl) : null
      return { key: (card.name + (card.setCode || "")).toLowerCase(), imageData }
    })
    const images = await Promise.all(imagePromises)
    const imageDataMap = new Map<string, string | null>()
    images.forEach(({ key, imageData }) => {
      imageDataMap.set(key, imageData)
    })
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: "letter",
    })

    // Setup page size and margins (Letter 8.5 x 11 inches)
    const pageWidth = 8.5
    const pageHeight = 11
    const margin = 0.5
    const usableWidth = pageWidth - 2 * margin
    const usableHeight = pageHeight - 2 * margin

    // Layout-specific dimensions
    let cardWidth: number
    let cardHeight: number
    let cardsPerPage: number
    let cols: number
    let rows: number
    let startX: number
    let startY: number

    if (layout === "avery") {
      // Avery 95328: 3 columns x 2 rows (6 cards per page)
      // Standard business card size: 2.5" x 3.5"
      cols = 3
      rows = 2
      cardsPerPage = 6
      cardWidth = 2.5
      cardHeight = 3.5

      // Center the cards on the page
      const totalWidth = cols * cardWidth
      const totalHeight = rows * cardHeight
      startX = (pageWidth - totalWidth) / 2
      startY = (pageHeight - totalHeight) / 2
    } else {
      // Self-cut: 3 columns x 3 rows (9 cards per page)
      cols = 3
      rows = 3
      cardsPerPage = 9
      cardWidth = usableWidth / 3
      cardHeight = usableHeight / 3
      startX = margin
      startY = margin
    }

    let cardsOnCurrentPage = 0
    let isFirstCard = true

    // Loop through input cards and add images to PDF as per quantity
    for (const card of cards) {
      const key = (card.name + (card.setCode || "")).toLowerCase()
      const imageData = imageDataMap.get(key)

      for (let i = 0; i < card.quantity; i++) {
        // Add new page if needed (skip for first card)
        if (cardsOnCurrentPage === 0 && !isFirstCard) {
          doc.addPage()
        }
        isFirstCard = false

        // Calculate row and col based on cards placed so far on current page
        const row = Math.floor(cardsOnCurrentPage / cols)
        const col = cardsOnCurrentPage % cols

        const x = startX + col * cardWidth
        const y = startY + row * cardHeight

        // Draw border for each card slot
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.01)
        doc.rect(x, y, cardWidth, cardHeight)

        if (imageData) {
          try {
            const padding = 0.05
            doc.addImage(imageData, "JPEG", x + padding, y + padding, cardWidth - 2 * padding, cardHeight - 2 * padding)
          } catch (error) {
            console.error(`Error adding image for ${card.name}:`, error)
            // Draw placeholder for failed images
            doc.setFillColor(245, 245, 245)
            doc.rect(x + 0.05, y + 0.05, cardWidth - 0.1, cardHeight - 0.1, "F")

            // Add card name as text
            doc.setFontSize(8)
            doc.setTextColor(100, 100, 100)
            const textLines = doc.splitTextToSize(card.name, cardWidth - 0.2)
            doc.text(textLines, x + 0.1, y + cardHeight / 2, {
              maxWidth: cardWidth - 0.2,
            })
          }
        } else {
          // Draw gray placeholder for missing images
          doc.setFillColor(245, 245, 245)
          doc.rect(x + 0.05, y + 0.05, cardWidth - 0.1, cardHeight - 0.1, "F")

          // Add card name as text
          doc.setFontSize(10)
          doc.setTextColor(60, 60, 60)
          const textLines = doc.splitTextToSize(card.name, cardWidth - 0.2)
          doc.text(textLines, x + 0.1, y + cardHeight / 2 - 0.1, {
            maxWidth: cardWidth - 0.2,
          })

          doc.setFontSize(8)
          doc.setTextColor(150, 150, 150)
          doc.text("(Image not found)", x + 0.1, y + cardHeight / 2 + 0.2, {
            maxWidth: cardWidth - 0.2,
          })
        }

        cardsOnCurrentPage++

        // Reset after filling page
        if (cardsOnCurrentPage === cardsPerPage) {
          cardsOnCurrentPage = 0
        }
      }
    }

    // Generate PDF as Uint8Array
    const pdfOutput = doc.output("arraybuffer")
    const pdfBuffer = new Uint8Array(pdfOutput)

    // Return PDF binary response with appropriate headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="proxyprint-cards-${layout}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate PDF",
      },
      { status: 500 },
    )
  }
}
