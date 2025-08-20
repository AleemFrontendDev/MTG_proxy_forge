"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ExternalLink, CheckCircle, Star, Package, Shield } from "lucide-react"
import Link from "next/link"

export default function ProductsPage() {
  return ( 
    <div className="min-h-screen min-bg-img">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/">
              <Button variant="outline" className="border-midnight-300 text-midnight-700 hover:bg-midnight-50 bg-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to ProxyPrintr
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white">Printing Supplies</h1>
              <p className="text-white">Get the best materials for your proxy cards</p>
            </div>
          </div>

          {/* Featured Product - Avery 95328 */}
          <Card className="mb-8 bg-white/90 backdrop-blur-sm border-coquelicot-200 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-coquelicot-500 to-coquelicot-600 text-white rounded-t-lg">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl font-serif mb-2">Avery 95328 Business Card Sheets</CardTitle>
                  <CardDescription className="text-coquelicot-100 text-lg">
                    Perfect for Magic: The Gathering proxy cards
                  </CardDescription>
                </div>
                <Badge className="bg-white text-coquelicot-600 font-bold">Recommended</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-serif font-semibold text-midnight-800 mb-3">
                    Why Avery 95328 is Perfect for Proxies:
                  </h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-midnight-700">
                        <strong>Exact MTG card size:</strong> 2.5" × 3.5" matches official Magic cards perfectly
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-midnight-700">
                        <strong>Premium cardstock:</strong> 110lb weight feels substantial and professional
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-midnight-700">
                        <strong>Clean separation:</strong> Micro-perforated edges for smooth, professional cuts
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-midnight-700">
                        <strong>Efficient layout:</strong> 6 cards per sheet (3×2 grid) minimizes waste
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-midnight-700">
                        <strong>Inkjet & laser compatible:</strong> Works with any home printer
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="bg-midnight-50 rounded-lg p-4">
                  <h4 className="font-serif font-semibold text-midnight-800 mb-3">Product Specifications:</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-midnight-600">Card Size:</span>
                      <span className="font-medium text-midnight-800">2.5" × 3.5"</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-midnight-600">Cards per Sheet:</span>
                      <span className="font-medium text-midnight-800">6 (3×2 grid)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-midnight-600">Paper Weight:</span>
                      <span className="font-medium text-midnight-800">110lb cardstock</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-midnight-600">Sheets per Pack:</span>
                      <span className="font-medium text-midnight-800">25 sheets</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-midnight-600">Total Cards:</span>
                      <span className="font-medium text-midnight-800">150 cards per pack</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase Options */}
              <div className="border-t border-midnight-200 pt-6">
                <h3 className="font-serif font-semibold text-midnight-800 mb-4">Where to Buy:</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <a
                    href="https://www.amazon.com/dp/B00006B8XZ?tag=proxyprintr-20"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer border-coquelicot-200 hover:border-coquelicot-300 bg-white">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-coquelicot-600" />
                            <span className="font-semibold text-midnight-800">Amazon</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-midnight-500" />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                          <span className="text-sm text-midnight-600">(4.5/5 • 2,000+ reviews)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-midnight-600">
                          <Shield className="h-4 w-4" />
                          <span>Prime shipping available</span>
                        </div>
                      </CardContent>
                    </Card>
                  </a>

                  <a
                    href="https://www.avery.com/products/business-cards/95328"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer border-midnight-200 hover:border-midnight-300 bg-white">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-midnight-600" />
                            <span className="font-semibold text-midnight-800">Avery.com</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-midnight-500" />
                        </div>
                        <p className="text-sm text-midnight-600 mb-2">Direct from manufacturer</p>
                        <div className="flex items-center gap-2 text-sm text-midnight-600">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span>Bulk pricing available</span>
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Products */}
          {/* <Card className="mb-8 bg-white/90 backdrop-blur-sm border-midnight-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-serif text-midnight-800">Other Recommended Supplies</CardTitle>
              <CardDescription className="text-midnight-600">Complete your proxy card setup</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-serif font-semibold text-midnight-800">For Self-Cut Layout:</h3>
                  <div className="bg-midnight-50 rounded-lg p-4">
                    <h4 className="font-medium text-midnight-800 mb-2">Premium Cardstock</h4>
                    <p className="text-sm text-midnight-600 mb-3">
                      110lb+ cardstock for professional feel and durability
                    </p>
                    <a
                      href="https://www.amazon.com/s?k=110lb+cardstock&tag=proxyprintr-20"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-coquelicot-600 hover:text-coquelicot-800 font-medium"
                    >
                      Shop Cardstock <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
-
                <div className="space-y-4">
                  <h3 className="font-serif font-semibold text-midnight-800">Protection & Storage:</h3>
                  <div className="bg-tangerine-50 rounded-lg p-4">
                    <h4 className="font-medium text-midnight-800 mb-2">Card Sleeves</h4>
                    <p className="text-sm text-midnight-600 mb-3">Protect your proxy cards during gameplay</p>
                    <a
                      href="https://www.amazon.com/s?k=mtg+card+sleeves&tag=proxyprintr-20"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-tangerine-700 hover:text-tangerine-800 font-medium"
                    >
                      Shop Sleeves <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card> */}

          {/* Coming Soon */}
          <Card className="bg-gradient-to-r from-tangerine-50 to-coquelicot-50 border-tangerine-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl font-serif text-midnight-800">Coming Soon from ProxyPrintr</CardTitle>
              <CardDescription className="text-midnight-700">
                Exciting new features and products in development
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-serif font-semibold text-midnight-800 mb-3">Custom Templates</h3>
                  <ul className="space-y-2 text-sm text-midnight-700">
                    <li>• Premium card backs and borders</li>
                    <li>• Vintage and modern frame styles</li>
                    <li>• Custom watermarks and branding</li>
                    <li>• Tournament-legal proxy indicators</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-midnight-800 mb-3">ProxyPrintr Supplies</h3>
                  <ul className="space-y-2 text-sm text-midnight-700">
                    <li>• Pre-cut card sheets optimized for proxies</li>
                    <li>• Professional printing service</li>
                    <li>• Bulk pricing for playgroups</li>
                    <li>• Custom deck boxes and accessories</li>
                  </ul>
                </div>
              </div>
              <div className="mt-6 p-4 bg-white/60 rounded-lg">
                <p className="text-sm text-midnight-600 text-center">
                  Want to be notified when these features launch?{" "}
                  <a
                    href="mailto:updates@proxyprintr.com"
                    className="text-coquelicot-600 hover:text-coquelicot-800 font-medium"
                  >
                    Join our mailing list
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-white text-sm mt-8">
            <p>
              ProxyPrintr may earn a commission from purchases made through affiliate links. This helps support the
              development of new features at no extra cost to you.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
