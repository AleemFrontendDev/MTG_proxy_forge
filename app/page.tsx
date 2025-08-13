"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Download, FileText, Eye, ArrowLeft, Scroll, Printer } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

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

function debounce<T extends (...args: any[]) => void>(func: T, wait: number) {
  let timeout: ReturnType<typeof setTimeout> | null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

const DEBOUNCE_DELAY = 500

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [selectedLayout, setSelectedLayout] = useState<"self-cut" | "avery">("self-cut")

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
      let cleanLine = line.replace(/\bF\s+/g, "")
      cleanLine = cleanLine.replace(/$$([^)]+)$$/g, "[$1]")
      const match = cleanLine.match(/^(\d+)\s+(.+?)(?:\s+\[([A-Z0-9]+)\])?(?:\s+(\d+))?$/i)
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

  const debouncedPreview = useCallback(
    debounce(async (parsed: ParsedCard[]) => {
      if (parsed.length > 0) {
        setIsLoadingPreview(true)
        setCardImages([])

        try {
          const uniqueCards: Record<string, { name: string; setCode?: string }> = {}
          for (const card of parsed) {
            const key = (card.name + (card.setCode ?? "")).toLowerCase()
            uniqueCards[key] = { name: card.name, setCode: card.setCode }
          }
          const uniqueCardArray = Object.values(uniqueCards)
          const fetchImagePromises = uniqueCardArray.map(async (card) => {
            try {
              const cardImage = await Promise.race([
                fetchCardImage(card.name, card.setCode),
                new Promise<CardImage>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000)),
              ])
              return { key: (card.name + (card.setCode ?? "")).toLowerCase(), ...cardImage }
            } catch {
              return {
                key: (card.name + (card.setCode ?? "")).toLowerCase(),
                name: card.name,
                imageUrl: null,
                error: "Failed to load",
              }
            }
          })

          const imageResults = await Promise.all(fetchImagePromises)
          const imageMap: Record<string, CardImage> = {}
          imageResults.forEach((res) => {
            imageMap[res.key] = res
          })
          const fullPreview: CardImage[] = []
          for (const card of parsed) {
            const key = (card.name + (card.setCode ?? "")).toLowerCase()
            for (let i = 0; i < card.quantity; i++) {
              fullPreview.push(imageMap[key] ?? { name: card.name, imageUrl: null, error: "No image found" })
            }
          }
          setCardImages(fullPreview)
        } catch (err) {
          console.error("Preview error:", err)
          setCardImages([])
        } finally {
          setIsLoadingPreview(false)
        }
      } else {
        setCardImages([])
      }
    }, DEBOUNCE_DELAY),
    [],
  )
  const handleInputChange = (value: string) => {
    setInputValue(value)
    const parsed = parseInput(value)
    setCards(parsed)
    const total = parsed.reduce((sum, card) => sum + card.quantity, 0)
    setCardCount(total)
    debouncedPreview(parsed)
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
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })
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
        body: JSON.stringify({ cards, layout: selectedLayout }),
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
      a.download = `proxyprint-cards-${selectedLayout}.pdf`
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
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl)
      setPdfUrl("")
    }
    setError("")
  }

  if (showPdfPreview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-midnight-50 via-white to-tangerine-50">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleBackToInput}
                  className="border-midnight-300 text-midnight-700 hover:bg-midnight-50 bg-white"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Input
                </Button>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold text-midnight-800">PDF Preview</h1>
                  <p className="text-sm text-midnight-600">
                    Layout: {selectedLayout === "self-cut" ? "Self-cut (3×3)" : "Avery 95328 (3×2)"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handlePrint}
                  className="bg-midnight-700 hover:bg-midnight-800 text-white font-semibold shadow-lg"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button
                  onClick={handleDownload}
                  className="bg-gradient-to-r from-coquelicot-500 to-coquelicot-600 hover:from-coquelicot-600 hover:to-coquelicot-700 text-white font-semibold shadow-lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                
                  <Button
                    onClick={() => window.open("/products", "_blank")}
                    variant="outline"
                    className="border-tangerine-300 text-tangerine-700 hover:bg-tangerine-50 font-semibold shadow-lg bg-white"
                  >
                    <span className="mr-2">🛒</span>
                    Get Avery Sheets
                  </Button>
                
              </div>
            </div>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Card className="bg-white/90 backdrop-blur-sm border-midnight-200 shadow-lg">
              <CardContent className="p-6">
                <div className="mb-4">
                  <p className="text-lg text-midnight-700 font-semibold">Total Cards: {cardCount}</p>
                  <p className="text-midnight-600">Your proxy cards are ready for printing!</p>
                </div>
                <div className="w-full h-[600px] border border-midnight-300 rounded-lg overflow-hidden bg-white shadow-inner">
                  {pdfUrl ? (
                    <iframe src={pdfUrl} className="w-full h-full" title="PDF Preview" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-coquelicot-500 mx-auto mb-2" />
                        <p className="text-midnight-600">Loading PDF preview...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-midnight-50 via-white to-tangerine-50">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img
                src="/proxyprintr-logo.png"
                alt="ProxyPrintr logo"
                className="h-16 w-auto rounded-lg"
                style={{ minWidth: "200px" }}
              />
            </div>
            <p className="text-midnight-600 text-base sm:text-lg px-4 font-medium">
              Craft printable proxy cards from your Magic: The Gathering collection
            </p>
          </div>

          {/* Main Input Card */}
          <Card className="mb-8 bg-white/90 backdrop-blur-sm border-midnight-200 shadow-lg">
            <CardHeader className="pb-4 bg-gradient-to-r from-midnight-700 to-midnight-800 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2 font-serif text-xl sm:text-2xl">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                Card List
              </CardTitle>
              <CardDescription className="text-midnight-100 text-sm sm:text-base">
                Enter each card on a new line using the format:{" "}
                <span className="text-white font-mono text-xs sm:text-sm bg-midnight-600 px-1 rounded">1 Sol Ring</span>{" "}
                or{" "}
                <span className="text-white font-mono text-xs sm:text-sm bg-midnight-600 px-1 rounded">
                  2 Lightning Bolt [M21] 123
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="space-y-2">
                <Label htmlFor="cardInput" className="text-midnight-800 font-semibold">
                  Enter your cards (one per line)
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
1 Black Lotus [LEA]
4 Counterspell [M21]
2 Force of Will [EMA] 49`}
                    className="min-h-[200px] text-base sm:text-lg py-3 bg-white border-midnight-300 text-midnight-800 resize-y focus:border-coquelicot-500 focus:ring-coquelicot-500/20"
                    rows={8}
                  />
                  {cards.length > 0 && (
                    <div className="absolute right-3 top-3">
                      <Badge
                        variant="secondary"
                        className="bg-tangerine-100 text-tangerine-800 border-tangerine-300 text-xs sm:text-sm font-semibold"
                      >
                        {cardCount} cards
                      </Badge>
                    </div>
                  )}
                </div>
                <p className="text-xs text-midnight-600">
                  Press Ctrl+Enter to generate PDF • Format: [quantity] [card name] [set code] [card number]
                </p>
              </div>

              {/* Layout Selection */}
              <div className="space-y-3">
                <Label className="text-midnight-800 font-semibold">Print Layout</Label>
                <RadioGroup
                  value={selectedLayout}
                  onValueChange={(value: "self-cut" | "avery") => setSelectedLayout(value)}
                  className="flex flex-col sm:flex-row gap-4"
                >
                  <div className="flex items-center space-x-2 p-3 border border-midnight-200 rounded-lg hover:bg-midnight-50 transition-colors">
                    <RadioGroupItem value="self-cut" id="self-cut" className="text-coquelicot-600" />
                    <Label htmlFor="self-cut" className="cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-semibold text-midnight-800">Self-cut</span>
                        <span className="text-xs text-midnight-600">9 cards per page (3×3 grid)</span>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border border-midnight-200 rounded-lg hover:bg-midnight-50 transition-colors">
                    <RadioGroupItem value="avery" id="avery" className="text-coquelicot-600" />
                    <Label htmlFor="avery" className="cursor-pointer">
                      <div className="flex flex-col">
                        <span className="font-semibold text-midnight-800">Avery 95328</span>
                        <span className="text-xs text-midnight-600">6 cards per page (3×2 grid, 2.5" × 3.5")</span>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {error && (
                <Alert variant="destructive" className="border-red-300 bg-red-50">
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-end mb-[10px]">
            {cards.length > 0 && (
              <Button
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="bg-gradient-to-r from-coquelicot-500 to-coquelicot-600 hover:from-coquelicot-600 hover:to-coquelicot-700 text-white font-semibold shadow-lg w-full sm:w-auto"
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
                    Generate {selectedLayout === "self-cut" ? "Self-cut" : "Avery"} PDF ({cardCount} cards)
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Live Preview Section */}
          {cards.length > 0 && (
            <Card className="mb-8 bg-white/90 backdrop-blur-sm border-midnight-200 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-midnight-700" />
                    <CardTitle className="text-midnight-800 font-serif text-lg sm:text-2xl">Live Preview</CardTitle>
                  </div>
                </div>
                <CardDescription className="text-midnight-600 text-sm sm:text-base mt-1">
                  {isLoadingPreview
                    ? "Loading card images..."
                    : cardImages.length > 0
                      ? `Showing all ${cardImages.length} cards in ${selectedLayout === "self-cut" ? "Self-cut (3×3)" : "Avery 95328 (3×2)"} layout`
                      : "Preview will appear here"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPreview ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-coquelicot-500 mx-auto mb-2" />
                      <p className="text-midnight-600">Loading card images...</p>
                      <p className="text-xs text-midnight-500 mt-1">This may take a few seconds</p>
                    </div>
                  </div>
                ) : cardImages.length > 0 ? (
                  <div
                    className={`grid gap-4 max-h-96 overflow-y-auto ${
                      selectedLayout === "self-cut"
                        ? "grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                        : "grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-3"
                    }`}
                  >
                    {cardImages.map((card, index) => (
                      <div
                        key={index}
                        className={`border border-midnight-300 rounded-lg overflow-hidden bg-midnight-50 flex items-center justify-center hover:border-coquelicot-400 transition-colors shadow-sm ${
                          selectedLayout === "self-cut" ? "aspect-[2.5/3.5]" : "aspect-[2.5/3.5]"
                        }`}
                      >
                        {card.imageUrl ? (
                          <img
                            src={card.imageUrl || "/placeholder.svg"}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                            loading="lazy"
                          />
                        ) : (
                          <div className="text-center p-2">
                            <p className="text-xs font-medium text-midnight-800 mb-1 break-words">{card.name}</p>
                            <p className="text-xs text-red-600">{card.error || "No image"}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-midnight-500">
                    <p>Enter cards above to see preview</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="text-center text-midnight-500 text-xs sm:text-sm">
            <p className="flex items-center justify-center gap-2 flex-wrap">
              <span>Powered by ProxyPrintr • For playtesting purposes only</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
