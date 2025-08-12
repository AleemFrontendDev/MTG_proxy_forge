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

export async function POST(request: NextRequest) {
  try {
    const { cards }: { cards: ParsedCard[] } = await request.json()

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

    // Avery 3x2 grid layout (3 columns, 2 rows)
    const cardWidth = usableWidth / 3
    const cardHeight = usableHeight / 2

    let cardsOnCurrentPage = 0
    let isFirstCard = true

    // 5. Loop through input cards and add images to PDF as per quantity
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
        const row = Math.floor(cardsOnCurrentPage / 3) // 0 or 1
        const col = cardsOnCurrentPage % 3             // 0, 1, or 2

        const x = margin + col * cardWidth
        const y = margin + row * cardHeight

        // Draw border for each card slot
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.01)
        doc.rect(x, y, cardWidth, cardHeight)

        if (imageData) {
          try {
            const padding = 0.05
            doc.addImage(
              imageData,
              "JPEG",
              x + padding,
              y + padding,
              cardWidth - 2 * padding,
              cardHeight - 2 * padding
            )
          } catch (error) {
            console.error(`Error adding image for ${card.name}:`, error)
          }
        } else {
          // Draw gray placeholder for missing images
          doc.setFillColor(245, 245, 245)
          doc.rect(x + 0.05, y + 0.05, cardWidth - 0.1, cardHeight - 0.1, "F")
        }

        cardsOnCurrentPage++

        // Reset after filling 6 cards (3 columns × 2 rows) per page
        if (cardsOnCurrentPage === 6) {
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
        "Content-Disposition": 'attachment; filename="proxyprint-cards.pdf"',
        "Content-Length": pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate PDF",
      },
      { status: 500 }
    )
  }
}
