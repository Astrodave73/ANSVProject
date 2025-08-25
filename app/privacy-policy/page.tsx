export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black text-gray-300 p-4 sm:p-6 md:p-10">
      <div className="max-w-4xl mx-auto bg-gray-900 border border-gray-700 rounded-lg p-6 sm:p-8">
        <a href="/" className="text-[#ff7700] hover:underline mb-6 block">
          &larr; Volver al registro
        </a>
        <h1 className="text-3xl font-bold text-white mb-6">
          Autorización para el Tratamiento de Datos Personales
        </h1>

        <div className="space-y-6 text-gray-300 leading-relaxed">
          <p>
            Aviso de PRIVACIDAD y AUTORIZACIÓN: En cumplimiento de la Ley 1581
            de 2012 y sus normas reglamentarias y complementarias autorizo a la
            Agencia nacional de Seguridad vial –ANSV- identificada con NIT
            900.852.998-5, como Responsable para tratar mis datos personales, en
            cumplimiento de su Política de Protección y Tratamiento de Datos
            Personales, la cual puede ser consultada en el siguiente enlace:{" "}
            <a
              href="https://ansv.gov.co/es/agencia/mipg/documentos/3760"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#ff7700] hover:underline"
            >
              https://ansv.gov.co/es/agencia/mipg/documentos/3760
            </a>
            , para que sean incluidos en sus bases de datos, para efectuar
            tratamiento de recolección, almacenamiento, uso, circulación,
            indexación y analítica, sobre los datos personales bajo la finalidad
            principal de la agencia y de acuerdo con la oferta institucional
            vigente además de la finalidad del registro o evidencia de la
            asistencia a la reunión o evento relacionado en el formato
            diligenciado; esta información podrá ser almacenada en archivos
            asociados a base de datos relacionadas con los eventos y reuniones
            de la dependencia que los citó a la sesión, en esa medida, declaro
            que la información suministrada es correcta, veraz, verificable y
            actualizada. Declaro que conozco el derecho a conocer, consultar,
            actualizar, rectificar y suprimir mi información, solicitar prueba
            de esta autorización y revocarla, los que puedo ejercer a través de
            los canales oficiales de la ANSV. SU ACEPTACIÓN SE PERFECCIONA al
            momento de diligenciar y/o firmar el presente documento bien sea de
            manera manuscrita o mediante el uso de firma electrónica dispuesta
            en el sistema electrónico adoptado por la agencia.
          </p>
        </div>
      </div>
    </div>
  );
}
