"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"

interface SurveyResponse {
  [key: string]: string
}

const surveyQuestions = [
  {
    id: "q1",
    question: "Pregunta 1",
  },
  {
    id: "q2",
    question: "Pregunta 2",
  },
  {
    id: "q3",
    question: "Pregunta 3",
  },
  {
    id: "q4",
    question: "Pregunta 4",
  },
  {
    id: "q5",
    question: "Pregunta 5",
  },
  {
    id: "q6",
    question: "Pregunta 6",
  },
]

const satisfactionLevels = [
  { value: "poco-importante", label: "Poco Importante", color: "bg-orange-500", hoverColor: "hover:bg-orange-600" },
  { value: "medio-importante", label: "Medianamente Importante", color: "bg-orange-500", hoverColor: "hover:bg-orange-600" },
  { value: "importante", label: "Importante", color: "bg-orange-500", hoverColor: "hover:bg-orange-600" },
  { value: "muy-importante", label: "Muy Importante", color: "bg-orange-500", hoverColor: "hover:bg-orange-600" },
]

export default function EncuestaPage() {
  const [responses, setResponses] = useState<SurveyResponse>({})
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleResponseChange = (questionId: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }))
  }

  const handleSubmit = () => {
    console.log("[v0] Test responses:", responses)
    setIsSubmitted(true)

    // Reset after 3 seconds for demo purposes
    setTimeout(() => {
      setIsSubmitted(false)
      setResponses({})
    }, 3000)
  }

  const isComplete = surveyQuestions.every((q) => responses[q.id])

  if (isSubmitted) {
    return (
      <div className="space-y-8">
    
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="bg-gray-800 border-gray-700 max-w-md w-full">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">¡Gracias!</h2>
                <p className="text-gray-400">
                  Tu evaluación ha sido enviada exitosamente.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <Card className="bg-gray-800 border-gray-700 p-10">
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
              <div className="lg:col-span-1">
                <h3 className="text-white font-semibold text-sm">PREGUNTA</h3>
              </div>
              <div className="lg:col-span-4 grid grid-cols-4 gap-2">
                {satisfactionLevels.map((level) => (
                  <div key={level.value} className="text-center">
                    <h4 className="text-white font-medium text-sm">{level.label}</h4>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {surveyQuestions.map((question, index) => (
                <div key={question.id} className="border-b border-gray-700 pb-6 last:border-b-0">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
                    <div className="lg:col-span-1">
                      <div className="flex items-start gap-3">
                        
                        <p className="text-white text-sm font-medium leading-relaxed">{question.question}</p>
                      </div>
                    </div>

                    <div className="lg:col-span-4 grid grid-cols-4 gap-2">
                      {satisfactionLevels.map((level) => (
                        <div key={level.value} className="flex justify-center">
                          <label className="cursor-pointer group">
                            <input
                              type="radio"
                              name={question.id}
                              value={level.value}
                              checked={responses[question.id] === level.value}
                              onChange={() => handleResponseChange(question.id, level.value)}
                              className="sr-only"
                            />
                            <div
                              className={`
                              w-6 h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center
                              ${
                                responses[question.id] === level.value
                                  ? `${level.color} border-white shadow-lg`
                                  : "border-gray-500 bg-gray-700 group-hover:border-gray-400 group-hover:bg-gray-600"
                              }
                            `}
                            >
                              {responses[question.id] === level.value && (
                                <div className="w-2 h-2 bg-white rounded-full" />
                              )}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center pt-6">
          <Button
            onClick={handleSubmit}
            disabled={!isComplete}
            size="lg"
            className={`
              px-12 py-4 text-lg font-semibold transition-all duration-200 rounded-xl
              ${
                isComplete
                  ? "bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-xl hover:scale-105"
                  : "bg-gray-700 text-gray-400 cursor-not-allowed"
              }
            `}
          >
            {isComplete ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                 Enviar Evaluación
              </div>
            ) : (
              "Enviar Evaluación"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
