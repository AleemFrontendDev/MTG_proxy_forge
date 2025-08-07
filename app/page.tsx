"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, Download, FileText, Eye, ArrowLeft, X, Scroll, Sparkles, Edit2 } from 'lucide-react'

interface ParsedCard {
  quantity: number
  name: string
  id: string
}

interface CardImage {
  name: string
  imageUrl: string | null
  error?: string
}

export default function Home() {
  const [inputValue, setInputValue] = useState("")
  const [cards, setCards] = useState<ParsedCard[]>([])
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [error, setError] = useState("")
  const [pdfUrl, setPdfUrl] = useState("")
  const [cardImages, setCardImages] = useState<CardImage[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [cardCount, setCardCount] = useState(0)
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const parseInput = (value: string): ParsedCard[] => {
    if (!value.trim()) return []
    
    // Enhanced parsing: split by numbers at the beginning of entries
    const entries: ParsedCard[] = []
    
    // Match pattern: number followed by card name, then optionally another number
    const regex = /(\d+)\s+([^0-9]+?)(?=\s*\d+|$)/g
    let match
    
    while ((match = regex.exec(value)) !== null) {
      const quantity = Number.parseInt(match[1])
      const name = match[2].trim()
      
      if (name && quantity > 0) {
        entries.push({
          quantity,
          name,
          id: `${name}-${entries.length}-${Date.now()}`
        })
      }
    }
    
    return entries
  }

  const handleInputChange = (value: string) => {
    setInputValue(value)
    const parsed = parseInput(value)
    setCards(parsed)
    
    const total = parsed.reduce((sum, card) => sum + card.quantity, 0)
    setCardCount(total)
  }

  const removeCard = (cardId: string) => {
    const updatedCards = cards.filter(card => card.id !== cardId)
    setCards(updatedCards)
    
    // Rebuild input value
    const newInputValue = updatedCards
      .map(card => `${card.quantity} ${card.name}`)
      .join(' ')
    setInputValue(newInputValue)
    
    const total = updatedCards.reduce((sum, card) => sum + card.quantity, 0)
    setCardCount(total)
  }

  const startEditCard = (card: ParsedCard) => {
    setEditingCard(card.id)
    setEditValue(`${card.quantity} ${card.name}`)
  }

  const saveEditCard = (cardId: string) => {
    const match = editValue.match(/^(\d+)\s+(.+)$/)
    if (match) {
      const quantity = Number.parseInt(match[1])
      const name = match[2].trim()
      
      const updatedCards = cards.map(card => 
        card.id === cardId 
          ? { ...card, quantity, name }
          : card
      )
      
      setCards(updatedCards)
      
      // Rebuild input value
      const newInputValue = updatedCards
        .map(card => `${card.quantity} ${card.name}`)
        .join(' ')
      setInputValue(newInputValue)
      
      const total = updatedCards.reduce((sum, card) => sum + card.quantity, 0)
      setCardCount(total)
    }
    
    setEditingCard(null)
    setEditValue("")
  }

  const cancelEditCard = () => {
    setEditingCard(null)
    setEditValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && inputValue === '' && cards.length > 0) {
      const lastCard = cards[cards.length - 1]
      removeCard(lastCard.id)
    }
    if (e.key === 'Enter' && cards.length > 0) {
      e.preventDefault()
      handlePreview()
    }
  }

  const fetchCardImage = async (cardName: string): Promise<CardImage> => {
    try {
      const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`)

      if (!response.ok) {
        return { name: cardName, imageUrl: null, error: "Card not found" }
      }

      const cardData = await response.json()

      if (cardData.card_faces && cardData.card_faces[0]?.image_uris?.normal) {
        return { name: cardName, imageUrl: cardData.card_faces[0].image_uris.normal }
      }

      if (cardData.image_uris?.normal) {
        return { name: cardName, imageUrl: cardData.image_uris.normal }
      }

      return { name: cardName, imageUrl: null, error: "No image available" }
    } catch (error) {
      return { name: cardName, imageUrl: null, error: "Failed to fetch" }
    }
  }

  const handlePreview = async () => {
    if (cards.length === 0) {
      setError("Please enter some cards first")
      return
    }

    setIsLoadingPreview(true)
    setError("")
    setCardImages([])

    try {
      const expandedCards: string[] = []
      for (const card of cards) {
        for (let i = 0; i < card.quantity; i++) {
          expandedCards.push(card.name)
        }
      }

      const images: CardImage[] = []
      for (const cardName of expandedCards) {
        const cardImage = await fetchCardImage(cardName)
        images.push(cardImage)
      }

      setCardImages(images)
      setShowPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true)
    setError("")

    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cards }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = "Failed to generate PDF"

        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }

        throw new Error(errorMessage)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (err) {
      console.error("Generation error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const handleDownload = () => {
    if (pdfUrl) {
      const a = document.createElement("a")
      a.href = pdfUrl
      a.download = "mtg-proxy-cards.pdf"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const handleBackToInput = () => {
    setShowPreview(false)
    setCardImages([])
    setPdfUrl("")
    setError("")
  }

  // Professional color variants for card pills
  const getCardPillStyle = (index: number) => {
    const variants = [
      "bg-primary text-primary-foreground border-primary/20", 
      "bg-teal-600 text-white border-teal-500", 
      "bg-teal-700 text-white border-teal-600", 
      "bg-primary/90 text-primary-foreground border-primary/30", 
      "bg-teal-500 text-white border-teal-400", 
    ]
    return variants[index % variants.length]
  }

  if (showPreview) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header with Generate PDF Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:hidden">
            
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-serif">Card Preview</h1>
                <p className="text-white">Total cards: {cardCount}</p>
                <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={handleBackToInput} 
                className="border-border text-card-foreground hover:bg-muted hover:text-card-foreground bg-card"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Input
              </Button>
              <div>
              </div>
            </div>
            
            {/* Generate PDF Button - Always visible at top */}
            <div className="flex gap-2">
              <Button 
                onClick={handleGeneratePdf} 
                disabled={isGeneratingPdf} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Scroll className="mr-2 h-4 w-4" />
                    Generate PDF
                  </>
                )}
              </Button>
              
              {pdfUrl && (
                <Button 
                  onClick={handleDownload} 
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}
            </div>
          </div>

          {/* For Pc*/}

          <div className="hidden sm:flex sm:flex-row sm:items-center sm:justify-between gap-4 mb-6
">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={handleBackToInput} 
                className="border-border text-card-foreground hover:bg-muted hover:text-card-foreground bg-card"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Input
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-serif">Card Preview</h1>
                <p className="text-white">Total cards: {cardCount}</p>
              </div>
            </div>
            
            {/* Generate PDF Button - Always visible at top */}
            <div className="flex gap-3">
              <Button 
                onClick={handleGeneratePdf} 
                disabled={isGeneratingPdf} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Scroll className="mr-2 h-4 w-4" />
                    Generate PDF
                  </>
                )}
              </Button>
              
              {pdfUrl && (
                <Button 
                  onClick={handleDownload} 
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}
            </div>
          </div>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview Grid - Only show cards that exist, no empty slots */}
          <div className="space-y-8">
            {Array.from({ length: Math.ceil(cardImages.length / 9) }, (_, pageIndex) => {
              const pageCards = cardImages.slice(pageIndex * 9, (pageIndex + 1) * 9)
              
              return (
                <Card key={pageIndex} className="bg-card border-border shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-card-foreground font-serif">Page {pageIndex + 1}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Cards {pageIndex * 9 + 1} - {Math.min((pageIndex + 1) * 9, cardImages.length)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {pageCards.map((card, cardIndex) => (
                        <div
                          key={`${pageIndex}-${cardIndex}`}
                          className="w-full max-w-[280px] mx-auto"
                        >
                          <div className="aspect-[2.5/3.5] border-2 border-dashed border-border rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center hover:border-primary/50 transition-colors">
                            {card.imageUrl ? (
                              <img
                                src={card.imageUrl || "/placeholder.svg"}
                                alt={card.name}
                                className="w-full h-full object-cover rounded-md"
                                crossOrigin="anonymous"
                              />
                            ) : (
                              <div className="text-center p-3">
                                <p className="text-sm font-medium text-card-foreground mb-1 break-words">
                                  {card.name}
                                </p>
                                <p className="text-xs text-destructive">{card.error || "No image"}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 mt-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground font-serif">
              MTG Proxy Forge
            </h1>
            <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          </div>
          <p className="text-muted-foreground text-white sm:text-lg px-4">
            Craft printable proxy cards from your Magic: The Gathering collection
          </p>
        </div>

        {/* PDF Download Button - Top Right on larger screens */}
        {pdfUrl && (
          <div className="hidden lg:block fixed top-6 right-6 z-50">
            <Button 
              onClick={handleDownload} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
              size="lg"
            >
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        )}

        {/* Main Input Card */}
        <Card className="mb-8 bg-card border-border shadow-lg pb-[60px] pt-[40px]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-card-foreground font-serif text-xl sm:text-2xl">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              Enter Your Cards
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm sm:text-base">
              Type your cards like: <span className="text-primary font-mono text-xs sm:text-sm">1 Sol Ring 2 Lightning Bolt 3 Path to Exile</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Input Field */}
            <div className="space-y-2">
              <Label htmlFor="cardInput" className="text-card-foreground font-medium">
                Card List
              </Label>
              <div className="relative">
                <Input
                  ref={inputRef}
                  id="cardInput"
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="1 Sol Ring 2 Lightning Bolt 3 Path to Exile..."
                  className="text-base sm:text-lg py-6 bg-input  text-card-foreground placeholder:text-muted-foreground "
                />
                {cards.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Badge variant="secondary" className="bg-secondary text-secondary-foreground border-border text-xs sm:text-sm">
                      {cardCount} cards
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Live Preview Pills */}
            {cards.length > 0 && (
              <div className="space-y-3">
                <Label className="text-card-foreground font-medium">Live Preview</Label>
                <div className="flex flex-wrap gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                  <TooltipProvider>
                    {cards.map((card, index) => (
                      <Tooltip key={card.id}>
                        <TooltipTrigger asChild>
                          <div className={`group flex items-center gap-2 ${getCardPillStyle(index)} border rounded-full px-4 py-2 hover:shadow-md transition-all duration-200 animate-in slide-in-from-bottom-2`}>
                            {editingCard === card.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditCard(card.id)
                                    if (e.key === 'Escape') cancelEditCard()
                                  }}
                                  className="h-6 text-xs bg-white text-gray-800 border-0 min-w-[120px]"
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveEditCard(card.id)}
                                  className="text-white hover:text-green-200 text-xs"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={cancelEditCard}
                                  className="text-white hover:text-red-200 text-xs"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs sm:text-sm font-bold bg-black/20 rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center border border-white/20">
                                  {card.quantity}
                                </span>
                                <span className="font-semibold max-w-[120px] sm:max-w-[200px] truncate text-sm sm:text-base drop-shadow-sm">
                                  {card.name}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => startEditCard(card)}
                                    className="hover:text-white/80 transition-colors"
                                    title="Edit card"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => removeCard(card.id)}
                                    className="hover:text-red-200 transition-colors"
                                    title="Remove card"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-card border-border text-card-foreground">
                          <p>{card.quantity}x {card.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </TooltipProvider>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Mobile PDF Download Button */}
            {pdfUrl && (
              <div className="lg:hidden">
                <Button 
                  onClick={handleDownload} 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  size="lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            )}

            {/* Action Button */}
            <Button 
              onClick={handlePreview} 
              disabled={isLoadingPreview || cards.length === 0} 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base sm:text-lg py-4 sm:py-6 shadow-lg" 
              size="lg"
            >
              {isLoadingPreview ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  Fetching Cards...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Preview Cards ({cardCount} total)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-white text-xs sm:text-sm">
          <p className="flex items-center justify-center gap-2 flex-wrap">
            <Sparkles className="h-4 w-4" />
            <span>Powered by Scryfall API • For playtesting purposes only</span>
            <Sparkles className="h-4 w-4" />
          </p>
        </div>
      </div>
    </div>
  )
}
