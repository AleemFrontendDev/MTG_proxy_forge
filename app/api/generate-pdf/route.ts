import { type NextRequest, NextResponse } from "next/server"
import React from 'react'
import { Document, Page, View, Image, StyleSheet, Text, pdf } from '@react-pdf/renderer'


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


interface ProcessedCard {
  name: string
  imageUrl: string | null
  setCode?: string
  success: boolean
}


async function fetchCardImage(cardName: string, setCode?: string): Promise<string | null> {
  try {
    let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`
    if (setCode) {
      url += `&set=${setCode.toLowerCase()}`
    }


    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ProxyPrint/1.0'
      }
    })


    if (!response.ok) {
      console.error(`Failed to fetch card: ${cardName} (${response.status})`)
      return null
    }


    const cardData: CardData = await response.json()
    
    // Check for double-faced cards first
    if (cardData.card_faces && cardData.card_faces[0]?.image_uris?.normal) {
      return cardData.card_faces[0].image_uris.normal
    }
    
    // Then check for regular cards
    if (cardData.image_uris?.normal) {
      return cardData.image_uris.normal
    }


    return null
  } catch (error) {
    console.error(`Error fetching card ${cardName}:`, error)
    return null
  }
}


// React-PDF Styles
const createStyles = (layout: "self-cut" | "avery") => {
  // Avery layout calculations
  const cardWidth = 180 // 2.5 inches in points
  const cardHeight = 255.6 // 3.55 inches in points
  const borderRadius = 27.36 // 0.38 inches in points
  const gapX = 72 // 1 inch in points
  const gapY = 28.8 // 0.4 inches in points
  const cols = 3
  const rows = 2
  const pageWidth = 792 // 11 inches in points (Letter landscape)
  const pageHeight = 612 // 8.5 inches in points (Letter landscape)
  
  const totalWidth = cols * cardWidth + (cols - 1) * gapX
  const totalHeight = rows * cardHeight + (rows - 1) * gapY
  const startX = (pageWidth - totalWidth) / 2
  const startY = (pageHeight - totalHeight) / 2

  return StyleSheet.create({
    page: {
      backgroundColor: 'white',
      ...(layout === "avery" ? {
        position: 'relative',
      } : {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 36,
        gap: 0,
      })
    },
    cardContainer: {
      ...(layout === "avery" ? {
        position: 'absolute',
        width: cardWidth,
        height: cardHeight,
        borderRadius: borderRadius,
      } : {
        width: 165,
        height: 238, 
        borderRadius: 7.2,
        margin: 2,
        
      }),
      overflow: 'hidden',
      border: layout === "avery" ? '0.5pt solid black' : '0.1pt solid #ccc',
    },
    cardImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      ...(layout === "avery" ? {
        borderRadius: borderRadius,
      } : {
        borderRadius: 7.2,
      })
    },
    placeholderContainer: {
      width: '100%',
      height: '100%',
      backgroundColor: '#f5f5f5',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 8,
      ...(layout === "avery" ? {
        borderRadius: borderRadius,
      } : {
        borderRadius: 7.2,
      })
    },
    placeholderText: {
      fontSize: layout === "avery" ? 8 : 10,
      color: '#3c3c3c',
      textAlign: 'center',
      marginBottom: 4,
    },
    errorText: {
      fontSize: 6,
      color: '#999',
      textAlign: 'center',
    },
    setCodeText: {
      fontSize: 5,
      color: '#666',
      textAlign: 'center',
      position: 'absolute',
      bottom: 4,
      left: 0,
      right: 0,
    }
  })
}


// Card Component
const CardComponent: React.FC<{
  card: ProcessedCard
  layout: "self-cut" | "avery"
  position?: { left: number; top: number }
}> = ({ card, layout, position }) => {
  const styles = createStyles(layout)
  
  const containerStyle = layout === "avery" && position 
    ? { ...styles.cardContainer, left: position.left, top: position.top }
    : styles.cardContainer
  
  if (card.imageUrl && card.success) {
    return React.createElement(
      View,
      { style: containerStyle },
      React.createElement(Image, { src: card.imageUrl, style: styles.cardImage })
    )
  }


  // Placeholder for missing or failed images
  return React.createElement(
    View,
    { style: containerStyle },
    React.createElement(
      View,
      { style: styles.placeholderContainer },
      React.createElement(Text, { style: styles.placeholderText }, card.name),
      React.createElement(
        Text,
        { style: styles.errorText },
        card.success === false ? "(Error loading)" : "(Image not found)"
      ),
      card.setCode
        ? React.createElement(
            Text,
            { style: styles.setCodeText },
            `[${card.setCode.toUpperCase()}]`
          )
        : null
    )
  )
}


// PDF Document Component
const CardsPDFDocument: React.FC<{
  cards: ProcessedCard[]
  layout: "self-cut" | "avery"
}> = ({ cards, layout }) => {
  const styles = createStyles(layout)
  const cardsPerPage = layout === "avery" ? 6 : 9

  // Avery layout calculations
  const cardWidth = 180
  const cardHeight = 255.6
  const gapX = 72
  const gapY = 28.8
  const cols = 3
  const rows = 2
  const pageWidth = 792
  const pageHeight = 612
  
  const totalWidth = cols * cardWidth + (cols - 1) * gapX
  const totalHeight = rows * cardHeight + (rows - 1) * gapY
  const startX = (pageWidth - totalWidth) / 2
  const startY = (pageHeight - totalHeight) / 2

  // Split cards into pages
  const pages: ProcessedCard[][] = []
  for (let i = 0; i < cards.length; i += cardsPerPage) {
    pages.push(cards.slice(i, i + cardsPerPage))
  }

  return React.createElement(
    Document,
    null,
    pages.map((pageCards: ProcessedCard[], pageIndex: number) =>
      React.createElement(
        Page,
        {
          key: pageIndex,
          size: "LETTER",
          orientation: layout === "avery" ? "landscape" : "portrait",
          style: styles.page,
        },
        pageCards.map((card: ProcessedCard, cardIndex: number) => {
          if (layout === "avery") {
            // Calculate position for 3x2 grid
            const row = Math.floor(cardIndex / cols)
            const col = cardIndex % cols
            const left = startX + col * (cardWidth + gapX)
            const top = startY + row * (cardHeight + gapY)
            
            return React.createElement(CardComponent, {
              key: `${pageIndex}-${cardIndex}`,
              card,
              layout,
              position: { left, top },
            })
          } else {
            return React.createElement(CardComponent, {
              key: `${pageIndex}-${cardIndex}`,
              card,
              layout,
            })
          }
        })
      )
    )
  )
}


export interface PostRequestBody {
  cards: ParsedCard[]
  layout?: "self-cut" | "avery"
}


export interface UniqueCard {
  name: string
  setCode?: string
}


export interface ImageData {
  imageUrl: string | null
  success: boolean
}


export async function POST(request: NextRequest) {
  try {
    const { cards, layout = "self-cut" }: { 
      cards: ParsedCard[]
      layout?: "self-cut" | "avery" 
    } = await request.json()


    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: "No cards provided" }, { status: 400 })
    }


    console.log(`Processing ${cards.length} card entries for ${layout} layout`)


    // Get unique cards to avoid duplicate API calls
    const uniqueCardsMap = new Map<string, { name: string; setCode?: string }>()
    for (const card of cards) {
      const key = (card.name + (card.setCode || "")).toLowerCase()
      if (!uniqueCardsMap.has(key)) {
        uniqueCardsMap.set(key, { name: card.name, setCode: card.setCode })
      }
    }


    console.log(`Fetching ${uniqueCardsMap.size} unique cards`)


    // Fetch all unique card images
    const uniqueCardsArray = Array.from(uniqueCardsMap.values())
    const imagePromises = uniqueCardsArray.map(async (card) => {
      try {
        const imageUrl = await fetchCardImage(card.name, card.setCode)
        const key = (card.name + (card.setCode || "")).toLowerCase()
        return { key, imageUrl, success: !!imageUrl, name: card.name, setCode: card.setCode }
      } catch (error) {
        console.error(`Failed to process card ${card.name}:`, error)
        const key = (card.name + (card.setCode || "")).toLowerCase()
        return { key, imageUrl: null, success: false, name: card.name, setCode: card.setCode }
      }
    })


    const images = await Promise.all(imagePromises)
    const imageDataMap = new Map<string, { imageUrl: string | null; success: boolean }>()
    
    images.forEach(({ key, imageUrl, success }) => {
      imageDataMap.set(key, { imageUrl, success })
    })


    console.log(`Successfully loaded ${images.filter(img => img.success).length}/${images.length} images`)


    // Create processed cards array with quantities
    const processedCards: ProcessedCard[] = []
    
    for (const card of cards) {
      const key = (card.name + (card.setCode || "")).toLowerCase()
      const imageData = imageDataMap.get(key)
      
      // Add card multiple times based on quantity
      for (let i = 0; i < card.quantity; i++) {
        processedCards.push({
          name: card.name,
          imageUrl: imageData?.imageUrl || null,
          setCode: card.setCode,
          success: imageData?.success || false
        })
      }
    }


    console.log(`Will generate ${processedCards.length} total card instances`)


    // Generate PDF using React-PDF
    const pdfDocument = React.createElement(CardsPDFDocument, { cards: processedCards, layout });


    const pdfBuffer = await pdf(pdfDocument).toBuffer()


    console.log(`Generated PDF with ${processedCards.length} cards`)


    // Return PDF with proper headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="proxyprint-cards.pdf"',
        // "Content-Length": pdfBuffer.length.toString(),
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
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 },
    )
  }
}
