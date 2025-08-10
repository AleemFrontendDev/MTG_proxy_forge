"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, Download, FileText, Eye, ArrowLeft, X, Scroll, Edit2, Printer } from "lucide-react"

interface ParsedCard {
  quantity: number
  name: string
  id: string
  setCode?: string
  cardNumber?: string
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
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [cardCount, setCardCount] = useState(0)
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  const parseInput = (value: string): ParsedCard[] => {
    if (!value.trim()) return []

    const lines = value.trim().split("\n")
    const entries: ParsedCard[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Match pattern: [quantity] [card name] [optional set code] [optional card number]
      const match = line.match(/^(\d+)\s+(.+?)(?:\s+\[([A-Z0-9]+)\])?(?:\s+(\d+))?$/i)

      if (match) {
        const quantity = Number.parseInt(match[1])
        const name = match[2].trim()
        const setCode = match[3]?.toUpperCase()
        const cardNumber = match[4]

        if (name && quantity > 0) {
          entries.push({
            quantity,
            name,
            setCode,
            cardNumber,
            id: `${name}-${i}-${Date.now()}`,
          })
        }
      }
    }

    return entries
  }

  const handleInputChange = async (value: string) => {
    setInputValue(value)
    const parsed = parseInput(value)
    setCards(parsed)

    const total = parsed.reduce((sum, card) => sum + card.quantity, 0)
    setCardCount(total)

    // Auto-fetch card images for live preview
    if (parsed.length > 0 && parsed.length <= 20) {
      // Limit to prevent too many API calls
      setIsLoadingPreview(true)
      try {
        const expandedCards: Array<{ name: string; setCode?: string }> = []
        for (const card of parsed) {
          for (let i = 0; i < Math.min(card.quantity, 3); i++) {
            // Limit preview to 3 per card
            expandedCards.push({ name: card.name, setCode: card.setCode })
          }
        }

        const images: CardImage[] = []
        for (const card of expandedCards.slice(0, 9)) {
          // Show max 9 cards in preview
          const cardImage = await fetchCardImage(card.name, card.setCode)
          images.push(cardImage)
        }

        setCardImages(images)
      } catch (err) {
        console.error("Preview error:", err)
      } finally {
        setIsLoadingPreview(false)
      }
    } else {
      setCardImages([])
    }
  }

  const removeCard = (cardId: string) => {
    const updatedCards = cards.filter((card) => card.id !== cardId)
    setCards(updatedCards)

    // Rebuild input value
    const newInputValue = updatedCards
      .map((card) => {
        let line = `${card.quantity} ${card.name}`
        if (card.setCode) line += ` [${card.setCode}]`
        if (card.cardNumber) line += ` ${card.cardNumber}`
        return line
      })
      .join("\n")
    setInputValue(newInputValue)

    const total = updatedCards.reduce((sum, card) => sum + card.quantity, 0)
    setCardCount(total)
  }

  const startEditCard = (card: ParsedCard) => {
    setEditingCard(card.id)
    let editText = `${card.quantity} ${card.name}`
    if (card.setCode) editText += ` [${card.setCode}]`
    if (card.cardNumber) editText += ` ${card.cardNumber}`
    setEditValue(editText)
  }

  const saveEditCard = (cardId: string) => {
    const match = editValue.match(/^(\d+)\s+(.+?)(?:\s+\[([A-Z0-9]+)\])?(?:\s+(\d+))?$/i)
    if (match) {
      const quantity = Number.parseInt(match[1])
      const name = match[2].trim()
      const setCode = match[3]?.toUpperCase()
      const cardNumber = match[4]

      const updatedCards = cards.map((card) =>
        card.id === cardId ? { ...card, quantity, name, setCode, cardNumber } : card,
      )

      setCards(updatedCards)

      // Rebuild input value
      const newInputValue = updatedCards
        .map((card) => {
          let line = `${card.quantity} ${card.name}`
          if (card.setCode) line += ` [${card.setCode}]`
          if (card.cardNumber) line += ` ${card.cardNumber}`
          return line
        })
        .join("\n")
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
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && cards.length > 0) {
      e.preventDefault()
      handleGeneratePdf()
    }
  }

