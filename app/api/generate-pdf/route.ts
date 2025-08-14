import { type NextRequest, NextResponse } from "next/server"
import jsPDF from "jspdf"

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

// Working rounded rectangle using jsPDF's roundedRect method
function drawRoundedCard(doc: jsPDF, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 4, height / 4)

  if (r <= 0) {
    doc.rect(x, y, width, height)
    return
  }

  // Set drawing properties
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.005)

  // Draw rounded rectangle
  doc.roundedRect(x, y, width, height, r, r)
}

export async function POST(request: NextRequest) {
  try {
    const { cards, layout = "self-cut" }: { cards: ParsedCard[]; layout?: "self-cut" | "avery" } = await request.json()

    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 })
    }

    // Get unique cards to avoid duplicate API calls
    const uniqueCardsMap = new Map<string, { name: string; setCode?: string }>()
    for (const card of cards) {
      const key = (card.name + (card.setCode || "")).toLowerCase()
      if (!uniqueCardsMap.has(key)) {
        uniqueCardsMap.set(key, { name: card.name, setCode: card.setCode })
      }
    }
    
    // Fetch all unique card images
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

    // Initialize PDF document
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: "letter",
    })

    // Page dimensions (Letter size: 8.5 x 11 inches)
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
    let borderRadius: number
    let gapX: number = 0
    let gapY: number = 0

    if (layout === "avery") {
      // Avery Business Card Layout: 2-1/2" x 3-1/2" (2.5" x 3.5")
      cols = 3
      rows = 2
      cardsPerPage = 6
      cardWidth = 2.5
      cardHeight = 3.5
      borderRadius = 0.125 // 1/8" radius for professional business cards
      
      // Define spacing between cards
      gapX = 0.125  // 1/8" horizontal gap
      gapY = 0.125  // 1/8" vertical gap
      
      // Calculate total grid size including gaps
      const totalWidth = (cols * cardWidth) + ((cols - 1) * gapX)
      const totalHeight = (rows * cardHeight) + ((rows - 1) * gapY)
      
      // Center the grid on the page
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
      borderRadius = 0.0625 // 1/16" radius for self-cut
    }

    let cardsOnCurrentPage = 0
    let isFirstCard = true

    // Process each card with its quantity
    for (const card of cards) {
      const key = (card.name + (card.setCode || "")).toLowerCase()
      const imageData = imageDataMap.get(key)

      // Add each card based on its quantity
      for (let i = 0; i < card.quantity; i++) {
        // Add new page if needed (skip for first card)
        if (cardsOnCurrentPage === 0 && !isFirstCard) {
          doc.addPage()
        }
        isFirstCard = false

        // Calculate position on current page
        const row = Math.floor(cardsOnCurrentPage / cols)
        const col = cardsOnCurrentPage % cols

        let x: number, y: number

        if (layout === "avery") {
          // Position with gaps
          x = startX + col * (cardWidth + gapX)
          y = startY + row * (cardHeight + gapY)
        } else {
          // Self-cut positioning
          x = startX + col * cardWidth
          y = startY + row * cardHeight
        }

        // Draw rounded card border
        drawRoundedCard(doc, x, y, cardWidth, cardHeight, borderRadius)

        // Add card image or placeholder
        if (imageData) {
          try {
            const padding = 0.05
            const imageX = x + padding
            const imageY = y + padding
            const imageWidth = cardWidth - 2 * padding
            const imageHeight = cardHeight - 2 * padding

            doc.addImage(imageData, "JPEG", imageX, imageY, imageWidth, imageHeight)
          } catch (error) {
            console.error(`Error adding image for ${card.name}:`, error)
            
            // doc.setFillColor(245, 245, 245)
            // drawRoundedCard(doc, x + 0.05, y + 0.05, cardWidth - 0.1, cardHeight - 0.1, borderRadius - 0.05)
            doc.fill()

            // Add card name as text
            doc.setFontSize(8)
            doc.setTextColor(100, 100, 100)
            const textLines = doc.splitTextToSize(card.name, cardWidth - 0.2)
            doc.text(textLines, x + 0.1, y + cardHeight / 2, {
              maxWidth: cardWidth - 0.2,
            })
          }
        } else {
          // Draw rounded placeholder for missing images
          doc.setFillColor(245, 245, 245)
          drawRoundedCard(doc, x + 0.05, y + 0.05, cardWidth - 0.1, cardHeight - 0.1, borderRadius - 0.05)
          doc.fill()

          // Add card name text
          doc.setFontSize(10)
          doc.setTextColor(60, 60, 60)
          const textLines = doc.splitTextToSize(card.name, cardWidth - 0.2)
          doc.text(textLines, x + 0.1, y + cardHeight / 2 - 0.1, {
            maxWidth: cardWidth - 0.2,
          })

          // Add "image not found" text
          doc.setFontSize(8)
          doc.setTextColor(150, 150, 150)
          doc.text("(Image not found)", x + 0.1, y + cardHeight / 2 + 0.2, {
            maxWidth: cardWidth - 0.2,
          })
        }

        cardsOnCurrentPage++

        // Reset page counter when page is full
        if (cardsOnCurrentPage === cardsPerPage) {
          cardsOnCurrentPage = 0
        }
      }
    }

    // Generate PDF output
    const pdfOutput = doc.output("arraybuffer")
    const pdfBuffer = new Uint8Array(pdfOutput)

    // Return PDF with proper headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="proxyprint-cards.pdf"',
        "Content-Length": pdfBuffer.length.toString(),
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
      {
        error: error instanceof Error ? error.message : "Failed to generate PDF",
      },
      { status: 500 },
    )
  }
}
