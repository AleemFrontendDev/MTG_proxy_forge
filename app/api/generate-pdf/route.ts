import { type NextRequest, NextResponse } from "next/server"
import jsPDF from "jspdf"

interface ParsedCard {
  quantity: number
  name: string
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

async function fetchCardImage(cardName: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`)

    if (!response.ok) {
      console.error(`Failed to fetch card: ${cardName}`)
      return null
    }

    const cardData: CardData = await response.json()

    // Handle double-faced cards
    if (cardData.card_faces && cardData.card_faces[0]?.image_uris?.normal) {
      return cardData.card_faces[0].image_uris.normal
    }

    // Handle normal cards
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

    // Always use JPEG format for consistency
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

    // Expand cards based on quantity
    const expandedCards: string[] = []
    for (const card of cards) {
      for (let i = 0; i < card.quantity; i++) {
        expandedCards.push(card.name)
      }
    }

    // Fetch all card images
    const cardImages: Array<{ name: string; imageData: string | null }> = []

    for (const cardName of expandedCards) {
      const imageUrl = await fetchCardImage(cardName)
      let imageData: string | null = null

      if (imageUrl) {
        imageData = await imageToBase64(imageUrl)
      }

      cardImages.push({ name: cardName, imageData })
    }

    // Create PDF using jsPDF
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: "letter",
    })

    // Calculate dimensions for 3x3 grid on 8.5" x 11" page
    const pageWidth = 8.5
    const pageHeight = 11
    const margin = 0.5
    const usableWidth = pageWidth - 2 * margin
    const usableHeight = pageHeight - 2 * margin

    const cardWidth = usableWidth / 3
    const cardHeight = usableHeight / 3

    let cardsOnCurrentPage = 0
    let isFirstCard = true

    for (let i = 0; i < cardImages.length; i++) {
      const { name, imageData } = cardImages[i]

      // Start new page if needed (except for first card)
      if (cardsOnCurrentPage === 0 && !isFirstCard) {
        doc.addPage()
      }
      isFirstCard = false

      // Calculate position in 3x3 grid
      const row = Math.floor(cardsOnCurrentPage / 3)
      const col = cardsOnCurrentPage % 3
      const x = margin + col * cardWidth
      const y = margin + row * cardHeight

      // Draw border for each card slot
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.01)
      doc.rect(x, y, cardWidth, cardHeight)

      if (imageData) {
        try {
          // Add image to PDF with padding
          const padding = 0.05
          doc.addImage(
            imageData,
            "JPEG",
            x + padding,
            y + padding,
            cardWidth - 2 * padding,
            cardHeight - 2 * padding,
          )
        } catch (error) {
          console.error(`Error adding image for ${name}:`, error)
          // Draw placeholder text
          doc.setFontSize(10)
          doc.setTextColor(100, 100, 100)
          const textLines = doc.splitTextToSize(name, cardWidth - 0.2)
          doc.text(textLines, x + 0.1, y + cardHeight / 2, {
            maxWidth: cardWidth - 0.2,
          })
        }
      } else {
        // Draw placeholder for missing cards
        doc.setFillColor(245, 245, 245)
        doc.rect(x + 0.05, y + 0.05, cardWidth - 0.1, cardHeight - 0.1, "F")
        
        doc.setFontSize(12)
        doc.setTextColor(60, 60, 60)
        const textLines = doc.splitTextToSize(name, cardWidth - 0.2)
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

      // Reset for new page
      if (cardsOnCurrentPage === 9) {
        cardsOnCurrentPage = 0
      }
    }

    // Generate PDF as Uint8Array
    const pdfOutput = doc.output('arraybuffer')
    const pdfBuffer = new Uint8Array(pdfOutput)

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="mtg-proxy-cards.pdf"',
        "Content-Length": pdfBuffer.length.toString(),
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