  const fetchCardImage = async (cardName: string, setCode?: string): Promise<CardImage> => {
    try {
      let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`
      if (setCode) {
        url += `&set=${setCode.toLowerCase()}`
      }

      const response = await fetch(url)

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

  const handleGeneratePdf = async () => {
    if (cards.length === 0) {
      setError("Please enter some cards first")
      return
    }

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
      setShowPdfPreview(true)
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
      a.download = "proxyprint-cards.pdf"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const handlePrint = () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl)
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
        }
      }
    }
  }

  const handleBackToInput = () => {
    setShowPdfPreview(false)
    setPdfUrl("")
    setError("")
  }

  // Professional color variants for card pills
  const getCardPillStyle = (index: number) => {
    const variants = [
      "bg-orange-500 text-white border-orange-400",
      "bg-orange-600 text-white border-orange-500",
      "bg-orange-700 text-white border-orange-600",
      "bg-orange-400 text-white border-orange-300",
      "bg-orange-800 text-white border-orange-700",
    ]
    return variants[index % variants.length]
  }

  if (showPdfPreview) {
    return (
      <div className="min-h-screen bg-gray-50 relative overflow-hidden">
        {/* Glass effect background with orange drops */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-orange-50/20 to-orange-100/30"></div>
        <div className="absolute inset-0 backdrop-blur-[1px]"></div>

        {/* Orange glass drops */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange-200/20 rounded-full blur-xl"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-orange-300/15 rounded-full blur-lg"></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-orange-100/25 rounded-full blur-2xl"></div>
        <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-orange-200/20 rounded-full blur-xl"></div>
        <div className="absolute top-1/3 left-1/2 w-20 h-20 bg-orange-400/10 rounded-full blur-lg"></div>

        <div className="p-4 sm:p-6 lg:p-8 relative z-10">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleBackToInput}
                  className="border-gray-300 bg-white/80 backdrop-blur-sm group transition-all duration-200 hover:bg-white/90"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span className="text-gray-700 group-hover:text-gray-900 transition-colors duration-200">
                    Back to Input
                  </span>
                </Button>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-serif">PDF Preview</h1>
                  <p className="text-gray-600">Total cards: {cardCount}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handlePrint}
                  className="bg-gray-800 hover:bg-gray-900 text-white font-semibold shadow-lg"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button
                  onClick={handleDownload}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* PDF Preview */}
            <Card className="bg-white/80 backdrop-blur-sm border-gray-200 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-gray-900 font-serif">PDF Preview</CardTitle>
                <CardDescription className="text-gray-600">Your proxy cards are ready for printing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[600px] border border-gray-300 rounded-lg overflow-hidden bg-white">
                  {pdfUrl ? (
                    <iframe src={pdfUrl} className="w-full h-full" title="PDF Preview" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-2" />
                        <p className="text-gray-600">Loading PDF preview...</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Glass effect background with orange drops */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-orange-50/20 to-orange-100/30"></div>
      <div className="absolute inset-0 backdrop-blur-[1px]"></div>

      {/* Orange glass drops */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-orange-200/20 rounded-full blur-xl"></div>
      <div className="absolute top-40 right-20 w-24 h-24 bg-orange-300/15 rounded-full blur-lg"></div>
      <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-orange-100/25 rounded-full blur-2xl"></div>
      <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-orange-200/20 rounded-full blur-xl"></div>
      <div className="absolute top-1/3 left-1/2 w-20 h-20 bg-orange-400/10 rounded-full blur-lg"></div>
      <div className="absolute top-60 left-1/3 w-16 h-16 bg-orange-300/20 rounded-full blur-md"></div>

      <div className="p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#f97316] font-serif drop-shadow-sm">
                ProxyPrintr
              </h1>
            </div>
            <p className="text-gray-600 text-base sm:text-lg px-4">
              Craft printable proxy cards from your Magic: The Gathering collection
            </p>
          </div>

          {/* Main Input Card */}
          <Card className="mb-8 bg-white/80 backdrop-blur-sm border-gray-200 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-gray-900 font-serif text-xl sm:text-2xl">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-[#f97316]" />
                Enter Your Cards
              </CardTitle>
              <CardDescription className="text-gray-600 text-sm sm:text-base">
                Enter each card on a new line:{" "}
                <span className="text-orange-500 font-mono text-xs sm:text-sm">1 Sol Ring</span> or{" "}
                <span className="text-orange-500 font-mono text-xs sm:text-sm">2 Lightning Bolt [M21] 123</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Textarea Field */}
              <div className="space-y-2">
                <Label htmlFor="cardInput" className="text-gray-900 font-medium">
                  Card List (one per line)
                </Label>
                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    id="cardInput"
                    value={inputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`1 Sol Ring
2 Lightning Bolt
3 Path to Exile [TSR] 299
1 Black Lotus [LEA]`}
                    className="min-h-[200px] text-base sm:text-lg py-3 bg-white/70 backdrop-blur-sm border-gray-300 text-gray-900 resize-y"
                    rows={8}
                  />
                  {cards.length > 0 && (
                    <div className="absolute right-3 top-3">
                      <Badge
                        variant="secondary"
                        className="bg-gray-100/80 backdrop-blur-sm text-gray-700 border-gray-300 text-xs sm:text-sm"
                      >
                        {cardCount} cards
                      </Badge>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Press Ctrl+Enter to generate PDF • Format: [quantity] [card name] [set code] [card number]
                </p>
              </div>

              {/* Card Pills */}
              {cards.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-gray-900 font-medium">Card Summary</Label>
                  <div className="flex flex-wrap gap-3 p-4 bg-gray-100/60 backdrop-blur-sm rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                    <TooltipProvider>
                      {cards.map((card, index) => (
                        <Tooltip key={card.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={`group flex items-center gap-2 ${getCardPillStyle(index)} border rounded-full px-4 py-2 hover:shadow-md transition-all duration-200 animate-in slide-in-from-bottom-2`}
                            >
                              {editingCard === card.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveEditCard(card.id)
                                      if (e.key === "Escape") cancelEditCard()
                                    }}
                                    className="h-6 text-xs bg-white text-gray-800 border-0 min-w-[120px] rounded px-2"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => saveEditCard(card.id)}
                                    className="text-white hover:text-green-200 text-xs"
                                  >
                                    ✓
                                  </button>
                                  <button onClick={cancelEditCard} className="text-white hover:text-red-200 text-xs">
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
                                  {(card.setCode || card.cardNumber) && (
                                    <span className="text-xs opacity-80">
                                      {card.setCode && `[${card.setCode}]`}
                                      {card.cardNumber && ` ${card.cardNumber}`}
                                    </span>
                                  )}
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
                          <TooltipContent className="bg-white border-gray-200 text-gray-900">
                            <p>
                              {card.quantity}x {card.name}
                              {card.setCode && ` [${card.setCode}]`}
                              {card.cardNumber && ` ${card.cardNumber}`}
                            </p>
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
            </CardContent>
          </Card>

          {/* Live Preview Section - Moved Below */}
          {cards.length > 0 && (
            <Card className="mb-8 bg-white/80 backdrop-blur-sm border-gray-200 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-gray-900 font-serif text-xl sm:text-2xl">
                  <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
                  Live Preview
                </CardTitle>
                <CardDescription className="text-gray-600 text-sm sm:text-base">
                  {cardImages.length > 0 ? `Showing first ${cardImages.length} cards` : "Loading card images..."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPreview ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-2" />
                      <p className="text-gray-600">Loading card images...</p>
                    </div>
                  </div>
                ) : cardImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {cardImages.map((card, index) => (
                      <div
                        key={index}
                        className="aspect-[2.5/3.5] border border-gray-300 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center hover:border-orange-400 transition-colors shadow-sm"
                      >
                        {card.imageUrl ? (
                          <img
                            src={card.imageUrl || "/placeholder.svg"}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <div className="text-center p-2">
                            <p className="text-xs font-medium text-gray-900 mb-1 break-words">{card.name}</p>
                            <p className="text-xs text-red-600">{card.error || "No image"}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Generate PDF Button - Moved Below Live Preview */}
          {cards.length > 0 && (
            <div className="mb-8">
              <Button
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="w-full bg-[#f97316] hover:bg-orange-600 text-white font-semibold text-base sm:text-lg py-4 sm:py-6 shadow-lg"
                size="lg"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Scroll className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    Generate PDF ({cardCount} cards)
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-gray-500 text-xs sm:text-sm">
            <p className="flex items-center justify-center gap-2 flex-wrap">
              <span>Powered by ProxyPrintr • For playtesting purposes only</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
