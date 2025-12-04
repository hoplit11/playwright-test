/**
 * -------------------------------------------------------------------------
 * 🧩 RESUMEN DEL HELPER
 * -------------------------------------------------------------------------
 * Este helper extrae un archivo DICOM crudo desde una respuesta
 * `multipart/related` típica de un Retrieve WADO-RS.
 * WADO-RS NO devuelve directamente un archivo .dcm, sino un bloque MIME:
 *   --boundary123
 *   Content-Type: application/dicom
 *
 *   <bytes del archivo DICOM>
 *   --boundary123--
 * Este helper:
 *   1. Lee el boundary del header Content-Type.
 *   2. Ubica el inicio del primer bloque MIME dentro del buffer.
 *   3. Salta los headers MIME (`\r\n\r\n`).
 *   4. Extrae únicamente los bytes del archivo DICOM.
 *   5. Ignora los demás boundaries.
 *
 * Resultado: retorna un Buffer que contiene SOLO el archivo DICOM puro.
 *
 * Esto permite:
 *   ✔ Parsearlo con dcmjs o DCMTK.
 *   ✔ Validar headers DICOM (p. ej. "DICM").
 *   ✔ Guardarlo en disco como evidencia.
 *
 * -------------------------------------------------------------------------
 */

export function extractDicomFromMultipart(
  buffer: Buffer,
  contentType: string
): Buffer {
  try {
    // Extraer boundary del Content-Type
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) {
      throw new Error('No se encontró boundary en Content-Type');
    }

    const boundary = boundaryMatch[1].replace(/"/g, '').trim();
    const boundaryBuffer = Buffer.from(`--${boundary}`);

    // Buscar inicio del primer boundary dentro del buffer
    let start = buffer.indexOf(boundaryBuffer);
    if (start === -1) {
      throw new Error('Boundary inicial no encontrado');
    }

    // Avanzar después del texto del boundary
    start += boundaryBuffer.length;

    // Buscar separación de headers MIME: "\r\n\r\n"
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), start);
    if (headerEnd === -1) {
      throw new Error('Headers MIME no encontrados');
    }

    const dicomStart = headerEnd + 4; // Saltar "\r\n\r\n"

    // Buscar el próximo boundary
    const nextBoundary = buffer.indexOf(boundaryBuffer, dicomStart);

    // Determinar final de los bytes del DICOM
    const dicomEnd = nextBoundary !== -1 ? nextBoundary - 2 : buffer.length;

    // Extraer SOLO los bytes del archivo DICOM
    return buffer.slice(dicomStart, dicomEnd);
  } catch (error: any) {
    console.error('❌ Error extrayendo DICOM:', error.message);
    throw error;
  }
}
