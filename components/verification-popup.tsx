"use client"

import { useEffect } from "react"
import { CheckCircle2, XCircle, X, User, Mail, Phone, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { UserRecord } from "@/lib/supabase"

interface VerificationPopupProps {
  isOpen: boolean
  onClose: () => void
  userRecord: UserRecord | null
  qrCode: string
  isLoading: boolean
  error: string | null
}

export function VerificationPopup({ isOpen, onClose, userRecord, qrCode, isLoading, error }: VerificationPopupProps) {
  // Auto-close popup after 5 seconds for successful verification
  useEffect(() => {
    if (isOpen && userRecord && !isLoading) {
      const timer = setTimeout(() => {
        onClose()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, userRecord, isLoading, onClose])

  if (!isOpen) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-900/20 text-green-400 border-green-700"
      case "inactive":
        return "bg-gray-800 text-gray-300 border-gray-600"
      case "suspended":
        return "bg-red-900/20 text-red-400 border-red-700"
      default:
        return "bg-[#ff7700]/10 text-[#ff7700] border-[#ff7700]/30"
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md mx-auto bg-gray-900 border-gray-700 shadow-2xl">
        <CardHeader className="relative">
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </Button>

          {isLoading ? (
            <CardTitle className="flex items-center gap-2 text-[#ff7700]">
              <div className="w-5 h-5 border-2 border-[#ff7700] border-t-transparent rounded-full animate-spin"></div>
              Verifying QR Code...
            </CardTitle>
          ) : error ? (
            <CardTitle className="flex items-center gap-2 text-red-400">
              <XCircle className="w-6 h-6" />
              Verification Error
            </CardTitle>
          ) : userRecord ? (
            <CardTitle className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-6 h-6" />
              Verification Successful
            </CardTitle>
          ) : (
            <CardTitle className="flex items-center gap-2 text-red-400">
              <XCircle className="w-6 h-6" />
              Verification Failed
            </CardTitle>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center py-4">
              <p className="text-[#ff7700]">Checking QR code in database...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-red-400 mb-2">Database connection error</p>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : userRecord ? (
            // Success - User found
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-700">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-green-400 mb-1">QR Code Verified!</h3>
                <p className="text-green-300 text-sm">User found in database</p>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                {userRecord.name && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#ff7700]" />
                    <span className="text-sm font-medium text-[#ff7700]">Name:</span>
                    <span className="text-gray-200">{userRecord.name}</span>
                  </div>
                )}

                {userRecord.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#ff7700]" />
                    <span className="text-sm font-medium text-[#ff7700]">Email:</span>
                    <span className="text-gray-200">{userRecord.email}</span>
                  </div>
                )}

                {userRecord.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#ff7700]" />
                    <span className="text-sm font-medium text-[#ff7700]">Phone:</span>
                    <span className="text-gray-200">{userRecord.phone}</span>
                  </div>
                )}

                {userRecord.status && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#ff7700]">Status:</span>
                    <Badge className={getStatusColor(userRecord.status)}>
                      {userRecord.status.charAt(0).toUpperCase() + userRecord.status.slice(1)}
                    </Badge>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#ff7700]" />
                  <span className="text-sm font-medium text-[#ff7700]">Registered:</span>
                  <span className="text-gray-200 text-sm">{new Date(userRecord.created_at).toLocaleDateString()}</span>
                </div>

                <div className="pt-2 border-t border-gray-700">
                  <span className="text-xs font-medium text-[#ff7700]">User ID:</span>
                  <div className="text-xs text-gray-300 font-mono bg-gray-800 border border-gray-600 p-1 rounded mt-1">
                    {userRecord.id}
                  </div>
                </div>
              </div>

              {userRecord.alreadyUsedToday ? (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3 mt-3">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Ya Registrado Hoy</span>
                  </div>
                  <p className="text-xs text-yellow-300 mt-1">
                    Este usuario ya utilizó este simulador hoy. No se creó un nuevo registro.
                  </p>
                </div>
              ) : (
                <div className="bg-[#ff7700]/10 border border-[#ff7700]/30 rounded-lg p-3 mt-3">
                  <div className="flex items-center gap-2 text-[#ff7700]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Attendance Recorded</span>
                  </div>
                  <p className="text-xs text-[#ff7700]/80 mt-1">
                    User attendance has been successfully recorded in the simulator system.
                  </p>
                </div>
              )}

              <div className="text-center text-xs text-gray-400">This popup will close automatically</div>
            </div>
          ) : (
            // Failure - User not found
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-700">
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-red-400 mb-1">Verification Failed</h3>
                <p className="text-red-300 text-sm">QR code not found in users database</p>
              </div>

              <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-red-400">Scanned QR Code:</span>
                    <div className="text-xs text-red-300 font-mono bg-red-900/30 border border-red-800 p-2 rounded mt-1 break-all">
                      {qrCode}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-red-800">
                    <p className="text-sm text-red-300">This QR code is not registered in the users database.</p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="w-full bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
