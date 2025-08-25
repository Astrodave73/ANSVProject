export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-gray-300 p-4 sm:p-6 md:p-10">
      <div className="max-w-4xl mx-auto bg-gray-900 border border-gray-700 rounded-lg p-6 sm:p-8">
        <a href="/" className="text-[#ff7700] hover:underline mb-6 block">
          &larr; Volver al registro
        </a>
        <h1 className="text-3xl font-bold text-white mb-6">
          Términos de confidencialidad
        </h1>

        <div className="space-y-6 text-gray-300 leading-relaxed">
          <p>
            Se garantiza la CONFIDENCIALIDAD de los datos suministrados y la
            protección de acuerdo con lo señalado en la Ley 1581 de 2012,
            además, se informará a las personas participantes en las actividades
            el contrato ANSV 078 de 2025 sobre el uso de los datos recogidos
            para la publicación de resultados de la investigación y desarrollo
            de estudios o acciones futuras sobre el tema.
          </p>
        </div>
      </div>
    </div>
  );
}
