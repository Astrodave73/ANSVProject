export default function EncuestaPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-4xl font-bold text-white mb-2">Página de Encuesta</h1>
        <p className="text-gray-400 text-lg">Aquí puedes integrar tu formulario de encuesta existente</p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Integra tu Formulario de Encuesta</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            Reemplaza este contenido con tu componente de formulario existente. La estructura modular te permite
            mantener toda la funcionalidad actual.
          </p>
        </div>
      </div>
    </div>
  )
}
